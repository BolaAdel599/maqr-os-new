
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { rateLimit, requireApiSession, checkOrderLock, registerFailedAttempt, resetAttempts } from "@/lib/security"

export async function POST(req: Request) {
  try {
    const { session, error } = await requireApiSession(["DRIVER", "RESTAURANT_ADMIN", "SUPER_ADMIN"])
    if (error) return error

    const { orderId, code } = await req.json()
    if (!rateLimit(`verify:${orderId}`, 20, 60000)) {
      return NextResponse.json({ error: "Too many attempts" }, { status: 429 })
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    if (session.user.role !== "SUPER_ADMIN" && order.restaurantId !== session.user.restaurantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (order.status === "DELIVERED") {
      return NextResponse.json({ error: "ALREADY_DELIVERED" }, { status: 409 })
    }

    // DB-backed lock, not in-memory - survives across serverless invocations.
    const { locked } = await checkOrderLock(orderId)
    if (locked) {
      return NextResponse.json({ error: "Too many failed attempts, try again later" }, { status: 429 })
    }

    if (order.verificationCode !== code) {
      const attempts = await registerFailedAttempt(orderId, order.attempts)
      return NextResponse.json({ error: "Invalid code", attempts }, { status: 400 })
    }

    await resetAttempts(orderId)
    const updated = await prisma.order.update({ where: { id: orderId }, data: { status: "DELIVERED" as any } })

    if (order.driverId) {
      const deliveryFee = Number(process.env.DRIVER_DELIVERY_FEE) || 20
      await prisma.driver.update({
        where: { id: order.driverId },
        data: { status: "AVAILABLE", earnings: { increment: deliveryFee } },
      })
    }

    return NextResponse.json({ ok: true, order: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
