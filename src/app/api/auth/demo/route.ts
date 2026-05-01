// Demo user creation endpoint
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/auth/demo
 * Create a demo user for testing purposes.
 * Only works if the demo user doesn't already exist.
 */
export async function POST() {
  try {
    const existing = await db.user.findUnique({
      where: { email: 'demo@nasayuwe.com' },
    })

    if (existing) {
      return NextResponse.json({
        message: 'Demo user already exists',
        email: 'demo@nasayuwe.com',
        password: 'demo123',
      })
    }

    const hashedPassword = await bcrypt.hash('demo123', 10)

    await db.user.create({
      data: {
        email: 'demo@nasayuwe.com',
        name: 'Usuario Demo',
        password: hashedPassword,
        role: 'user',
      },
    })

    return NextResponse.json({
      message: 'Demo user created',
      email: 'demo@nasayuwe.com',
      password: 'demo123',
    })
  } catch (error) {
    console.error('Demo user creation error:', error)
    return NextResponse.json(
      { message: 'Error creating demo user' },
      { status: 500 }
    )
  }
}
