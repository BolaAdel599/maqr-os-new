
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiSession } from "@/lib/security"

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireApiSession(["RESTAURANT_ADMIN", "SUPER_ADMIN"])
  if (error) return error
  const restaurantId = session.user.restaurantId

  const item = await prisma.menuItem.findUnique({ where: { id: params.id } })
  if (!item || item.restaurantId !== restaurantId) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 })
  }

  const { name, price, categoryId, image, available } = await req.json()
  const data: any = {}
  if (typeof name === "string" && name.trim()) data.name = name.trim()
  if (price !== undefined) {
    const numericPrice = Number(price)
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      return NextResponse.json({ error: "Price must be a positive number" }, { status: 400 })
    }
    data.price = numericPrice
  }
  if (categoryId) {
    const category = await prisma.menuCategory.findUnique({ where: { id: categoryId } })
    if (!category || category.restaurantId !== restaurantId) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }
    data.categoryId = categoryId
  }
  if (typeof image === "string") data.image = image
  if (typeof available === "boolean") data.available = available
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })

  const updated = await prisma.menuItem.update({ where: { id: params.id }, data })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireApiSession(["RESTAURANT_ADMIN", "SUPER_ADMIN"])
  if (error) return error
  const restaurantId = session.user.restaurantId

  const item = await prisma.menuItem.findUnique({ where: { id: params.id } })
  if (!item || item.restaurantId !== restaurantId) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 })
  }

  await prisma.menuItem.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
