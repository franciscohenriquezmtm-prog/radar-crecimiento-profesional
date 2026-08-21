// Decide de que se trata cada cosa: que tipo de oportunidad es y de que area.
//
// Las palabras estan en espanol, ingles y portugues porque las fuentes vienen
// mezcladas. Sin tildes: el texto llega normalizado.

import { normalizar } from './util.js';

export const TIPOS = {
  beca: {
    etiqueta: 'Beca o fellowship',
    palabras: ['beca', 'becas', 'scholarship', 'fellowship', 'bursary', 'stipend', 'financiamiento para estudios', 'travel grant', 'travel award', 'bolsa de estudos', 'grant for', 'grant program', 'grants', 'funding opportunity', 'education grant', 'award program'],
  },
  'call-abstracts': {
    etiqueta: 'Envio de resumenes',
    palabras: ['call for abstracts', 'abstract submission', 'submit your abstract', 'envio de resumenes', 'recepcion de resumenes', 'call for papers', 'call for contributions', 'presentacion de trabajos', 'trabajos libres', 'submissao de resumos'],
  },
  congreso: {
    etiqueta: 'Congreso o jornada',
    palabras: ['congreso', 'congress', 'conference', 'symposium', 'simposio', 'jornada', 'jornadas', 'annual meeting', 'encuentro', 'summit', 'congresso'],
  },
  curso: {
    etiqueta: 'Curso o capacitacion',
    palabras: ['curso', 'course', 'training', 'capacitacion', 'taller', 'workshop', 'seminario', 'school', 'escuela', 'academy', 'academia', 'programa de formacion', 'treinamento', 'masterclass', 'bootcamp', 'e-learning', 'modulo', 'seminar series', 'ciclo de seminarios', 'serie de seminarios', 'lecture series'],
  },
  webinar: {
    etiqueta: 'Webinar',
    palabras: ['webinar', 'seminario web', 'online seminar', 'live stream', 'charla online', 'virtual session', 'webcast'],
  },
  postgrado: {
    etiqueta: 'Postgrado',
    palabras: ['magister', 'master of', 'master degree', 'msc', 'doctorado', 'doctoral', 'phd', 'diplomado', 'postgrado', 'postgraduate', 'especializacion', 'residency', 'mestrado'],
  },
  certificacion: {
    etiqueta: 'Certificacion',
    palabras: ['certification', 'certificacion', 'board exam', 'examen de certificacion', 'credential', 'acreditacion', 'licencia de operacion', 'registro profesional', 'cpd', 'continuing education credit', 'creditos cme', 'cme credit'],
  },
  pasantia: {
    etiqueta: 'Pasantia o visita',
    palabras: ['pasantia', 'internship', 'observership', 'scientific visit', 'visita cientifica', 'secondment', 'rotacion', 'estancia', 'exchange programme', 'exchange program', 'estagio', 'placement'],
  },
  convocatoria: {
    etiqueta: 'Convocatoria abierta',
    palabras: ['call for applications', 'convocatoria', 'llamado a', 'aplicaciones abiertas', 'applications open', 'now accepting applications', 'concurso academico', 'expression of interest', 'nominations open', 'postulaciones abiertas'],
  },
  investigacion: {
    etiqueta: 'Investigacion o proyecto',
    palabras: ['call for proposals', 'coordinated research', 'crp', 'proyecto de investigacion', 'research project', 'fondo concursable', 'fondecyt', 'fondef', 'research grant'],
  },
  premio: {
    etiqueta: 'Premio o reconocimiento',
    palabras: ['award', 'premio', 'prize', 'reconocimiento', 'best paper', 'young investigator'],
  },
  noticia: {
    etiqueta: 'Noticia',
    palabras: ['segun informo', 'de acuerdo a', 'declaro', 'senalo el', 'en entrevista'],
  },
  publicacion: {
    etiqueta: 'Documento o guia',
    palabras: ['guideline', 'guia clinica', 'safety report', 'technical report', 'norma', 'reglamento', 'publication', 'informe tecnico', 'protocolo'],
  },
};

