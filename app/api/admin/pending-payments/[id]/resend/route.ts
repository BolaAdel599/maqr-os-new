
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiSession } from "@/lib/security"
import { createPaymobPayment } from "@/lib/paymob"
import { sendWhatsApp, templates } from "@/lib/whatsapp"

// Staff-triggered resend: for when the customer lost the WhatsApp message
// entirely (deleted it, changed phones, etc.) rather than just closing the
// payment tab - that self-service case is handled directly on the
// customer's own waiting screen via /api/payment/paymob/create.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireApiSession(["RESTAURANT_ADMIN", "SUPER_ADMIN"])
  if (error) return error

  const order = await prisma.order.findUnique({ where: { id: params.id } })
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
  if (order.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (order.status !== "AWAITING_PAYMENT" || order.paymentStatus !== "PENDING") {
    return NextResponse.json({ error: "This order isn't awaiting online payment" }, { status: 400 })
  }
  if (!order.customerPhone) {
    return NextResponse.json({ error: "This order has no phone number to send the link to" }, { status: 400 })
  }

  try {
    const { iframeUrl } = await createPaymobPayment(order.id, order.total, {
      name: order.customerName || "Guest", phone: order.customerPhone,
    })
    const sent = await sendWhatsApp(order.customerPhone, templates.paymentLink(iframeUrl))
    return NextResponse.json({ ok: true, sent })
  } catch (e: any) {
    console.error("resend paymob link error", e)
    return NextResponse.json({ error: e.message || "Payment provider error" }, { status: 500 })
  }
}
