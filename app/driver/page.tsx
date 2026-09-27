
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

type Order = { id:string, orderNumber:number, address:any, customerPhone:string|null, status:string, driverId:string|null }

export default function Driver(){
  const { data: session } = useSession()
  const restaurantId = (session?.user as any)?.restaurantId
  const [myDriverId, setMyDriverId] = useState<string|null>(null)
  const [code, setCode] = useState(['','','',''])
  const [order, setOrder] = useState<Order|null>(null)
  const [delivered, setDelivered] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(()=>{
    (async ()=>{
      try {
        const res = await fetch('/api/drivers')
        if(!res.ok) return
        const data = await res.json()
        setMyDriverId(data.me?.id || null)
      } catch {}
    })()
  },[])

  const refresh = useCallback(async ()=>{
    if(!restaurantId) return
    try {
      const res = await fetch(`/api/orders?restaurantId=${restaurantId}`)
      if(!res.ok) return
      const data = await res.json()
      // Only orders assigned to ME (this login's linked Driver profile).
      const mine = data.find((o:Order)=>o.status==='OUT_FOR_DELIVERY' && (!myDriverId || o.driverId===myDriverId))
      setOrder(mine || null)
    } catch {}
  },[restaurantId, myDriverId])

  useEffect(()=>{ refresh(); const t=setInterval(refresh, 5000); return ()=>clearInterval(t) },[refresh])

  const check = async ()=>{
    if(!order) return
    setErrorMsg('')
    try{
      const res = await fetch('/api/driver/verify', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderId: order.id, code: code.join('') })
      })
      const data = await res.json()
      if(!res.ok){ setErrorMsg(data.error==='ALREADY_DELIVERED' ? 'الأوردر ده اتوصل بالفعل' : (data.error || 'كود غلط!')); return }
      setDelivered(true)
    } catch { setErrorMsg('تعذر الاتصال بالسيرفر') }
  }

  if(delivered) return <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-6 text-white" dir="rtl"><div className="text-center"><div className="text-6xl">🎉</div><h2 className="text-2xl font-bold mt-4">تم التوصيل!</h2></div></div>

  if(!myDriverId) return <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-6 text-white/60 text-center" dir="rtl">حسابك مش مربوط بملف طيار في المطعم - كلم الأدمن</div>
  if(!order) return <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-6 text-white/60" dir="rtl">مفيش أوردرات موصّلة ليك دلوقتي</div>

  const address = order.address?.text || order.address || ''

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white p-4 max-w-[480px] mx-auto" dir="rtl">
      <h1 className="text-xl font-bold">تطبيق الطيار 🏍️</h1>
      <div className="mt-6 bg-[#171717] rounded-[16px] p-4 border border-white/10">
        <div className="flex justify-between"><span className="font-bold text-lg">#{order.orderNumber}</span><span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full">{order.status}</span></div>
        <p className="text-sm text-white/70 mt-3">📍 {address}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {order.customerPhone && <a href={`tel:${order.customerPhone}`} className="bg-white text-black rounded-full py-3 text-center text-sm font-bold">📞 اتصل</a>}
          <a href={`https://maps.google.com/?q=${encodeURIComponent(address)}`} target="_blank" className="bg-white/10 rounded-full py-3 text-center text-sm">🗺️ الخريطة</a>
        </div>
        <div className="mt-6">
          <p className="text-sm mb-3">ادخل كود الاستلام من العميل:</p>
          <div className="flex gap-2 justify-center">
            {code.map((c,i)=><input key={i} value={c} onChange={e=>{const v=e.target.value.slice(-1); const nc=[...code]; nc[i]=v; setCode(nc); if(v && i<3) document.getElementById(`code-${i+1}`)?.focus()}} id={`code-${i}`} className="w-14 h-14 bg-white/10 border border-white/20 rounded-xl text-center text-xl font-bold"/>)}
          </div>
          {errorMsg && <p className="text-red-400 text-xs mt-2 text-center">{errorMsg}</p>}
          <button onClick={check} className="w-full mt-4 bg-[#FF6B2B] rounded-full py-3 font-bold min-h-[56px]">تأكيد التوصيل</button>
        </div>
      </div>
    </div>
  )
}
