
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiSession } from "@/lib/security"
import { pusherServer } from "@/lib/pusher"

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  // Staff can only cancel an AWAITING_PAYMENT order (e.g. customer changed
  // their mind, or it's stale) - never force it straight into the kitchen
  // manually, since that would defeat the whole point of gating on payment.
  AWAITING_PAYMENT: ["CANCELLED"],
  NEW: ["IN_KITCHEN", "CANCELLED"],
  IN_KITCHEN: ["READY", "CANCELLED"],
  READY: ["OUT_FOR_DELIVERY", "DELIVERED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireApiSession(["KITCHEN", "CASHIER", "RESTAURANT_ADMIN", "SUPER_ADMIN"])
  if (error) return error

  const { status, driverId } = await req.json()
  const order = await prisma.order.findUnique({ where: { id: params.id } })
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
  if (session.user.role !== "SUPER_ADMIN" && order.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const allowedNext = ALLOWED_TRANSITIONS[order.status] || []
  if (!allowedNext.includes(status)) {
    return NextResponse.json({ error: `Cannot move from ${order.status} to ${status}` }, { status: 400 })
  }

  const data: any = { status }
  if (status === "IN_KITCHEN") data.startedAt = new Date()
  if (status === "READY") data.readyAt = new Date()

  // A delivery order moving to OUT_FOR_DELIVERY must be assigned to a real,
  // available driver from this restaurant - not left as a dangling status.
  if (status === "OUT_FOR_DELIVERY" && order.source === "DELIVERY") {
    if (!driverId) return NextResponse.json({ error: "driverId required for delivery orders" }, { status: 400 })
    const driver = await prisma.driver.findUnique({ where: { id: driverId } })
    if (!driver || driver.restaurantId !== order.restaurantId) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 })
    }
    data.driverId = driverId
  }

  const updated = await prisma.order.update({ where: { id: params.id }, data })

  if (status === "OUT_FOR_DELIVERY" && data.driverId) {
    await prisma.driver.update({ where: { id: data.driverId }, data: { status: "ON_DELIVERY" } })
  }
  if (status === "DELIVERED" && order.driverId) {
    await prisma.driver.update({ where: { id: order.driverId }, data: { status: "AVAILABLE" } })
  }

  try {
    await pusherServer.trigger(`restaurant-${order.restaurantId}-kitchen`, "order:updated", updated)
    await pusherServer.trigger(`restaurant-${order.restaurantId}-cashier`, "order:updated", updated)
  } catch {}

  return NextResponse.json(updated)
}
