# Propuesta — Términos y Condiciones y Política de Privacidad (Piiyaak Web)

**Rama:** `terminos-y-condiciones` (desde `main`)  
**Fecha:** 5 de noviembre de 2026  
**Alcance:** Web Next.js (`Diccionario nasa`).

## Objetivo
Incorporar a la plataforma web un marco legal mínimo (Términos y Condiciones + Política de Privacidad) y
registrar el consentimiento del usuario al momento del registro, conforme a la Ley 1581 de 2012 (Colombia).

## Entregado en esta rama
- Páginas públicas:
  - `/terminos` — Términos y Condiciones de Uso (10 secciones).
  - `/privacidad` — Política de Privacidad (11 secciones).
- Modal de autenticación (`auth-modal.tsx`):
  - Checkbox de aceptación en modo registro.
  - Validación que bloquea el envío si no se acepta.
  - Envío de `acceptedTerms` / `acceptedPrivacy` en el request de registro.
- Footer (`site-footer.tsx`): enlaces a `/terminos` y `/privacidad`.

## Pendientes (próxima iteración)
1. **Persistencia del consentimiento**: añadir campos al modelo `User` (`termsAcceptedAt`,
   `privacyAcceptedAt`, `termsVersion`, `privacyVersion`) y migración Prisma; guardar en
   `/api/auth/register` solo cuando `acceptedTerms && acceptedPrivacy` sean `true`.
2. Actualizar tests de `register/route.test.ts` para el nuevo contrato.
3. (Opcional) Re-pedir aceptación cuando cambie la versión de los términos.
4. (Opcional) Página de "Mis datos" para ejercer derechos ARCO.

## Notas
- Textos redactados en español neutro/profesional, orientados a un proyecto educativo/comunitario.
- Correo de contacto placeholder: `contacto@piiyaak.org` (ajustar dominio real).
- Versión de documentos: 1.0 (5 de noviembre de 2026).