import NextAuth, { type DefaultSession } from "next-auth"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { PrismaClient } from "@/src/generated/prisma"

const prisma = new PrismaClient()

// Extend the built-in session type
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      isActive: boolean
    } & DefaultSession["user"]
  }

  interface User {
    role: string
    isActive: boolean
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
          // Optional: Restrict to specific domain
          // hd: "syatt.io"
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Check if email is from allowed domain
      const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN || "syatt.io"
      if (user.email && !user.email.endsWith(`@${allowedDomain}`)) {
        return false // Deny sign in
      }

      return true
    },
    async session({ session, user }) {
      // Add user id, role, and isActive to session
      if (session.user) {
        session.user.id = user.id
        session.user.role = user.role
        session.user.isActive = user.isActive

        // Auto-promote admin email to admin role if still member
        const adminEmail = process.env.ADMIN_EMAIL
        if (user.email === adminEmail && user.role === "member") {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: "admin" },
          })
          session.user.role = "admin"
        }
      }
      return session
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  debug: process.env.NODE_ENV === "development",
})
