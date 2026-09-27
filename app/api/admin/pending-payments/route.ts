
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiSession } from "@/lib/security"

// Orders stuck at AWAITING_PAYMENT (customer started an online payment and
// never finished it). These are deliberately hidden from the normal
// kitchen/cashier views since they aren't paid yet - this is the one place
// staff can see and, if needed, cancel them early instead of waiting for
// the 30-minute auto-expiry cron (/api/cron/expire-pending-payments).
export async function GET() {
  const { session, error } = await requireApiSession(["RESTAURANT_ADMIN", "SUPER_ADMIN"])
  if (error) return error
  const restaurantId = session.user.restaurantId
  if (!restaurantId) return NextResponse.json({ error: "No restaurant on this account" }, { status: 400 })

  const orders = await prisma.order.findMany({
    where: { restaurantId, status: "AWAITING_PAYMENT" as any },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({ orders })
}