export const AREAS = {
  radioterapia: ['radioterapia', 'radiation therapy', 'radiation oncology', 'radioterapica', 'radiotherapy', 'imrt', 'vmat', 'sbrt', 'sabr', 'srs', 'radiocirugia', 'braquiterapia', 'brachytherapy', 'acelerador lineal', 'linac', 'protonterapia', 'proton therapy', 'flash therapy', 'mr-linac', 'tomotherapy', 'cyberknife', 'gamma knife', 'contorneo', 'contouring', 'planificacion de tratamiento', 'treatment planning', 'igrt', 'adaptive radiotherapy', 'radioterapia adaptativa'],
  // Las tecnicas de tratamiento propiamente tales. Van aparte de "radioterapia"
  // porque son lo que a ti mas te interesa: un curso de VMAT no es lo mismo que
  // una noticia general del servicio de radioterapia.
  tecnicasEspeciales: [
    'imrt', 'vmat', 'imat', 'rapidarc', 'sbrt', 'sabr', 'srs', 'srt', 'radiocirugia', 'radiosurgery',
    'stereotactic', 'estereotactica', 'estereotaxica', 'sfrt', 'grid therapy', 'lattice', 'spatially fractionated',
    'flash', 'protonterapia', 'proton therapy', 'carbon ion', 'hadron', 'braquiterapia', 'brachytherapy',
    'hdr', 'ldr', 'pdr', 'tbi', 'total body irradiation', 'irradiacion corporal total', 'tset',
    'craneoespinal', 'craniospinal', 'dibh', 'deep inspiration breath hold', 'gating', 'tracking',
    '4dct', 'respiratory motion', 'movimiento respiratorio', 'igrt', 'sgrt', 'surface guided',
    'adaptive radiotherapy', 'radioterapia adaptativa', 'mr-linac', 'mri-linac', 'art ',
    'tomotherapy', 'tomoterapia', 'cyberknife', 'gamma knife', 'halcyon', 'ethos', 'unity',
    'hipofraccionamiento', 'hypofractionation', 'reirradiacion', 're-irradiation',
    'intraoperatoria', 'iort', 'radioterapia superficial', 'ortovoltaje',
  ],
  fisicaMedica: ['fisica medica', 'medical physics', 'medical physicist', 'dosimetria', 'dosimetry', 'dosimetrista', 'control de calidad', 'quality assurance', 'quality control', 'tps', 'monte carlo', 'calibracion de haces', 'beam calibration', 'trs-398', 'trs 398', 'aapm tg', 'commissioning', 'auditoria dosimetrica'],
  imagenologia: ['imagenologia', 'radiologia', 'radiology', 'diagnostic imaging', 'imagen diagnostica', 'tomografia', 'computed tomography', ' ct ', 'rayos x', 'x-ray', 'radiografia', 'radiography', 'mamografia', 'mammography', 'angiografia', 'hemodinamia', 'fluoroscopia', 'fluoroscopy', 'densitometria', 'radiologia intervencional', 'interventional radiology', 'radiographer', 'posicionamiento radiologico'],
  resonancia: ['resonancia magnetica', 'magnetic resonance', ' mri ', 'mri', ' rm ', 'espectroscopia', 'difusion', 'dwi', 'perfusion', 'funcional mri', 'fmri', 'secuencias', 'sequences', 'tesla', 'smrt', 'ismrm'],
  medicinaNuclear: ['medicina nuclear', 'nuclear medicine', 'pet/ct', 'pet ct', 'petct', 'spect', 'gammacamara', 'gamma camera', 'cintigrafia', 'scintigraphy', 'radiofarmaco', 'radiopharmaceutical', 'radiofarmacia', 'teranostica', 'theranostics', 'lutecio', 'lu-177', 'psma', 'yodo 131', 'i-131', 'dosimetria interna'],
  proteccionRadiologica: ['proteccion radiologica', 'radiation protection', 'radioproteccion', 'seguridad radiologica', 'radiation safety', 'proteccion del paciente', 'dose optimization', 'optimizacion de dosis', 'blindaje', 'shielding', 'icrp', 'irpa', 'oficial de proteccion', 'radiation safety officer', 'licencia de operacion', 'niveles de referencia', 'diagnostic reference level', 'justificacion', 'alara', 'emergencia radiologica', 'transporte de material radiactivo', 'gestion de desechos radiactivos'],
  // Ojo: aca no van palabras sueltas como "docente" o "academico". Aparecen en
  // el menu de cualquier universidad y arrastraban basura al panel. Solo frases
  // que de verdad describen una actividad de formacion docente.
  docenciaEducacion: ['formacion de formadores', 'train the trainer', 'train-the-trainer', 'training of trainers', 'educacion medica', 'medical education', 'educacion en ciencias de la salud', 'docencia universitaria', 'docencia clinica', 'formacion docente', 'perfeccionamiento docente', 'faculty development', 'teaching skills', 'how to teach', 'metodologias de ensenanza', 'diseno curricular', 'simulacion clinica', 'evaluacion de aprendizajes', 'tutoria clinica', 'preceptoria', 'mentoring program', 'programa de mentoria'],
  // Solo frases donde la IA aparece pegada a lo medico. "Diploma de IA aplicada
  // a la gestion de proyectos de diseno" no tiene nada que ver contigo, y con
  // "inteligencia artificial" a secas entraba igual.
  inteligenciaArtificial: ['ai in radiology', 'ai in radiotherapy', 'ai in medical imaging', 'inteligencia artificial en radiologia', 'inteligencia artificial en imagenes', 'inteligencia artificial en salud', 'artificial intelligence in medicine', 'artificial intelligence in healthcare', 'radiomica', 'radiomics', 'auto-contouring', 'autocontorneo', 'segmentacion automatica', 'automatic segmentation', 'deep learning reconstruction', 'machine learning in imaging', 'ai-based treatment planning'],
  informaticaImagenes: ['pacs', 'ris ', 'dicom', 'hl7', 'informatica de imagenes', 'imaging informatics', 'teleradiologia', 'telerradiologia', 'interoperabilidad', 'flujo de trabajo digital', 'ihe'],
  gestionCalidad: ['gestion de calidad', 'quality management', 'acreditacion en salud', 'acreditacion de servicios', 'seguridad del paciente', 'patient safety', 'gestion clinica', 'administracion en salud', 'mejora continua', 'auditoria clinica', 'gestion de servicios de salud'],
  // Nada de "investigacion" o "research" a secas: aparecen en cualquier pagina
  // universitaria y arrastraban noticias que no son oportunidades.
  investigacion: ['metodologia de la investigacion', 'bioestadistica', 'biostatistics', 'publicacion cientifica', 'ensayo clinico', 'clinical trial', 'revision sistematica', 'systematic review', 'como escribir un paper', 'scientific writing', 'research grant', 'fondo de investigacion', 'proyecto de investigacion', 'research fellowship', 'investigacion clinica'],
  ecografia: ['ecografia', 'ultrasonido', 'ultrasound', 'sonography', 'sonografia', 'ecotomografia', 'doppler', 'pocus', 'point of care ultrasound', 'elastografia'],
};

