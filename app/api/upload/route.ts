
import { NextRequest, NextResponse } from "next/server"
import { requireApiSession } from "@/lib/security"
import { uploadToR2 } from "@/lib/r2"

const MAX_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

export async function POST(req: NextRequest) {
  const { error } = await requireApiSession(["RESTAURANT_ADMIN", "SUPER_ADMIN"])
  if (error) return error

  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only jpeg/png/webp images are allowed" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const extension = file.type.split("/")[1]
    const url = await uploadToR2({ buffer, contentType: file.type, extension })
    return NextResponse.json({ url })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
