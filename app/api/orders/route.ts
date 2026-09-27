
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { rateLimit, getRestaurantByDomain, requireApiSession } from "@/lib/security"
import { sendWhatsApp, templates } from "@/lib/whatsapp"
import { pusherServer } from "@/lib/pusher"
import { createPaymobPayment } from "@/lib/paymob"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { items, tableNumber, tableId, customerName, customerPhone, restaurantSlug, source, address, paymentMethod } = body

    if (!rateLimit(`order:${customerPhone || tableNumber}`, 5, 60000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 })
    }

    let restaurantId = body.restaurantId
    if (restaurantSlug) {
      const r = await prisma.restaurant.findUnique({ where: { slug: restaurantSlug } })
      restaurantId = r?.id
    }
    if (!restaurantId) {
      const host = req.headers.get("host") || ""
      const r = await getRestaurantByDomain(host)
      restaurantId = r?.id
    }
    if (!restaurantId) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } })
    if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
    if (restaurant.subscriptionStatus === "EXPIRED") {
      return NextResponse.json({ error: "Restaurant subscription expired" }, { status: 403 })
    }

    // Delivery orders must have an address.
    const orderSource = source === "DELIVERY" ? "DELIVERY" : (source === "CASHIER" ? "CASHIER" : "QR")
    if (orderSource === "DELIVERY" && (!address || !address.text)) {
      return NextResponse.json({ error: "Address required for delivery" }, { status: 400 })
    }

    // NEVER trust the client's total or per-item price. Recompute from the
    // menu items actually stored for this restaurant, and clamp quantities.
    const menuItemIds = items.map((it: any) => it.id).filter(Boolean)
    const dbItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, restaurantId, available: true },
    })
    const dbItemsById = new Map<string, typeof dbItems[number]>(dbItems.map((m) => [m.id, m]))

    let addedTotal = 0
    const newItems: any[] = []
    for (const it of items) {
      const dbItem = dbItemsById.get(it.id)
      if (!dbItem) {
        return NextResponse.json({ error: `Item not available: ${it.name || it.id}` }, { status: 400 })
      }
      const qty = Math.min(Math.max(parseInt(it.qty) || 1, 1), 20) // clamp 1-20
      addedTotal += dbItem.price * qty
      newItems.push({ id: dbItem.id, name: dbItem.name, price: dbItem.price, qty })
    }

    // If this table already has an open (unpaid) order, add these items to
    // it as a new round instead of creating a second, separate order - a
    // second round used to create a duplicate order that /api/pos/pay could
    // never find, leaving it stuck open forever.
    const existingOrderId = body.existingOrderId
    if (existingOrderId) {
      const existing = await prisma.order.findUnique({ where: { id: existingOrderId } })
      if (!existing || existing.restaurantId !== restaurantId) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 })
      }
      if (existing.status === "DELIVERED" || existing.status === "CANCELLED") {
        return NextResponse.json({ error: "Order already closed" }, { status: 400 })
      }
      const mergedItems = [...(existing.items as any[]), ...newItems]
      const updated = await prisma.order.update({
        where: { id: existingOrderId },
        data: { items: mergedItems, total: existing.total + addedTotal },
      })
      try {
        await pusherServer.trigger(`restaurant-${restaurantId}-kitchen`, "order:updated", updated)
      } catch {}
      return NextResponse.json({ ok: true, order: updated })
    }

    const order = await prisma.order.create({
      data: {
        restaurantId,
        items: newItems,
        total: addedTotal,
        tableNumber: tableNumber ? parseInt(tableNumber) : null,
        tableId: tableId || null,
        customerName,
        customerPhone,
        source: orderSource as any,
        address: orderSource === "DELIVERY" ? address : undefined,
        // Choosing to pay online holds the order out of the kitchen queue
        // until the Paymob webhook confirms payment (see /api/payment/webhook).
        paymentMethod: paymentMethod === "CARD" ? "CARD" : "CASH",
        status: paymentMethod === "CARD" ? "AWAITING_PAYMENT" as any : "NEW" as any,
        // Delivery orders need a code the driver can verify at the door.
        // This used to never be generated anywhere, so /api/driver/verify
        // was unreachable for every delivery order (verificationCode was
        // always null).
        verificationCode: orderSource === "DELIVERY" ? String(Math.floor(1000 + Math.random() * 9000)) : null,
      }
    })

    if (orderSource === "DELIVERY" && order.verificationCode && customerPhone) {
      if (order.status === "AWAITING_PAYMENT") {
        // Online-pay delivery order: send a payment link instead of the
        // delivery code - the code goes out later, once the webhook
        // confirms the order is actually paid (see /api/payment/webhook).
        try {
          const { iframeUrl } = await createPaymobPayment(order.id, order.total, {
            name: customerName || "Guest", phone: customerPhone,
          })
          await sendWhatsApp(customerPhone, templates.paymentLink(iframeUrl))
        } catch (e) {
          console.error("paymob link for delivery order failed", e)
        }
      } else {
        try { await sendWhatsApp(customerPhone, templates.verificationCode(order.verificationCode)) } catch {}
      }
    }

    try {
      await pusherServer.trigger(`restaurant-${restaurantId}`, "new-order", order)
      await pusherServer.trigger(`kitchen-${restaurantId}`, "new-order", order)
    } catch {}

    return NextResponse.json({ ok: true, order })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Listing orders is restaurant-internal data (customer names/phones/totals),
// so it now requires a logged-in staff session scoped to that restaurant.
export async function GET(req: NextRequest) {
  try {
    const { session, error } = await requireApiSession(["RESTAURANT_ADMIN", "CASHIER", "KITCHEN", "DRIVER", "SUPER_ADMIN"])
    if (error) return error

    const { searchParams } = new URL(req.url)
    const requestedRestaurantId = searchParams.get("restaurantId")
    const restaurantId = session.user.role === "SUPER_ADMIN" ? requestedRestaurantId : session.user.restaurantId

    if (!restaurantId) return NextResponse.json([])
    if (session.user.role !== "SUPER_ADMIN" && requestedRestaurantId && requestedRestaurantId !== session.user.restaurantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const orders = await prisma.order.findMany({ where: { restaurantId }, orderBy: { createdAt: "desc" }, take: 50 })
    return NextResponse.json(orders)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
