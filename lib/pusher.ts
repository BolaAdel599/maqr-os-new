import PusherServer from 'pusher'
import PusherClient from 'pusher-js'

const hasServerConfig = !!(
  process.env.PUSHER_APP_ID && process.env.PUSHER_KEY &&
  process.env.PUSHER_SECRET && process.env.PUSHER_CLUSTER
)

// Real Pusher server client when credentials are configured. Falls back to a
// no-op so the app still runs (with polling as the fallback real-time
// mechanism - see the *.page.tsx files) when Pusher isn't set up yet.
export const pusherServer = hasServerConfig
  ? new PusherServer({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER!,
      useTLS: true,
    })
  : { trigger: async (...args: any[]) => { console.warn('[pusher] not configured, skipping trigger', args[0]) } }

let clientSingleton: PusherClient | null = null

export function getPusherClient(): PusherClient | null {
  if (typeof window === 'undefined') return null
  if (!process.env.NEXT_PUBLIC_PUSHER_KEY || !process.env.NEXT_PUBLIC_PUSHER_CLUSTER) return null
  if (!clientSingleton) {
    clientSingleton = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
    })
  }
  return clientSingleton
}

// Backwards-compatible export some pages import directly; prefer
// getPusherClient() in new code so we don't construct a client with no keys.
export const pusherClient = {
  subscribe: (channel: string) => getPusherClient()?.subscribe(channel) ?? { bind: () => {}, unbind: () => {} },
  unsubscribe: (channel: string) => getPusherClient()?.unsubscribe(channel),
}
