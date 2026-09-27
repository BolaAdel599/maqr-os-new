
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

type Order = { id:string, orderNumber:number, tableNumber:number|null, source:string, items:any[], total:number, status:string, createdAt:string }

export default function Kitchen(){
  const { data: session } = useSession()
  const restaurantId = (session?.user as any)?.restaurantId
  const [orders, setOrders] = useState<Order[]>([])
  const [now, setNow] = useState(Date.now())

  useEffect(()=>{ const t=setInterval(()=>setNow(Date.now()),1000); return ()=>clearInterval(t)},[])

  const refresh = useCallback(async ()=>{
    if(!restaurantId) return
    try {
      const res = await fetch(`/api/orders?restaurantId=${restaurantId}`)
      if(!res.ok) return
      const data = await res.json()
      setOrders(data.filter((o:Order)=>o.status==='NEW' || o.status==='IN_KITCHEN'))
    } catch {}
  },[restaurantId])

  // Polling keeps this working even without Pusher credentials configured.
  useEffect(()=>{
    refresh()
    const t = setInterval(refresh, 4000)
    return ()=>clearInterval(t)
  },[refresh])

  const updateStatus = async (id:string, status:string)=>{
    setOrders(o=>o.map(x=>x.id===id?{...x,status}:x)) // optimistic
    try{
      const res = await fetch(`/api/orders/${id}/status`, {
        method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status })
      })
      if(!res.ok) refresh() // roll back to server truth on failure
      else if(status==='READY') refresh()
    } catch { refresh() }
  }

  const start = (id:string)=> updateStatus(id, 'IN_KITCHEN')
  const ready = (id:string)=> updateStatus(id, 'READY')

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white p-4" dir="rtl">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">المطبخ KDS 🔥</h1>
        <div className="flex gap-3 text-sm">
          <div className="bg-white/10 rounded-full px-3 py-1">{orders.length} اوردرات</div>
          <div className="bg-green-500/20 text-green-400 rounded-full px-3 py-1">متصل</div>
        </div>
      </header>
      {orders.length===0 ? (
        <div className="h-[60vh] flex flex-col items-center justify-center text-white/50"><div className="text-6xl mb-4">👨‍🍳</div><p>المطبخ فاضي - مستني اوردرات</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
          {orders.map(o=>{
            const mins = Math.floor((now - new Date(o.createdAt).getTime())/60000)
            const color = mins<10?'border-green-500':mins<20?'border-yellow-500':'border-red-500 animate-pulse'
            return (
              <div key={o.id} className={`bg-[#171717] rounded-[16px] border-2 ${color} p-4`}>
                <div className="flex justify-between items-start">
                  <div><div className="text-2xl font-bold">#{o.orderNumber}</div><div className="text-xs bg-white/10 rounded-full px-2 py-1 mt-1 inline-block">{o.source==='DELIVERY' ? '🏍️ دليفري' : `ترابيزة ${o.tableNumber ?? '-'}`}</div></div>
                  <div className={`text-sm px-3 py-1 rounded-full ${mins<10?'bg-green-500/20 text-green-400':mins<20?'bg-yellow-500/20 text-yellow-400':'bg-red-500/20 text-red-400'}`}>{mins} د</div>
                </div>
                <div className="mt-4 space-y-1 text-sm">
                  {o.items.map((it:any,i:number)=><div key={i} className="flex justify-between"><span>{it.qty}× {it.name}</span></div>)}
                </div>
                <div className="mt-4">
                  {o.status==='NEW' ? <button onClick={()=>start(o.id)} className="w-full bg-[#FF6B2B] rounded-full py-3 font-bold min-h-[56px]">بدء التحضير</button>
                  : <button onClick={()=>ready(o.id)} className="w-full bg-green-500 rounded-full py-3 font-bold min-h-[56px]">جاهز ✅</button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
