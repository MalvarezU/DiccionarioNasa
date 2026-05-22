import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("Seeding users...");

  const saltRounds = 10;

  // Check if users already exist
  const existingCount = await db.user.count();
  if (existingCount > 0) {
    console.log(`Users already exist (${existingCount} found). Skipping seed.`);
    console.log("\n=== Credenciales de prueba ===");
    console.log("\n[ADMINISTRADORES]");
    console.log("Email: admin1@example.com | Password: admin123");
    console.log("Email: admin2@example.com | Password: admin456");
    console.log("\n[USUARIOS COMUNES]");
    console.log("Email: juan@example.com  | Password: user123");
    console.log("Email: maria@example.com | Password: user456");
    console.log("Email: carlos@example.com | Password: user789");
    return;
  }

  // Admin users
  const admin1Password = await bcrypt.hash("admin123", saltRounds);
  const admin2Password = await bcrypt.hash("admin456", saltRounds);

  // Regular users
  const user1Password = await bcrypt.hash("user123", saltRounds);
  const user2Password = await bcrypt.hash("user456", saltRounds);
  const user3Password = await bcrypt.hash("user789", saltRounds);

  const users = await db.user.createMany({
    data: [
      {
        email: "admin1@example.com",
        name: "Administrador Principal",
        password: admin1Password,
        role: "admin",
      },
      {
        email: "admin2@example.com",
        name: "Administrador Secundario",
        password: admin2Password,
        role: "admin",
      },
      {
        email: "juan@example.com",
        name: "Juan Pérez",
        password: user1Password,
        role: "user",
      },
      {
        email: "maria@example.com",
        name: "María González",
        password: user2Password,
        role: "user",
      },
      {
        email: "carlos@example.com",
        name: "Carlos Rodríguez",
        password: user3Password,
        role: "user",
      },
    ],
  });

  console.log(`Inserted ${users.count} users!`);
  console.log("\n=== Credenciales de prueba ===");
  console.log("\n[ADMINISTRADORES]");
  console.log("Email: admin1@example.com | Password: admin123");
  console.log("Email: admin2@example.com | Password: admin456");
  console.log("\n[USUARIOS COMUNES]");
  console.log("Email: juan@example.com  | Password: user123");
  console.log("Email: maria@example.com | Password: user456");
  console.log("Email: carlos@example.com | Password: user789");
}

main()
  .catch((e) => {
    console.error("Error seeding users:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
