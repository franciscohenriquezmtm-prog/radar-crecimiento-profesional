// Utilidades compartidas: texto, fechas, log.

import crypto from 'node:crypto';
import { env } from './config.js';

const NIVELES = { error: 0, aviso: 1, info: 2, detalle: 3 };
const nivelActual = NIVELES[env.nivelLog] ?? 2;

export const log = {
  error: (...a) => nivelActual >= 0 && console.error('  ✖', ...a),
  aviso: (...a) => nivelActual >= 1 && console.warn('  !', ...a),
  info: (...a) => nivelActual >= 2 && console.log('   ', ...a),
  detalle: (...a) => nivelActual >= 3 && console.log('    ·', ...a),
  titulo: (t) => console.log(`\n▸ ${t}\n`),
};

export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export function hash(texto) {
  return crypto.createHash('sha1').update(String(texto)).digest('hex').slice(0, 16);
}

/** Quita tildes y baja a minusculas. Para comparar sin sufrir. */
export function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

const ENTIDADES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-',
  rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', hellip: '...', eacute: 'e', aacute: 'a',
  iacute: 'i', oacute: 'o', uacute: 'u', ntilde: 'n', uuml: 'u', deg: '°', euro: '€', pound: '£',
};

export function decodificarHtml(texto) {
  return String(texto || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n.toLowerCase()] ?? m);
}

/** Saca etiquetas, scripts y espacios sobrantes. Devuelve texto plano legible. */
export function aTextoPlano(html) {
  return decodificarHtml(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ 	 ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function recortar(texto, largo = 400) {
  const t = String(texto || '').trim();
  if (t.length <= largo) return t;
  return t.slice(0, largo - 1).replace(/\s+\S*$/, '') + '…';
}

/** Direccion absoluta y sin basura de seguimiento, para poder comparar duplicados. */
export function urlCanonica(url, base) {
  try {
    const u = new URL(url, base);
    u.hash = '';
    for (const p of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_cid|mc_eid|ref|source)/i.test(p)) u.searchParams.delete(p);
    }
    let s = u.toString();
    if (s.endsWith('/') && u.pathname !== '/') s = s.slice(0, -1);
    return s;
  } catch {
    return null;
  }
}

export function hoy() {
  return new Date();
}

export function aIso(fecha) {
  if (!fecha) return null;
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function diasHasta(iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / 86400000);
}

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

/** El dia de la semana de una fecha ISO, calculado al mediodia UTC para que no
 *  se corra un dia por el huso horario. */
export function diaDeLaSemana(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) return '';
  return DIAS_SEMANA[d.getUTCDay()];
}

/** Fin de semana: hay que tener todo listo el viernes. */
export function caeEnFinDeSemana(iso) {
  const dia = diaDeLaSemana(iso);
  return dia === 'sabado' || dia === 'domingo';
}

/**
 * "viernes 10 de octubre de 2026".
 * El dia de la semana va adelante porque cambia como te organizas: un plazo que
 * cae sabado en la practica vence el viernes.
 */
export function fechaBonita(iso, conDia = true) {
  if (!iso) return 'sin fecha';
  const [a, m, d] = iso.split('-').map(Number);
  if (!a || !m || !d) return iso;
  const cuerpo = `${d} de ${MESES_LARGOS[m - 1]} de ${a}`;
  const dia = conDia ? diaDeLaSemana(iso) : '';
  return dia ? `${dia} ${cuerpo}` : cuerpo;
}

/**
 * Texto humano de la fecha. Distingue el cierre de una postulacion de la fecha
 * del evento mismo: decir "cierra en 12 dias" cuando en realidad es la fecha en
 * que parte el curso es la clase de error que hace perder una postulacion.
 */
export function textoPlazo(iso, clase = 'limite') {
  const d = diasHasta(iso);
  if (d === null) return '';
  const evento = clase === 'evento';
  if (d < 0) return evento ? `fue hace ${Math.abs(d)} dias` : `cerro hace ${Math.abs(d)} dia${Math.abs(d) === 1 ? '' : 's'}`;
  if (d === 0) return evento ? 'es HOY' : 'cierra HOY';
  if (d === 1) return evento ? 'es MANANA' : 'cierra MANANA';
  return evento ? `es en ${d} dias` : `cierra en ${d} dias`;
}

