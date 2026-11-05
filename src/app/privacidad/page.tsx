import { NavBar } from "@/components/navbar";
import { SiteFooter } from "@/components/site-footer";
import { Breadcrumbs } from "@/components/breadcrumbs";

export const metadata = {
  title: "Política de Privacidad — Piiyaak",
  description: "Política de privacidad y tratamiento de datos personales de Piiyaak.",
};

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main id="contenido" className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8">
        <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Política de Privacidad" }]} />
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-primary mb-2">
          Política de Privacidad
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Última actualización: 5 de noviembre de 2026 · Versión 1.0
        </p>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-serif font-bold text-primary mt-6 mb-2">1. Responsable del tratamiento</h2>
            <p>
              El responsable del tratamiento de los datos personales es el equipo de Piiyaak, proyecto de
              preservación de la lengua Nasa Yuwe. Contacto:{" "}
              <a href="mailto:contacto@piiyaak.org" className="text-primary underline">contacto@piiyaak.org</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-primary mt-6 mb-2">2. Datos que recogemos</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Correo electrónico y nombre (al registrarse).</li>
              <li>Contraseña (almacenada cifrada con bcrypt).</li>
              <li>Datos de uso: palabras consultadas, favoritos, progreso en cursos y juegos.</li>
              <li>Datos técnicos: dirección IP, tipo de navegador/dispositivo (para seguridad y rate-limit).</li>
            </ul>
            <p className="mt-2">
              Si ingresas con Google, recibimos el perfil básico (nombre, correo, foto) autorizado por ti.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-primary mt-6 mb-2">3. Finalidades</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Crear y administrar tu cuenta.</li>
              <li>Guardar tus favoritos, historial y progreso de aprendizaje.</li>
              <li>Enviar correos de verificación y recuperación de contraseña.</li>
              <li>Mejorar la Plataforma y prevenir abusos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-primary mt-6 mb-2">4. Base legal</h2>
            <p>
              El tratamiento se basa en tu consentimiento (al registrarte y aceptar estos términos) y en
              la ejecución del servicio solicitado. Cumplimos la Ley 1581 de 2012 (Colombia) y el Decreto
              1377 de 2013.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-primary mt-6 mb-2">5. Conservación</h2>
            <p>
              Conservamos tus datos mientras tu cuenta esté activa. Puedes solicitar la eliminación en
              cualquier momento; al hacerlo, tus datos personales se borrarán o anonimizarán, salvo los que
              debamos conservar por obligación legal.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-primary mt-6 mb-2">6. Tus derechos</h2>
            <p>
              Tienes derecho a conocer, actualizar, rectificar y suprimir tus datos, así como a revocar tu
              autorización. Para ejercerlos, escribe a{" "}
              <a href="mailto:contacto@piiyaak.org" className="text-primary underline">contacto@piiyaak.org</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-primary mt-6 mb-2">7. Seguridad</h2>
            <p>
              Usamos cifrado en tránsito (HTTPS), contraseñas con hash (bcrypt) y almacenamiento seguro.
              Aun así, ningún sistema es 100% seguro; te pedimos usar contraseñas robustas y no
              compartirlas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-primary mt-6 mb-2">8. Terceros</h2>
            <p>
              La Plataforma se apoya en proveedores: Supabase/Postgres (base de datos), Vercel (hosting),
              Google (autenticación OAuth) y Resend (correo). Cada uno trata datos conforme a sus propias
              políticas. No vendemos ni cedemos tus datos a terceros con fines comerciales.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-primary mt-6 mb-2">9. Cookies</h2>
            <p>
              Usamos cookies de sesión necesarias para mantener tu login. No usamos cookies de seguimiento
              publicitario. Puedes desactivarlas en tu navegador, pero algunas funciones dejarán de
              funcionar.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-primary mt-6 mb-2">10. Cambios en esta política</h2>
            <p>
              Podremos actualizar esta Política. Los cambios se publicarán aquí y, si son sustanciales, se
              notificará a los Usuarios registrados.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-serif font-bold text-primary mt-6 mb-2">11. Contacto</h2>
            <p>
              Para consultas sobre privacidad, escribe a{" "}
              <a href="mailto:contacto@piiyaak.org" className="text-primary underline">contacto@piiyaak.org</a>.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}