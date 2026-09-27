
import './globals.css'
import { Providers } from './providers'
import { Cairo } from 'next/font/google'

const cairo = Cairo({ subsets: ['arabic', 'latin'], variable: '--font-cairo' })

export const metadata = { title: 'Maqr OS', description: 'Restaurant OS' }
export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="ar" dir="rtl" className={cairo.variable}><body><Providers>{children}</Providers></body></html>
}
