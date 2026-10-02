import Image from "next/image";
import Link from "next/link";

/**
 * Footer de la plataforma. Vive aparte porque lo comparten la portada `/`
 * y `/diccionario` (antes estaba embebido en la home del diccionario).
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Logo + Brand */}
          <div className="flex flex-col items-center md:items-start gap-3">
            <div className="flex items-center gap-4">
              <Image
                src="/ybc.jpg"
                alt="YBC Logo"
                width={72}
                height={72}
                className="rounded-full border-2 border-white/30"
              />
              <div>
                <p className="font-serif text-lg font-bold text-white">
                  Grupo YBC
                </p>
                <p className="text-xs text-white/70">
                  Piiyaak · Plataforma de la lengua Nasa Yuwe
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-xs font-semibold text-white uppercase tracking-wider mb-1">
              Navegación
            </p>
            <nav className="flex flex-col items-center gap-2">
              <Link
                href="/diccionario"
                className="text-xs text-white/70 hover:text-white transition-colors duration-200"
              >
                Diccionario
              </Link>
              <Link
                href="/juegos"
                className="text-xs text-white/70 hover:text-white transition-colors duration-200"
              >
                Juegos
              </Link>
              <Link
                href="/cursos"
                className="text-xs text-white/70 hover:text-white transition-colors duration-200"
              >
                Cursos
              </Link>
              <Link
                href="/#acerca"
                className="text-xs text-white/70 hover:text-white transition-colors duration-200"
              >
                Acerca del proyecto
              </Link>
              <Link
                href="/admin"
                className="text-xs text-white/70 hover:text-white transition-colors duration-200"
              >
                Administración
              </Link>
            </nav>
          </div>

          {/* Acknowledgment + Version */}
          <div className="flex flex-col items-center md:items-end gap-3">
            <p className="text-xs text-white/70 text-center md:text-right max-w-xs leading-relaxed">
              Piiyaak es una herramienta de preservación lingüística y cultural
              del pueblo Nasa (Páez) de Colombia.
            </p>
            <p className="text-2xs text-white/50">Versión 1.0.0</p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-white/20">
          <p
            className="text-center text-2xs text-white/50"
            suppressHydrationWarning
          >
            © {new Date().getFullYear()} Piiyaak · Proyecto de preservación de
            la lengua Nasa Yuwe
          </p>
        </div>
      </div>
    </footer>
  );
}
