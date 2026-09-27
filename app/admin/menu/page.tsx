
'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

type MenuItem = { id:string, name:string, price:number, image:string|null, available:boolean, categoryId:string }
type Category = { id:string, name:string, order:number, items:MenuItem[] }

export default function MenuAdmin(){
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [addingItemTo, setAddingItemTo] = useState<string|null>(null)
  const [editingItemId, setEditingItemId] = useState<string|null>(null)

  const refresh = useCallback(async ()=>{
    try {
      const res = await fetch('/api/admin/menu')
      const data = await res.json()
      if(!res.ok){ setErrorMsg(data.error || 'حصل خطأ'); return }
      setCategories(data.categories)
    } catch { setErrorMsg('تعذر الاتصال بالسيرفر') } finally { setLoading(false) }
  },[])

  useEffect(()=>{ refresh() },[refresh])

  const addCategory = async () => {
    if(!newCategoryName.trim()) return
    try {
      const res = await fetch('/api/admin/menu/categories', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name: newCategoryName.trim() })
      })
      const data = await res.json()
      if(!res.ok){ setErrorMsg(data.error || 'حصل خطأ'); return }
      setNewCategoryName('')
      await refresh()
    } catch { setErrorMsg('تعذر الإضافة') }
  }

  const renameCategory = async (id:string, name:string) => {
    if(!name.trim()) return
    try {
      await fetch(`/api/admin/menu/categories/${id}`, {
        method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name })
      })
      await refresh()
    } catch { setErrorMsg('تعذر التعديل') }
  }

  const deleteCategory = async (id:string) => {
    if(!confirm('هتمسح القسم ده وكل الأصناف اللي جواه؟')) return
    try {
      const res = await fetch(`/api/admin/menu/categories/${id}`, { method:'DELETE' })
      if(!res.ok){ const data = await res.json(); setErrorMsg(data.error || 'حصل خطأ'); return }
      await refresh()
    } catch { setErrorMsg('تعذر الحذف') }
  }

  const deleteItem = async (id:string) => {
    if(!confirm('هتمسح الصنف ده؟')) return
    try {
      const res = await fetch(`/api/admin/menu/items/${id}`, { method:'DELETE' })
      if(!res.ok){ const data = await res.json(); setErrorMsg(data.error || 'حصل خطأ'); return }
      await refresh()
    } catch { setErrorMsg('تعذر الحذف') }
  }

  const toggleAvailable = async (item:MenuItem) => {
    setCategories(cs=>cs.map(c=>({...c, items: c.items.map(i=>i.id===item.id?{...i, available:!i.available}:i)}))) // optimistic
    try {
      const res = await fetch(`/api/admin/menu/items/${item.id}`, {
        method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ available: !item.available })
      })
      if(!res.ok) await refresh() // roll back to server truth on failure
    } catch { await refresh() }
  }

  if(loading) return <div className="min-h-screen flex items-center justify-center text-gray-400" dir="rtl">جاري التحميل...</div>

  return (
    <div className="min-h-screen bg-[#FFFBF5] p-4 md:p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">إدارة المنيو 🍽️</h1>
        <p className="text-sm text-gray-500 mb-6">أضف وعدّل الأقسام والأصناف اللي بتظهر لعملائك</p>

        {errorMsg && (
          <div className="mb-4 bg-red-50 text-red-600 text-sm p-3 rounded-xl flex justify-between items-center">
            <span>{errorMsg}</span>
            <button onClick={()=>setErrorMsg('')} className="text-red-400">✕</button>
          </div>
        )}

        <div className="bg-white rounded-[16px] p-4 shadow-sm mb-6 flex gap-2">
          <input
            value={newCategoryName}
            onChange={e=>setNewCategoryName(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter') addCategory() }}
            placeholder="اسم قسم جديد (مثلاً: مقبلات)"
            className="flex-1 border rounded-xl px-4 py-2 text-sm"
          />
          <button onClick={addCategory} className="bg-[#FF6B2B] text-white rounded-xl px-5 py-2 font-bold text-sm shrink-0">+ إضافة قسم</button>
        </div>

        {categories.length===0 && (
          <div className="text-center text-gray-400 py-12">مفيش أقسام لسه - ابدأ بإضافة قسم فوق</div>
        )}

        <div className="space-y-4">
          {categories.map(cat=>(
            <CategoryCard
              key={cat.id}
              category={cat}
              onRename={(name)=>renameCategory(cat.id, name)}
              onDelete={()=>deleteCategory(cat.id)}
              onDeleteItem={deleteItem}
              onToggleAvailable={toggleAvailable}
              isAddingItem={addingItemTo===cat.id}
              onStartAddItem={()=>setAddingItemTo(cat.id)}
              onCancelAddItem={()=>setAddingItemTo(null)}
              onItemAdded={()=>{ setAddingItemTo(null); refresh() }}
              editingItemId={editingItemId}
              onStartEditItem={setEditingItemId}
              onCancelEditItem={()=>setEditingItemId(null)}
              onItemEdited={()=>{ setEditingItemId(null); refresh() }}
              onError={setErrorMsg}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function CategoryCard({ category, onRename, onDelete, onDeleteItem, onToggleAvailable, isAddingItem, onStartAddItem, onCancelAddItem, onItemAdded, editingItemId, onStartEditItem, onCancelEditItem, onItemEdited, onError }: {
  category: Category
  onRename: (name:string)=>void
  onDelete: ()=>void
  onDeleteItem: (id:string)=>void
  onToggleAvailable: (item:MenuItem)=>void
  isAddingItem: boolean
  onStartAddItem: ()=>void
  onCancelAddItem: ()=>void
  onItemAdded: ()=>void
  editingItemId: string|null
  onStartEditItem: (id:string)=>void
  onCancelEditItem: ()=>void
  onItemEdited: ()=>void
  onError: (msg:string)=>void
}){
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(category.name)

  return (
    <div className="bg-white rounded-[16px] shadow-sm p-4">
      <div className="flex justify-between items-center mb-3">
        {editingName ? (
          <div className="flex gap-2 flex-1">
            <input value={nameDraft} onChange={e=>setNameDraft(e.target.value)} className="border rounded-lg px-3 py-1 text-sm font-bold flex-1" autoFocus/>
            <button onClick={()=>{ onRename(nameDraft); setEditingName(false) }} className="text-green-600 text-sm font-bold">حفظ</button>
            <button onClick={()=>{ setNameDraft(category.name); setEditingName(false) }} className="text-gray-400 text-sm">إلغاء</button>
          </div>
        ) : (
          <h3 className="font-bold text-lg cursor-pointer" onClick={()=>setEditingName(true)}>{category.name} <span className="text-gray-300 text-sm">✎</span></h3>
        )}
        <button onClick={onDelete} className="text-red-400 text-xs shrink-0">حذف القسم</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {category.items.map(item=>(
          editingItemId===item.id ? (
            <ItemForm
              key={item.id}
              categoryId={category.id}
              existing={item}
              onDone={onItemEdited}
              onCancel={onCancelEditItem}
              onError={onError}
            />
          ) : (
            <div key={item.id} className={`border rounded-xl p-3 flex gap-3 ${!item.available?'opacity-50':''}`}>
              <div className="w-14 h-14 rounded-lg bg-gray-100 shrink-0 overflow-hidden flex items-center justify-center text-xl">
                {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover"/> : '🍽️'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{item.name}</div>
                <div className="text-xs text-gray-500">{item.price} ج</div>
                <div className="flex gap-3 mt-1 text-xs">
                  <button onClick={()=>onToggleAvailable(item)} className={item.available?'text-green-600':'text-gray-400'}>
                    {item.available ? 'متاح' : 'مش متاح'}
                  </button>
                  <button onClick={()=>onStartEditItem(item.id)} className="text-blue-500">تعديل</button>
                  <button onClick={()=>onDeleteItem(item.id)} className="text-red-400">حذف</button>
                </div>
              </div>
            </div>
          )
        ))}

        {isAddingItem ? (
          <ItemForm categoryId={category.id} onDone={onItemAdded} onCancel={onCancelAddItem} onError={onError} />
        ) : (
          <button onClick={onStartAddItem} className="border-2 border-dashed rounded-xl p-3 text-sm text-gray-400 hover:text-[#FF6B2B] hover:border-[#FF6B2B] flex items-center justify-center min-h-[90px]">
            + إضافة صنف
          </button>
        )}
      </div>
    </div>
  )
}

function ItemForm({ categoryId, existing, onDone, onCancel, onError }: {
  categoryId: string
  existing?: MenuItem
  onDone: ()=>void
  onCancel: ()=>void
  onError: (msg:string)=>void
}){
  const [name, setName] = useState(existing?.name || '')
  const [price, setPrice] = useState(existing ? String(existing.price) : '')
  const [image, setImage] = useState(existing?.image || '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadImage = async (file: File) => {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method:'POST', body: form })
      const data = await res.json()
      if(!res.ok){ onError(data.error || 'تعذر رفع الصورة'); return }
      setImage(data.url)
    } catch { onError('تعذر رفع الصورة') } finally { setUploading(false) }
  }

  const save = async () => {
    if(!name.trim()){ onError('الاسم مطلوب'); return }
    const numericPrice = Number(price)
    if(!Number.isFinite(numericPrice) || numericPrice<=0){ onError('السعر لازم يكون رقم أكبر من صفر'); return }
    setSaving(true)
    try {
      const url = existing ? `/api/admin/menu/items/${existing.id}` : '/api/admin/menu/items'
      const method = existing ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method, headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name: name.trim(), price: numericPrice, categoryId, image: image || undefined })
      })
      const data = await res.json()
      if(!res.ok){ onError(data.error || 'حصل خطأ'); return }
      onDone()
    } catch { onError('تعذر الحفظ') } finally { setSaving(false) }
  }

  return (
    <div className="border-2 border-[#FF6B2B]/40 rounded-xl p-3 space-y-2">
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="اسم الصنف" className="w-full border rounded-lg px-3 py-2 text-sm"/>
      <input value={price} onChange={e=>setPrice(e.target.value)} type="number" min="0" step="0.01" placeholder="السعر" className="w-full border rounded-lg px-3 py-2 text-sm"/>
      <div className="flex items-center gap-2">
        {image && <img src={image} alt="" className="w-10 h-10 rounded object-cover"/>}
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={e=>{ const f=e.target.files?.[0]; if(f) uploadImage(f) }}/>
        <button type="button" onClick={()=>fileInputRef.current?.click()} disabled={uploading} className="text-xs text-blue-500 border rounded-lg px-2 py-1 disabled:opacity-50">
          {uploading ? 'جاري الرفع...' : (image ? 'تغيير الصورة' : 'رفع صورة')}
        </button>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={save} disabled={saving || uploading} className="flex-1 bg-[#FF6B2B] text-white rounded-lg py-2 text-sm font-bold disabled:opacity-50">
          {saving ? 'جاري الحفظ...' : 'حفظ'}
        </button>
        <button onClick={onCancel} className="text-gray-400 text-sm px-3">إلغاء</button>
      </div>
    </div>
  )
}
