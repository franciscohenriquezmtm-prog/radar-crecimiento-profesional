// Lectores: convierten una pagina en una lista de posibles oportunidades.
//
// Ninguno depende de librerias externas. Cada uno devuelve
// [{ titulo, url, resumen, fecha }] y nunca lanza excepcion.

import { pedir } from './http.js';
import { aTextoPlano, decodificarHtml, recortar, urlCanonica, normalizar } from './util.js';
import { SIGLAS } from './siglas.js';

/** Enlaces que aparecen en todos los sitios y nunca son una oportunidad. */
const RUIDO = [
  'login', 'log-in', 'signin', 'sign-in', 'register', 'privacy', 'cookie', 'terms',
  'contact', 'sitemap', 'accessibility', 'facebook.com', 'twitter.com', 'x.com/',
  'linkedin.com', 'instagram.com', 'youtube.com', 'whatsapp', 'mailto:', 'tel:',
  'javascript:', '/rss', '.pdf#', 'wp-content', 'wp-login', 'feed/', 'search?',
  'carrito', 'checkout', 'donate', 'shop', 'store', 'jobs/apply', 'preferences',
];

// Frases exactas de navegacion que ningun sitio usa como titulo de nada.
const MENUS = [
  'skip to main content', 'skip to content', 'saltar al contenido', 'ir al contenido principal',
  'volver al inicio', 'back to top', 'toggle navigation', 'abrir menu', 'cerrar menu',
  'aceptar cookies', 'politica de cookies', 'accessibility statement',
  'inicio', 'home', 'menu', 'buscar', 'search', 'siguiente', 'anterior', 'next', 'previous',
  'ver mas', 'leer mas', 'read more', 'more', 'ver todo', 'todos', 'volver', 'back',
  'contacto', 'nosotros', 'about', 'about us', 'quienes somos', 'suscribirse', 'subscribe',
  'iniciar sesion', 'cerrar sesion', 'ingresar', 'registrarse', 'espanol', 'english',
];

function esRuido(url, texto) {
  const u = url.toLowerCase();
  if (RUIDO.some((r) => u.includes(r))) return true;
  const t = normalizar(texto).trim();
  if (t.length < 18) return true;
  if (MENUS.includes(t)) return true;
  if (/^\d+$/.test(t)) return true;
  return false;
}

// ── RSS / Atom ───────────────────────────────────────────────

function etiqueta(bloque, nombre) {
  const m = bloque.match(new RegExp(`<${nombre}[^>]*>([\\s\\S]*?)</${nombre}>`, 'i'));
  if (!m) return '';
  return decodificarHtml(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim();
}

export async function leerFeed(url) {
  const r = await pedir(url, { aceptar: 'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*' });
  if (!r.ok) return { items: [], error: r.error };
  const xml = r.cuerpo;
  if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(xml)) return { items: [], error: 'no parece un feed' };

  const bloques = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
  const items = [];
  for (const b of bloques) {
    const titulo = aTextoPlano(etiqueta(b, 'title'));
    let enlace = etiqueta(b, 'link');
    if (!enlace) {
      const m = b.match(/<link[^>]*href=["']([^"']+)["']/i);
      if (m) enlace = m[1];
    }
    const abs = urlCanonica(enlace, url);
    if (!titulo || !abs) continue;
    const resumen = recortar(aTextoPlano(etiqueta(b, 'description') || etiqueta(b, 'summary') || etiqueta(b, 'content:encoded') || etiqueta(b, 'content')), 600);
    const fecha = etiqueta(b, 'pubDate') || etiqueta(b, 'published') || etiqueta(b, 'updated') || etiqueta(b, 'dc:date');
    items.push({ titulo, url: abs, resumen, fecha });
  }
  return { items, error: items.length ? null : 'feed sin entradas' };
}

// ── HTML: datos estructurados + enlaces ──────────────────────

function leerJsonLd(html, base) {
  const items = [];
  const bloques = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const b of bloques) {
    const crudo = b.replace(/^[\s\S]*?>/, '').replace(/<\/script>$/i, '').trim();
    let datos;
    try { datos = JSON.parse(crudo); } catch { continue; }
    const lista = Array.isArray(datos) ? datos : datos['@graph'] ? datos['@graph'] : [datos];
    for (const d of lista) {
      if (!d || typeof d !== 'object') continue;
      const tipo = String(d['@type'] || '');
      if (!/Event|Course|EducationalOccupationalProgram|ScholarlyArticle|NewsArticle/i.test(tipo)) continue;
      const titulo = aTextoPlano(d.name || d.headline || '');
      const abs = urlCanonica(d.url || d['@id'] || '', base);
      if (!titulo || !abs) continue;
      items.push({
        titulo,
        url: abs,
        resumen: recortar(aTextoPlano(d.description || ''), 600),
        fecha: d.startDate || d.datePublished || d.applicationDeadline || '',
        lugar: typeof d.location === 'object' ? aTextoPlano(d.location?.name || d.location?.address?.addressLocality || '') : aTextoPlano(d.location || ''),
      });
    }
  }
  return items;
}

