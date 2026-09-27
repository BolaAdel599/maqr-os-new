
import { AuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import { getRestaurantByDomain } from "./restaurant"
import bcrypt from "bcryptjs"

export const authOptions: AuthOptions = {
  providers: [CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
      restaurantDomain: { label: "Domain", type: "text" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null
      try {
        const user = await prisma.user.findUnique({ where: { email: credentials.email } })
        if (!user) return null
        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) return null

        // Cross-tenant guard: if this login happened on a specific restaurant's
        // subdomain, a staff account belonging to a *different* restaurant
        // should not be able to log in there (except platform-wide roles).
        if (credentials.restaurantDomain && user.role !== "SUPER_ADMIN") {
          const domainRestaurant = await getRestaurantByDomain(credentials.restaurantDomain)
          if (domainRestaurant && user.restaurantId && domainRestaurant.id !== user.restaurantId) {
            return null
          }
        }

        // Subscription check: the login page already has UI for this
        // ("الاشتراك منتهي") but nothing used to actually throw it.
        if (user.restaurantId && user.role !== "SUPER_ADMIN") {
          const restaurant = await prisma.restaurant.findUnique({ where: { id: user.restaurantId } })
          if (restaurant?.subscriptionStatus === "EXPIRED") {
            throw new Error("SUBSCRIPTION_EXPIRED")
          }
        }

        return { id: user.id, email: user.email, name: user.name, role: user.role, restaurantId: user.restaurantId } as any
      } catch (e: any) {
        if (e?.message === "SUBSCRIPTION_EXPIRED") throw e
        console.error("authorize error", e)
        return null
      }
    }
  })],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }: any) { if (user) { token.role = user.role; token.restaurantId = user.restaurantId; } return token },
    async session({ session, token }: any) { if (token) { (session.user as any).role = token.role; (session.user as any).restaurantId = token.restaurantId; (session.user as any).id = token.sub; } return session }
  },
  secret: process.env.NEXTAUTH_SECRET,
}