/**
 * Cuenta cuantas palabras de la lista aparecen COMO PALABRA en el texto.
 *
 * El match por substring parecia mas simple, pero clasificaba "una revision
 * contemporanea" como medicina nuclear, porque "perspectiva" contiene "spect".
 * Los limites de palabra arreglan esa familia entera de errores.
 */
const cacheRegex = new Map();

function regexDe(palabra) {
  if (!cacheRegex.has(palabra)) {
    const escapada = palabra.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // \b no funciona junto a un guion o una barra, asi que el borde se define
    // como "inicio, fin o algo que no sea letra ni numero".
    cacheRegex.set(palabra, new RegExp(`(^|[^a-z0-9])${escapada}($|[^a-z0-9])`, 'i'));
  }
  return cacheRegex.get(palabra);
}

function contar(texto, palabras) {
  let n = 0;
  for (const p of palabras) if (regexDe(p).test(texto)) n++;
  return n;
}

/** Devuelve el tipo mas probable, o null si el texto no dice nada. */
export function tipoDe(texto, pista) {
  const t = ` ${normalizar(texto)} `;
  let mejor = null;
  for (const [clave, def] of Object.entries(TIPOS)) {
    const n = contar(t, def.palabras);
    if (n > 0 && (!mejor || n > mejor.n)) mejor = { clave, n };
  }
  // El envio de resumenes gana siempre: es lo que tiene fecha de cierre real.
  if (contar(t, TIPOS['call-abstracts'].palabras) > 0) return 'call-abstracts';
  if (mejor) return mejor.clave;
  return pista || null;
}

