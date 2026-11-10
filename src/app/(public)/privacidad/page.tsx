import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  PrivacyDocument,
  PRIVACY_TITLE,
  LEGAL_UPDATED_LABEL,
  LEGAL_VERSION,
} from "@/components/legal-content";

export const metadata = {
  title: "Política de Privacidad — Piiyaak",
  description: "Política de privacidad y tratamiento de datos personales de Piiyaak.",
};

export default function PrivacidadPage() {
  return (
      <main id="contenido" className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8">
        <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Política de Privacidad" }]} />
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-primary mb-2">
          {PRIVACY_TITLE}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Última actualización: {LEGAL_UPDATED_LABEL} · Versión {LEGAL_VERSION}
        </p>
        <PrivacyDocument />
      </main>
  );
}
