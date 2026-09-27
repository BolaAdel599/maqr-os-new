
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Deliberately minimal + public: the customer's browser polls this right
// after placing an order to know when kitchen/payment status changes,
// without needing an account. Only returns non-sensitive fields (no
// customer info, no restaurant internals) - never the full order.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    select: { id: true, orderNumber: true, status: true, paymentStatus: true },
  })
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
  return NextResponse.json(order)
}
