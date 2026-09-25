-- Búsqueda con unaccent: la ruta /api/dictionary/search lo exige.
-- En Supabase se habilita por panel; esta migración lo deja explícito y
-- hace que la BD local de pruebas tenga paridad con prod.
CREATE EXTENSION IF NOT EXISTS unaccent;
