-- B1.2/B1.4: verificación de email y recuperación de contraseña.
-- Backfill: las cuentas existentes quedan verificadas (son humanas conocidas;
-- sin esto el admin quedaría bloqueado en su próximo login).
ALTER TABLE "User" ADD COLUMN "emailVerified" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "verifyToken" TEXT;
ALTER TABLE "User" ADD COLUMN "verifyExpires" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_verifyToken_key" ON "User"("verifyToken");

CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordReset_token_key" ON "PasswordReset"("token");
CREATE INDEX "PasswordReset_userId_idx" ON "PasswordReset"("userId");

ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "User" SET "emailVerified" = CURRENT_TIMESTAMP WHERE "emailVerified" IS NULL;
