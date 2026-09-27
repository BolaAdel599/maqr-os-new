
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendWhatsApp, templates } from "@/lib/whatsapp"

export async function GET(req: Request) {
  // Verify cron secret - this now actually blocks unauthorized calls.
  const authHeader = req.headers.get("authorization")
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const restaurants = await prisma.restaurant.findMany()
    const now = new Date()

    for (const r of restaurants) {
      const diffTime = r.subscriptionEnd.getTime() - now.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays <= 0 && r.subscriptionStatus !== 'EXPIRED') {
        await prisma.restaurant.update({ where: { id: r.id }, data: { subscriptionStatus: 'EXPIRED' as any } })
        await prisma.subscriptionLog.create({ data: { restaurantId: r.id, oldStatus: r.subscriptionStatus as any, newStatus: 'EXPIRED' as any } })
      } else if (diffDays <= 2 && diffDays > 0 && r.subscriptionStatus === 'ACTIVE') {
        await prisma.restaurant.update({ where: { id: r.id }, data: { subscriptionStatus: 'GRACE' as any } })
        await prisma.subscriptionLog.create({ data: { restaurantId: r.id, oldStatus: 'ACTIVE' as any, newStatus: 'GRACE' as any } })
        try {
          await sendWhatsApp(r.ownerPhone, templates.subscription(r.name, diffDays))
        } catch {}
      }
    }

    return NextResponse.json({ ok: true, checked: restaurants.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
