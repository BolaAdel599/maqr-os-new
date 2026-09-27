import { prisma } from "./prisma"

// Small standalone module (not lib/security.ts) so lib/auth.ts can use this
// without creating an auth.ts <-> security.ts circular import, since
// security.ts itself imports authOptions from auth.ts.
export async function getRestaurantByDomain(domain: string) {
  try {
    if (!domain) return null
    const host = domain.replace(/^https?:\/\//, '').split('/')[0].split(':')[0]
    const slug = host.split('.')[0]
    const restaurant = await prisma.restaurant.findFirst({ where: { OR: [{ slug }, { domain: host }, { customDomain: host }] } })
    return restaurant
  } catch { return null }
}
