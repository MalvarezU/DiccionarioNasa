import NextAuth, { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { JWT } from "next-auth/jwt";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

const secret = process.env.NEXTAUTH_SECRET;
if (!secret) {
  // Falla en voz alta: jamás arrancar con secreto por defecto (RNF-11)
  throw new Error("NEXTAUTH_SECRET no está definido");
}

/** Inactividad máxima de la sesión (30 min) y frecuencia de re-sellado (5 min). */
export const INACTIVITY_LIMIT_S = 30 * 60;
export const ACTIVITY_WRITE_THROTTLE_S = 5 * 60;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) return null;

        // For demo: allow plain text comparison or bcrypt
        let isValid = false;
        if (user.password) {
          try {
            isValid = await bcrypt.compare(credentials.password, user.password);
          } catch {
            // If not bcrypt hash, do direct comparison (demo only)
            isValid = credentials.password === user.password;
          }
        }

        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      const now = Math.floor(Date.now() / 1000);

      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        (token as JWT & { lastActivity?: number }).lastActivity = now;
        return token;
      }

      const last =
        typeof (token as JWT & { lastActivity?: unknown }).lastActivity ===
        "number"
          ? ((token as JWT & { lastActivity?: number }).lastActivity as number)
          : now;

      if (now - last > INACTIVITY_LIMIT_S) {
        // Sesión expirada por inactividad: devolver null la destruye (NextAuth v4)
        return null as unknown as JWT;
      }

      // Re-sella la cookie como máximo cada 5 min (evita firmarla en cada request)
      if (now - last > ACTIVITY_WRITE_THROTTLE_S) {
        (token as JWT & { lastActivity?: number }).lastActivity = now;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    // We use a custom modal, not a dedicated page
    signIn: "/",
  },
  secret,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
