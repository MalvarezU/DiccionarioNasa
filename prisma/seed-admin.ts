/**
 * Seed script: Create the initial admin user.
 *
 * Usage:
 *   bun run prisma/seed-admin.ts
 *
 * Or with custom credentials:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=MySecurePass123 bun run prisma/seed-admin.ts
 */

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@nasayuwe.com"
  const password = process.env.ADMIN_PASSWORD || "AdminNasa2024!"
  const name = process.env.ADMIN_NAME || "Administrador"

  console.log(`Creating admin user: ${email}`)

  // Check if admin already exists
  const existing = await prisma.user.findUnique({
    where: { email },
  })

  if (existing) {
    if (existing.role === "admin") {
      console.log(`✓ Admin user already exists: ${email}`)
      return
    }

    // Promote existing user to admin
    await prisma.user.update({
      where: { email },
      data: { role: "admin" },
    })
    console.log(`✓ Existing user promoted to admin: ${email}`)
    return
  }

  // Create new admin user
  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role: "admin",
    },
  })

  console.log(`✓ Admin user created successfully!`)
  console.log(`  Email: ${user.email}`)
  console.log(`  Name: ${user.name}`)
  console.log(`  Role: ${user.role}`)
  console.log(`  Password: ${password}`)
  console.log()
  console.log(`⚠️  Change the default password after first login!`)
}

main()
  .catch((e) => {
    console.error("Error creating admin user:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
