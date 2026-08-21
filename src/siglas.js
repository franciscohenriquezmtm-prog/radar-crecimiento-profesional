// Que significa cada sigla.
//
// El area esta hecha de siglas, y una ficha que dice "ESTRO Falcon Workshop on
// Spine SBRT" no comunica nada si no sabes que ESTRO es la sociedad europea de
// radioterapia y SBRT es radioterapia estereotactica corporal.
//
// Cada entrada trae el nombre completo tal cual y, cuando aporta, la traduccion
// o la explicacion en una linea. Solo se muestran las siglas que aparecen en la
// ficha, no el glosario entero.

/**
 * @type {Record<string, {largo: string, es?: string}>}
 */
export const SIGLAS = {
  // ── Organismos y sociedades ────────────────────────────────
  IAEA: { largo: 'International Atomic Energy Agency', es: 'Organismo Internacional de Energia Atomica (OIEA)' },
  OIEA: { largo: 'Organismo Internacional de Energia Atomica', es: 'agencia de Naciones Unidas para usos pacificos de la energia nuclear' },
  OPS: { largo: 'Organizacion Panamericana de la Salud', es: 'oficina regional de la OMS para las Americas' },
  PAHO: { largo: 'Pan American Health Organization', es: 'la OPS en ingles' },
  OMS: { largo: 'Organizacion Mundial de la Salud' },
  WHO: { largo: 'World Health Organization', es: 'la OMS en ingles' },
  OEA: { largo: 'Organizacion de los Estados Americanos' },

  ESTRO: { largo: 'European Society for Radiotherapy and Oncology', es: 'la sociedad europea de radioterapia; su escuela dicta la mayoria de los cursos del area' },
  ASTRO: { largo: 'American Society for Radiation Oncology', es: 'la sociedad estadounidense de radioterapia' },
  AAPM: { largo: 'American Association of Physicists in Medicine', es: 'asociacion estadounidense de fisicos medicos' },
  IOMP: { largo: 'International Organization for Medical Physics', es: 'organizacion mundial de fisica medica' },
  EFOMP: { largo: 'European Federation of Organisations for Medical Physics' },
  ACPSEM: { largo: 'Australasian College of Physical Scientists and Engineers in Medicine' },
  ALFIM: { largo: 'Asociacion Latinoamericana de Fisica Medica' },
  ALATRO: { largo: 'Asociacion Latinoamericana de Terapia Radiante Oncologica' },
  AAMD: { largo: 'American Association of Medical Dosimetrists', es: 'asociacion de dosimetristas' },
  RSNA: { largo: 'Radiological Society of North America', es: 'organiza el congreso de radiologia mas grande del mundo, en Chicago' },
  ESR: { largo: 'European Society of Radiology' },
  ECR: { largo: 'European Congress of Radiology', es: 'el congreso anual de la ESR, en Viena' },
  ISMRM: { largo: 'International Society for Magnetic Resonance in Medicine' },
  SMRT: { largo: 'Section for Magnetic Resonance Technologists', es: 'la seccion de tecnologos dentro de la ISMRM' },
  ISMRT: { largo: 'International Society for Magnetic Resonance Technologists', es: 'nombre actual de la seccion de tecnologos de la ISMRM' },
  ESMRMB: { largo: 'European Society for Magnetic Resonance in Medicine and Biology' },
  SNMMI: { largo: 'Society of Nuclear Medicine and Molecular Imaging', es: 'sociedad estadounidense de medicina nuclear' },
  EANM: { largo: 'European Association of Nuclear Medicine' },
  ALASBIMN: { largo: 'Asociacion Latinoamericana de Sociedades de Biologia y Medicina Nuclear' },
  ISRRT: { largo: 'International Society of Radiographers and Radiological Technologists', es: 'la sociedad mundial de TU profesion: agrupa a los tecnologos medicos' },
  EFRS: { largo: 'European Federation of Radiographer Societies' },
  ASRT: { largo: 'American Society of Radiologic Technologists', es: 'sociedad estadounidense de tecnologos radiologos' },
  ARRT: { largo: 'American Registry of Radiologic Technologists', es: 'entidad que certifica tecnologos en Estados Unidos' },
  ACR: { largo: 'American College of Radiology' },
  SIIM: { largo: 'Society for Imaging Informatics in Medicine', es: 'informatica de imagenes: PACS, DICOM, flujos digitales' },
  ICRP: { largo: 'International Commission on Radiological Protection', es: 'la comision que fija las recomendaciones de proteccion radiologica' },
  ICRU: { largo: 'International Commission on Radiation Units and Measurements' },
  IRPA: { largo: 'International Radiation Protection Association' },
  NCRP: { largo: 'National Council on Radiation Protection and Measurements', es: 'consejo estadounidense de proteccion radiologica' },
  HPS: { largo: 'Health Physics Society' },
  IUPESM: { largo: 'International Union for Physical and Engineering Sciences in Medicine' },
  WFUMB: { largo: 'World Federation for Ultrasound in Medicine and Biology' },
  AIUM: { largo: 'American Institute of Ultrasound in Medicine' },
  SDMS: { largo: 'Society of Diagnostic Medical Sonography' },
  ICTP: { largo: 'International Centre for Theoretical Physics', es: 'centro en Trieste que financia formacion para paises en desarrollo' },
  TWAS: { largo: 'The World Academy of Sciences', es: 'academia de ciencias para el sur global' },
  MPWB: { largo: 'Medical Physics for World Benefit' },
  EUTEMPE: { largo: 'European Training and Education for Medical Physics Experts' },
  RANZCR: { largo: 'Royal Australian and New Zealand College of Radiologists' },
  NBEMS: { largo: 'National Board of Examinations in Medical Sciences', es: 'organismo examinador de India' },
  CIR: { largo: 'Colegio Interamericano de Radiologia' },
  CBR: { largo: 'Colegio Brasileiro de Radiologia' },
  ABFM: { largo: 'Associacao Brasileira de Fisica Medica' },
  SEFM: { largo: 'Sociedad Espanola de Fisica Medica' },
  SEPR: { largo: 'Sociedad Espanola de Proteccion Radiologica' },
  SEOR: { largo: 'Sociedad Espanola de Oncologia Radioterapica' },
  SERAM: { largo: 'Sociedad Espanola de Radiologia Medica' },
  CSN: { largo: 'Consejo de Seguridad Nuclear', es: 'el regulador nuclear espanol' },
  DAAD: { largo: 'Deutscher Akademischer Austauschdienst', es: 'Servicio Aleman de Intercambio Academico: becas de Alemania' },

  // ── Chile ──────────────────────────────────────────────────
  SOCHRADI: { largo: 'Sociedad Chilena de Radiologia' },
  CCHEN: { largo: 'Comision Chilena de Energia Nuclear', es: 'tambien es la Autoridad Nacional de Enlace ante el OIEA: por ahi pasan las becas' },
  ANID: { largo: 'Agencia Nacional de Investigacion y Desarrollo', es: 'la agencia estatal chilena que entrega las becas de postgrado' },
  MINSAL: { largo: 'Ministerio de Salud' },
  ISP: { largo: 'Instituto de Salud Publica de Chile' },
  INC: { largo: 'Instituto Nacional del Cancer' },
  FALP: { largo: 'Fundacion Arturo Lopez Perez' },
  UBO: { largo: "Universidad Bernardo O'Higgins" },

  // ── Tecnicas de tratamiento ────────────────────────────────
  IMRT: { largo: 'Intensity-Modulated Radiation Therapy', es: 'radioterapia de intensidad modulada' },
  VMAT: { largo: 'Volumetric Modulated Arc Therapy', es: 'arcoterapia volumetrica modulada' },
  SBRT: { largo: 'Stereotactic Body Radiation Therapy', es: 'radioterapia estereotactica corporal: pocas sesiones, dosis alta, gran precision' },
  SABR: { largo: 'Stereotactic Ablative Radiotherapy', es: 'otro nombre para la SBRT' },
  SRS: { largo: 'Stereotactic Radiosurgery', es: 'radiocirugia estereotactica, habitualmente intracraneal' },
  SFRT: { largo: 'Spatially Fractionated Radiation Therapy', es: 'radioterapia espacialmente fraccionada (GRID, lattice)' },
  IGRT: { largo: 'Image-Guided Radiation Therapy', es: 'radioterapia guiada por imagen' },
  SGRT: { largo: 'Surface-Guided Radiation Therapy', es: 'posicionamiento guiado por la superficie del paciente' },
  ART: { largo: 'Adaptive Radiation Therapy', es: 'radioterapia adaptativa: el plan se rehace durante el tratamiento' },
  DIBH: { largo: 'Deep Inspiration Breath Hold', es: 'apnea inspiratoria profunda, para alejar el corazon del campo' },
  TBI: { largo: 'Total Body Irradiation', es: 'irradiacion corporal total' },
  TSET: { largo: 'Total Skin Electron Therapy', es: 'electronterapia cutanea total' },
  IORT: { largo: 'Intraoperative Radiation Therapy', es: 'radioterapia intraoperatoria' },
  HDR: { largo: 'High Dose Rate', es: 'braquiterapia de alta tasa de dosis' },
  LDR: { largo: 'Low Dose Rate', es: 'braquiterapia de baja tasa de dosis' },
  PDR: { largo: 'Pulsed Dose Rate', es: 'braquiterapia de tasa pulsada' },
  OAR: { largo: 'Organs At Risk', es: 'organos en riesgo: lo que hay que proteger al planificar' },
  GTV: { largo: 'Gross Tumour Volume', es: 'volumen tumoral visible' },
  CTV: { largo: 'Clinical Target Volume', es: 'volumen blanco clinico' },
  PTV: { largo: 'Planning Target Volume', es: 'volumen blanco de planificacion' },
  TPS: { largo: 'Treatment Planning System', es: 'el software de planificacion (Eclipse, Monaco, RayStation)' },
  QA: { largo: 'Quality Assurance', es: 'garantia de calidad' },
  QC: { largo: 'Quality Control', es: 'control de calidad' },

  // ── Imagenes ───────────────────────────────────────────────
  MRI: { largo: 'Magnetic Resonance Imaging', es: 'resonancia magnetica' },
  CBCT: { largo: 'Cone Beam Computed Tomography', es: 'tomografia de haz conico, la del acelerador' },
  '4DCT': { largo: 'Four-Dimensional Computed Tomography', es: 'TC que registra el movimiento respiratorio' },
  PET: { largo: 'Positron Emission Tomography', es: 'tomografia por emision de positrones' },
  SPECT: { largo: 'Single Photon Emission Computed Tomography' },
  PSMA: { largo: 'Prostate-Specific Membrane Antigen', es: 'marcador usado en PET y en teranostica de prostata' },
  PACS: { largo: 'Picture Archiving and Communication System', es: 'el sistema donde se archivan y se ven las imagenes' },
  RIS: { largo: 'Radiology Information System' },
  DICOM: { largo: 'Digital Imaging and Communications in Medicine', es: 'el formato estandar de las imagenes medicas' },

  // ── Proteccion radiologica ─────────────────────────────────
  ALARA: { largo: 'As Low As Reasonably Achievable', es: 'principio de mantener la dosis tan baja como sea razonable' },
  DRL: { largo: 'Diagnostic Reference Level', es: 'nivel de referencia para diagnostico' },
  RPO: { largo: 'Radiation Protection Officer', es: 'encargado de proteccion radiologica' },

  // ── Formacion ──────────────────────────────────────────────
  RTT: { largo: 'Radiation Therapist', es: 'como llaman en Europa al tecnologo medico de radioterapia: eres tu' },
  CME: { largo: 'Continuing Medical Education', es: 'educacion medica continua, con creditos' },
  CPD: { largo: 'Continuing Professional Development', es: 'desarrollo profesional continuo' },
  CRP: { largo: 'Coordinated Research Project', es: 'proyecto de investigacion coordinado por el OIEA' },
  PGEC: { largo: 'Postgraduate Educational Course', es: 'el curso de postgrado en proteccion radiologica del OIEA' },
  MSc: { largo: 'Master of Science', es: 'magister' },
  PhD: { largo: 'Doctor of Philosophy', es: 'doctorado' },
};

