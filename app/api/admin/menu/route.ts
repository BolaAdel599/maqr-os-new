
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiSession } from "@/lib/security"

// Full menu (categories + all items, including unavailable ones) for the
// logged-in restaurant admin to manage. Unlike /api/menu (the public
// customer-facing one), this shows everything regardless of availability.
export async function GET() {
  const { session, error } = await requireApiSession(["RESTAURANT_ADMIN", "SUPER_ADMIN"])
  if (error) return error
  const restaurantId = session.user.restaurantId
  if (!restaurantId) return NextResponse.json({ error: "No restaurant on this account" }, { status: 400 })

  const categories = await prisma.menuCategory.findMany({
    where: { restaurantId },
    orderBy: { order: "asc" },
    include: { items: { orderBy: { name: "asc" } } },
  })

  return NextResponse.json({ categories })
}