/**
 * Areas detectadas, ordenadas por cuantas palabras pegaron.
 *
 * `minimo` exige mas de una coincidencia. Se usa al mirar el texto completo de
 * una ficha: los menus y pies de pagina de una universidad mencionan "docencia"
 * e "investigacion" en todas sus paginas, y sin ese filtro un diplomado de
 * Power BI terminaba clasificado como oportunidad de radioterapia.
 */
export function areasDe(texto, { minimo = 1 } = {}) {
  const t = ` ${normalizar(texto)} `;
  const marcador = [];
  for (const [clave, palabras] of Object.entries(AREAS)) {
    const n = contar(t, palabras);
    if (n >= minimo) marcador.push([clave, n]);
  }
  marcador.sort((a, b) => b[1] - a[1]);
  return marcador.map(([c]) => c).slice(0, 5);
}

/**
 * Paginas indice: el menu de una institucion, no una oportunidad.
 *
 * "Education and training" es la portada de la seccion de la IAEA, no un curso
 * al que puedas postular; "Past ISMRT Meetings" es un archivo historico. Se
 * cuelan porque el titulo suena bien y la pagina esta llena de palabras del
 * area, pero no hay nada que hacer con ellas: no tienen plazo propio y la fecha
 * que se les detecta viene de cualquier evento listado adentro.
 */
const TITULOS_INDICE = new Set([
  'education and training', 'education', 'training', 'training courses', 'courses', 'our courses',
  'education y training', 'educacion y capacitacion', 'capacitacion', 'formacion', 'cursos',
  'news', 'noticias', 'events', 'eventos', 'news and events', 'noticias y eventos', 'agenda',
  'meetings', 'reuniones', 'webinars', 'seminarios', 'resources', 'recursos', 'publications',
  'publicaciones', 'home', 'inicio', 'about', 'about us', 'quienes somos', 'contact', 'contacto',
  'membership', 'socios', 'library', 'biblioteca', 'media', 'prensa', 'blog', 'newsroom',
  'continuing education', 'educacion continua', 'postgrado', 'postgrados', 'programas',
  'programs', 'our work', 'services', 'servicios', 'scholarships', 'becas', 'grants', 'fellowships',
  'opportunities', 'oportunidades', 'convocatorias', 'concursos', 'calendario', 'calendar',
  'jobs', 'careers', 'empleos', 'faq', 'preguntas frecuentes', 'downloads', 'descargas',
]);

/** Sustantivos de menu que, solos o combinados, nunca nombran una oportunidad. */
const PALABRAS_DE_MENU = new Set([
  'news', 'noticias', 'events', 'eventos', 'publications', 'publicaciones', 'resources',
  'recursos', 'education', 'educacion', 'training', 'capacitacion', 'formacion', 'courses',
  'cursos', 'meetings', 'reuniones', 'webinars', 'media', 'prensa', 'library', 'biblioteca',
  'about', 'contact', 'contacto', 'membership', 'home', 'inicio', 'programs', 'programas',
  'services', 'servicios', 'downloads', 'descargas', 'links', 'enlaces', 'documents',
  'documentos', 'information', 'informacion', 'overview', 'general',
]);

