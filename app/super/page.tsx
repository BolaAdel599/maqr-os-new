
'use client'
import { useState, useEffect } from 'react'

type Restaurant = { id:string, name:string, domain:string|null, slug:string, subscriptionStatus:string, subscriptionEnd:string, planPrice:number }

export default function Super(){
  const [stats, setStats] = useState<{mrr:number, activeCount:number, graceCount:number, ordersToday:number, restaurants:Restaurant[]}|null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(()=>{
    (async ()=>{
      try {
        const res = await fetch('/api/super/stats')
        const data = await res.json()
        if(!res.ok){ setErrorMsg(data.error || 'حصل خطأ'); return }
        setStats(data)
      } catch { setErrorMsg('تعذر الاتصال بالسيرفر') }
    })()
  },[])

  if(errorMsg) return <div className="min-h-screen flex items-center justify-center text-red-500" dir="rtl">{errorMsg}</div>
  if(!stats) return <div className="min-h-screen flex items-center justify-center text-gray-400" dir="rtl">جاري التحميل...</div>

  const statusLabel: Record<string,string> = { ACTIVE:'ACTIVE', GRACE:'GRACE', EXPIRED:'EXPIRED' }
  const statusColor: Record<string,string> = {
    ACTIVE:'bg-green-100 text-green-700', GRACE:'bg-yellow-100 text-yellow-700', EXPIRED:'bg-red-100 text-red-700'
  }

  return <div className="min-h-screen bg-[#FFFBF5] p-6" dir="rtl">
    <h1 className="text-2xl font-bold">سوبر ادمن 👑</h1>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
      <div className="bg-white rounded-[16px] p-4 shadow"><div className="text-xs text-gray-500">MRR</div><div className="text-xl font-bold">{stats.mrr.toLocaleString()} ج</div></div>
      <div className="bg-white rounded-[16px] p-4 shadow"><div className="text-xs text-gray-500">مطاعم نشطة</div><div className="text-xl font-bold">{stats.activeCount}</div></div>
      <div className="bg-white rounded-[16px] p-4 shadow"><div className="text-xs text-gray-500">اوردرات اليوم</div><div className="text-xl font-bold">{stats.ordersToday}</div></div>
      <div className="bg-white rounded-[16px] p-4 shadow"><div className="text-xs text-gray-500">Grace</div><div className="text-xl font-bold">{stats.graceCount}</div></div>
    </div>
    <div className="mt-6 bg-white rounded-[16px] p-4 shadow">
      <h3 className="font-bold">المطاعم</h3>
      <div className="mt-3 space-y-3">
        {stats.restaurants.map(r=>(
          <div key={r.id} className="border rounded-xl p-3 flex justify-between items-center">
            <div><div className="font-bold">{r.name}</div><div className="text-xs text-gray-500">{r.domain || r.slug} • ينتهي {new Date(r.subscriptionEnd).toLocaleDateString('ar-EG')}</div></div>
            <span className={`text-xs px-3 py-1 rounded-full ${statusColor[r.subscriptionStatus]}`}>{statusLabel[r.subscriptionStatus]}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
}
