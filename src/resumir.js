// "De que se trata": una frase en espanol para cada oportunidad.
//
// No es una traduccion. Es un resumen armado con lo que el radar ya sabe:
// que tipo de cosa es, de que tema, quien la organiza, donde, cuanto cuesta,
// hasta cuando hay plazo y que peros tiene. Sale igual de bien para una ficha
// en ingles, en portugues o en espanol, y no depende de ningun servicio
// externo ni de ninguna clave.

import { normalizar, fechaBonita, caeEnFinDeSemana, diasHasta } from './util.js';

/**
 * Temas concretos. Son mas finos que las areas: un area dice "radioterapia",
 * esto dice "braquiterapia" o "planificacion IMRT/VMAT", que es lo que uno
 * realmente quiere saber de un vistazo.
 */
const TEMAS = [
  [['braquiterapia', 'brachytherapy', 'gec-estro'], 'braquiterapia'],
  [['imrt', 'vmat', 'treatment planning', 'planificacion de tratamiento', 'planificacion dosimetrica'], 'planificacion de tratamiento (IMRT/VMAT)'],
  [['sbrt', 'sabr', 'srs', 'radiocirugia', 'radiosurgery', 'stereotactic'], 'radioterapia estereotactica y radiocirugia'],
  [['proton', 'protonterapia', 'carbon ion', 'hadron'], 'protonterapia y terapia con iones'],
  [['flash'], 'radioterapia FLASH'],
  [['mr-linac', 'mri-linac', 'unity', 'mr guided', 'adaptive radiotherapy', 'radioterapia adaptativa'], 'radioterapia adaptativa y guiada por resonancia'],
  [['contouring', 'contorneo', 'delineacion', 'oar', 'organs at risk'], 'contorneo de organos y volumenes'],
  [['igrt', 'cbct', 'image guided', 'posicionamiento'], 'posicionamiento y verificacion de imagen (IGRT)'],
  [['surface guided', 'sgrt', 'vision rt', 'c-rad'], 'posicionamiento por superficie (SGRT)'],
  [['dosimetry', 'dosimetria', 'trs-398', 'trs 398', 'calibracion de haces', 'beam calibration', 'absolute dose'], 'dosimetria y calibracion'],
  [['quality assurance', 'quality control', 'control de calidad', 'commissioning', 'auditoria dosimetrica'], 'control de calidad y puesta en servicio'],
  [['monte carlo'], 'calculo Monte Carlo'],
  [['pet/ct', 'pet ct', 'petct', 'pet-ct'], 'PET/CT'],
  [['spect', 'gammacamara', 'gamma camera', 'cintigrafia', 'scintigraphy'], 'SPECT y gammagrafia'],
  [['theranostics', 'teranostica', 'lu-177', 'lutecio', 'psma', 'radioligand', 'i-131', 'yodo 131'], 'teranostica y terapia con radiofarmacos'],
  [['radiopharmaceutical', 'radiofarmaco', 'radiofarmacia', 'radiochemistry'], 'radiofarmacia'],
  [['mri', 'resonancia magnetica', 'magnetic resonance', 'ismrm', 'smrt'], 'resonancia magnetica'],
  [['fmri', 'difusion', 'dwi', 'perfusion', 'espectroscopia', 'spectroscopy'], 'secuencias avanzadas de resonancia'],
  [['mammography', 'mamografia', 'tomosintesis', 'breast imaging'], 'mamografia e imagen mamaria'],
  [['interventional', 'intervencional', 'hemodinamia', 'angiografia', 'cateterismo'], 'radiologia intervencional y hemodinamia'],
  [['computed tomography', 'tomografia computada', 'tomografia computarizada', 'ct protocol'], 'tomografia computada'],
  [['ultrasound', 'ecografia', 'sonography', 'pocus', 'doppler'], 'ecografia'],
  [['radiation protection', 'proteccion radiologica', 'radiation safety', 'radioproteccion', 'alara', 'shielding', 'blindaje'], 'proteccion radiologica'],
  [['patient dose', 'dosis al paciente', 'diagnostic reference level', 'niveles de referencia', 'optimizacion de dosis'], 'optimizacion de dosis al paciente'],
  [['emergency', 'emergencia radiologica', 'accidente radiologico'], 'emergencias radiologicas'],
  [['waste', 'desechos radiactivos', 'transport of radioactive'], 'gestion y transporte de material radiactivo'],
  [['artificial intelligence', 'inteligencia artificial', 'machine learning', 'deep learning', 'radiomics', 'radiomica'], 'inteligencia artificial aplicada'],
  [['pacs', 'dicom', 'ris', 'informatics', 'teleradiolog', 'telerradiolog'], 'informatica de imagenes (PACS/DICOM)'],
  [['train the trainer', 'formacion de formadores', 'faculty development', 'educacion medica', 'medical education', 'docencia universitaria', 'teaching'], 'formacion de docentes'],
  [['curriculum', 'plan de estudios', 'competencias'], 'diseno de programas de estudio'],
  [['patient safety', 'seguridad del paciente', 'incident learning'], 'seguridad del paciente'],
  [['leadership', 'liderazgo', 'management', 'gestion clinica'], 'gestion y liderazgo'],
  [['research methodology', 'metodologia de la investigacion', 'scientific writing', 'publicacion cientifica', 'bioestadistica'], 'metodologia e investigacion'],
  [['cancer', 'oncolog'], 'oncologia'],
  [['pediatric', 'pediatric', 'pediatria'], 'aplicaciones en pediatria'],
];

