
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiSession } from "@/lib/security"

// Returns tables, menu, and open orders for the logged-in cashier's own
// restaurant. Previously the cashier page had all of this hardcoded.
export async function GET() {
  const { session, error } = await requireApiSession(["CASHIER", "RESTAURANT_ADMIN", "SUPER_ADMIN"])
  if (error) return error
  const restaurantId = session.user.restaurantId
  if (!restaurantId) return NextResponse.json({ error: "No restaurant on this account" }, { status: 400 })

  const [tables, categories, openOrders] = await Promise.all([
    prisma.table.findMany({ where: { restaurantId }, orderBy: { number: "asc" } }),
    prisma.menuCategory.findMany({ where: { restaurantId }, orderBy: { order: "asc" }, include: { items: { where: { available: true } } } }),
    // Exclude AWAITING_PAYMENT: those are customer-initiated online-payment
    // orders still mid-checkout - the cashier shouldn't see or touch them
    // until the Paymob webhook confirms payment and moves them to NEW.
    prisma.order.findMany({ where: { restaurantId, status: { notIn: ["DELIVERED", "CANCELLED", "AWAITING_PAYMENT"] } } }),
  ])

  return NextResponse.json({ tables, categories, openOrders })
}
