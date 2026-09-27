
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CONFLICT_WINDOW_MS = 2 * 60 * 60 * 1000 // 2 hours

export async function POST(req: NextRequest){
  const { restaurantId, tableNumber, name, phone, time, people } = await req.json()
  if(!name || !phone || !time || !restaurantId || !tableNumber) {
    return NextResponse.json({error:'Missing fields'}, {status:400})
  }

  const requestedTime = new Date(time)
  if (isNaN(requestedTime.getTime()) || requestedTime.getTime() < Date.now() - 60000) {
    return NextResponse.json({error:'Invalid reservation time'}, {status:400})
  }

  const table = await prisma.table.findFirst({ where:{ number: Number(tableNumber), restaurantId } })
  if(!table) return NextResponse.json({error:'Table not found'}, {status:404})

  // Real conflict check: only block if there's an existing reservation for
  // this table within +/- 2 hours of the requested time.
  if (table.status === 'RESERVED' && table.reservedTime) {
    const diff = Math.abs(table.reservedTime.getTime() - requestedTime.getTime())
    if (diff < CONFLICT_WINDOW_MS) {
      return NextResponse.json({error:'Table already reserved around that time'}, {status:409})
    }
  }

  const updated = await prisma.table.update({
    where:{id:table.id},
    data:{ status:'RESERVED', reservedName:name, reservedPhone:phone, reservedTime: requestedTime, people: Number(people)||2 }
  })
  return NextResponse.json(updated)
}
