
'use client'
import { useState, useEffect, useCallback } from 'react'
import DeliverySection from './DeliverySection'

type Table = { id:string, number:number, status:string }
type MenuItem = { id:string, name:string, price:number }
type Category = { id:string, name:string, items:MenuItem[] }
type Order = { id:string, tableId:string|null, tableNumber:number|null, total:number, status:string, items:any[] }

export default function Cashier(){
  const [section, setSection] = useState<'dine-in'|'delivery'>('dine-in')
  const [tables, setTables] = useState<Table[]>([])
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [openOrders, setOpenOrders] = useState<Order[]>([])
  const [selectedTable, setSelectedTable] = useState<Table|null>(null)
  // Items already sent to the kitchen for this table's open order (read-only here).
  const [sentItems, setSentItems] = useState<any[]>([])
  // Items the cashier just added in this session, not sent yet.
  const [newItems, setNewItems] = useState<any[]>([])
  const [view, setView] = useState<'tables'|'menu'|'invoice'>('tables')
  const [errorMsg, setErrorMsg] = useState('')

  const refresh = useCallback(async ()=>{
    try {
      const res = await fetch('/api/pos/data')
      if(!res.ok) return
      const data = await res.json()
      setTables(data.tables)
      setMenu(data.categories.flatMap((c:Category)=>c.items))
      setOpenOrders(data.openOrders)
    } catch {}
  },[])

  useEffect(()=>{ refresh(); const t=setInterval(refresh, 5000); return ()=>clearInterval(t) },[refresh])

  const openOrderForTable = (t:Table) => openOrders.find(o=>o.tableId===t.id)
  const combinedCart = [...sentItems, ...newItems]
  const total = combinedCart.reduce((s,i)=>s+i.price*i.qty,0)

  const selectTable = (t:Table) => {
    setSelectedTable(t)
    const existing = openOrderForTable(t)
    setSentItems(existing ? existing.items.map((it:any)=>({...it})) : [])
    setNewItems([])
    setView('invoice')
    setErrorMsg('')
  }

  const addItem = (m:MenuItem) => setNewItems(c=>{
    const ex = c.find(i=>i.id===m.id)
    if(ex) return c.map(i=>i.id===m.id?{...i,qty:i.qty+1}:i)
    return [...c,{...m,qty:1}]
  })

  const sendToKitchen = async () => {
    if(!selectedTable || newItems.length===0) return
    const existing = openOrderForTable(selectedTable)
    try{
      const res = await fetch('/api/orders', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          tableId: selectedTable.id, tableNumber: selectedTable.number, source:'CASHIER',
          existingOrderId: existing?.id, // merges into the existing tab instead of duplicating it
          items: newItems.map(c=>({ id:c.id, name:c.name, qty:c.qty })),
        })
      })
      const data = await res.json()
      if(!res.ok){ setErrorMsg(data.error || 'حصل خطأ'); return }
      setSentItems(c=>[...c, ...newItems])
      setNewItems([])
      await refresh()
    } catch { setErrorMsg('تعذر إرسال الأوردر') }
  }

  const pay = async (paymentMethod:'CASH'|'CARD') => {
    const order = selectedTable && openOrderForTable(selectedTable)
    if(!order){ setErrorMsg('لازم ترسل الأوردر للمطبخ الأول'); return }
    if(newItems.length>0){ setErrorMsg('فيه أصناف لسه متبعتتش للمطبخ - ابعتها الأول'); return }
    try{
      const res = await fetch('/api/pos/pay', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ orderId: order.id, paymentMethod, discount: 0 })
      })
      const data = await res.json()
      if(!res.ok){ setErrorMsg(data.error || 'حصل خطأ في الدفع'); return }
      setSentItems([]); setNewItems([]); setSelectedTable(null); setView('tables')
      await refresh()
    } catch { setErrorMsg('تعذر إتمام الدفع') }
  }

  return (
    <div className="min-h-screen bg-[#FFFBF5]" dir="rtl">
      <div className="flex gap-2 p-4 pb-0">
        <button onClick={()=>setSection('dine-in')} className={`px-4 py-2 rounded-full text-sm font-bold ${section==='dine-in'?'bg-black text-white':'bg-white border'}`}>الترابيزات</button>
        <button onClick={()=>setSection('delivery')} className={`px-4 py-2 rounded-full text-sm font-bold ${section==='delivery'?'bg-black text-white':'bg-white border'}`}>الدليفري</button>
      </div>

      {section==='delivery' ? (
        <DeliverySection menu={menu} />
      ) : (
      <div className="flex flex-col lg:flex-row">
      <div className={`${view!=='tables'?'hidden lg:block':''} flex-1 p-4`}>
        <h2 className="font-bold mb-3">الترابيزات</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {tables.map(t=>{
            const order = openOrderForTable(t)
            const bg = t.status==='AVAILABLE'?'bg-white border': t.status==='OCCUPIED'?'bg-red-500 text-white': t.status==='RESERVED'?'bg-blue-500 text-white':'bg-orange-500 text-white animate-pulse'
            return <button key={t.id} onClick={()=>selectTable(t)} className={`${bg} rounded-[16px] p-4 text-center shadow-sm min-h-[90px]`}>
              <div className="font-bold">ترابيزة {t.number}</div>
              <div className="text-xs mt-1 opacity-80">{order ? `${order.total} ج` : t.status}</div>
            </button>
          })}
        </div>
        <div className="mt-6">
          <h3 className="font-bold mb-2">المنيو السريع</h3>
          <div className="grid grid-cols-2 gap-2">
            {menu.map(m=><button key={m.id} onClick={()=>addItem(m)} disabled={!selectedTable} className="bg-white rounded-xl p-3 text-sm shadow-sm border text-right disabled:opacity-40"><div className="font-bold">{m.name}</div><div className="text-xs text-gray-500">{m.price} ج</div></button>)}
          </div>
        </div>
      </div>

      <div className={`${view!=='invoice'?'hidden lg:block':''} w-full lg:w-[380px] bg-white border-l p-4 lg:sticky lg:top-0 lg:h-screen flex flex-col`}>
        <div className="flex-1">
          <div className="flex justify-between"><h2 className="font-bold">الفاتورة</h2>{selectedTable && <span className="bg-[#0A0A0B] text-white text-xs px-3 py-1 rounded-full">ترابيزة {selectedTable.number}</span>}</div>
          {errorMsg && <div className="mt-3 bg-red-50 text-red-600 text-xs p-2 rounded-xl">{errorMsg}</div>}
          <div className="mt-4 space-y-2">
            {sentItems.map((it,i)=><div key={`sent-${i}`} className="flex justify-between text-sm"><span>{it.qty}× {it.name}</span><span>{it.price*it.qty} ج</span></div>)}
            {newItems.length>0 && <div className="text-xs text-orange-500 font-bold pt-1">لسه متبعتتش للمطبخ:</div>}
            {newItems.map((it,i)=><div key={`new-${i}`} className="flex justify-between text-sm text-orange-600"><span>{it.qty}× {it.name}</span><span>{it.price*it.qty} ج</span></div>)}
          </div>
          <div className="mt-6 border-t pt-4 flex justify-between font-bold text-lg"><span>الاجمالي</span><span className="text-[#FF6B2B]">{total} ج</span></div>
          <button onClick={sendToKitchen} disabled={!selectedTable || newItems.length===0} className="w-full mt-3 bg-black text-white rounded-full py-3 font-bold disabled:opacity-40">ارسال للمطبخ</button>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={()=>pay('CASH')} className="bg-green-500 text-white rounded-full py-3">كاش</button>
            <button onClick={()=>pay('CARD')} className="bg-blue-500 text-white rounded-full py-3">كارت</button>
          </div>
        </div>
        <div className="lg:hidden grid grid-cols-3 gap-2 mt-4">
          <button onClick={()=>setView('tables')} className={`rounded-full py-2 text-sm ${view==='tables'?'bg-black text-white':'bg-gray-100'}`}>ترابيزات</button>
          <button onClick={()=>setView('menu')} className={`rounded-full py-2 text-sm ${view==='menu'?'bg-black text-white':'bg-gray-100'}`}>منيو</button>
          <button onClick={()=>setView('invoice')} className={`rounded-full py-2 text-sm ${view==='invoice'?'bg-black text-white':'bg-gray-100'}`}>فاتورة</button>
        </div>
      </div>
      </div>
      )}
    </div>
  )
}