/**
 * A quien va dirigido. Es el dato que decide si vale la pena seguir leyendo,
 * asi que se busca con harto detalle y en los tres idiomas. Ojo con los nombres:
 * "radiation therapist" y "RTT" en Europa son el equivalente al tecnologo medico
 * de radioterapia chileno, no al medico.
 */
const PUBLICO = [
  [['tecnologo medico', 'tecnologa medica', 'tecnologos medicos', 'tecnologia medica', 'medical technologist'], 'tecnologos medicos'],
  [['radiation therapist', 'radiation therapists', 'rtt', 'therapeutic radiographer', 'radioterapeuta', 'tecnico en radioterapia'], 'tecnologos medicos de radioterapia (RTT)'],
  [['radiographer', 'radiographers', 'radiologic technologist', 'radiological technologist', 'diagnostic radiographer', 'tecnico en radiologia'], 'tecnologos medicos de imagenologia'],
  [['nuclear medicine technologist', 'tecnologo de medicina nuclear'], 'tecnologos de medicina nuclear'],
  [['mri technologist', 'mr technologist', 'tecnologo de resonancia'], 'tecnologos de resonancia'],
  [['sonographer', 'ecografista'], 'ecografistas'],
  [['medical physicist', 'medical physicists', 'fisico medico', 'fisica medica', 'clinical scientist'], 'fisicos medicos'],
  [['dosimetrist', 'dosimetrista'], 'dosimetristas'],
  [['radiation oncologist', 'oncologo radioterapeuta', 'radio-oncologo', 'radiation oncology resident'], 'medicos radio-oncologos'],
  [['radiologist', 'radiologists', 'medico radiologo'], 'medicos radiologos'],
  [['nuclear medicine physician', 'medico nuclear'], 'medicos de medicina nuclear'],
  [['oncologist', 'oncologo'], 'oncologos'],
  [['radiation safety officer', 'oficial de proteccion radiologica', 'encargado de proteccion radiologica', 'radiation protection officer', 'rpo'], 'encargados de proteccion radiologica'],
  [['regulator', 'regulators', 'regulatory body', 'autoridad reguladora'], 'autoridades reguladoras'],
  [['biomedical engineer', 'ingeniero biomedico', 'clinical engineer'], 'ingenieros biomedicos'],
  [['nurse', 'nurses', 'enfermera', 'enfermero', 'enfermeria'], 'enfermeria'],
  [['student', 'students', 'estudiante', 'estudiantes', 'undergraduate'], 'estudiantes'],
  [['resident', 'residents', 'residente', 'trainee', 'trainees'], 'residentes y personal en formacion'],
  [['early career', 'young professional', 'jovenes profesionales', 'recien titulado'], 'profesionales jovenes'],
  [['teacher', 'teachers', 'educator', 'educators', 'faculty', 'docente', 'docentes', 'profesor'], 'docentes'],
  [['researcher', 'researchers', 'investigador', 'investigadores'], 'investigadores'],
  [['manager', 'jefatura', 'director', 'head of department', 'gestor'], 'jefaturas y gestion'],
];

const ANUNCIA_PUBLICO = /(dirigido a|dirigida a|destinado a|orientado a|participantes|pueden participar|pueden postular|aimed at|intended for|designed for|open to|target audience|who should attend|for practicing|para profesionales)/;

/**
 * Igual que publicoDe, pero mirando solo las frases del texto largo que anuncian
 * a quien va dirigido. Un "director" suelto en el pie de pagina no cuenta.
 */
