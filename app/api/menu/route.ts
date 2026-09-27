
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getRestaurantByDomain } from "@/lib/security"

// Public endpoint: resolves the restaurant for the current domain (or an
// explicit ?slug=), and returns its menu + (optionally) a specific table.
// This is what the QR ordering page should call instead of hardcoding
// "demo-restaurant" and a static menu array.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get("slug")
  const tableNumber = searchParams.get("tableNumber")

  let restaurant = null
  if (slug) {
    restaurant = await prisma.restaurant.findUnique({ where: { slug } })
  } else {
    const host = req.headers.get("host") || ""
    restaurant = await getRestaurantByDomain(host)
  }
  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })
  if (restaurant.subscriptionStatus === "EXPIRED") {
    return NextResponse.json({ error: "Restaurant subscription expired" }, { status: 403 })
  }

  const categories = await prisma.menuCategory.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { order: "asc" },
    include: { items: { where: { available: true } } },
  })

  let table = null
  if (tableNumber) {
    table = await prisma.table.findFirst({
      where: { restaurantId: restaurant.id, number: Number(tableNumber) },
    })
    if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 })
  }

  return NextResponse.json({
    restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug },
    categories,
    table,
  })
}
