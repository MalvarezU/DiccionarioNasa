-- Ilustración por palabra.
--
-- Mismo patrón que "audioUrl": un string con la URL pública (/api/media/[id])
-- y no una relación, porque el binario vive en MediaAsset (Postgres) y se
-- sirve desde el mismo origen para que el service worker del PWA lo cachee.
--
-- Aditiva y nullable: las filas existentes quedan sin ilustración y la ficha
-- la muestra solo cuando existe.
ALTER TABLE "DictionaryWord" ADD COLUMN "illustrationUrl" TEXT;
