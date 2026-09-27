/**
 * Paymob "classic" payment flow (auth token -> order registration -> payment
 * key -> iframe). This was entirely missing before - only the webhook
 * *receiver* existed (lib/security.ts verifyPaymobHmac / app/api/payment/webhook),
 * with nothing in the app that ever actually started a Paymob payment.
 *
 * Docs: https://docs.paymob.com/docs/accept-standard-redirect
 *
 * Required env vars: PAYMOB_API_KEY, PAYMOB_INTEGRATION_ID, PAYMOB_IFRAME_ID
 */

const BASE_URL = "https://accept.paymob.com/api"

function assertConfigured() {
  if (!process.env.PAYMOB_API_KEY || !process.env.PAYMOB_INTEGRATION_ID || !process.env.PAYMOB_IFRAME_ID) {
    throw new Error("Paymob is not configured (set PAYMOB_API_KEY, PAYMOB_INTEGRATION_ID, PAYMOB_IFRAME_ID)")
  }
}

async function getAuthToken(): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: process.env.PAYMOB_API_KEY }),
  })
  if (!res.ok) throw new Error(`Paymob auth failed: ${res.status}`)
  const data = await res.json()
  return data.token
}

async function registerOrder(authToken: string, merchantOrderId: string, amountCents: number): Promise<number> {
  const res = await fetch(`${BASE_URL}/ecommerce/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      delivery_needed: false,
      amount_cents: amountCents,
      currency: "EGP",
      merchant_order_id: merchantOrderId,
      items: [],
    }),
  })
  if (!res.ok) throw new Error(`Paymob order registration failed: ${res.status}`)
  const data = await res.json()
  return data.id
}

async function getPaymentKey(authToken: string, paymobOrderId: number, amountCents: number, billing: {
  first_name: string, phone_number: string
}): Promise<string> {
  const res = await fetch(`${BASE_URL}/acceptance/payment_keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token: authToken,
      amount_cents: amountCents,
      expiration: 3600,
      order_id: paymobOrderId,
      billing_data: {
        first_name: billing.first_name || "Guest",
        last_name: "N/A",
        phone_number: billing.phone_number || "NA",
        email: "guest@maqr.cloud",
        city: "NA", country: "EG", street: "NA", building: "NA", floor: "NA", apartment: "NA",
        state: "NA", postal_code: "NA",
      },
      currency: "EGP",
      integration_id: Number(process.env.PAYMOB_INTEGRATION_ID),
    }),
  })
  if (!res.ok) throw new Error(`Paymob payment key request failed: ${res.status}`)
  const data = await res.json()
  return data.token
}

/**
 * Starts a Paymob payment for an existing internal Order and returns the
 * iframe URL to send the customer to. Uses our own Order.id as Paymob's
 * merchant_order_id, so the webhook (which looks up Order by merchant_order_id)
 * can find it back without any extra mapping table.
 */
export async function createPaymobPayment(orderId: string, amountEGP: number, billing: { name: string, phone: string }) {
  assertConfigured()
  const amountCents = Math.round(amountEGP * 100)
  const authToken = await getAuthToken()
  const paymobOrderId = await registerOrder(authToken, orderId, amountCents)
  const paymentToken = await getPaymentKey(authToken, paymobOrderId, amountCents, {
    first_name: billing.name, phone_number: billing.phone,
  })
  const iframeUrl = `${BASE_URL}/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${paymentToken}`
  return { iframeUrl, paymobOrderId }
}