export async function leerHtml(url, opciones = {}) {
  const r = await pedir(url, { tlsRelajado: opciones.tlsRelajado });
  if (!r.ok) return { items: [], error: r.error };
  const html = r.cuerpo;
  const base = r.url || url;

  const estructurados = leerJsonLd(html, base);

  const patronEnlace = opciones.patronEnlace ? new RegExp(opciones.patronEnlace, 'i') : null;
  const patronTexto = opciones.patronTexto ? new RegExp(opciones.patronTexto, 'i') : null;
  const vistos = new Set(estructurados.map((i) => i.url));
  const items = [...estructurados];

  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const abs = urlCanonica(m[1], base);
    if (!abs) continue;
    const titulo = aTextoPlano(m[2]);
    if (esRuido(abs, titulo)) continue;
    if (patronEnlace && !patronEnlace.test(abs)) continue;
    if (patronTexto && !patronTexto.test(titulo)) continue;
    if (vistos.has(abs)) continue;
    // Solo el mismo sitio, salvo que el patron diga otra cosa.
    try {
      if (!patronEnlace && new URL(abs).host !== new URL(base).host) continue;
    } catch { continue; }
    vistos.add(abs);
    items.push({ titulo, url: abs, resumen: '', fecha: '' });
    if (items.length >= (opciones.maxItems || 80)) break;
  }

  return { items, error: items.length ? null : 'la pagina cargo pero no hubo enlaces utiles' };
}

// ── Sitemap ──────────────────────────────────────────────────

/**
 * Titulo legible a partir de la direccion.
 *
 * Un sitemap no trae titulos, solo direcciones, asi que el nombre sale del
 * ultimo trozo de la ruta. Las siglas se devuelven a mayusculas con el glosario:
 * sin eso quedaba "Advanced imrt for radiation therapists" en vez de IMRT.
 */
function tituloDesdeSlug(slug) {
  return slug
    .split(' ')
    .map((palabra, i) => {
      const mayus = palabra.toUpperCase();
      if (SIGLAS[mayus]) return mayus;
      return i === 0 ? palabra.charAt(0).toUpperCase() + palabra.slice(1) : palabra;
    })
    .join(' ');
}

export async function leerSitemap(url, opciones = {}) {
  const r = await pedir(url, { aceptar: 'application/xml,text/xml,*/*' });
  if (!r.ok) return { items: [], error: r.error };
  const patron = opciones.patronEnlace ? new RegExp(opciones.patronEnlace, 'i') : null;
  const bloques = r.cuerpo.match(/<url>[\s\S]*?<\/url>/gi) || [];
  const items = [];
  for (const b of bloques) {
    const loc = etiqueta(b, 'loc');
    const abs = urlCanonica(loc, url);
    if (!abs) continue;
    if (patron && !patron.test(abs)) continue;
    const lastmod = etiqueta(b, 'lastmod');
    const slug = decodeURIComponent(abs.split('/').filter(Boolean).pop() || '')
      .replace(/[-_]+/g, ' ')
      .replace(/\.\w+$/, '')
      .trim();
    if (slug.length < 12) continue;
    items.push({ titulo: tituloDesdeSlug(slug), url: abs, resumen: '', fecha: lastmod });
  }
  items.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  return { items: items.slice(0, opciones.maxItems || 60), error: items.length ? null : 'sitemap sin direcciones que calcen' };
}

// ── Calendario .ics ──────────────────────────────────────────

export async function leerIcal(url) {
  const r = await pedir(url, { aceptar: 'text/calendar,*/*' });
  if (!r.ok) return { items: [], error: r.error };
  const eventos = r.cuerpo.split(/BEGIN:VEVENT/i).slice(1);
  const items = [];
  for (const e of eventos) {
    const campo = (n) => {
      const m = e.match(new RegExp(`^${n}[^:]*:(.*)$`, 'im'));
      return m ? m[1].trim().replace(/\\,/g, ',').replace(/\\n/g, ' ') : '';
    };
    const titulo = campo('SUMMARY');
    if (!titulo) continue;
    const cruda = campo('DTSTART');
    const fecha = cruda.length >= 8 ? `${cruda.slice(0, 4)}-${cruda.slice(4, 6)}-${cruda.slice(6, 8)}` : '';
    items.push({ titulo, url: urlCanonica(campo('URL'), url) || url, resumen: recortar(campo('DESCRIPTION'), 600), fecha, lugar: campo('LOCATION') });
  }
  return { items, error: items.length ? null : 'calendario sin eventos' };
}

/** Ejecuta una estrategia cualquiera. */
export async function ejecutarEstrategia(estrategia) {
  switch (estrategia.tipo) {
    case 'feed': return leerFeed(estrategia.url);
    case 'html': return leerHtml(estrategia.url, estrategia);
    case 'sitemap': return leerSitemap(estrategia.url, estrategia);
    case 'ical': return leerIcal(estrategia.url);
    default: return { items: [], error: `estrategia desconocida: ${estrategia.tipo}` };
  }
}
