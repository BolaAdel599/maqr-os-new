
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiSession } from "@/lib/security"

export async function POST(req: NextRequest) {
  const { session, error } = await requireApiSession(["RESTAURANT_ADMIN", "SUPER_ADMIN"])
  if (error) return error
  const restaurantId = session.user.restaurantId
  if (!restaurantId) return NextResponse.json({ error: "No restaurant on this account" }, { status: 400 })

  const { name } = await req.json()
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Category name is required" }, { status: 400 })
  }

  const count = await prisma.menuCategory.count({ where: { restaurantId } })
  const category = await prisma.menuCategory.create({
    data: { name: name.trim(), order: count, restaurantId },
  })
  return NextResponse.json(category)
}
