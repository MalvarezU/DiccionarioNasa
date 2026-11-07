import { createHash } from "crypto";

/**
 * Fase A T08 — hash de registro de medios (spec §4.1).
 *
 * Hex minúsculas, 64 caracteres, calculado sobre los bytes originales ANTES
 * del `putObject`. El test lo verifica contra un hash independiente.
 */
export function sha256Hex(data: Uint8Array | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}
