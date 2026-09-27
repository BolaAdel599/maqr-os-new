
import crypto from "crypto"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { prisma } from "./prisma"
import { authOptions } from "./auth"

export { getRestaurantByDomain } from "./restaurant"

const attemptsMap = new Map<string, { count: number, first: number }>()

/** Simple in-memory rate limit. NOTE: on serverless (Vercel) this only limits
 * within a single warm instance - it is a best-effort speed bump, not the
 * real brute-force protection. Real lockouts (driver codes, login) MUST use
 * the DB-backed counters below, not this map. */
export function rateLimit(key: string, limit: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now()
  const rec = attemptsMap.get(key)
  if (!rec || now - rec.first > windowMs) { attemptsMap.set(key, { count: 1, first: now }); return true }
  rec.count++
  return rec.count <= limit
}

/**
 * Real Paymob HMAC verification. Paymob concatenates a fixed, documented set
 * of fields from the transaction callback object (in this exact order) and
 * computes an HMAC-SHA512 with your Paymob HMAC secret. We compare using a
 * constant-time comparison to avoid timing attacks.
 * https://docs.paymob.com/docs/transaction-callback-hmac
 */
export function verifyPaymobHmac(obj: any, hmac: string): boolean {
  const secret = process.env.PAYMOB_HMAC
  if (!secret || !hmac) return false
  const fields = [
    "amount_cents", "created_at", "currency", "error_occured",
    "has_parent_transaction", "id", "integration_id", "is_3d_secure",
    "is_auth", "is_capture", "is_refunded", "is_standalone_payment",
    "is_voided", "order.id", "owner", "pending", "source_data.pan",
    "source_data.sub_type", "source_data.type", "success",
  ]
  const get = (path: string) => path.split(".").reduce((o: any, k: string) => (o == null ? o : o[k]), obj)
  const concatenated = fields.map((f) => {
    const v = get(f)
    return v === undefined || v === null ? "" : String(v)
  }).join("")
  const computed = crypto.createHmac("sha512", secret).update(concatenated).digest("hex")
  const a = Buffer.from(computed)
  const b = Buffer.from(String(hmac))
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function encrypt(text: string) { return text }
export function decrypt(text: string) { return text }
export function generateToken() { return crypto.randomBytes(16).toString("hex") }

type Role = "SUPER_ADMIN" | "RESTAURANT_ADMIN" | "CASHIER" | "KITCHEN" | "DRIVER"

/**
 * Server-side session + role guard for API routes. Returns the session on
 * success, or a NextResponse to return immediately on failure.
 */
export async function requireApiSession(allowedRoles: Role[]) {
  const session: any = await getServerSession(authOptions)
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  if (!allowedRoles.includes(session.user.role)) {
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { session, error: null }
}

/**
 * DB-backed lockout check/increment for an Order (used for driver
 * verification codes). Unlike the in-memory map, this survives across
 * serverless invocations because it's stored on the Order row itself.
 */
export async function checkOrderLock(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) return { order: null, locked: false }
  if (order.lockedUntil && order.lockedUntil.getTime() > Date.now()) {
    return { order, locked: true }
  }
  return { order, locked: false }
}

export async function registerFailedAttempt(orderId: string, currentAttempts: number) {
  const attempts = currentAttempts + 1
  const data: any = { attempts }
  if (attempts >= 5) {
    data.lockedUntil = new Date(Date.now() + 10 * 60 * 1000) // 10 min lock
  }
  await prisma.order.update({ where: { id: orderId }, data })
  return attempts
}

export async function resetAttempts(orderId: string) {
  await prisma.order.update({ where: { id: orderId }, data: { attempts: 0, lockedUntil: null } })
}
