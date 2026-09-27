
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPaymobHmac } from '@/lib/security'
import { pusherServer } from '@/lib/pusher'
import { sendWhatsApp, templates } from '@/lib/whatsapp'

export async function POST(req: NextRequest){
  const body = await req.json()
  const { searchParams } = new URL(req.url)
  // Paymob sends the hmac as a query param on the callback URL, not just a header/body field.
  const hmac = searchParams.get('hmac') || req.headers.get('x-paymob-hmac') || body.hmac || ''

  const obj = body.obj || body

  // Verify HMAC - CRITICAL. Fail closed: if the secret isn't configured, or the
  // signature doesn't check out, we reject. We never trust an unsigned callback.
  if (!process.env.PAYMOB_HMAC) {
    console.error('PAYMOB_HMAC not configured - rejecting webhook')
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }
  const valid = verifyPaymobHmac(obj, hmac)
  if (!valid) return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 })

  const merchantOrderId = obj.merchant_order_id || obj.order?.merchant_order_id
  const success = obj.success
  const transactionId = String(obj.id)
  const paymobOrderId = String(obj.order?.id || obj.order_id)

  if(!merchantOrderId) return NextResponse.json({error:'Missing order id'}, {status:400})

  // Idempotent: check if already paid
  const existing = await prisma.order.findUnique({ where:{id: merchantOrderId} })
  if(!existing) return NextResponse.json({error:'Order not found'}, {status:404})
  if(existing.paymentStatus==='PAID') return NextResponse.json({ success:true, message:'Already paid' })

  if(success){
    const updated = await prisma.order.update({
      where:{id: merchantOrderId},
      data:{ paymentStatus:'PAID', paymobTransactionId: transactionId, paymobOrderId, status:'NEW' }
    })
    await pusherServer.trigger(`restaurant-${existing.restaurantId}-kitchen`, 'order:new', updated)

    // The delivery verification code was deliberately withheld at order
    // creation for online-pay delivery orders (a payment link was sent
    // instead) - now that payment is actually confirmed, send it.
    if (updated.source === 'DELIVERY' && updated.verificationCode && updated.customerPhone) {
      try { await sendWhatsApp(updated.customerPhone, templates.verificationCode(updated.verificationCode)) } catch {}
    }

    return NextResponse.json({ success:true })
  } else {
    await prisma.order.update({ where:{id: merchantOrderId}, data:{ paymentStatus:'FAILED' } })
    return NextResponse.json({ success:false })
  }
}
