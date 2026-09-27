
'use client'
import { useState, useEffect, useCallback } from 'react'

type PendingOrder = { id:string, orderNumber:number, total:number, tableNumber:number|null, customerName:string|null, customerPhone:string|null, createdAt:string }

export default function PendingPayments(){
  const [orders, setOrders] = useState<PendingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [now, setNow] = useState(Date.now())
  const [resendingId, setResendingId] = useState<string|null>(null)
  const [resentId, setResentId] = useState<string|null>(null)

  const refresh = useCallback(async ()=>{
    try {
      const res = await fetch('/api/admin/pending-payments')
      const data = await res.json()
      if(!res.ok){ setErrorMsg(data.error || 'حصل خطأ'); return }
      setOrders(data.orders)
    } catch { setErrorMsg('تعذر الاتصال بالسيرفر') } finally { setLoading(false) }
  },[])

  useEffect(()=>{ refresh(); const t=setInterval(refresh, 8000); return ()=>clearInterval(t) },[refresh])
  useEffect(()=>{ const t=setInterval(()=>setNow(Date.now()),1000); return ()=>clearInterval(t) },[])

  const cancel = async (id:string) => {
    if(!confirm('هتلغي الأوردر ده؟ العميل لسه مدفعش.')) return
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status:'CANCELLED' })
      })
      if(!res.ok){ const data = await res.json(); setErrorMsg(data.error || 'حصل خطأ'); return }
      await refresh()
    } catch { setErrorMsg('تعذر الإلغاء') }
  }

  const resend = async (id:string) => {
    setResendingId(id)
    setErrorMsg('')
    try {
      const res = await fetch(`/api/admin/pending-payments/${id}/resend`, { method:'POST' })
      const data = await res.json()
      if(!res.ok){ setErrorMsg(data.error || 'حصل خطأ'); return }
      setResentId(id)
      setTimeout(()=>setResentId(null), 4000)
    } catch { setErrorMsg('تعذر إعادة الإرسال') } finally { setResendingId(null) }
  }

  if(loading) return <div className="min-h-screen flex items-center justify-center text-gray-400" dir="rtl">جاري التحميل...</div>

  return (
    <div className="min-h-screen bg-[#FFFBF5] p-4 md:p-6" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">دفعات معلقة ⏳</h1>
        <p className="text-sm text-gray-500 mb-6">
          أوردرات اختار أصحابها "دفع أونلاين" ولسه مخلصوش الدفع. بتتلغي تلقائيًا بعد ٣٠ دقيقة، أو تقدر تلغيها أو تبعت رابط الدفع تاني بنفسك دلوقتي.
        </p>

        {errorMsg && (
          <div className="mb-4 bg-red-50 text-red-600 text-sm p-3 rounded-xl flex justify-between items-center">
            <span>{errorMsg}</span>
            <button onClick={()=>setErrorMsg('')} className="text-red-400">✕</button>
          </div>
        )}

        {orders.length===0 ? (
          <div className="text-center text-gray-400 py-12">مفيش دفعات معلقة دلوقتي 🎉</div>
        ) : (
          <div className="space-y-3">
            {orders.map(o=>{
              const mins = Math.floor((now - new Date(o.createdAt).getTime())/60000)
              return (
                <div key={o.id} className="bg-white rounded-xl border p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm">#{o.orderNumber} {o.tableNumber ? `- ترابيزة ${o.tableNumber}` : ''}</div>
                      <div className="text-xs text-gray-500 mt-1">{o.total} ج - من {mins} دقيقة</div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {o.customerPhone && (
                        <button
                          onClick={()=>resend(o.id)}
                          disabled={resendingId===o.id}
                          className="text-blue-500 text-xs border border-blue-200 rounded-lg px-3 py-2 disabled:opacity-50"
                        >
                          {resendingId===o.id ? 'جاري الإرسال...' : 'إعادة إرسال الرابط'}
                        </button>
                      )}
                      <button onClick={()=>cancel(o.id)} className="text-red-500 text-xs border border-red-200 rounded-lg px-3 py-2">إلغاء</button>
                    </div>
                  </div>
                  {!o.customerPhone && (
                    <div className="text-xs text-gray-400 mt-2">مفيش رقم موبايل مسجل للأوردر ده - مينفعش نبعت رابط تاني</div>
                  )}
                  {resentId===o.id && (
                    <div className="text-xs text-green-600 mt-2">✓ اتبعت رابط الدفع تاني على واتساب</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