export function publicoEnFrasesRelevantes(textoLargo) {
  const frases = String(textoLargo || '')
    .split(/[.;\n]+/)
    .filter((f) => ANUNCIA_PUBLICO.test(normalizar(f)));
  if (!frases.length) return [];
  return publicoDe(frases.join('. '));
}

/** Devuelve el publico objetivo detectado, en espanol. */
export function publicoDe(texto) {
  const t = ` ${normalizar(texto)} `;
  const encontrados = [];
  for (const [claves, frase] of PUBLICO) {
    // El (s|es)? del final hace que "radiation oncologists" y "RTTs" calcen
    // igual que su singular, sin tener que listar cada plural a mano.
    const pega = claves.some((c) => apareceComoPalabra(t, c));
    if (pega && !encontrados.includes(frase)) encontrados.push(frase);
  }
  // Sobran los genericos cuando ya se dijo algo mas preciso: si dice
  // "tecnologos medicos de radioterapia", no hace falta repetir "tecnologos
  // medicos"; si dice "medicos radio-oncologos", no hace falta "oncologos".
  let limpio = [...encontrados];
  if (limpio.some((e) => e.startsWith('tecnologos medicos de') || e.startsWith('tecnologos de'))) {
    limpio = limpio.filter((e) => e !== 'tecnologos medicos');
  }
  if (limpio.includes('medicos radio-oncologos')) limpio = limpio.filter((e) => e !== 'oncologos');
  if (limpio.includes('medicos radiologos')) limpio = limpio.filter((e) => e !== 'oncologos');
  return limpio.slice(0, 4);
}

/**
 * Cuando la ficha no dice a quien va dirigido, el area lo insinua bastante bien:
 * un curso de braquiterapia es para el equipo de radioterapia, aunque no lo
 * escriba. Se devuelve como deduccion, nunca como dato.
 */
const PUBLICO_POR_AREA = {
  tecnicasEspeciales: 'tecnologos medicos de radioterapia, fisicos medicos y medicos radio-oncologos',
  radioterapia: 'tecnologos medicos de radioterapia, fisicos medicos y medicos radio-oncologos',
  fisicaMedica: 'fisicos medicos, dosimetristas y tecnologos medicos con experiencia clinica',
  imagenologia: 'tecnologos medicos de imagenologia y medicos radiologos',
  resonancia: 'tecnologos medicos de resonancia y medicos radiologos',
  medicinaNuclear: 'tecnologos de medicina nuclear, fisicos medicos y medicos nucleares',
  proteccionRadiologica: 'encargados de proteccion radiologica, fisicos medicos y tecnologos medicos',
  docenciaEducacion: 'docentes del area de la salud',
  ecografia: 'ecografistas y tecnologos medicos',
  informaticaImagenes: 'tecnologos medicos e informaticos de imagenes',
  inteligenciaArtificial: 'tecnologos medicos, fisicos medicos e investigadores',
};

export function publicoProbable(areas) {
  for (const a of areas) if (PUBLICO_POR_AREA[a]) return PUBLICO_POR_AREA[a];
  return null;
}

const FRASE_TIPO = {
  beca: 'Beca o fellowship',
  'call-abstracts': 'Llamado a enviar resumenes',
  congreso: 'Congreso o jornada',
  curso: 'Curso',
  webinar: 'Webinar',
  postgrado: 'Programa de postgrado',
  certificacion: 'Certificacion',
  pasantia: 'Pasantia o visita cientifica',
  convocatoria: 'Convocatoria abierta',
  investigacion: 'Convocatoria de investigacion',
  premio: 'Premio o reconocimiento',
  publicacion: 'Documento o guia tecnica',
};

const IDIOMAS = { en: 'ingles', pt: 'portugues', es: 'espanol', fr: 'frances', de: 'aleman', it: 'italiano' };

const TEMAS_GENERICOS = ['oncologia', 'aplicaciones en pediatria'];

/**
 * La palabra tiene que aparecer completa, no como pedazo de otra.
 * El (s|es)? del final cubre los plurales sin listarlos uno por uno.
 */
function apareceComoPalabra(texto, clave) {
  const escapada = clave.replace(/[.*+?^${}()|[\]\\]/g, (c) => '\\' + c);
  return new RegExp(`(^|[^a-z0-9])${escapada}(s|es)?($|[^a-z0-9])`).test(texto);
}

function temasDe(texto) {
  const t = ` ${normalizar(texto)} `;
  const encontrados = [];
  for (const [claves, frase] of TEMAS) {
    // Sin esto, "ris" pegaba dentro de "Paris" y todo terminaba clasificado
    // como informatica de imagenes.
    if (claves.some((c) => apareceComoPalabra(t, c)) && !encontrados.includes(frase)) encontrados.push(frase);
  }
  const especificos = encontrados.filter((e) => !TEMAS_GENERICOS.includes(e));
  return (especificos.length ? especificos : encontrados).slice(0, 2);
}

