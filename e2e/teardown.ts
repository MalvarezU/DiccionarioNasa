import * as path from "path";
import { config as dotenv } from "dotenv";

/**
 * Limpieza post-E2E (B4): borra lo creado por la suite.
 * - Usuarios e2e-* (cascada: favoritos, historial, progreso, sesiones juego).
 * - Palabras "E2E *" (auditoría queda con entityId huérfano = histórico).
 * - Sesiones de juego anónimas e2e-*.
 */
async function teardown() {
  dotenv({ path: path.resolve(__dirname, "../.env") });
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  try {
    const sessions = await db.userGameSession.deleteMany({
      where: { sessionKey: { startsWith: "e2e-" } },
    });
    const words = await db.dictionaryWord.deleteMany({
      where: { spanish: { startsWith: "E2E " } },
    });
    const users = await db.user.deleteMany({
      where: { email: { startsWith: "e2e-" } },
    });
    console.log(
      `[teardown] sesiones juego: ${sessions.count}, palabras: ${words.count}, usuarios: ${users.count}`
    );
  } finally {
    await db.$disconnect();
  }
}

export default teardown;
