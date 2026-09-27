
'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'

type MenuItem = { id: string, name: string, price: number, available: boolean }
type Category = { id: string, name: string, items: MenuItem[] }

export default function CustomerPage(){
  const params = useParams()
  const tableNumber = params.tableNumber as string
  const [restaurant, setRestaurant] = useState<{id:string, name:string}|null>(null)
  const [table, setTable] = useState<{id:string}|null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [cat, setCat] = useState('الكل')
  const [cart, setCart] = useState<any[]>([])
  const [note, setNote] = useState('')
  const [ordered, setOrdered] = useState(false)
  const [needsWaiter, setNeedsWaiter] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [orderNumber, setOrderNumber] = useState<number|null>(null)
  const [showPaymentChoice, setShowPaymentChoice] = useState(false)
  const [phone, setPhone] = useState('')
  const [placingOrder, setPlacingOrder] = useState(false)
  // Set once an online-payment order is created; drives the "waiting for
  // payment" screen that polls until Paymob's webhook confirms it.
  const [awaitingPaymentOrderId, setAwaitingPaymentOrderId] = useState<string|null>(null)
  const [reopening, setReopening] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval>|null>(null)

  // Resolve the real restaurant + menu for THIS domain and THIS table,
  // instead of a hardcoded 'demo-restaurant' id and a static menu array.
  useEffect(()=>{
    (async ()=>{
      try{
        const res = await fetch(`/api/menu?tableNumber=${encodeURIComponent(tableNumber)}`)
        const data = await res.json()
        if(!res.ok){ setErrorMsg(data.error || 'حصل خطأ'); setLoading(false); return }
        setRestaurant(data.restaurant)
        setTable(data.table)
        setCategories(data.categories)
      } catch {
        setErrorMsg('تعذر الاتصال بالسيرفر')
      } finally {
        setLoading(false)
      }
    })()
  },[tableNumber])

  useEffect(()=>()=>{ if(pollRef.current) clearInterval(pollRef.current) },[])

  const allItems = categories.flatMap(c=>c.items.map(i=>({...i, cat:c.name})))
  const cats = ['الكل', ...categories.map(c=>c.name)]
  const filtered = cat==='الكل' ? allItems : allItems.filter(m=>m.cat===cat)
  const total = cart.reduce((s,i)=>s+i.price*i.qty,0)

  const add = (item:MenuItem & {cat:string})=>{
    setCart(prev=>{
      const ex = prev.find(p=>p.id===item.id)
      if(ex) return prev.map(p=>p.id===item.id?{...p,qty:p.qty+1}:p)
      return [...prev,{...item,qty:1}]
    })
  }

  const placeOrder = async (paymentMethod:'CASH'|'CARD')=>{
    if(!restaurant) return
    if(paymentMethod==='CARD' && !phone.trim()){
      setErrorMsg('لازم تدخل رقم موبايل عشان الدفع أونلاين (هيتبعتلك عليه رابط الدفع وتأكيد الأوردر)')
      return
    }
    setPlacingOrder(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/orders',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
        restaurantId: restaurant.id,
        tableId: table?.id,
        tableNumber: Number(tableNumber),
        items: cart.map(c=>({ id:c.id, name:c.name, qty:c.qty })), // price is recalculated server-side
        source: 'QR',
        paymentMethod,
        customerName: 'عميل ترابيزة '+tableNumber,
        customerPhone: phone.trim() || undefined,
      })})
      const data = await res.json()
      if(!res.ok){ setErrorMsg(data.error || 'حصل خطأ في إرسال الأوردر'); return }

      if(paymentMethod === 'CARD'){
        // Kick off the Paymob payment session, then wait for the webhook to confirm it.
        const payRes = await fetch('/api/payment/paymob/create', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ orderId: data.order.id })
        })
        const payData = await payRes.json()
        if(!payRes.ok){ setErrorMsg(payData.error || 'تعذر بدء عملية الدفع'); return }
        window.open(payData.iframeUrl, '_blank')
        setAwaitingPaymentOrderId(data.order.id)
        setShowPaymentChoice(false)
        setCart([])
        pollRef.current = setInterval(async ()=>{
          const statusRes = await fetch(`/api/orders/${data.order.id}/public-status`)
          if(!statusRes.ok) return
          const statusData = await statusRes.json()
          if(statusData.paymentStatus === 'PAID'){
            clearInterval(pollRef.current!)
            setAwaitingPaymentOrderId(null)
            setOrderNumber(statusData.orderNumber)
            setOrdered(true)
            setTimeout(()=>setOrdered(false),4000)
          } else if(statusData.paymentStatus === 'FAILED'){
            clearInterval(pollRef.current!)
            setAwaitingPaymentOrderId(null)
            setErrorMsg('الدفع فشل - جرب تاني')
          }
        }, 3000)
      } else {
        setOrderNumber(data.order?.orderNumber ?? null)
        setOrdered(true)
        setCart([])
        setShowPaymentChoice(false)
        setTimeout(()=>setOrdered(false),3000)
      }
    } catch {
      setErrorMsg('تعذر إرسال الأوردر')
    } finally {
      setPlacingOrder(false)
    }
  }

  const reopenPayment = async () => {
    if(!awaitingPaymentOrderId) return
    setReopening(true)
    setErrorMsg('')
    try {
      // Same public endpoint used at checkout - safe to call again since it's
      // scoped to this specific order and still checks it's genuinely
      // AWAITING_PAYMENT server-side.
      const payRes = await fetch('/api/payment/paymob/create', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderId: awaitingPaymentOrderId })
      })
      const payData = await payRes.json()
      if(!payRes.ok){ setErrorMsg(payData.error || 'تعذر فتح صفحة الدفع'); return }
      window.open(payData.iframeUrl, '_blank')
    } catch {
      setErrorMsg('تعذر فتح صفحة الدفع')
    } finally {
      setReopening(false)
    }
  }

  if(loading) return <div className="min-h-screen flex items-center justify-center text-gray-400" dir="rtl">جاري التحميل...</div>
  if(errorMsg && !restaurant) return <div className="min-h-screen flex items-center justify-center text-red-500 p-6 text-center" dir="rtl">{errorMsg}</div>

  if(awaitingPaymentOrderId) return (
    <div className="min-h-screen bg-[#FFFBF5] flex items-center justify-center p-6" dir="rtl">
      <div className="bg-white rounded-[24px] p-8 text-center shadow max-w-sm w-full">
        <div className="text-5xl animate-pulse">⏳</div>
        <h2 className="text-xl font-bold mt-4">في انتظار تأكيد الدفع...</h2>
        <p className="text-gray-500 text-sm mt-2">أكمل الدفع في التاب اللي فتح، الصفحة دي هتتحدث لوحدها</p>
        {errorMsg && <p className="text-red-500 text-sm mt-3">{errorMsg}</p>}
        <button onClick={reopenPayment} disabled={reopening} className="mt-5 w-full bg-[#FF6B2B] text-white rounded-full py-3 font-bold disabled:opacity-50">
          {reopening ? 'جاري الفتح...' : 'قفلت صفحة الدفع بالغلط؟ افتحها تاني'}
        </button>
      </div>
    </div>
  )

  if(ordered) return (
    <div className="min-h-screen bg-[#FFFBF5] flex items-center justify-center p-6" dir="rtl">
      <div className="bg-white rounded-[24px] p-8 text-center shadow max-w-sm w-full animate-bounce">
        <div className="text-6xl">✅</div>
        <h2 className="text-2xl font-bold mt-4">طلبك وصل للمطبخ!</h2>
        <p className="text-gray-500 mt-2">ترابيزة {tableNumber}{orderNumber ? ` - الاوردر #${orderNumber}` : ''}</p>
        <button onClick={()=>setOrdered(false)} className="mt-6 w-full bg-[#FF6B2B] text-white rounded-full py-3">اطلب تاني</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FFFBF5] pb-32" dir="rtl">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b px-4 py-3 flex justify-between items-center">
        <div><h1 className="font-bold">{restaurant?.name}</h1><p className="text-xs text-gray-500">ترابيزة {tableNumber} • QR مباشر</p></div>
        <div className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full">مفتوحة</div>
      </header>

      <div className="sticky top-[56px] z-10 bg-[#FFFBF5] px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
        {cats.map(c=>(
          <button key={c} onClick={()=>setCat(c)} className={`whitespace-nowrap px-4 py-2 rounded-full text-sm ${cat===c?'bg-[#0A0A0B] text-white':'bg-white border'}`}>{c}</button>
        ))}
      </div>

      {errorMsg && <div className="mx-4 mt-2 bg-red-50 text-red-600 text-xs p-3 rounded-xl">{errorMsg}</div>}

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-6xl mx-auto">
        {filtered.map(item=>(
          <div key={item.id} className="bg-white rounded-[16px] p-4 shadow-sm border flex gap-3">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center text-2xl">🍽️</div>
            <div className="flex-1">
              <h3 className="font-bold text-sm">{item.name}</h3>
              <p className="text-xs text-gray-500">{item.cat}</p>
              <div className="flex justify-between items-center mt-2">
                <span className="font-bold">{item.price} ج</span>
                <button onClick={()=>add(item as any)} className="bg-[#FF6B2B] text-white w-8 h-8 rounded-full">+</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={()=>setNeedsWaiter(true)} className="fixed bottom-24 left-4 bg-[#0A0A0B] text-white rounded-full px-4 py-3 text-sm shadow-lg">🔔 نادلي الويتر</button>
      {needsWaiter && <div className="fixed bottom-36 left-4 bg-orange-500 text-white text-sm px-4 py-2 rounded-full shadow">الويتر جاي حالا!</div>}

      {cart.length>0 && !showPaymentChoice && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t rounded-t-[24px] shadow-2xl p-4 max-w-2xl mx-auto">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3"></div>
          <div className="flex justify-between items-center mb-3"><h3 className="font-bold">سلة الطلبات ({cart.reduce((s,i)=>s+i.qty,0)})</h3><span className="font-bold text-[#FF6B2B]">{total} ج</span></div>
          <div className="space-y-2 max-h-32 overflow-auto">
            {cart.map(it=>(
              <div key={it.id} className="flex justify-between text-sm"><span>{it.qty}× {it.name}</span><span>{it.price*it.qty} ج</span></div>
            ))}
          </div>
          <input value={note} onChange={e=>setNote(e.target.value)} placeholder="ملاحظات (اختياري)" className="w-full mt-3 border rounded-xl px-3 py-2 text-sm"/>
          <button onClick={()=>setShowPaymentChoice(true)} className="w-full mt-3 bg-[#FF6B2B] text-white rounded-full py-3 font-bold">إرسال للمطبخ • {total} ج</button>
        </div>
      )}

      {showPaymentChoice && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t rounded-t-[24px] shadow-2xl p-4 max-w-2xl mx-auto">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3"></div>
          <h3 className="font-bold mb-3 text-center">هتدفع إزاي؟</h3>
          <input
            value={phone}
            onChange={e=>setPhone(e.target.value)}
            type="tel"
            placeholder="رقم موبايلك (مطلوب بس لو هتدفع أونلاين)"
            className="w-full mb-3 border rounded-xl px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <button disabled={placingOrder} onClick={()=>placeOrder('CASH')} className="bg-[#0A0A0B] text-white rounded-xl py-4 font-bold disabled:opacity-50">
              💵 كاش عند الترابيزة
            </button>
            <button disabled={placingOrder} onClick={()=>placeOrder('CARD')} className="bg-[#FF6B2B] text-white rounded-xl py-4 font-bold disabled:opacity-50">
              💳 دفع أونلاين
            </button>
          </div>
          {errorMsg && <p className="text-red-500 text-xs mt-2 text-center">{errorMsg}</p>}
          <button onClick={()=>setShowPaymentChoice(false)} className="w-full mt-3 text-gray-400 text-sm py-2">رجوع</button>
        </div>
      )}
    </div>
  )
}
