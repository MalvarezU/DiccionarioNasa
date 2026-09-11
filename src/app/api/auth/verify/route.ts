import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * GET /api/auth/verify?token=
 * Activa la cuenta (un solo uso) y redirige. Token inválido/expirado → error.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  const home = new URL("/", request.url)

  if (!token) {
    home.searchParams.set("verify", "error")
    return NextResponse.redirect(home)
  }

  try {
    const user = await db.user.findUnique({ where: { verifyToken: token } })
    if (
      !user ||
      !user.verifyExpires ||
      user.verifyExpires.getTime() < Date.now()
    ) {
      home.searchParams.set("verify", "error")
      return NextResponse.redirect(home)
    }

    await db.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date(), verifyToken: null, verifyExpires: null },
    })

    home.searchParams.set("verified", "1")
    return NextResponse.redirect(home)
  } catch (error) {
    console.error("Verify error:", error)
    home.searchParams.set("verify", "error")
    return NextResponse.redirect(home)
  }
}
