// Saca datos duros del texto: fechas limite, modalidad, costo, idioma, lugar.
//
// Todo esto es heuristica sobre texto libre en espanol, ingles y portugues.
// Cuando no esta seguro, prefiere devolver null antes que inventar.

import { normalizar, aIso } from './util.js';

const MESES = {
  enero: 1, ene: 1, january: 1, jan: 1, janeiro: 1,
  febrero: 2, feb: 2, february: 2, fevereiro: 2,
  marzo: 3, mar: 3, march: 3, marco: 3,
  abril: 4, abr: 4, april: 4, apr: 4,
  mayo: 5, may: 5, maio: 5,
  junio: 6, jun: 6, june: 6, junho: 6,
  julio: 7, jul: 7, july: 7, julho: 7,
  agosto: 8, ago: 8, august: 8, aug: 8,
  septiembre: 9, setiembre: 9, sep: 9, sept: 9, september: 9, setembro: 9,
  octubre: 10, oct: 10, october: 10, outubro: 10, out: 10,
  noviembre: 11, nov: 11, november: 11, novembro: 11,
  diciembre: 12, dic: 12, december: 12, dec: 12, dezembro: 12,
};

const NOMBRES_MES = Object.keys(MESES).sort((a, b) => b.length - a.length).join('|');

