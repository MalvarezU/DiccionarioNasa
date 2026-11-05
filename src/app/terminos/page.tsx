import { NavBar } from "@/components/navbar";
import { SiteFooter } from "@/components/site-footer";
import { Breadcrumbs } from "@/components/breadcrumbs";

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
          Términos y Condiciones de Uso
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Última actualización: 5 de noviembre de 2026 · Versión 1.0
        </p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-serif font-bold text-primary mt-6 mb-2">1. Objeto</h2>
            <p>
              Piiyaak (en adelante, "la Plataforma") es un proyecto de preservación y difusión de la
              lengua Nasa Yuwe del pueblo Nasa (Páez) de Colombia. Ofrece un diccionario bilingüe,
              juegos didácticos y una ruta de aprendizaje, accesibles desde la web y la aplicación móvil.
              Estos Términos y Condiciones regulan el uso de la Plataforma por parte de las personas
              usuarias (en adelante, "el Usuario").
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-primary mt-6 mb-2">2. Acceso y cuenta de usuario</h2>
            <p>
              Para acceder a funciones personalizadas (favoritos, progreso, cursos) el Usuario debe crear
              una cuenta con correo electrónico y contraseña, o ingresar mediante Google. El Usuario se
              compromete a proporcionar información veraz y a mantener la confidencialidad de sus
              credenciales. Es responsable de toda actividad realizada desde su cuenta.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-primary mt-6 mb-2">3. Uso aceptable</h2>
            <p>
              El Usuario se compromete a usar la Plataforma de forma lícita y respetuosa, sin intentar
              vulnerar su seguridad, extraer datos de forma masiva, ni publicar contenidos ofensivos o
              que atenten contra la dignidad del pueblo Nasa. El uso indebido puede dar lugar a la
              suspensión o cancelación de la cuenta.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-primary mt-6 mb-2">4. Contenido y propiedad intelectual</h2>
            <p>
              El diccionario, los audios, las imágenes y los cursos son aportes de la comunidad y del
              equipo de Piiyaak. El Usuario puede consultarlos y usarlos para fines educativos y de
              preservación lingüística. No se permite la reproducción comercial ni la redistribución
              masiva sin autorización expresa. Las contribuciones del Usuario (correcciones, sugerencias)
              podrán ser incorporadas al corpus con el crédito correspondiente.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-primary mt-6 mb-2">5. Datos personales y privacidad</h2>
            <p>
              El tratamiento de los datos personales se rige por la Política de Privacidad disponible en{" "}
              <a href="/privacidad" className="text-primary underline">/privacidad</a>. Al registrarse,
              el Usuario acepta dicho tratamiento conforme a la Ley 1581 de 2012 (Colombia) y demás
              normas aplicables.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-primary mt-6 mb-2">6. Limitación de responsabilidad</h2>
            <p>
              La Plataforma se ofrece "tal cual". Piiyaak no garantiza la disponibilidad ininterrumpida
              ni la exactitud absoluta de las definiciones. En ningún caso responderá por daños indirectos
              derivados del uso o la imposibilidad de uso de la Plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-primary mt-6 mb-2">7. Modificaciones</h2>
            <p>
              Piiyaak podrá modificar estos Términos en cualquier momento. Los cambios se publicarán en
              esta página y, cuando sean sustanciales, se notificará a los Usuarios registrados. El uso
              continuado de la Plataforma tras la publicación implica la aceptación de los nuevos
              términos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-primary mt-6 mb-2">8. Terminación</h2>
            <p>
              El Usuario puede solicitar la eliminación de su cuenta en cualquier momento escribiendo al
              correo de contacto. Piiyaak podrá suspender cuentas que incumplan estos Términos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-primary mt-6 mb-2">9. Ley aplicable y jurisdicción</h2>
            <p>
              Estos Términos se rigen por las leyes de la República de Colombia. Cualquier controversia
              se someterá a los jueces competentes del domicilio del responsable del proyecto.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-primary mt-6 mb-2">10. Contacto</h2>
            <p>
              Para consultas sobre estos Términos, escribir a{" "}
              <a href="mailto:contacto@piiyaak.org" className="text-primary underline">
                contacto@piiyaak.org
              </a>
              .
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}