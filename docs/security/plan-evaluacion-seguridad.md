# Plan de Evaluación de Seguridad — Piiyaak (Web + Móvil)

> **Proyecto:** Piiyaak / Diccionario Nasa Yuwe — Next.js 16 + Prisma + Supabase/Postgres + R2 + Expo (offline-first)
> **Rama de trabajo:** `security/evaluacion-seguridad`
> **Alcance:** App web (producción en Vercel) + app móvil Expo (`piiyaak-app/`)
> **Objetivo:** Plan riguroso, reproducible y trazable por módulo, con casos de prueba, severidades, gates de salida y evidencia.

---

## 1. Contexto y alcance

**En alcance (web):** autenticación, autorización/RBAC, API REST por dominio, media, importación, sync, infra.
**En alcance (móvil):** auth headless, SQLite local, sync, audio, normalize.
**Fuera de alcance:** pentest de infra cloud del cliente, ingeniería social, carga masiva (salvo rate-limit).

## 2. Activos a proteger

A1 Credenciales (bcrypt) · A2 Sesiones JWT/cookies · A3 Rol/privilegios · A4 Corpus (integridad) · A5 Media R2 · A6 Progreso/favoritos · A7 Audit logs · A8 PII · A9 Secretos.

## 3. Metodología y estándares

OWASP ASVS 4.0 (L1/L2/L3), OWASP Top 10 2021, OWASP API Security Top 10, OWASP MASVS/MASTG (móvil), CWE, CVSS 3.1.
Estrategia: SAST + DAST + SCA + revisión manual + pruebas de autorización por rol + fuzzing de inputs.

Severidades: Crítico (P0, bloquea release), Alto (P1), Medio (P2), Bajo (P3), Informativo.

## 4. Arquitectura de pruebas

L0 lint/type (cada PR) · L1 SAST Semgrep/CodeQL (cada PR) · L2 SCA npm audit/Dependabot (semanal) · L3 Vitest (cada PR) · L4 Playwright E2E (cada PR) · L5 DAST ZAP (pre-release) · L6 Manual checklist (pre-release) · L7 Móvil MobSF (pre-release).

Entorno: staging con datos sintéticos. Nunca DAST destructivo contra prod.

## 5. Plan por módulo — WEB (resumen, detalle en matriz de autorización)

M1 Autenticación y sesión · M2 Autorización/RBAC · M3 Panel admin · M4 Diccionario público · M5 Cursos/módulos/lecciones/progreso · M6 Juegos · M7 Media · M8 Sync · M9 Infra/config/deps · M10 Privacidad.

Casos de prueba detallados: ver `docs/security/matriz-autorizacion.md` y bitácora de ejecución.

## 6. Plan por módulo — APP MÓVIL

MM1 Almacenamiento · MM2 Red · MM3 Auth · MM4 Integridad · MM5 Sync offline. Estándar OWASP MASVS L1/L2.

## 7. Ejecución por fases

F0 Inventario + matriz · F1 SAST/SCA/secrets · F2 M1–M4 · F3 M5–M8 · F4 M9–M10 · F5 Móvil · F6 DAST + remediación P0/P1 · F7 Re-test + cierre.

## 8. Gate de salida (release)

0 Críticos abiertos; 0 Altos sin mitigación; 100% casos SEC-* documentados; matriz de autorización firmada; tsc limpio sin ignoreBuildErrors; SCA sin high/critical sin justificación; gitleaks sin hallazgos; DAST baseline sin high; re-test P0/P1 cerrado.

## 9. Entregables

1. `docs/security/plan-evaluacion-seguridad.md` (este)
2. `docs/security/matriz-autorizacion.md`
3. `docs/security/informe-hallazgos.md`
4. `docs/security/evidencia/`
5. Actualización de trazabilidad RNF seguridad.

## 10. Riesgos y deuda conocida

Rate-limit/lockout en memoria (R-03); bucket R2 público por diseño; bcrypt cost verificar ≥12 en todos los paths; cookie móvil solo en memoria; sin RLS en Supabase; demo endpoint expone credenciales.

## 11. Métricas

% casos SEC-* ejecutados; hallazgos por severidad (tendencia); MTTR P0/P1; cobertura matriz autorización (objetivo 100%).
