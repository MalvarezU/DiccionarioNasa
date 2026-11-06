interface LegalSection {
  heading: string;
  body: string;
}

export const LEGAL_VERSION = "1.0";
export const LEGAL_UPDATED_LABEL = "5 de noviembre de 2026";
export const CONTACT_EMAIL = "contacto@piiyaak.org";

export const TERMS_TITLE = "Términos y Condiciones de Uso";

export const TERMS_SUMMARY: string[] = [
  "Piiyaak es un proyecto de preservación y difusión de la lengua Nasa Yuwe: diccionario, juegos y cursos.",
  "Tu cuenta es personal: usa datos veraces y mantén tu contraseña en privado.",
  "Usa la plataforma con respeto: no publiques contenidos ofensivos ni atentes contra la dignidad del pueblo Nasa.",
  "El contenido es para fines educativos y de preservación lingüística, no para uso comercial.",
  "Puedes eliminar tu cuenta cuando quieras escribiendo a contacto@piiyaak.org.",
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: "Qué es Piiyaak",
    body: "Piiyaak es un proyecto de preservación y difusión de la lengua Nasa Yuwe del pueblo Nasa de Colombia. Ofrece un diccionario bilingüe, juegos didácticos y una ruta de aprendizaje desde la web y la aplicación móvil. Estos Términos regulan el uso de la plataforma por parte de las personas usuarias.",
  },
  {
    heading: "Tu cuenta",
    body: "Para guardar favoritos, seguir tu progreso y acceder a los cursos necesitas crear una cuenta con tu correo electrónico, o ingresar con tu cuenta de Google. Comprométete a dar información veraz y a no compartir tu contraseña. Eres responsable de la actividad realizada desde tu cuenta.",
  },
  {
    heading: "Uso respetuoso",
    body: "Usa la plataforma de forma lícita y respetuosa. No publiques contenidos ofensivos ni que atenten contra la dignidad del pueblo Nasa, y no intentes dañar el servicio ni interferir con el uso de otras personas. El uso indebido puede llevar a la suspensión o cancelación de la cuenta.",
  },
  {
    heading: "Contenido educativo",
    body: "El diccionario, los audios, las imágenes y los cursos son aportes de la comunidad y del equipo de Piiyaak. Puedes consultarlos y usarlos para aprender y para apoyar la preservación de la lengua. No está permitido el uso comercial ni la redistribución masiva sin autorización. Tus correcciones y sugerencias podrán incorporarse al contenido con el crédito correspondiente.",
  },
  {
    heading: "Privacidad",
    body: "El tratamiento de tus datos personales se rige por la Política de Privacidad. Al registrarte aceptas ese tratamiento conforme a la Ley 1581 de 2012 de Colombia y las normas aplicables.",
  },
  {
    heading: "Disponibilidad",
    body: "La plataforma se ofrece tal cual. Hacemos lo posible por mantenerla disponible y por cuidar la calidad de las definiciones, pero no garantizamos un servicio ininterrumpido ni la exactitud absoluta de cada entrada.",
  },
  {
    heading: "Cambios y terminación",
    body: "Podremos actualizar estos Términos. Los cambios se publicarán en esta página y, cuando sean importantes, avisaremos a las personas registradas. Si sigues usando la plataforma aceptas los nuevos términos. Puedes pedir la eliminación de tu cuenta en cualquier momento escribiendo al correo de contacto.",
  },
  {
    heading: "Contacto",
    body: `Para consultas sobre estos Términos, escríbenos a ${CONTACT_EMAIL}. Estos Términos se rigen por las leyes de la República de Colombia.`,
  },
];

export const PRIVACY_TITLE = "Política de Privacidad";