function listar(cosas) {
  if (cosas.length <= 1) return cosas[0] || '';
  return `${cosas.slice(0, -1).join(', ')} y ${cosas[cosas.length - 1]}`;
}

/**
 * Arma la frase en espanol.
 * @returns {string} una o dos oraciones, siempre en espanol, nunca vacia.
 */
/** Donde se hace, dicho siempre, aunque la respuesta sea que no se sabe. */
function fraseDelLugar(o) {
  const donde = o.lugar ? o.lugar : null;
  switch (o.modalidad) {
    case 'online':
      return 'Se hace a distancia: no hay que viajar.';
    case 'hibrido':
      return donde
        ? `Es mixto: presencial en ${donde} o a distancia.`
        : 'Es mixto, presencial o a distancia, pero la ficha no dice en que ciudad.';
    case 'presencial':
      return donde
        ? `Es presencial, en ${donde}: hay que viajar.`
        : 'Es presencial, pero la ficha no dice donde.';
    default:
      return donde
        ? `Aparece asociado a ${donde}; la ficha no aclara si es presencial o a distancia.`
        : 'La ficha no dice donde se hace ni si es presencial o a distancia.';
  }
}

/** Como se paga. Tambien se dice siempre. */
function fraseDelDinero(o) {
  // Si la ficha publica montos, eso manda por sobre cualquier deduccion.
  const plata = o.dinero || {};
  if (plata.montos?.length) {
    const cubre = o.financiamiento ? ' Ademas menciona apoyo economico: conviene preguntar si cubre esto.' : '';
    return `La ficha publica valores: ${plata.montos.join(', ')}.${cubre}`;
  }

  const apoyo = o.detalleFinanciamiento?.length ? listar(o.detalleFinanciamiento) : null;
  const esBecaEnSi = o.tipo === 'beca' || o.tipo === 'pasantia';

  if (esBecaEnSi) {
    return apoyo
      ? `El financiamiento es el objeto de la postulacion: ${apoyo}.`
      : 'Lo que se postula es el financiamiento mismo; la ficha no detalla que cubre.';
  }

  if (o.costo === 'gratis' && o.financiamiento) {
    return `Sin costo, y ademas menciona ${apoyo || 'apoyo economico'}.`;
  }
  if (o.costo === 'gratis') return 'Sin costo de inscripcion.';

  if (o.costo === 'pago' && o.financiamiento) {
    return `Tiene costo de inscripcion, pero menciona ${apoyo || 'apoyo para financiarlo'}: vale la pena preguntar.`;
  }
  if (o.costo === 'pago') return 'Tiene costo de inscripcion, pero la pagina no publica el monto: aparece al entrar al formulario.';

  if (o.financiamiento) {
    return `No dice el valor, pero menciona ${apoyo || 'apoyo economico'}.`;
  }
  return 'La pagina no publica el valor ni menciona apoyo economico. En estos casos el precio suele estar en el formulario de inscripcion.';
}

