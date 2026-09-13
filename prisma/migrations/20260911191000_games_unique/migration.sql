-- B2.1: unicidad para el upsert de resultados (NULLs no colisionan en PG).
CREATE UNIQUE INDEX IF NOT EXISTS "UserGameSession_userId_game_key" ON "UserGameSession"("userId", "game");
CREATE UNIQUE INDEX IF NOT EXISTS "UserGameSession_sessionKey_game_key" ON "UserGameSession"("sessionKey", "game");