export const PRIVACY_SUMMARY: string[] = [
  "Guardamos tu correo, tu nombre si lo indicas, tus favoritos y tu progreso de aprendizaje.",
  "Usamos tus datos solo para gestionar tu cuenta y mejorar la plataforma.",
  "No vendemos ni compartimos tus datos con fines comerciales.",
  "Puedes conocer, corregir o eliminar tus datos cuando quieras.",
  "Para cualquier solicitud de privacidad, escríbenos a contacto@piiyaak.org.",
];

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: "Quién cuida tus datos",
    body: "El responsable del tratamiento de los datos personales es el equipo de Piiyaak, proyecto de preservación de la lengua Nasa Yuwe. Si tienes preguntas sobre privacidad, escríbenos y te responderemos.",
  },
  {
    heading: "Qué datos guardamos",
    body: "Guardamos tu correo electrónico y el nombre que indiques al registrarte. También guardamos tu actividad de aprendizaje: palabras consultadas, favoritos y progreso en cursos y juegos. Si ingresas con Google, recibimos el perfil básico que autorices (nombre, correo y foto).",
  },
  {
    heading: "Para qué los usamos",
    body: "Usamos tus datos para crear y administrar tu cuenta, guardar tus favoritos y tu progreso, enviarte correos de verificación y recuperación de contraseña, y mejorar la plataforma. Solo pedimos los datos necesarios para ofrecerte el servicio.",
  },
  {
    heading: "No vendemos tus datos",
    body: "No vendemos ni compartimos tus datos personales con fines comerciales. Solo los usamos para operar la plataforma y nunca cederemos tu información a terceros para publicidad.",
  },
  {
    heading: "Cuánto tiempo los conservamos",
    body: "Conservamos tus datos mientras tu cuenta esté activa. Cuando pidas la eliminación de tu cuenta, tus datos personales se borrarán o se harán anónimos, salvo los que debamos conservar por obligación legal.",
  },
  {
    heading: "Tus derechos",
    body: "Tienes derecho a conocer, actualizar, corregir y eliminar tus datos, y a retirar tu autorización en cualquier momento. Tratamos tus datos conforme a la Ley 1581 de 2012 de Colombia. Para ejercer tus derechos, escríbenos al correo de contacto.",
  },
  {
    heading: "Cookies",
    body: "Usamos las cookies estrictamente necesarias para mantener tu sesión iniciada. No usamos cookies de seguimiento publicitario. Si las desactivas en tu navegador, algunas funciones dejarán de funcionar.",
  },
  {
    heading: "Cambios y contacto",
    body: `Podremos actualizar esta Política; los cambios se publicarán en esta página y, si son importantes, avisaremos a las personas registradas. Para consultas sobre privacidad, escríbenos a ${CONTACT_EMAIL}.`,
  },
];

function ContactLink() {
  return (
    <a
      href={`mailto:${CONTACT_EMAIL}`}
      className="text-primary underline"
    >
      {CONTACT_EMAIL}
    </a>
  );
}

interface LegalDocumentProps {
  title: string;
  summary: string[];
  sections: LegalSection[];
}

function LegalDocument({ title, summary, sections }: LegalDocumentProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <div className="rounded-lg bg-muted/60 p-4 mb-6">
        <p className="text-sm font-semibold mb-2">En resumen</p>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          {summary.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="space-y-5">
        {sections.map((section, index) => (
          <section key={section.heading}>
            <h3 className="text-base font-semibold mb-1">
              {index + 1}. {section.heading}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {section.body}
            </p>
          </section>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Contacto: <ContactLink /> · Versión {LEGAL_VERSION} · Actualizado el{" "}
        {LEGAL_UPDATED_LABEL}.
      </p>
    </div>
  );
}

export function TermsDocument() {
  return (
    <LegalDocument
      title={TERMS_TITLE}
      summary={TERMS_SUMMARY}
      sections={TERMS_SECTIONS}
    />
  );
}

export function PrivacyDocument() {
  return (
    <LegalDocument
      title={PRIVACY_TITLE}
      summary={PRIVACY_SUMMARY}
      sections={PRIVACY_SECTIONS}
    />
  );
}