export function resumirEnEspanol(o) {
  // textoParaTemas permite acotar de donde salen los temas. Sin el, se usa
  // todo lo que haya, que es lo correcto al reprocesar fichas viejas.
  const texto = o.textoParaTemas || [o.titulo, o.resumen].filter(Boolean).join(' ') || o.texto || '';
  const banderas = o.elegibilidad?.banderas || {};
  const partes = [];

  // ── Que es y de que ──────────────────────────────────────
  const tipo = FRASE_TIPO[o.tipo] || 'Actividad';
  // Decir "a distancia" de un premio o de una guia no aporta nada; en un curso
  // o un congreso, en cambio, es de lo primero que uno quiere saber.
  const modalidadImporta = ['curso', 'webinar', 'congreso', 'postgrado', 'pasantia', 'certificacion'].includes(o.tipo);
  const modalidad = !modalidadImporta ? ''
    : o.modalidad === 'online' ? ' a distancia'
    : o.modalidad === 'hibrido' ? ' en formato mixto'
    : o.modalidad === 'presencial' ? ' presencial'
    : '';
  const temas = temasDe(texto);
  const sobre = temas.length ? ` sobre ${listar(temas)}` : '';
  let primera = `${tipo}${modalidad}${sobre}`;

  const organizacion = (o.organizacion || '').replace(/\s+·.*$/, '').trim();
  if (organizacion) primera += `, de ${organizacion}`;
  partes.push(primera + '.');

  // Lo primero que hay que saber de un archivo es que no esta abierto.
  if (o.historico) {
    partes.push('Es el registro de ediciones anteriores, no una convocatoria abierta: sirve para saber que se repite y estar atento a la proxima vuelta.');
  }

  // ── A quien va dirigido ──────────────────────────────────
  // Va segundo a proposito: despues de saber que es, lo siguiente que uno
  // quiere saber es si es para uno.
  const publico = o.publico?.length ? o.publico : publicoDe(texto);
  if (publico.length) {
    const meIncluye = publico.some((p) => p.startsWith('tecnologos'));
    partes.push(`Dirigido a ${listar(publico)}${meIncluye ? ', o sea a ti' : ''}.`);
  } else {
    // Cuando la ficha no lo dice, se deduce del tema. Se avisa que es deduccion.
    const probable = publicoProbable(o.areas || []);
    partes.push(
      probable
        ? `No dice a quien va dirigido; por el tema deberian entrar ${probable}.`
        : 'No dice a quien va dirigido: hay que revisar la ficha.'
    );
  }

  // ── Donde se hace ────────────────────────────────────────
  // Siempre se dice algo: "no se sabe" tambien es informacion.
  partes.push(fraseDelLugar(o));

  // ── Plata ────────────────────────────────────────────────
  partes.push(fraseDelDinero(o));

  // ── Plazo ────────────────────────────────────────────────
  if (o.fecha_limite) {
    const dias = diasHasta(o.fecha_limite);
    const cuando = fechaBonita(o.fecha_limite);
    const estimada = o.fecha_estimada ? ' (fecha estimada, hay que confirmarla)' : '';
    if (o.clase_fecha === 'evento') {
      partes.push(dias >= 0 ? `Se realiza el ${cuando}${estimada}.` : `Se realizo el ${cuando}.`);
    } else if (dias === null || dias >= 0) {
      // Un cierre en fin de semana suele significar que hay que tener todo
      // listo el viernes: pocas oficinas revisan un sabado.
      const aviso = caeEnFinDeSemana(o.fecha_limite) ? ' Cae fin de semana: conviene cerrarlo el viernes.' : '';
      partes.push(`El plazo vence el ${cuando}${estimada}.${aviso}`);
    } else {
      partes.push(`El plazo vencio el ${cuando}.`);
    }
  }

  // ── Peros ────────────────────────────────────────────────
  const peros = [];
  if (banderas.pideNominacionGobierno) peros.push('se postula por el canal oficial del pais, que en Chile es la CCHEN');
  if (banderas.dirigidoAOtraProfesion && !banderas.mencionaTecnologos && !publico.length) peros.push('el texto apunta a medicos o fisicos medicos');
  const yaDijePublico = publico.some((p) => p.startsWith('tecnologos'));
  if (banderas.mencionaTecnologos && !yaDijePublico) peros.push('menciona expresamente a tecnologos medicos');
  if (banderas.pidePostgrado) peros.push('menciona magister o doctorado entre los requisitos');
  if (banderas.restriccionGeografica && !banderas.mencionaChile && !banderas.mencionaLatam) peros.push('parece limitado a otra region');
  if (banderas.mencionaChile && o.lugar !== 'Chile') peros.push('menciona a Chile');
  else if (banderas.mencionaLatam) peros.push('es una actividad regional para America Latina');
  if (peros.length) partes.push(`${listar(peros.slice(0, 3)).replace(/^./, (c) => c.toUpperCase())}.`);

  // ── Idioma del material ──────────────────────────────────
  if (o.idioma && o.idioma !== 'es') {
    partes.push(`El material esta en ${IDIOMAS[o.idioma] || o.idioma}.`);
  }

  // ── De donde salio esto ──────────────────────────────────
  // Las notas que vienen de la busqueda de noticias no tienen ficha propia que
  // leer: el radar solo ve el titular. Mas vale decirlo que fingir que se sabe.
  if (String(o.url || '').includes('news.google')) {
    partes.push(
      o.anuncio
        ? 'Es una noticia, pero anuncia algo concreto a lo que se puede entrar. El radar solo ve el titular: abre el enlace para la fecha, el costo y como postular.'
        : 'Es prensa del gremio, no una convocatoria. Queda registrada por si sirve de contexto.'
    );
  } else if (!o.contenido && !o.descripcion) {
    partes.push('La pagina no entrega texto legible (suele pasar con sitios hechos en javascript): hay que abrirla para ver de que se trata.');
  }

  return partes.join(' ');
}
