
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Which roles may access each protected section. Previously NOTHING checked
// this - anyone could open /kitchen, /cashier, /driver, /super directly.
const ROUTE_ROLES: Record<string, string[]> = {
  '/kitchen': ['KITCHEN', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'],
  '/cashier': ['CASHIER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'],
  '/driver': ['DRIVER', 'RESTAURANT_ADMIN', 'SUPER_ADMIN'],
  '/super': ['SUPER_ADMIN'],
  '/admin': ['RESTAURANT_ADMIN', 'SUPER_ADMIN'],
}

export async function middleware(req: NextRequest){
  const host = req.headers.get('host') || ''
  const cleanHost = host.replace(/:3000|:3001/, '').replace(/^www\./,'')
  const { pathname } = req.nextUrl

  const protectedPrefix = Object.keys(ROUTE_ROLES).find((p) => pathname.startsWith(p))
  if (protectedPrefix) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    const role = (token as any)?.role
    if (!token || !ROUTE_ROLES[protectedPrefix].includes(role)) {
      const loginUrl = req.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Allow main domain and api
  if(cleanHost==='maqr.cloud' || cleanHost==='localhost' || cleanHost.includes('vercel.app') || pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  // For custom domains: pass to header, actual lookup in layout via x-restaurant-domain
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-restaurant-domain', cleanHost)

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = { matcher: ['/((?!_next|static|favicon).*)'] }
