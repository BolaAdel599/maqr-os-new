
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiSession } from "@/lib/security"

export async function POST(req: NextRequest) {
  const { session, error } = await requireApiSession(["RESTAURANT_ADMIN", "SUPER_ADMIN"])
  if (error) return error
  const restaurantId = session.user.restaurantId
  if (!restaurantId) return NextResponse.json({ error: "No restaurant on this account" }, { status: 400 })

  const { name, price, categoryId, image, available } = await req.json()
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Item name is required" }, { status: 400 })
  }
  const numericPrice = Number(price)
  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    return NextResponse.json({ error: "Price must be a positive number" }, { status: 400 })
  }
  if (!categoryId) return NextResponse.json({ error: "Category is required" }, { status: 400 })

  const category = await prisma.menuCategory.findUnique({ where: { id: categoryId } })
  if (!category || category.restaurantId !== restaurantId) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 })
  }

  const item = await prisma.menuItem.create({
    data: {
      name: name.trim(),
      price: numericPrice,
      categoryId,
      restaurantId,
      image: image || undefined,
      available: available !== false,
    },
  })
  return NextResponse.json(item)
}
