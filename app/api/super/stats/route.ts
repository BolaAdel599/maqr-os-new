
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiSession } from "@/lib/security"

export async function GET() {
  const { error } = await requireApiSession(["SUPER_ADMIN"])
  if (error) return error

  const restaurants = await prisma.restaurant.findMany({ orderBy: { createdAt: "desc" } })
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [ordersToday] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: startOfDay } } }),
  ])

  const mrr = restaurants
    .filter((r) => r.subscriptionStatus !== "EXPIRED")
    .reduce((s, r) => s + (r.planPrice || 0), 0)
  const activeCount = restaurants.filter((r) => r.subscriptionStatus === "ACTIVE").length
  const graceCount = restaurants.filter((r) => r.subscriptionStatus === "GRACE").length

  return NextResponse.json({
    mrr, activeCount, graceCount, ordersToday,
    restaurants: restaurants.map((r) => ({
      id: r.id, name: r.name, domain: r.domain, slug: r.slug,
      subscriptionStatus: r.subscriptionStatus, subscriptionEnd: r.subscriptionEnd, planPrice: r.planPrice,
    })),
  })
}
