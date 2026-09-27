
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiSession } from "@/lib/security"

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireApiSession(["RESTAURANT_ADMIN", "SUPER_ADMIN"])
  if (error) return error
  const restaurantId = session.user.restaurantId

  const category = await prisma.menuCategory.findUnique({ where: { id: params.id } })
  if (!category || category.restaurantId !== restaurantId) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 })
  }

  const { name, order } = await req.json()
  const data: any = {}
  if (typeof name === "string" && name.trim()) data.name = name.trim()
  if (typeof order === "number") data.order = order
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })

  const updated = await prisma.menuCategory.update({ where: { id: params.id }, data })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireApiSession(["RESTAURANT_ADMIN", "SUPER_ADMIN"])
  if (error) return error
  const restaurantId = session.user.restaurantId

  const category = await prisma.menuCategory.findUnique({ where: { id: params.id } })
  if (!category || category.restaurantId !== restaurantId) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 })
  }

  // Cascades to delete its MenuItems too (schema: onDelete Cascade).
  await prisma.menuCategory.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