// Se ordenan de la mas larga a la mas corta para que "SBRT" no tape a "SB".
const ORDENADAS = Object.keys(SIGLAS).sort((a, b) => b.length - a.length);

/**
 * Las siglas que aparecen en el texto, con su significado.
 *
 * Se exige que la sigla venga en mayusculas y como palabra completa: asi "ART"
 * no calza dentro de "artificial" ni "PET" dentro de "competition".
 *
 * @returns {{sigla: string, largo: string, es?: string}[]}
 */
export function siglasEn(texto, maximo = 6) {
  const t = String(texto || '');
  const encontradas = [];

  for (const sigla of ORDENADAS) {
    if (encontradas.length >= maximo) break;
    const escapada = sigla.replace(/[.*+?^${}()|[\]\\]/g, (c) => '\\' + c);
    // Borde: inicio, fin, o cualquier caracter que no sea letra ni numero.
    const patron = new RegExp(`(^|[^A-Za-z0-9])${escapada}(s|es)?($|[^A-Za-z0-9])`);
    if (patron.test(t)) encontradas.push({ sigla, ...SIGLAS[sigla] });
  }

  return encontradas;
}

/** Una linea lista para mostrar: "ESTRO: nombre completo (explicacion)". */
export function explicar({ sigla, largo, es }) {
  return es ? `${sigla}: ${largo} — ${es}` : `${sigla}: ${largo}`;
}
