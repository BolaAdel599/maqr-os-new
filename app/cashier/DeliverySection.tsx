
'use client'
import { useState, useEffect, useCallback } from 'react'

type MenuItem = { id:string, name:string, price:number }
type Driver = { id:string, name:string, status:string }
type DeliveryOrder = { id:string, orderNumber:number, customerName:string|null, customerPhone:string|null, address:any, total:number, status:string, driverId:string|null }

const STATUS_LABEL: Record<string,string> = {
  AWAITING_PAYMENT: 'في انتظار الدفع أونلاين', NEW: 'جديد', IN_KITCHEN: 'بيتحضر', READY: 'جاهز', OUT_FOR_DELIVERY: 'في الطريق', DELIVERED: 'اتوصل', CANCELLED: 'اتلغى',
}

export default function DeliverySection({ menu }: { menu: MenuItem[] }){
  const [orders, setOrders] = useState<DeliveryOrder[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [creating, setCreating] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const refresh = useCallback(async ()=>{
    try {
      const [ordersRes, driversRes] = await Promise.all([
        // No restaurantId param needed: for non-SUPER_ADMIN roles the API
        // always scopes to the session's own restaurant regardless of query
        // params, and passing a bogus value here would actually get rejected
        // by its cross-tenant check.
        fetch('/api/orders').then(r=>r.ok?r.json():[]),
        fetch('/api/drivers').then(r=>r.ok?r.json():{drivers:[]}),
      ])
      const list = Array.isArray(ordersRes) ? ordersRes : []
      setOrders(list.filter((o:any)=>o.source==='DELIVERY' && o.status!=='DELIVERED' && o.status!=='CANCELLED'))
      setDrivers(driversRes.drivers || [])
    } catch {}
  },[])

  useEffect(()=>{ refresh(); const t=setInterval(refresh, 5000); return ()=>clearInterval(t) },[refresh])

  const assignDriver = async (orderId:string, driverId:string) => {
    if(!driverId) return
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status:'OUT_FOR_DELIVERY', driverId })
      })
      const data = await res.json()
      if(!res.ok){ setErrorMsg(data.error || 'حصل خطأ'); return }
      await refresh()
    } catch { setErrorMsg('تعذر تعيين الطيار') }
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold">أوردرات الدليفري</h2>
        <button onClick={()=>setCreating(true)} className="bg-[#FF6B2B] text-white rounded-full px-4 py-2 text-sm font-bold">+ أوردر جديد</button>
      </div>

      {errorMsg && <div className="mb-3 bg-red-50 text-red-600 text-xs p-2 rounded-xl">{errorMsg}</div>}

      {creating && (
        <NewDeliveryOrderForm
          menu={menu}
          onCancel={()=>setCreating(false)}
          onCreated={()=>{ setCreating(false); refresh() }}
          onError={setErrorMsg}
        />
      )}

      {orders.length===0 && !creating && (
        <div className="text-center text-gray-400 py-12">مفيش أوردرات دليفري مفتوحة دلوقتي</div>
      )}

      <div className="space-y-3">
        {orders.map(o=>(
          <div key={o.id} className="bg-white rounded-xl border p-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold text-sm">#{o.orderNumber} - {o.customerName || 'عميل'}</div>
                <div className="text-xs text-gray-500 mt-1">{o.address?.text || ''}</div>
                {o.customerPhone && <div className="text-xs text-gray-500">{o.customerPhone}</div>}
              </div>
              <div className="text-left shrink-0">
                <div className="font-bold text-[#FF6B2B]">{o.total} ج</div>
                <div className="text-xs bg-gray-100 rounded-full px-2 py-1 mt-1">{STATUS_LABEL[o.status] || o.status}</div>
              </div>
            </div>
            {o.status==='READY' && (
              <div className="mt-3 flex gap-2">
                <select
                  onChange={e=>assignDriver(o.id, e.target.value)}
                  defaultValue=""
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="" disabled>اختار طيار...</option>
                  {drivers.map(d=>(
                    <option key={d.id} value={d.id} disabled={d.status!=='AVAILABLE'}>
                      {d.name} {d.status!=='AVAILABLE' ? `(${d.status==='ON_DELIVERY'?'مشغول':'أوفلاين'})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {o.status==='OUT_FOR_DELIVERY' && (
              <div className="mt-2 text-xs text-orange-500 font-bold">في الطريق - في انتظار الطيار يأكد التوصيل بالكود</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function NewDeliveryOrderForm({ menu, onCancel, onCreated, onError }: {
  menu: MenuItem[]
  onCancel: ()=>void
  onCreated: ()=>void
  onError: (msg:string)=>void
}){
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [address, setAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'CASH'|'CARD'>('CASH')
  const [cart, setCart] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  const total = cart.reduce((s,i)=>s+i.price*i.qty,0)

  const addItem = (m:MenuItem) => setCart(c=>{
    const ex = c.find(i=>i.id===m.id)
    if(ex) return c.map(i=>i.id===m.id?{...i,qty:i.qty+1}:i)
    return [...c,{...m,qty:1}]
  })

  const submit = async () => {
    if(!customerName.trim() || !customerPhone.trim() || !address.trim()){ onError('البيانات كلها مطلوبة (الاسم، الموبايل، العنوان)'); return }
    if(paymentMethod==='CARD' && !customerPhone.trim()){ onError('رقم الموبايل مطلوب عشان نبعت رابط الدفع أونلاين'); return }
    if(cart.length===0){ onError('لازم تختار صنف واحد على الأقل'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/orders', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          source:'DELIVERY', customerName, customerPhone, paymentMethod,
          address: { text: address },
          items: cart.map(c=>({ id:c.id, name:c.name, qty:c.qty })),
        })
      })
      const data = await res.json()
      if(!res.ok){ onError(data.error || 'حصل خطأ'); return }
      onCreated()
    } catch { onError('تعذر إنشاء الأوردر') } finally { setSaving(false) }
  }

  return (
    <div className="bg-white rounded-xl border-2 border-[#FF6B2B]/40 p-4 mb-4 space-y-3">
      <input value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="اسم العميل" className="w-full border rounded-lg px-3 py-2 text-sm"/>
      <input value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} placeholder="رقم الموبايل" className="w-full border rounded-lg px-3 py-2 text-sm"/>
      <textarea value={address} onChange={e=>setAddress(e.target.value)} placeholder="العنوان بالتفصيل" className="w-full border rounded-lg px-3 py-2 text-sm" rows={2}/>

      <div>
        <div className="text-xs font-bold text-gray-500 mb-2">طريقة الدفع:</div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={()=>setPaymentMethod('CASH')} className={`rounded-lg py-2 text-sm font-bold ${paymentMethod==='CASH'?'bg-[#0A0A0B] text-white':'bg-gray-50 border'}`}>💵 كاش عند التسليم</button>
          <button type="button" onClick={()=>setPaymentMethod('CARD')} className={`rounded-lg py-2 text-sm font-bold ${paymentMethod==='CARD'?'bg-[#FF6B2B] text-white':'bg-gray-50 border'}`}>💳 دفع أونلاين</button>
        </div>
        {paymentMethod==='CARD' && <p className="text-xs text-gray-400 mt-1">هيتبعت رابط دفع للعميل على واتساب بعد إنشاء الأوردر</p>}
      </div>

      <div>
        <div className="text-xs font-bold text-gray-500 mb-2">اختار الأصناف:</div>
        <div className="grid grid-cols-2 gap-2">
          {menu.map(m=><button key={m.id} onClick={()=>addItem(m)} className="bg-gray-50 rounded-lg p-2 text-xs border text-right"><div className="font-bold">{m.name}</div><div className="text-gray-500">{m.price} ج</div></button>)}
        </div>
      </div>

      {cart.length>0 && (
        <div className="border-t pt-2 space-y-1">
          {cart.map(it=><div key={it.id} className="flex justify-between text-sm"><span>{it.qty}× {it.name}</span><span>{it.price*it.qty} ج</span></div>)}
          <div className="flex justify-between font-bold pt-1"><span>الإجمالي</span><span className="text-[#FF6B2B]">{total} ج</span></div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={submit} disabled={saving} className="flex-1 bg-[#FF6B2B] text-white rounded-lg py-2 text-sm font-bold disabled:opacity-50">
          {saving ? 'جاري الإنشاء...' : 'إنشاء الأوردر'}
        </button>
        <button onClick={onCancel} className="text-gray-400 text-sm px-3">إلغاء</button>
      </div>
    </div>
  )
}
