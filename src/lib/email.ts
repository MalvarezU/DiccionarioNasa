/**
 * Envío de correos transaccionales vía Resend (HTTP, sin dependencias).
 *
 * Sin RESEND_API_KEY (desarrollo): no envía, avisa por consola y reporta
 * `sent:false` para que el caller decida (el registro auto-verifica en
 * ese caso; en producción la key es obligatoria — ver SDD checklist).
 */

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(
  input: SendEmailInput
): Promise<{ sent: boolean; id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Piiyaak <hola@piiyaak.com>";

  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY ausente: no se envió a ${input.to} («${input.subject}»)`
    );
    return { sent: false };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, ...input }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[email] Resend ${res.status}: ${detail.slice(0, 200)}`);
    return { sent: false };
  }

  const body = (await res.json().catch(() => null)) as { id?: string } | null;
  return { sent: true, id: body?.id };
}

export function appBaseUrl(requestUrl?: string): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  if (requestUrl) return new URL(requestUrl).origin;
  return "http://localhost:3000";
}
