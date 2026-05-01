import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface WordData {
  spanish: string
  nasaYuwe: string
  pronunciation: string
  culturalContext: string
  category: string
  audioUrl: string | null
  examples: string
}

const words: WordData[] = [
  // ── Sustantivos: Naturaleza ──
  {
    spanish: 'casa',
    nasaYuwe: 'pe',
    pronunciation: 'peh',
    culturalContext: 'La casa es el centro de la vida comunitaria nasa. Tradicionalmente construida con materiales de la región como bahareque y paja.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Mi casa es grande', nasaYuwe: 'Pe nxhã thẽ' },
      { spanish: 'La casa del nasa', nasaYuwe: 'Nasa pe' },
    ]),
  },
  {
    spanish: 'agua',
    nasaYuwe: 'wãla',
    pronunciation: 'wah-lah',
    culturalContext: 'El agua es sagrada para el pueblo nasa. Los ríos y fuentes son considerados seres vivos que protegen la comunidad.',
    category: 'sustantivo',
    audioUrl: '/audio/wala.wav',
    examples: JSON.stringify([
      { spanish: 'El agua está fría', nasaYuwe: 'Wãla pxika te' },
      { spanish: 'Quiero agua', nasaYuwe: 'Wãla kãwẽ' },
    ]),
  },
  {
    spanish: 'sol',
    nasaYuwe: 'mheka',
    pronunciation: 'meh-kah',
    culturalContext: 'El sol es una deidad principal en la cosmogonía nasa. Mheka guía los ciclos agrícolas y marca el tiempo ritual.',
    category: 'sustantivo',
    audioUrl: '/audio/mheka.wav',
    examples: JSON.stringify([
      { spanish: 'El sol brilla', nasaYuwe: 'Mheka mhxãte' },
      { spanish: 'El sol sale temprano', nasaYuwe: 'Mheka peyate wejhx' },
    ]),
  },
  {
    spanish: 'luna',
    nasaYuwe: 'yã',
    pronunciation: 'yah',
    culturalContext: 'La luna rige los ciclos de siembra y cosecha. Las fases lunares determinan las actividades agrícolas y ceremoniales.',
    category: 'sustantivo',
    audioUrl: '/audio/ya.wav',
    examples: JSON.stringify([
      { spanish: 'La luna está llena', nasaYuwe: 'Yã thẽ' },
      { spanish: 'La luna nueva', nasaYuwe: 'Yã mẽ' },
    ]),
  },
  {
    spanish: 'tierra',
    nasaYuwe: 'cxãhã',
    pronunciation: 'kshah-hah',
    culturalContext: 'La tierra es la madre de todo. El territorio nasa es sagrado y su defensa es el principio fundamental de la comunidad.',
    category: 'sustantivo',
    audioUrl: '/audio/cxaha.wav',
    examples: JSON.stringify([
      { spanish: 'La tierra es nuestra', nasaYuwe: 'Cxãhã nasa we' },
      { spanish: 'Caminar sobre la tierra', nasaYuwe: 'Cxãhã theg' },
    ]),
  },
  {
    spanish: 'fuego',
    nasaYuwe: 'te',
    pronunciation: 'teh',
    culturalContext: 'El fuego es un elemento purificador en las ceremonias nasa. El tulpá (fogón) es el corazón espiritual del hogar.',
    category: 'sustantivo',
    audioUrl: '/audio/te.wav',
    examples: JSON.stringify([
      { spanish: 'El fuego quema', nasaYuwe: 'Te pxika' },
      { spanish: 'Encender el fuego', nasaYuwe: 'Te yãte' },
    ]),
  },
  {
    spanish: 'montaña',
    nasaYuwe: 'kxãwã',
    pronunciation: 'kshah-wah',
    culturalContext: 'Las montañas son los guardianes del territorio nasa. Cada cerro tiene un espíritu protector llamado "dueño del cerro".',
    category: 'sustantivo',
    audioUrl: '/audio/kxawa.wav',
    examples: JSON.stringify([
      { spanish: 'La montaña es alta', nasaYuwe: 'Kxãwã thẽ' },
      { spanish: 'Subir la montaña', nasaYuwe: 'Kxãwã theg' },
    ]),
  },
  {
    spanish: 'río',
    nasaYuwe: 'wãla wejhx',
    pronunciation: 'wah-lah weh-hx',
    culturalContext: 'Los ríos son las venas de la tierra according to nasa cosmology. El agua que fluye es vida y conexión con los ancestros.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'El río es profundo', nasaYuwe: 'Wãla wejhx thẽ' },
      { spanish: 'Bañarse en el río', nasaYuwe: 'Wãla wejhx kã' },
    ]),
  },
  {
    spanish: 'árbol',
    nasaYuwe: 'yã',
    pronunciation: 'yah',
    culturalContext: 'Los árboles son los hijos de la tierra. Cada especie tiene un uso medicinal, constructivo o ceremonial en la cultura nasa.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'El árbol es grande', nasaYuwe: 'Yã thẽ' },
      { spanish: 'Plantar un árbol', nasaYuwe: 'Yã we\'sx' },
    ]),
  },
  {
    spanish: 'maíz',
    nasaYuwe: 'fxiy',
    pronunciation: 'fshiy',
    culturalContext: 'El maíz es el alimento sagrado por excelencia. La chicha de maíz es la bebida ceremonial central en los rituales nasa.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'El maíz está maduro', nasaYuwe: 'Fxiy mẽhẽ' },
      { spanish: 'Sembrar maíz', nasaYuwe: 'Fxiy pã' },
    ]),
  },
  // ── Sustantivos: Persona y Familia ──
  {
    spanish: 'persona',
    nasaYuwe: 'nasa',
    pronunciation: 'nah-sah',
    culturalContext: 'Nasa significa "ser humano" o "gente". Es el nombre que el pueblo se da a sí mismo, refiriéndose a los descendientes del gran cacique.',
    category: 'sustantivo',
    audioUrl: '/audio/nasa.wav',
    examples: JSON.stringify([
      { spanish: 'La persona es buena', nasaYuwe: 'Nasa mẽhẽ' },
      { spanish: 'Muchas personas', nasaYuwe: 'Nasa thẽ' },
    ]),
  },
  {
    spanish: 'hombre',
    nasaYuwe: 'nasa yu',
    pronunciation: 'nah-sah yoo',
    culturalContext: 'En la cultura nasa, el hombre tiene responsabilidades específicas en la minga y en la protección del territorio.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'El hombre trabaja', nasaYuwe: 'Nasa yu theg' },
    ]),
  },
  {
    spanish: 'mujer',
    nasaYuwe: 'nasa ti',
    pronunciation: 'nah-sah tee',
    culturalContext: 'La mujer nasa es guardiana de la semilla y del conocimiento tradicional. Transmite la lengua y las prácticas culturales.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'La mujer teje', nasaYuwe: 'Nasa ti yãte' },
    ]),
  },
  {
    spanish: 'niño',
    nasaYuwe: 'wejhx',
    pronunciation: 'weh-hx',
    culturalContext: 'Los niños son el futuro del pueblo nasa. Desde pequeños aprenden la lengua y las tradiciones en el ñimish (escuela tradicional).',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'El niño juega', nasaYuwe: 'Wejhx theg' },
    ]),
  },
  {
    spanish: 'niña',
    nasaYuwe: 'wejhx ti',
    pronunciation: 'weh-hx tee',
    culturalContext: 'La niña nasa aprende desde temprana edad las labores de siembra, cocina y textilería que son base de la cultura.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'La niña aprende', nasaYuwe: 'Wejhx ti kãwã' },
    ]),
  },
  {
    spanish: 'madre',
    nasaYuwe: 'ti',
    pronunciation: 'tee',
    culturalContext: 'La madre es la raíz de la familia nasa. "Ti" también se usa como sufijo femenino en la formación de palabras.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Mi madre', nasaYuwe: 'Nxhã ti' },
    ]),
  },
  {
    spanish: 'padre',
    nasaYuwe: 'yu',
    pronunciation: 'yoo',
    culturalContext: 'El padre enseña las labores del campo y la cosmovisión. "Yu" también funciona como sufijo masculino.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Mi padre', nasaYuwe: 'Nxhã yu' },
    ]),
  },
  {
    spanish: 'hermano',
    nasaYuwe: 'pxã',
    pronunciation: 'pshah',
    culturalContext: 'El término pxã se extiende más allá de la familia biológica para incluir a todos los miembros del clan y la comunidad.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Mi hermano', nasaYuwe: 'Nxhã pxã' },
    ]),
  },
  {
    spanish: 'hermana',
    nasaYuwe: 'pxã ti',
    pronunciation: 'pshah tee',
    culturalContext: 'La hermana tiene un rol especial en la transmisión oral de historias y canciones tradicionales nasa.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Mi hermana', nasaYuwe: 'Nxhã pxã ti' },
    ]),
  },
  // ── Sustantivos: Cuerpo humano ──
  {
    spanish: 'corazón',
    nasaYuwe: 'kãsãwã',
    pronunciation: 'kah-sah-wah',
    culturalContext: 'El corazón es el centro del pensamiento y la emoción en la cosmovisión nasa, no solo un órgano físico.',
    category: 'sustantivo',
    audioUrl: '/audio/kasawa.wav',
    examples: JSON.stringify([
      { spanish: 'El corazón late', nasaYuwe: 'Kãsãwã theg' },
      { spanish: 'Buen corazón', nasaYuwe: 'Kãsãwã mẽhẽ' },
    ]),
  },
  {
    spanish: 'mano',
    nasaYuwe: 'kxã',
    pronunciation: 'kshah',
    culturalContext: 'Las manos son el medio de trabajo creador. La artesanía nasa es una expresión espiritual a través de las manos.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Mi mano', nasaYuwe: 'Nxhã kxã' },
    ]),
  },
  {
    spanish: 'cabeza',
    nasaYuwe: 'the',
    pronunciation: 'teh',
    culturalContext: 'La cabeza es la sede del pensamiento. Los mayores dicen que el saber reside entre la cabeza y el corazón.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'La cabeza duele', nasaYuwe: 'The pxi' },
    ]),
  },
  {
    spanish: 'ojo',
    nasaYuwe: 'mhx',
    pronunciation: 'mhx',
    culturalContext: 'Los ojos son las ventanas del espíritu. Ver con los ojos del corazón es un concepto fundamental nasa.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'El ojo grande', nasaYuwe: 'Mhx thẽ' },
    ]),
  },
  {
    spanish: 'boca',
    nasaYuwe: 'pã',
    pronunciation: 'pah',
    culturalContext: 'La boca es sagrada: por ella sale la palabra que crea y destruye. El cuidado de la palabra es enseñanza fundamental.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Abrir la boca', nasaYuwe: 'Pã we\'sx' },
    ]),
  },
  {
    spanish: 'pie',
    nasaYuwe: 'theg',
    pronunciation: 'tehg',
    culturalContext: 'Los pies conectan a la persona con la tierra. Caminar descalzo es una forma de respeto a la madre tierra.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'El pie derecho', nasaYuwe: 'Theg mẽhẽ' },
    ]),
  },
  // ── Adjetivos ──
  {
    spanish: 'blanco',
    nasaYuwe: 'pe',
    pronunciation: 'peh',
    culturalContext: 'El blanco está asociado con la claridad y la paz en la simbología nasa. Es uno de los colores ceremoniales.',
    category: 'adjetivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'La casa blanca', nasaYuwe: 'Pe pe' },
    ]),
  },
  {
    spanish: 'negro',
    nasaYuwe: 'te',
    pronunciation: 'teh',
    culturalContext: 'El negro representa la noche y el misterio. En la cosmovisión nasa, no es negativo sino protector.',
    category: 'adjetivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'El cielo negro', nasaYuwe: 'Mheka kxãwã te' },
    ]),
  },
  {
    spanish: 'rojo',
    nasaYuwe: 'ka',
    pronunciation: 'kah',
    culturalContext: 'El rojo es el color de la sangre y la vida. Es sagrado y se usa en pinturas ceremoniales y textiles rituales.',
    category: 'adjetivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'La flor roja', nasaYuwe: 'Yã kãwã ka' },
    ]),
  },
  {
    spanish: 'verde',
    nasaYuwe: 'wã',
    pronunciation: 'wah',
    culturalContext: 'El verde representa la naturaleza y la fertilidad de la tierra. Es el color de la esperanza y la renovación.',
    category: 'adjetivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'El árbol verde', nasaYuwe: 'Yã wã' },
    ]),
  },
  {
    spanish: 'grande',
    nasaYuwe: 'thẽ',
    pronunciation: 'teh',
    culturalContext: 'La grandeza en la cultura nasa se mide por la sabiduría y el servicio a la comunidad, no por posesiones materiales.',
    category: 'adjetivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'La montaña grande', nasaYuwe: 'Kxãwã thẽ' },
      { spanish: 'El río grande', nasaYuwe: 'Wãla wejhx thẽ' },
    ]),
  },
  {
    spanish: 'pequeño',
    nasaYuwe: 'mẽ',
    pronunciation: 'meh',
    culturalContext: 'Lo pequeño es valioso en la cultura nasa. Una semilla pequeña contiene la vida entera del maíz.',
    category: 'adjetivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'El niño pequeño', nasaYuwe: 'Wejhx mẽ' },
    ]),
  },
  {
    spanish: 'bueno',
    nasaYuwe: 'mẽhẽ',
    pronunciation: 'meh-heh',
    culturalContext: 'Ser bueno en la filosofía nasa implica vivir en armonía con la comunidad y la naturaleza.',
    category: 'adjetivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'El corazón bueno', nasaYuwe: 'Kãsãwã mẽhẽ' },
      { spanish: 'Buen día', nasaYuwe: 'Mheka wejhx mẽhẽ' },
    ]),
  },
  {
    spanish: 'malo',
    nasaYuwe: 'pxi',
    pronunciation: 'pshee',
    culturalContext: 'Lo malo se entiende como desequilibrio. La enfermedad es una desarmonía que debe restaurarse con rituales y medicinas tradicionales.',
    category: 'adjetivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'El camino malo', nasaYuwe: 'Theg kxãwã pxi' },
    ]),
  },
  // ── Verbos ──
  {
    spanish: 'comer',
    nasaYuwe: 'we\'sx',
    pronunciation: 'weh-sx',
    culturalContext: 'Comer es un acto ceremonial. Antes de comer, se ofrece una porción a la tierra y a los espíritus protectores.',
    category: 'verbo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Vamos a comer', nasaYuwe: 'We\'sx theg' },
      { spanish: 'Comer maíz', nasaYuwe: 'Fxiy we\'sx' },
    ]),
  },
  {
    spanish: 'beber',
    nasaYuwe: 'kã',
    pronunciation: 'kah',
    culturalContext: 'Beber, especialmente la chicha de maíz, es un acto comunitario y ritual. Se bebe en círculo compartiendo la palabra.',
    category: 'verbo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Beber agua', nasaYuwe: 'Wãla kã' },
    ]),
  },
  {
    spanish: 'dormir',
    nasaYuwe: 'pã',
    pronunciation: 'pah',
    culturalContext: 'El sueño es un viaje del espíritu. Los mayores interpretan los sueños como mensajes de los ancestros y guías espirituales.',
    category: 'verbo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Quiero dormir', nasaYuwe: 'Pã kãwẽ' },
    ]),
  },
  {
    spanish: 'caminar',
    nasaYuwe: 'theg',
    pronunciation: 'tehg',
    culturalContext: 'Caminar el territorio es una forma de conocimiento. Los nasa recorren sus tierras para mantener viva la memoria colectiva.',
    category: 'verbo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Caminar por el camino', nasaYuwe: 'Theg kxãwã theg' },
      { spanish: 'Caminar juntos', nasaYuwe: 'Thẽ theg' },
    ]),
  },
  {
    spanish: 'hablar',
    nasaYuwe: 'yãte',
    pronunciation: 'yah-teh',
    culturalContext: 'La palabra es poder. Hablar en nasa yuwe es mantener vivo el pensamiento propio. El orally es la forma principal de transmisión del conocimiento.',
    category: 'verbo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Hablar nasa yuwe', nasaYuwe: 'Nasa yuwe yãte' },
    ]),
  },
  {
    spanish: 'escuchar',
    nasaYuwe: 'nãk',
    pronunciation: 'nahk',
    culturalContext: 'Escuchar es la base del aprendizaje nasa. Los jóvenes escuchan a los mayores para absorber la sabiduría ancestral.',
    category: 'verbo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Escuchar a los mayores', nasaYuwe: 'Thẽ nãk' },
    ]),
  },
  {
    spanish: 'ver',
    nasaYuwe: 'mhx',
    pronunciation: 'mhx',
    culturalContext: 'Ver va más allá de la percepción visual. "Ver con el corazón" significa comprender profundamente la realidad.',
    category: 'verbo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Ver la montaña', nasaYuwe: 'Kxãwã mhx' },
    ]),
  },
  {
    spanish: 'saber',
    nasaYuwe: 'kãwã',
    pronunciation: 'kah-wah',
    culturalContext: 'El saber nasa es colectivo y se construye en comunidad. Los taitas y mamas son los grandes sabedores.',
    category: 'verbo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Saber la lengua', nasaYuwe: 'Nasa yuwe kãwã' },
      { spanish: 'Él sabe mucho', nasaYuwe: 'Kãwã thẽ' },
    ]),
  },
  // ── Números ──
  {
    spanish: 'uno',
    nasaYuwe: 'bxejhy',
    pronunciation: 'bxeh-jhy',
    culturalContext: 'El uno representa el origen, el principio de todo. En la cosmogonía nasa, todo parte de una semilla, un pensamiento.',
    category: 'numeral',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Una persona', nasaYuwe: 'Nasa bxejhy' },
    ]),
  },
  {
    spanish: 'dos',
    nasaYuwe: 'maka',
    pronunciation: 'mah-kah',
    culturalContext: 'El dos representa la dualidad complementaria: hombre-mujer, día-noche, sol-luna. Es la base del equilibrio nasa.',
    category: 'numeral',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Dos personas', nasaYuwe: 'Nasa maka' },
    ]),
  },
  {
    spanish: 'tres',
    nasaYuwe: 'peya',
    pronunciation: 'peh-yah',
    culturalContext: 'El tres es un número sagrado que representa los tres mundos: arriba, medio y abajo en la cosmovisión nasa.',
    category: 'numeral',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Tres montañas', nasaYuwe: 'Kxãwã peya' },
    ]),
  },
  {
    spanish: 'cuatro',
    nasaYuwe: 'pita',
    pronunciation: 'pee-tah',
    culturalContext: 'El cuatro representa los cuatro puntos cardinales y los cuatro elementos. Es la totalidad del espacio nasa.',
    category: 'numeral',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Cuatro caminos', nasaYuwe: 'Theg kxãwã pita' },
    ]),
  },
  {
    spanish: 'cinco',
    nasaYuwe: 'txã',
    pronunciation: 'tshah',
    culturalContext: 'El cinco representa la mano abierta y la capacidad de acción. Simboliza el trabajo comunitario.',
    category: 'numeral',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Cinco dedos', nasaYuwe: 'Kxã txã' },
    ]),
  },
  // ── Sustantivos: Naturaleza (continuación) ──
  {
    spanish: 'noche',
    nasaYuwe: 'yã wejhx',
    pronunciation: 'yah weh-hx',
    culturalContext: 'La noche es el tiempo de los espíritus y los sueños. Las ceremonias importantes se realizan durante la noche.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'La noche es oscura', nasaYuwe: 'Yã wejhx te' },
    ]),
  },
  {
    spanish: 'día',
    nasaYuwe: 'mheka wejhx',
    pronunciation: 'meh-kah weh-hx',
    culturalContext: 'El día es el tiempo del trabajo y la comunidad. El sol guía las actividades diarias del pueblo nasa.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Buen día', nasaYuwe: 'Mheka wejhx mẽhẽ' },
    ]),
  },
  {
    spanish: 'flor',
    nasaYuwe: 'yã kãwã',
    pronunciation: 'yah kah-wah',
    culturalContext: 'Las flores son usadas en ceremonias y como medicina. Cada flor tiene un propósito espiritual específico.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'La flor es bonita', nasaYuwe: 'Yã kãwã mẽhẽ' },
    ]),
  },
  {
    spanish: 'estrella',
    nasaYuwe: 'yã thẽ',
    pronunciation: 'yah teh',
    culturalContext: 'Las estrellas son los ojos de los ancestros que vigilan la comunidad desde el cielo nocturno.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Las estrellas brillan', nasaYuwe: 'Yã thẽ mhxãte' },
    ]),
  },
  {
    spanish: 'lluvia',
    nasaYuwe: 'wãla pã',
    pronunciation: 'wah-lah pah',
    culturalContext: 'La lluvia es la bendición de la tierra. Las ceremonias de petición de lluvia son fundamentales para la agricultura nasa.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'La lluvia cae', nasaYuwe: 'Wãla pã theg' },
    ]),
  },
  {
    spanish: 'viento',
    nasaYuwe: 'fxĩ',
    pronunciation: 'fshi',
    culturalContext: 'El viento es el mensajero entre los mundos. Los nasa escuchan el viento para recibir señales de los espíritus.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'El viento sopla fuerte', nasaYuwe: 'Fxĩ thẽ' },
    ]),
  },
  {
    spanish: 'cielo',
    nasaYuwe: 'mheka kxãwã',
    pronunciation: 'meh-kah kshah-wah',
    culturalContext: 'El cielo es la morada de los espíritus superiores. La conexión entre cielo y tierra mantiene el equilibrio del mundo.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'El cielo es azul', nasaYuwe: 'Mheka kxãwã wã' },
    ]),
  },
  {
    spanish: 'piedra',
    nasaYuwe: 'txã',
    pronunciation: 'tshah',
    culturalContext: 'Las piedras son los huesos de la tierra. Las piedras sagradas marcan los sitios ceremoniales del territorio nasa.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'La piedra es dura', nasaYuwe: 'Txã thẽ' },
    ]),
  },
  {
    spanish: 'camino',
    nasaYuwe: 'theg kxãwã',
    pronunciation: 'tehg kshah-wah',
    culturalContext: 'El camino es más que una ruta; es el recorrido de la vida. "Caminar el territorio" es una práctica de resistencia cultural.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'El camino largo', nasaYuwe: 'Theg kxãwã thẽ' },
    ]),
  },
  // ── Palabras adicionales para enriquecer el diccionario ──
  {
    spanish: 'trabajo',
    nasaYuwe: 'mẽka',
    pronunciation: 'meh-kah',
    culturalContext: 'El trabajo comunitario o minga es la base de la organización social nasa. Trabajar juntos fortalece la comunidad.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'El trabajo es bueno', nasaYuwe: 'Mẽka mẽhẽ' },
      { spanish: 'Ir a la minga', nasaYuwe: 'Mẽka theg' },
    ]),
  },
  {
    spanish: 'palabra',
    nasaYuwe: 'yãte wãla',
    pronunciation: 'yah-teh wah-lah',
    culturalContext: 'La palabra es el vehículo del pensamiento nasa. La palabra dada es sagrada y no debe romperse.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'La palabra del mayor', nasaYuwe: 'Yãte wãla thẽ' },
    ]),
  },
  {
    spanish: 'cantar',
    nasaYuwe: 'wãla yãte',
    pronunciation: 'wah-lah yah-teh',
    culturalContext: 'El canto es una forma de oración y de conexión con los espíritus. Los cantos tradicionales narran la historia del pueblo.',
    category: 'verbo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Cantar en la ceremonia', nasaYuwe: 'Wãla yãte theg' },
    ]),
  },
  {
    spanish: 'bailar',
    nasaYuwe: 'theg wãla',
    pronunciation: 'tehg wah-lah',
    culturalContext: 'La danza es una forma de oración en movimiento. Cada paso del baile tradicional tiene un significado espiritual.',
    category: 'verbo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Bailar en la fiesta', nasaYuwe: 'Theg wãla mẽhẽ' },
    ]),
  },
  {
    spanish: 'semilla',
    nasaYuwe: 'fxiy mẽ',
    pronunciation: 'fshiy meh',
    culturalContext: 'La semilla es la promesa del futuro. Resguardar las semillas nativas es una responsabilidad sagrada del pueblo nasa.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'La semilla del maíz', nasaYuwe: 'Fxiy mẽ' },
    ]),
  },
  {
    spanish: 'comunidad',
    nasaYuwe: 'nasa cxãhã',
    pronunciation: 'nah-sah kshah-hah',
    culturalContext: 'La comunidad es la extensión de la familia. El cabildo nasa es la autoridad tradicional que organiza la vida comunitaria.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'La comunidad trabaja junta', nasaYuwe: 'Nasa cxãhã mẽka thẽ' },
    ]),
  },
  {
    spanish: 'medicina',
    nasaYuwe: 'wãla mẽhẽ',
    pronunciation: 'wah-lah meh-heh',
    culturalContext: 'La medicina tradicional nasa proviene de las plantas y los rituales. Los médicos tradicionales (taitas) son los guardianes de este saber.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'La medicina natural', nasaYuwe: 'Wãla mẽhẽ yã' },
    ]),
  },
  {
    spanish: 'song',
    nasaYuwe: 'wãla theg',
    pronunciation: 'wah-lah tehg',
    culturalContext: 'Los cantos tradicionales transmiten la historia y los valores del pueblo nasa de generación en generación.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'El canto sagrado', nasaYuwe: 'Wãla theg mẽhẽ' },
    ]),
  },
  {
    spanish: 'amigo',
    nasaYuwe: 'pxã mẽhẽ',
    pronunciation: 'pshah meh-heh',
    culturalContext: 'La amistad es un lazo sagrado. Un amigo es un hermano elegido por el corazón.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Mi buen amigo', nasaYuwe: 'Pxã mẽhẽ' },
    ]),
  },
  {
    spanish: 'carne',
    nasaYuwe: 'nasa kxã',
    pronunciation: 'nah-sah kshah',
    culturalContext: 'La carne de animales domesticados se consume en ocasiones especiales y ceremonias.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Comer carne', nasaYuwe: 'Nasa kxã we\'sx' },
    ]),
  },
  {
    spanish: 'sal',
    nasaYuwe: 'txã wejhx',
    pronunciation: 'tshah weh-hx',
    culturalContext: 'La sal es un elemento de intercambio y preservación. Históricamente fue un recurso valioso en el comercio indígena.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'Poner sal', nasaYuwe: 'Txã wejhx we\'sx' },
    ]),
  },
  {
    spanish: 'lengua',
    nasaYuwe: 'nasa yuwe',
    pronunciation: 'nah-sah yoo-weh',
    culturalContext: 'Nasa yuwe significa "lengua del pueblo". Es la lengua materna del pueblo nasa y está en peligro de extinción. Su preservación es vital para la identidad cultural.',
    category: 'sustantivo',
    audioUrl: '/audio/nasa-yuwe.wav',
    examples: JSON.stringify([
      { spanish: 'Hablar la lengua nasa', nasaYuwe: 'Nasa yuwe yãte' },
      { spanish: 'La lengua es nuestra', nasaYuwe: 'Nasa yuwe nasa we' },
    ]),
  },
  {
    spanish: 'cerro',
    nasaYuwe: 'kxãwã wejhx',
    pronunciation: 'kshah-wah weh-hx',
    culturalContext: 'Los cerros menores también tienen espíritus protectores. Son sitios de oración y meditación.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'El cerro sagrado', nasaYuwe: 'Kxãwã wejhx mẽhẽ' },
    ]),
  },
  {
    spanish: 'animal',
    nasaYuwe: 'nasa pxã',
    pronunciation: 'nah-sah pshah',
    culturalContext: 'Los animales son hermanos menores en la cosmovisión nasa. Se les respeta y se les pide permiso antes de cazar.',
    category: 'sustantivo',
    audioUrl: null,
    examples: JSON.stringify([
      { spanish: 'El animal pequeño', nasaYuwe: 'Nasa pxã mẽ' },
    ]),
  },
]

async function main() {
  console.log('Seeding database...')

  // Clear existing words
  await prisma.dictionaryWord.deleteMany()

  console.log(`Inserting ${words.length} Nasa Yuwe words...`)

  for (const word of words) {
    await prisma.dictionaryWord.create({
      data: {
        spanish: word.spanish,
        nasaYuwe: word.nasaYuwe,
        pronunciation: word.pronunciation,
        culturalContext: word.culturalContext,
        category: word.category,
        audioUrl: word.audioUrl,
        examples: word.examples,
        status: 'PUBLISHED',
      },
    })
  }

  console.log(`Successfully seeded ${words.length} words!`)
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
