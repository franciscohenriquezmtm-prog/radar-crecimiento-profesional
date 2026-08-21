// Leer de verdad la ficha de una oportunidad.
//
// Hasta aca el radar se conformaba con el titulo y la meta-descripcion. Eso
// alcanza para clasificar, pero no para responder las dos preguntas que uno
// realmente se hace: de que se trata esto, y quien lo paga.
//
// Ese contenido si esta en la pagina, pero enterrado entre menus, banners de
// cookies y pies de pagina. Este modulo hace tres cosas:
//   1. se queda con la region principal de la pagina y bota el resto;
//   2. rescata las frases que describen la actividad;
//   3. rescata las frases que hablan de plata, con montos y todo.
//
// Todo textual: se muestran las palabras de la fuente, no una parafrasis.

import { aTextoPlano, normalizar, recortar } from './util.js';

// ── 1. Quedarse con el contenido, botar la maqueta ───────────

const BLOQUES_DE_MAQUETA = ['nav', 'header', 'footer', 'aside', 'form', 'script', 'style', 'noscript', 'svg', 'select'];

const CLASES_DE_MAQUETA = /(^|[\s"'_-])(nav|navbar|menu|topbar|header|footer|sidebar|breadcrumb|cookie|consent|banner|social|share|newsletter|subscribe|search|skip|widget|related|sidenav|offcanvas|modal)([\s"'_-]|$)/i;

/**
 * El texto de la region principal de la pagina.
 *
 * Si la pagina usa <main> o <article>, se confia en eso. Si no, se limpian los
 * bloques de maqueta y se elige el trozo con mas texto de verdad: los menus
 * tienen muchas etiquetas y poco contenido, el cuerpo es al reves.
 */
export function textoPrincipal(html) {
  const crudo = String(html || '').replace(/<!--[\s\S]*?-->/g, ' ');

  // Primero se ubica la region principal y DESPUES se limpia adentro. Al reves
  // no funciona: al borrar los <header> antes de buscar, un </header> lejano se
  // llevaba por delante todo el contenido de la pagina.
  const region = primeraRegion(crudo, 'main') || primeraRegion(crudo, 'article') || null;
  if (region) {
    const limpio = limpiarLineas(aTextoPlano(sinMaqueta(region)));
    if (limpio.length > 250) return limpio;
  }

  const s = sinMaqueta(crudo);

  // Sin <main> utilizable: se parte en secciones y se elige la de mayor
  // densidad de texto. Los menus tienen muchas etiquetas y poco contenido.
  const trozos = s.split(/<\/(?:section|div)>/i);
  let mejor = '';
  let mejorPuntaje = 0;
  for (const trozo of trozos) {
    if (CLASES_DE_MAQUETA.test((trozo.match(/class="[^"]*"/i) || [''])[0])) continue;
    const texto = aTextoPlano(trozo);
    if (texto.length < 200) continue;
    // Densidad: cuanto del trozo es texto y no etiquetas.
    const densidad = texto.length / Math.max(trozo.length, 1);
    const puntaje = texto.length * (0.3 + densidad);
    if (puntaje > mejorPuntaje) { mejorPuntaje = puntaje; mejor = texto; }
  }

  return limpiarLineas(mejor || aTextoPlano(s));
}

/** Saca los bloques de maqueta de un trozo de HTML. */
function sinMaqueta(html) {
  let s = String(html || '');
  for (const t of BLOQUES_DE_MAQUETA) {
    s = s.replace(new RegExp(`<${t}\\b[^>]*>[\\s\\S]*?</${t}>`, 'gi'), ' ');
  }
  return s;
}

function primeraRegion(html, etiqueta) {
  const abre = new RegExp(`<${etiqueta}\\b[^>]*>`, 'i').exec(html);
  if (!abre) return null;
  const desde = abre.index + abre[0].length;
  const cierra = html.toLowerCase().indexOf(`</${etiqueta}>`, desde);
  return cierra === -1 ? html.slice(desde) : html.slice(desde, cierra);
}

const LINEA_DE_MENU = /^(skip to main content|skip to content|saltar al contenido|more on the iaea|press centre|inicio|home|menu|search|buscar|login|log in|sign in|registrarse|contacto|contact|about|about us|newsletter|cookies?|aceptar|accept|privacy|privacidad|compartir|share|siguiente|anterior|next|previous|leer mas|read more|ver mas)\b/i;

/** Bota las lineas que son restos de navegacion y junta el resto. */
function limpiarLineas(texto) {
  return String(texto || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return false;
      if (LINEA_DE_MENU.test(l)) return false;
      if (/cookies?/i.test(l) && l.length < 200) return false;
      // Una linea de menu son dos o tres palabras sin puntuacion.
      const palabras = l.split(/\s+/).length;
      if (palabras <= 3 && !/[.:;?!]/.test(l)) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── 2. De que trata ──────────────────────────────────────────

const ANUNCIA_CONTENIDO = [
  'aims to', 'aim of', 'objective', 'objectives', 'this course', 'this workshop', 'this webinar',
  'this programme', 'this program', 'this training', 'the course', 'the workshop', 'will cover',
  'will focus', 'will provide', 'will learn', 'participants will', 'topics include', 'topics covered',
  'content', 'curriculum', 'agenda', 'is designed to', 'is intended to', 'provides an overview',
  'el curso', 'este curso', 'el taller', 'este taller', 'el objetivo', 'los objetivos',
  'esta actividad', 'el programa', 'se abordaran', 'se abordan', 'contenidos', 'aprenderas',
  'permitira', 'esta dirigido', 'busca entregar', 'entrega herramientas', 'capacita',
  'o curso', 'este webinar', 'la jornada', 'el diplomado', 'el magister',
];

/**
 * Las frases donde la fuente explica que es esto.
 *
 * Se buscan las oraciones que empiezan a explicar ("this course aims to...",
 * "el objetivo es...") y se devuelven textuales. Si no hay ninguna, se
 * devuelven las primeras oraciones que parezcan prosa: es preferible una frase
 * cruda de la fuente a un resumen que no dice nada.
 */
export function frasesDeContenido(texto, largo = 400) {
  const oraciones = enOraciones(texto);
  if (!oraciones.length) return '';

  const explicativas = oraciones.filter((o) => {
    const n = normalizar(o);
    return ANUNCIA_CONTENIDO.some((p) => n.includes(p));
  });

  // El respaldo solo acepta prosa de verdad. Una pagina de noticias encadena
  // titulares que parecen oraciones largas pero no explican nada: "ICRP Chair
  // Delivers Keynote... In Memoriam: Professor..." no describe ninguna actividad.
  const elegidas = explicativas.length ? explicativas : oraciones.filter(pareceProsa);
  if (!elegidas.length) return '';

  let salida = '';
  for (const o of elegidas) {
    if (salida.length + o.length > largo) break;
    salida += (salida ? ' ' : '') + o;
  }
  return salida || recortar(elegidas[0], largo);
}

/** Prosa de verdad: frase larga, con verbo, y sin pinta de titular encadenado. */
function pareceProsa(o) {
  if (o.length < 70) return false;
  const palabras = o.split(/\s+/);
  if (palabras.length < 12) return false;
  // Una tira de titulares trae muchas mayusculas en medio de la frase.
  const mayusculasInternas = palabras.slice(1).filter((p) => /^[A-Z]/.test(p)).length;
  if (mayusculasInternas > palabras.length * 0.35) return false;
  return /\b(is|are|was|were|will|can|provides|offers|aims|covers|includes|allows|enables|es|son|sera|permite|ofrece|entrega|busca|incluye|cubre|aborda|contempla)\b/i.test(o);
}

// ── 3. Cuanto cuesta y quien paga ────────────────────────────

const HABLA_DE_PLATA = [
  'fee', 'fees', 'cost', 'costs', 'price', 'pricing', 'payment', 'free of charge', 'free',
  'tuition', 'registration', 'scholarship', 'grant', 'funding', 'funded', 'bursary', 'stipend',
  'travel support', 'covers', 'reimburse', 'no charge', 'at no cost',
  'arancel', 'matricula', 'valor', 'precio', 'costo', 'gratuito', 'gratuita', 'gratis',
  'sin costo', 'beca', 'becas', 'financiamiento', 'financiado', 'viatico', 'viaticos',
  'pasaje', 'pasajes', 'estipendio', 'cubre', 'descuento', 'inscripcion',
];

const MONTO = /(?:(?:US\s?\$|USD|EUR|€|£|CLP|\$)\s?\d[\d.,]*(?:\s?(?:mil|millones|k))?)|(?:\d[\d.,]*\s?(?:USD|EUR|euros?|dolares|dólares|pesos|CLP|GBP))/gi;

/**
 * Todo lo que la ficha dice sobre plata: los montos que aparecen y las frases
 * donde se habla de costo o de financiamiento, textuales.
 */
/**
 * Plata que no es la tuya.
 *
 * "Novartis acuerda comprar Avidity a USD 72 por accion" trae monto y la palabra
 * "funding", pero no es el arancel de nada. Lo mismo una auditoria que reporta
 * deudas en millones. Las finanzas corporativas y las cifras de noticias se
 * descartan antes de mirar los montos.
 */
const PLATA_AJENA = [
  'per share', 'shareholder', 'shareholders', 'stock', 'shares', 'acquisition', 'acquire',
  'merger', 'revenue', 'earnings', 'quarterly', 'fiscal year', 'proxy statement', 'bonds',
  'market cap', 'valuation', 'investors', 'dividend', 'ipo', 'net income', 'ebitda',
  'accion', 'acciones', 'accionistas', 'fusion', 'adquisicion', 'facturacion', 'ingresos',
  'utilidades', 'deuda', 'deudas', 'adeudan', 'fisco', 'presupuesto nacional', 'inversion de',
  'millones al fisco', 'balance', 'ventas',
];

export function datosDeDinero(texto) {
  // Minimo mas corto que en el resto: una linea de precio suele ser
  // "Valor del diplomado: $1.850.000", y con el umbral normal se perdia.
  const oraciones = enOraciones(texto, 22);
  const frases = oraciones.filter((o) => {
    const n = normalizar(o);
    if (o.length > 300) return false;
    if (PLATA_AJENA.some((p) => new RegExp(`(^|[^a-z])${p}([^a-z]|$)`).test(n))) return false;
    return HABLA_DE_PLATA.some((p) => new RegExp(`(^|[^a-z])${p}([^a-z]|$)`).test(n));
  });

  // Los montos se leen solo de las frases que ya pasaron el filtro: si se
  // miraran todas las oraciones, cualquier cifra de la pagina entraria como precio.
  const montos = [];
  for (const o of frases) {
    for (const m of o.match(MONTO) || []) {
      const limpio = m.replace(/\s+/g, ' ').trim();
      if (!montos.includes(limpio)) montos.push(limpio);
    }
    if (montos.length >= 4) break;
  }

  // Las frases mas utiles son las que traen un monto o dicen "gratis".
  const ordenadas = frases.sort((a, b) => {
    const peso = (f) => (MONTO.test(f) ? 2 : 0) + (/\b(free|gratis|gratuito|sin costo|no charge|fully funded|beca|scholarship)\b/i.test(f) ? 1 : 0);
    MONTO.lastIndex = 0;
    return peso(b) - peso(a);
  });

  return {
    montos: montos.slice(0, 3),
    frases: ordenadas.slice(0, 2).map((f) => recortar(f, 220)),
  };
}

/**
 * Los montos que viven en tablas y listas, no en frases.
 *
 * Un arancel casi siempre se publica como tabla ("Socios | 150 EUR") o como
 * lista de vinetas. Ninguna de las dos sobrevive a un separador de oraciones,
 * asi que se leen del HTML crudo y aparte.
 */
export function dineroEnHtml(html) {
  const bloques = String(html || '').match(/<(table|ul|ol|dl)\b[\s\S]*?<\/\1>/gi) || [];
  const montos = [];
  const frases = [];

  for (const b of bloques) {
    const texto = aTextoPlano(b).replace(/\s+/g, ' ').trim();
    if (!texto || texto.length > 600) continue;

    const hallados = texto.match(MONTO) || [];
    if (!hallados.length) continue;
    // Una tabla de precios habla de precios; un menu con un numero suelto, no.
    // El s? del final importa: la tabla de ESTRO dice "members", no "member",
    // y con la palabra exacta el filtro la descartaba entera.
    if (!/\b(fee|rate|price|cost|registration|tuition|member|arancel|matricula|valor|precio|costo|inscripcion|socio|participante)s?\b/i.test(texto)) continue;

    // Un balance trimestral tambien tiene tabla, montos y la palabra "cost",
    // y no es el arancel de nada.
    if (PLATA_AJENA.some((p) => new RegExp(`(^|[^a-z])${p}([^a-z]|$)`, 'i').test(texto))) continue;

    for (const m of hallados) {
      const limpio = m.replace(/\s+/g, ' ').trim();
      if (!montos.includes(limpio)) montos.push(limpio);
    }
    if (!frases.includes(texto)) frases.push(recortar(texto, 240));
    if (montos.length >= 6) break;
  }

  return { montos: montos.slice(0, 6), frases: frases.slice(0, 1) };
}

/** Junta lo que se saco de las frases con lo que se saco de las tablas. */
export function fusionarDinero(...partes) {
  const montos = [];
  const frases = [];
  for (const p of partes) {
    for (const m of p?.montos || []) if (!montos.includes(m)) montos.push(m);
    for (const f of p?.frases || []) if (!frases.includes(f)) frases.push(f);
  }
  return { montos: montos.slice(0, 6), frases: frases.slice(0, 2) };
}

// ── Auxiliar ─────────────────────────────────────────────────

/** Parte en oraciones utilizables, sin restos de maqueta. */
function enOraciones(texto, minimo = 40) {
  return String(texto || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/)
    .map((o) => o.trim())
    .filter((o) => {
      if (o.length < minimo || o.length > 420) return false;
      const n = normalizar(o);
      if (/(cookie|privacy policy|politica de privacidad|all rights reserved|todos los derechos)/.test(n)) return false;
      // Una linea de precio no es prosa ("Valor del diplomado: $1.850.000")
      // pero es justo lo que se anda buscando.
      if (new RegExp(MONTO.source, 'i').test(o)) return true;
      // El resto debe parecer una oracion: articulos o verbos comunes.
      return /\b(is|are|will|the|this|these|a|an|of|to|and|for|el|la|los|las|de|del|que|se|un|una|con|por|para|es|son|sera|valor|costo)\b/.test(n);
    });
}
