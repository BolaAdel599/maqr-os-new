
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createPaymobPayment } from "@/lib/paymob"
import { rateLimit } from "@/lib/security"

// Public (the customer isn't logged in at the QR ordering stage), but tightly
// scoped: only works for an order that is genuinely AWAITING_PAYMENT and
// still PENDING, and the order's own total is used (never a client-sent
// amount) - so this can't be used to pay an arbitrary amount for anything.
export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json()
    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 })

    if (!rateLimit(`paymob-create:${orderId}`, 5, 60000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    if (order.status !== "AWAITING_PAYMENT" || order.paymentStatus !== "PENDING") {
      return NextResponse.json({ error: "This order isn't awaiting online payment" }, { status: 400 })
    }

    const { iframeUrl } = await createPaymobPayment(orderId, order.total, {
      name: order.customerName || "Guest",
      phone: order.customerPhone || "01000000000",
    })

    return NextResponse.json({ iframeUrl })
  } catch (e: any) {
    console.error("paymob create error", e)
    return NextResponse.json({ error: e.message || "Payment provider error" }, { status: 500 })
  }
}