export function esPaginaIndice(titulo) {
  const t = normalizar(titulo).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (TITULOS_INDICE.has(t)) return true;

  // Combinaciones del mismo material: "News and Publications", "Meetings & Events",
  // "Educacion y formacion". Si todas las palabras con peso son de menu, es un menu.
  const conector = /^(and|y|e|or|o|the|la|el|los|las|de|del|our|nuestro|nuestros)$/;
  const palabras = t.split(' ').filter((p) => p && !conector.test(p));
  if (palabras.length >= 1 && palabras.length <= 3 && palabras.every((p) => PALABRAS_DE_MENU.has(p))) {
    return true;
  }
  return false;
}

/**
 * Archivo de ediciones pasadas.
 *
 * No se descarta: se guarda aparte. Saber que la ISMRT hizo su reunion de
 * capitulo en marzo, o que ALATRO congrego en Cancun, es lo que permite
 * calcular cuando conviene estar mirando para la proxima vuelta.
 */
export function esArchivoHistorico(titulo) {
  const t = normalizar(titulo).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(past|previous|archived|archive|recorded|memoria del|resumen del)\b/.test(t)) return true;
  if (/\b(archive|archivo historico|ediciones anteriores|versiones anteriores|past editions|on demand|on-demand)\b/.test(t)) return true;
  return false;
}

/** Tipos que valen aunque no digan de que area son: la convocatoria es la noticia. */
const TIPOS_GENERICOS_VALIDOS = ['beca', 'convocatoria', 'pasantia', 'postgrado', 'investigacion'];

/**
 * Filtro de ruido. Un enlace suelto de un menu no es una oportunidad.
 *
 * La regla dura: algo entra si el TEXTO habla de tu area. Las excepciones son
 * dos, y son deliberadas:
 *   - una convocatoria generica de una fuente prioritaria (ANID abriendo becas
 *     de doctorado, sin decir de que disciplina) entra igual;
 *   - una fuente estrecha (una marca de radioterapia, una sociedad de
 *     resonancia) presta su area cuando el titulo es escueto.
 * Las fuentes amplias —universidades, Coursera, ministerios— nunca prestan area:
 * sus catalogos tienen de todo y ahi es donde se cuela la basura.
 */
/** Grupos donde una convocatoria sin disciplina declarada igual importa. */
const GRUPOS_DE_CONVOCATORIA = ['becas', 'chile', 'organismos', 'reguladores'];

export function valeLaPena({ texto, titulo, tipo, areas, prioridadFuente, grupoFuente }) {
  const t = normalizar(texto);
  if (t.length < 25) return false;
  if (/^(cookie|privacidad|privacy|terminos|aviso legal|mapa del sitio)/.test(t)) return false;
  if (esPaginaIndice(titulo ?? texto.split('.')[0])) return false;

  if (areas.length) return true;
  // "Becas de doctorado en el extranjero 2027" no dice de que disciplina es, y
  // sin embargo es exactamente lo que este radar existe para pescar.
  if (tipo && TIPOS_GENERICOS_VALIDOS.includes(tipo) && prioridadFuente === 'alta' && GRUPOS_DE_CONVOCATORIA.includes(grupoFuente)) {
    return true;
  }
  return false;
}

export function etiquetaTipo(tipo) {
  return TIPOS[tipo]?.etiqueta || 'Otra oportunidad';
}

export const ETIQUETAS_AREA = {
  tecnicasEspeciales: 'Tecnicas especiales de tratamiento',
  radioterapia: 'Radioterapia',
  fisicaMedica: 'Fisica medica',
  imagenologia: 'Imagenologia',
  resonancia: 'Resonancia magnetica',
  medicinaNuclear: 'Medicina nuclear',
  proteccionRadiologica: 'Proteccion radiologica',
  docenciaEducacion: 'Docencia y educacion',
  inteligenciaArtificial: 'Inteligencia artificial',
  informaticaImagenes: 'Informatica de imagenes',
  gestionCalidad: 'Gestion y calidad',
  investigacion: 'Investigacion',
  ecografia: 'Ecografia',
};
