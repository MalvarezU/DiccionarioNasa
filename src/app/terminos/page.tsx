import { NavBar } from "@/components/navbar";
import { SiteFooter } from "@/components/site-footer";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  TermsDocument,
  TERMS_TITLE,
  LEGAL_UPDATED_LABEL,
  LEGAL_VERSION,
} from "@/components/legal-content";

export const metadata = {
  title: "Términos y Condiciones — Piiyaak",
  description: "Términos y condiciones de uso de la plataforma Piiyaak.",
};

export default function TerminosPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main id="contenido" className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8">
        <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Términos y Condiciones" }]} />
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-primary mb-2">
          {TERMS_TITLE}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Última actualización: {LEGAL_UPDATED_LABEL} · Versión {LEGAL_VERSION}
        </p>
        <TermsDocument />
      </main>
      <SiteFooter />
    </div>
  );
}
