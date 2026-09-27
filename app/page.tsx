
export default function Home(){
  return <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5] p-6" dir="rtl">
    <div className="max-w-2xl w-full bg-white rounded-[24px] shadow p-8 text-center">
      <h1 className="text-3xl font-bold">Maqr OS 🧡</h1>
      <p className="text-gray-500 mt-2">نظام ادارة المطاعم - SaaS</p>
      <div className="grid grid-cols-2 gap-3 mt-6 text-sm">
        <a href="/t/5" className="bg-[#0A0A0B] text-white rounded-xl p-4">عميل QR - ترابيزة 5</a>
        <a href="/kitchen" className="bg-[#0A0A0B] text-white rounded-xl p-4">المطبخ KDS</a>
        <a href="/cashier" className="bg-[#FF6B2B] text-white rounded-xl p-4">الكاشير POS</a>
        <a href="/driver" className="bg-[#0A0A0B] text-white rounded-xl p-4">الطيار</a>
        <a href="/admin/menu" className="bg-[#0A0A0B] text-white rounded-xl p-4">إدارة المنيو</a>
        <a href="/admin/payments" className="bg-[#0A0A0B] text-white rounded-xl p-4">دفعات معلقة</a>
      </div>
      <p className="mt-6 text-xs text-gray-400">افتح /super للسوبر ادمن - الدومينات عبر middleware</p>
    </div>
  </div>
}
