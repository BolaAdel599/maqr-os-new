
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiSession } from "@/lib/security"

// List this restaurant's delivery drivers (roster), and expose the caller's
// own Driver profile (if their User account is linked to one) so the driver
// app can find "my orders" instead of showing everyone's deliveries.
export async function GET() {
  const { session, error } = await requireApiSession(["DRIVER", "CASHIER", "RESTAURANT_ADMIN", "SUPER_ADMIN"])
  if (error) return error
  const restaurantId = session.user.restaurantId
  if (!restaurantId) return NextResponse.json({ error: "No restaurant on this account" }, { status: 400 })

  const drivers = await prisma.driver.findMany({ where: { restaurantId } })
  const me = drivers.find((d) => d.userId === session.user.id) || null

  return NextResponse.json({ drivers, me })
}
