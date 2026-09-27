
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const STALE_MINUTES = 30

// Cancels AWAITING_PAYMENT orders that have sat unpaid for too long (customer
// opened the Paymob tab and never finished, or closed it). Without this,
// abandoned online-payment orders would stay invisible to staff forever -
// they're excluded from the cashier/kitchen views on purpose (see
// /api/pos/data), so nothing else ever cleans them up.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000)
    const result = await prisma.order.updateMany({
      where: { status: "AWAITING_PAYMENT" as any, createdAt: { lt: cutoff } },
      data: { status: "CANCELLED" as any },
    })
    return NextResponse.json({ ok: true, cancelled: result.count })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
