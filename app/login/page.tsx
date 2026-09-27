'use client'
import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm(){
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'

  const submit = async (e:any)=>{
    e.preventDefault()
    setLoading(true)
    setError('')
    const host = window.location.host
    const res = await signIn('credentials', { email, password, restaurantDomain: host, redirect:false })
    setLoading(false)
    if(res?.error){
      if(res.error==='SUBSCRIPTION_EXPIRED') setError('الاشتراك منتهي - تواصل مع الدعم')
      else setError('ايميل او باسورد غلط')
    } else {
      router.push(callbackUrl)
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFBF5] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-[24px] shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-[#FF6B2B] rounded-full mx-auto flex items-center justify-center text-white font-bold">M</div>
          <h1 className="text-xl font-bold mt-3">تسجيل دخول Maqr OS</h1>
          <p className="text-xs text-gray-500 mt-1">ادخل بياناتك للوصول للوحة التحكم</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="الايميل" className="w-full border rounded-xl px-4 py-3 text-sm" required/>
          <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="الباسورد" className="w-full border rounded-xl px-4 py-3 text-sm" required/>
          {error && <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl">{error}</div>}
          <button disabled={loading} className="w-full bg-[#FF6B2B] text-white rounded-full py-3 font-bold disabled:opacity-50">
            {loading ? 'جاري الدخول...' : 'دخول'}
          </button>
        </form>
        {process.env.NODE_ENV !== 'production' && (
          <div className="mt-6 bg-gray-50 rounded-xl p-3 text-xs space-y-1">
            <p className="font-bold">حسابات تجريبية (تظهر بس في بيئة التطوير):</p>
            <p>سوبر: super@maqr.cloud / super123</p>
            <p>صاحب: owner@el-tahrir.com / owner123</p>
            <p>كاشير: cashier@el-tahrir.com / cashier123</p>
            <p>مطبخ: kitchen@el-tahrir.com / kitchen123</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Login(){
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400" dir="rtl">جاري التحميل...</div>}>
      <LoginForm />
    </Suspense>
  )
}