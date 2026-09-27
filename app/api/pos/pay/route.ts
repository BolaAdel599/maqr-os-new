
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pusherServer } from '@/lib/pusher'
import { requireApiSession } from '@/lib/security'

export async function POST(req: NextRequest){
  const { session, error } = await requireApiSession(["CASHIER", "RESTAURANT_ADMIN", "SUPER_ADMIN"])
  if (error) return error

  const { orderId, paymentMethod, discount } = await req.json()
  const order = await prisma.order.findUnique({ where:{id:orderId} })
  if(!order) return NextResponse.json({error:'Not found'}, {status:404})
  if (session.user.role !== "SUPER_ADMIN" && order.restaurantId !== session.user.restaurantId) {
    return NextResponse.json({error:'Forbidden'}, {status:403})
  }
  const restaurantId = order.restaurantId
  if(order.status==='DELIVERED') return NextResponse.json({error:'Already paid'}, {status:400})
  if(order.status==='AWAITING_PAYMENT') {
    return NextResponse.json({ error: 'This order is still awaiting its own online payment' }, { status: 400 })
  }

  const disc = Math.min(Math.max(Number(discount)||0,0),50) // max 50%
  const finalTotal = order.total * (1 - disc/100)

  const updated = await prisma.order.update({
    where:{id:orderId},
    data:{ status:'DELIVERED', paymentMethod, paymentStatus:'PAID', total: finalTotal }
  })

  // Free table
  if(order.tableId){
    await prisma.table.update({ where:{id:order.tableId}, data:{ status:'AVAILABLE' } })
  }

  await pusherServer.trigger(`restaurant-${restaurantId}-cashier`, 'order:paid', updated)
  return NextResponse.json(updated)
}