function armar(a, m, d) {
  if (!a || !m || !d) return null;
  if (a < 100) a += 2000;
  if (a < 2000 || a > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const f = new Date(Date.UTC(a, m - 1, d));
  if (f.getUTCMonth() !== m - 1) return null;
  return aIso(f);
}

/**
 * Encuentra todas las fechas del texto con su posicion.
 * @returns {{iso: string, pos: number, soloMes: boolean}[]}
 */
export function fechasEn(texto) {
  const t = normalizar(texto);
  const halladas = [];
  const empujar = (iso, pos, soloMes = false) => { if (iso) halladas.push({ iso, pos, soloMes }); };

  let m;

  // 2026-10-31
  const reIso = /\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/g;
  while ((m = reIso.exec(t))) empujar(armar(+m[1], +m[2], +m[3]), m.index);

  // 31/10/2026  y  31-10-26   (dia primero; si el primero pasa de 12, es dia si o si)
  const reNum = /\b(\d{1,2})[/.-](\d{1,2})[/.-](20\d{2}|\d{2})\b/g;
  while ((m = reNum.exec(t))) {
    let d = +m[1], mes = +m[2];
    if (d <= 12 && mes > 12) { const x = d; d = mes; mes = x; }
    empujar(armar(+m[3], mes, d), m.index);
  }

  // 31 de octubre de 2026 / 31 october 2026 / 31 de outubro de 2026
  const reDiaMes = new RegExp(`\\b(\\d{1,2})\\s*(?:de\\s+)?(${NOMBRES_MES})\\b\\.?,?\\s*(?:de\\s+|of\\s+)?(20\\d{2})?`, 'g');
  while ((m = reDiaMes.exec(t))) {
    const anio = m[3] ? +m[3] : new Date().getUTCFullYear();
    empujar(armar(anio, MESES[m[2]], +m[1]), m.index);
  }

  // october 31, 2026
  const reMesDia = new RegExp(`\\b(${NOMBRES_MES})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(20\\d{2})?`, 'g');
  while ((m = reMesDia.exec(t))) {
    const anio = m[3] ? +m[3] : new Date().getUTCFullYear();
    empujar(armar(anio, MESES[m[1]], +m[2]), m.index);
  }

  // "octubre de 2026" sin dia: se toma el dia 28 como referencia prudente
  const reMesAnio = new RegExp(`\\b(${NOMBRES_MES})\\s+(?:de\\s+|of\\s+)?(20\\d{2})\\b`, 'g');
  while ((m = reMesAnio.exec(t))) empujar(armar(+m[2], MESES[m[1]], 28), m.index, true);

  return halladas;
}

const PISTAS_LIMITE = [
  'fecha limite', 'fecha de cierre', 'plazo de postulacion', 'plazo maximo', 'plazo hasta',
  'cierre de postulaciones', 'cierre de inscripciones', 'postulaciones hasta', 'postular hasta',
  'inscripciones hasta', 'recepcion de resumenes', 'envio de resumenes hasta', 'vence el',
  'ultimo dia', 'hasta el', 'cierra el', 'cierran el', 'antes del',
  'deadline', 'closing date', 'applications close', 'application deadline', 'submission deadline',
  'abstract deadline', 'abstract submission', 'registration deadline', 'apply by', 'due by',
  'closes on', 'last day to', 'expires on', 'call closes',
  'prazo', 'inscricoes ate', 'encerramento', 'data limite',
];

const PISTAS_EVENTO = [
  'se realizara', 'tendra lugar', 'fecha del curso', 'fecha del evento', 'inicio del curso',
  'takes place', 'will be held', 'course dates', 'event date', 'start date', 'from',
];

/** Busca la fecha limite: una fecha que aparezca cerca de una palabra de cierre. */
export function fechaLimiteEn(texto) {
  if (!texto) return null;
  const t = normalizar(texto);
  const fechas = fechasEn(texto).filter((f) => f.iso >= aIso(new Date(Date.now() - 400 * 86400000)));
  if (!fechas.length) return null;

  let mejor = null;
  for (const pista of PISTAS_LIMITE) {
    let desde = 0;
    for (;;) {
      const i = t.indexOf(pista, desde);
      if (i === -1) break;
      desde = i + pista.length;
      const cercanas = fechas
        .filter((f) => f.pos >= i - 40 && f.pos <= i + 160)
        .sort((a, b) => Math.abs(a.pos - i) - Math.abs(b.pos - i));
      if (cercanas.length) {
        const c = cercanas[0];
        const distancia = Math.abs(c.pos - i);
        if (!mejor || distancia < mejor.distancia) mejor = { iso: c.iso, distancia, soloMes: c.soloMes };
      }
    }
  }
  return mejor ? { fecha: mejor.iso, estimada: mejor.soloMes } : null;
}

/** Fecha del evento en si (no del cierre). Se usa cuando no hay fecha limite. */
export function fechaEventoEn(texto) {
  if (!texto) return null;
  const futuras = fechasEn(texto).filter((f) => f.iso >= aIso(new Date()));
  if (!futuras.length) return null;
  futuras.sort((a, b) => a.iso.localeCompare(b.iso));
  return { fecha: futuras[0].iso, estimada: futuras[0].soloMes };
}

const PAISES = [
  ['chile', 'Chile'], ['santiago', 'Chile'], ['valparaiso', 'Chile'], ['concepcion', 'Chile'],
  ['argentina', 'Argentina'], ['buenos aires', 'Argentina'], ['brasil', 'Brasil'], ['brazil', 'Brasil'],
  ['sao paulo', 'Brasil'], ['rio de janeiro', 'Brasil'], ['peru', 'Peru'], ['lima', 'Peru'],
  ['colombia', 'Colombia'], ['bogota', 'Colombia'], ['mexico', 'Mexico'], ['uruguay', 'Uruguay'],
  ['montevideo', 'Uruguay'], ['ecuador', 'Ecuador'], ['bolivia', 'Bolivia'], ['paraguay', 'Paraguay'],
  ['costa rica', 'Costa Rica'], ['san jose', 'Costa Rica'], ['panama', 'Panama'], ['cuba', 'Cuba'],
  ['espana', 'Espana'], ['spain', 'Espana'], ['madrid', 'Espana'], ['barcelona', 'Espana'],
  ['portugal', 'Portugal'], ['lisbon', 'Portugal'], ['italy', 'Italia'], ['italia', 'Italia'],
  ['trieste', 'Italia'], ['vienna', 'Austria'], ['viena', 'Austria'], ['austria', 'Austria'],
  ['germany', 'Alemania'], ['alemania', 'Alemania'], ['france', 'Francia'], ['paris', 'Francia'],
  ['netherlands', 'Paises Bajos'], ['amsterdam', 'Paises Bajos'], ['belgium', 'Belgica'],
  ['brussels', 'Belgica'], ['united kingdom', 'Reino Unido'], ['london', 'Reino Unido'],
  ['england', 'Reino Unido'], ['ireland', 'Irlanda'], ['sweden', 'Suecia'], ['stockholm', 'Suecia'],
  ['switzerland', 'Suiza'], ['geneva', 'Suiza'], ['united states', 'Estados Unidos'],
  ['usa', 'Estados Unidos'], ['u.s.', 'Estados Unidos'], ['chicago', 'Estados Unidos'],
  ['new york', 'Estados Unidos'], ['boston', 'Estados Unidos'], ['houston', 'Estados Unidos'],
  ['canada', 'Canada'], ['japan', 'Japon'], ['japon', 'Japon'], ['korea', 'Corea del Sur'],
  ['china', 'China'], ['india', 'India'], ['australia', 'Australia'], ['south africa', 'Sudafrica'],
];

export function lugarEn(texto) {
  const t = normalizar(texto);
  for (const [clave, pais] of PAISES) {
    if (new RegExp(`\\b${clave}\\b`).test(t)) return pais;
  }
  return null;
}

export function modalidadEn(texto) {
  const t = normalizar(texto);
  const online = /\b(online|on-line|virtual|webinar|e-learning|elearning|a distancia|remoto|remote|zoom|teams|streaming|en linea|autoadministrado|self-paced|mooc)\b/.test(t);
  const presencial = /\b(presencial|on-site|onsite|in person|in-person|face to face|face-to-face|venue|hotel|campus|aula|sede)\b/.test(t);
  if (online && presencial) return 'hibrido';
  if (online) return 'online';
  if (presencial) return 'presencial';
  return 'desconocida';
}

export function costoEn(texto) {
  const t = normalizar(texto);
  if (/\b(gratis|gratuito|gratuita|sin costo|sin cargo|free of charge|no cost|no fee|free registration|free webinar|acceso libre|sem custo)\b/.test(t)) return 'gratis';
  if (/\b(arancel|matricula|inscripcion de|valor del curso|costo del curso|precio|tuition|course fee|registration fee|fees|usd\s?\d|us\$\s?\d|\$\s?\d{2,}|eur\s?\d|€\s?\d)\b/.test(t)) return 'pago';
  return 'desconocido';
}

export function traeFinanciamiento(texto) {
  const t = normalizar(texto);
  return /\b(beca|becas|financiamiento|financiado|viaticos|pasajes|estipendio|apoyo economico|manutencion|scholarship|fellowship|grant|grants|funded|fully funded|travel grant|travel award|stipend|bursary|sponsorship|all expenses)\b/.test(t);
}

/**
 * Cronica de algo que ya ocurrio, no una oportunidad abierta.
 *
 * "Exitosa jornada sobre inteligencia artificial" y "ECR 2025 wins two gold
 * awards" son noticias, no cosas a las que puedas postular. No se descartan
 * —a veces adentro viene el anuncio del proximo ciclo— pero bajan harto.
 */
export function pareceRetrospectiva(texto) {
  const t = normalizar(texto);
  // Tambien entran los titulares de prensa: una nota periodistica sobre becas
  // no es una convocatoria de becas, y hasta ahora se colaban con puntaje alto.
  const cronica = /\b(exitosa|exitoso|se realizo|se llevo a cabo|concluyo|culmino|celebro|memoria del|resumen del|recuento|balance|galardon|premiado|wins|won|awarded|receives|celebrates|highlights of|recap|took place|was held|concluded|report on|looking back|aniversario|honoured|honored|delivers keynote|delivered|appointed|elected|named as|in memoriam|obituary|now available|ya disponible|nombrado|designado|distinguido)\b/;
  const prensa = /\b(revela que|revelan|detecta|detectan|denuncia|denuncian|investiga|acusa|critica|polemica|escandalo|adeudan|se adjudica|obtuvo|firma convenio|inaugura|inauguro)\b/;
  return cronica.test(t) || prensa.test(t);
}

/** Verbo de accion: hay algo que hacer y una puerta abierta. */
export function invitaAActuar(texto) {
  const t = normalizar(texto);
  return /\b(postula|postular|postulaciones|inscribete|inscripciones abiertas|inscripcion abierta|convocatoria abierta|abierta la convocatoria|apply now|apply by|applications open|registration open|register now|call for|submit your|nominations open|cupos disponibles|matriculas abiertas|save the date)\b/.test(t);
}

/**
 * Que clase de apoyo economico ofrece, no solo si ofrece.
 *
 * No es lo mismo una beca que cubre todo, un apoyo de pasajes, o un descuento
 * de matricula: cambia por completo si puedes ir o no.
 */
export function detalleDelFinanciamiento(texto) {
  const t = normalizar(texto);
  const hallados = [];
  const buscar = (claves, etiqueta) => {
    if (claves.some((c) => t.includes(c)) && !hallados.includes(etiqueta)) hallados.push(etiqueta);
  };

  buscar(['fully funded', 'all expenses', 'todos los gastos', 'beca completa', 'gastos cubiertos', 'covers all costs'], 'cubre todos los gastos');
  buscar(['travel grant', 'travel award', 'travel support', 'pasajes', 'viaticos', 'apoyo de viaje', 'travel bursary', 'accommodation'], 'apoyo de viaje o estadia');
  buscar(['stipend', 'estipendio', 'monthly allowance', 'manutencion', 'salary', 'remunerado'], 'estipendio o manutencion');
  buscar(['tuition', 'matricula', 'registration fee waiver', 'fee waiver', 'exencion', 'descuento'], 'matricula cubierta o rebajada');
  buscar(['scholarship', 'beca', 'bursary', 'bolsa de estudos'], 'beca');
  buscar(['grant', 'funding', 'financiamiento', 'fondo'], 'fondo o financiamiento');

  return hallados.slice(0, 2);
}

/**
 * Una noticia que ANUNCIA algo a lo que se puede entrar.
 *
 * "NBEMS lanza curso gratuito de IA, postulaciones abiertas" es una
 * oportunidad, aunque llegue como titular de prensa. "Fulano recibe doctorado
 * honorario" no lo es. La diferencia es si hay una puerta abierta o no.
 */
export function anunciaUnaOportunidad(texto) {
  const t = normalizar(texto);
  const anuncia = /\b(lanza|lanzan|lanzo|abre|abren|abrio|convoca|convocan|ofrece|ofrecen|dicta|dictara|invita|inicia|comienza|entrega becas|otorga|dispone|habilita|launches|launched|opens|opened|announces|announced|invites|offers|now accepting|applications open|call for|apply now|registration open|free course|new course|new programme|new program)\b/;
  const objeto = /\b(curso|cursos|beca|becas|diplomado|magister|congreso|taller|programa|capacitacion|formacion|pasantia|convocatoria|concurso|fellowship|scholarship|course|training|workshop|programme|program|grant|internship|webinar|certificacion)\b/;
  return anuncia.test(t) && objeto.test(t);
}

export function esFormacionDeFormadores(texto) {
  const t = normalizar(texto);
  return /\b(train the trainer|train-the-trainer|training of trainers|formacion de formadores|formador de formadores|faculty development|teaching skills|educators|docencia|docente|teaching course|how to teach|curso para profesores|pedagogia|educacion medica|medical education|preceptor|tutor clinico|mentoring|mentorship)\b/.test(t);
}

export function idiomaEn(texto) {
  const t = normalizar(texto).slice(0, 3000);
  const marcadores = {
    es: (t.match(/\b(de|la|el|para|los|con|del|una|que|curso|inscripcion)\b/g) || []).length,
    en: (t.match(/\b(the|and|for|with|this|will|course|registration|application)\b/g) || []).length,
    pt: (t.match(/\b(para|com|uma|nao|inscricoes|curso|realizacao|sera)\b/g) || []).length,
  };
  const [mejor] = Object.entries(marcadores).sort((a, b) => b[1] - a[1]);
  return mejor && mejor[1] > 2 ? mejor[0] : 'en';
}

const FRASES_REQUISITO = [
  ['nominacion del gobierno', 'nominado por el gobierno', 'government nomination', 'nominated by', 'national liaison officer', 'nlo ', 'member state', 'estados miembros', 'counterpart'],
  ['medical physicist', 'fisico medico', 'physicists only', 'for physicians', 'medical doctors', 'solo medicos', 'radiation oncologist', 'physicians only'],
  ['master', 'magister', 'msc', 'phd', 'doctorado', 'postgraduate degree', 'graduate degree'],
  ['years of experience', 'anos de experiencia', 'minimum of', 'at least 3 years', 'at least 5 years'],
  ['eu citizen', 'european union', 'residents of', 'nationals of', 'only for members', 'members only', 'solo socios', 'solo miembros'],
];

/** Devuelve frases textuales de requisitos encontradas, para mostrarlas tal cual. */
export function requisitosEn(texto) {
  if (!texto) return [];
  const lineas = String(texto).split(/[\n.;]+/);
  const encontradas = [];
  for (const linea of lineas) {
    const l = normalizar(linea);
    if (l.length < 20 || l.length > 260) continue;
    const pega =
      /\b(requisito|requisitos|dirigido a|destinado a|elegible|elegibilidad|se requiere|debe ser|deben ser|pueden postular|eligibility|eligible|requirement|must be|must have|open to|intended for|applicants should|who can apply|prerequisite)\b/.test(l);
    if (pega) encontradas.push(linea.trim().replace(/\s+/g, ' '));
    if (encontradas.length >= 6) break;
  }
  return encontradas;
}

export function banderasDeRequisito(texto) {
  const t = normalizar(texto);
  return {
    pideNominacionGobierno: FRASES_REQUISITO[0].some((f) => t.includes(f)),
    dirigidoAOtraProfesion: FRASES_REQUISITO[1].some((f) => t.includes(f)),
    pidePostgrado: FRASES_REQUISITO[2].some((f) => t.includes(f)),
    pideExperiencia: FRASES_REQUISITO[3].some((f) => t.includes(f)),
    restriccionGeografica: FRASES_REQUISITO[4].some((f) => t.includes(f)),
    mencionaTecnologos: /\b(radiographer|radiation therapist|rtt|technologist|tecnologo medico|tecnologa medica|tecnicos en radiologia|radiologic technologist|nuclear medicine technologist|mri technologist)\b/.test(t),
    mencionaChile: /\bchile\b/.test(t),
    mencionaLatam: /\b(latin america|latinoamerica|america latina|latam|caribbean|caribe|region|iberoamerica)\b/.test(t),
  };
}