const BASURA_DE_PAGINA = [
  'skip to content', 'skip to main content', 'saltar al contenido', 'ir al contenido',
  'menu principal', 'main menu', 'cookie', 'aceptar todas', 'accept all',
  'javascript', 'enable js', 'toggle navigation', 'buscar en el sitio',
];

/**
 * Deja un resumen legible a partir del texto crudo de una pagina.
 * Quita el titulo repetido, los restos de menu y el espaciado de maqueta.
 */
export function limpiarResumen(texto, titulo = '') {
  let t = String(texto || '').replace(/\s+/g, ' ').trim();
  if (titulo) {
    const tn = normalizar(titulo).slice(0, 60);
    while (normalizar(t).startsWith(tn)) {
      t = t.slice(titulo.length).replace(/^[\s|·—–:-]+/, '');
      if (!t) break;
    }
  }
  const partes = t
    .split(/(?<=[.!?])\s+/)
    .filter((p) => {
      const n = normalizar(p);
      if (n.length < 25) return false;
      return !BASURA_DE_PAGINA.some((b) => n.includes(b));
    });
  return (partes.join(' ') || t).trim();
}

/**
 * La descripcion que la propia pagina declara para redes sociales y buscadores.
 * Es una frase escrita por un humano para resumir la pagina: sirve mucho mas
 * que los primeros 300 caracteres del cuerpo, que suelen ser el menu.
 */
export function descripcionDeclarada(html) {
  const patrones = [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{40,})["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{40,})["']/i,
    /<meta[^>]+content=["']([^"']{40,})["'][^>]+name=["']description["']/i,
  ];
  for (const p of patrones) {
    const m = String(html || '').match(p);
    if (m) return decodificarHtml(m[1]).replace(/\s+/g, ' ').trim();
  }
  return '';
}

/**
 * La frase con que la fuente describe lo que ofrece.
 *
 * Se prefiere la descripcion declarada por la pagina; si no hay, se busca en el
 * cuerpo la primera oracion que parezca prosa de verdad: suficientemente larga,
 * con verbo, y sin la sopa de menu que rodea al contenido. Sirve para responder
 * lo unico que importa de un vistazo: de que se trata esto.
 */
export function frasesQueDescriben(texto, maximo = 2) {
  const bruto = String(texto || '').replace(/\s+/g, ' ').trim();
  if (!bruto) return '';

  const candidatas = bruto
    .split(/(?<=[.!?])\s+/)
    .map((f) => f.trim())
    .filter((f) => {
      if (f.length < 45 || f.length > 400) return false;
      const n = normalizar(f);
      // Menus y avisos legales: muchas palabras sueltas, ningun verbo.
      if (/(cookie|skip to|iniciar sesion|log in|sign in|todos los derechos|all rights reserved|politica de privacidad)/.test(n)) return false;
      // Una oracion de verdad trae articulos o verbos comunes.
      if (!/\b(is|are|will|offers|provides|aims|covers|includes|the|this|se|es|son|ofrece|permite|busca|esta|sera|incluye|dirigido|permite)\b/.test(n)) return false;
      // Listas de nombres propios o fechas sueltas: mas mayusculas que frases.
      const mayusculas = (f.match(/[A-Z]/g) || []).length;
      if (mayusculas > f.length * 0.25) return false;
      return true;
    });

  return candidatas.slice(0, maximo).join(' ');
}

export function escaparHtml(texto) {
  return String(texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Parecido entre dos titulos, 0 a 1. Sirve para no duplicar la misma convocatoria. */
export function parecido(a, b) {
  const pa = new Set(normalizar(a).split(/\W+/).filter((p) => p.length > 3));
  const pb = new Set(normalizar(b).split(/\W+/).filter((p) => p.length > 3));
  if (!pa.size || !pb.size) return 0;
  let comunes = 0;
  for (const p of pa) if (pb.has(p)) comunes++;
  return comunes / Math.min(pa.size, pb.size);
}
