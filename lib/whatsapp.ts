
export const templates = {
  orderConfirmed: (orderNumber: number) => `تم تأكيد طلبك رقم #${orderNumber}`,
  orderReady: (orderNumber: number) => `طلبك رقم #${orderNumber} جاهز للاستلام`,
  verificationCode: (code: string) => `كود التأكيد الخاص بك هو: ${code}`,
  driverAssigned: (name: string) => `السائق ${name} في الطريق إليك`,
  subscription: (name: string, days: number) => `تنبيه: اشتراك مطعم ${name} ينتهي خلال ${days} يوم`,
  paymentLink: (url: string) => `لإتمام الدفع لطلبك، اضغط هنا: ${url}`,
}

// Egyptian mobile numbers: accepts +20 1xxxxxxxxx / 201xxxxxxxxx / 01xxxxxxxxx
// and normalizes to E.164 (+201xxxxxxxxx). Returns null if invalid.
export function normalizeEgyptianPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "")
  let n = digits
  if (n.startsWith("+20")) n = n.slice(3)
  else if (n.startsWith("20")) n = n.slice(2)
  else if (n.startsWith("0")) n = n.slice(1)
  if (!/^1[0125]\d{8}$/.test(n)) return null
  return `+20${n}`
}

/**
 * Sends a WhatsApp message via the WhatsApp Cloud API (Meta), when
 * WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID are configured. Falls back to
 * logging (and returning false) so calling code doesn't crash in dev/local
 * environments without WhatsApp credentials set up.
 */
export async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  const phone = normalizeEgyptianPhone(to)
  if (!phone) {
    console.warn('[whatsapp] invalid phone, not sending:', to)
    return false
  }
  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) {
    console.log('[whatsapp:not-configured]', phone, message)
    return false
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone.replace('+', ''),
        type: 'text',
        text: { body: message },
      }),
    })
    if (!res.ok) {
      console.error('[whatsapp] send failed', res.status, await res.text())
      return false
    }
    return true
  } catch (e) {
    console.error('[whatsapp] send error', e)
    return false
  }
}
