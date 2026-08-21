// Genera un panel de bolsillo: un solo archivo HTML con los datos adentro.
//
// Sirve para dos cosas:
//   - publicarlo en internet (GitHub Pages) y abrirlo desde el celular en
//     cualquier parte, con el computador apagado;
//   - mandartelo o guardarlo, porque funciona sin conexion una vez cargado.
//
//   node src/cli.js exportar [archivo.html]
//
// No lleva scripts externos, ni tipografias locales, ni llamadas a ningun
// servidor: todo lo que necesita viaja adentro.

import fs from 'node:fs';
import path from 'node:path';
import { DIR_DATOS } from './config.js';
import * as db from './db.js';
import { ETIQUETAS_AREA, etiquetaTipo } from './clasificar.js';
import { diasHasta, escaparHtml, fechaBonita } from './util.js';
import { iconoDataUri } from './icono.js';

const MAX_FICHAS = 600;

/**
 * Deja el texto en caracteres validos.
 *
 * Algunos sitios declaran UTF-8 pero mandan Windows-1252, y las comillas
 * curvas llegan rotas. Ademas, cortar un texto por la mitad puede partir un
 * emoji en dos. Ninguna de las dos cosas puede viajar a una pagina publicada.
 */
function limpiarTexto(t) {
  const REEMPLAZO = 0xfffd;
  const s = String(t ?? String());
  let salida = String();
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);

    // Caracter roto: si quedo entre dos letras, casi siempre era un apostrofo.
    if (c === REEMPLAZO) {
      const antes = salida.slice(-1);
      const despues = s[i + 1] || String();
      if (/[A-Za-z]/.test(antes) && /[A-Za-z]/.test(despues)) salida += String.fromCharCode(39);
      continue;
    }

    // Par sustituto completo (un emoji): pasa entero. Mitad suelta: se descarta.
    if (c >= 0xd800 && c <= 0xdbff) {
      const sigue = s.charCodeAt(i + 1);
      if (sigue >= 0xdc00 && sigue <= 0xdfff) { salida += s[i] + s[i + 1]; i++; }
      continue;
    }
    if (c >= 0xdc00 && c <= 0xdfff) continue;

    // Controles invisibles que se cuelan al raspar HTML (se conservan tab y salto).
    if (c === 0x7f || (c < 0x20 && c !== 0x09 && c !== 0x0a)) continue;

    salida += s[i];
  }
  return salida.trim();
}

function aJson(fila) {
  const parsear = (t, pd) => { try { return JSON.parse(t); } catch { return pd; } };
  const eleg = parsear(fila.elegibilidad, {});
  return {
    id: fila.id,
    t: limpiarTexto(fila.titulo),
    u: fila.url,
    r: limpiarTexto(fila.resumen_es || ''),
    d: limpiarTexto(fila.descripcion || ''),
    c: limpiarTexto(fila.contenido || ''),
    // Los datos de plata tambien pasan por el limpiador: una frase en portugues
    // mal codificada bastaba para que la pagina entera fuera rechazada al publicar.
    pl: (() => {
      try {
        const d = JSON.parse(fila.dinero || '{}');
        return {
          montos: (d.montos || []).map(limpiarTexto).filter(Boolean),
          frases: (d.frases || []).map(limpiarTexto).filter(Boolean),
        };
      } catch {
        return { montos: [], frases: [] };
      }
    })(),
    o: limpiarTexto(fila.fuente_nombre || ''),
    tipo: etiquetaTipo(fila.tipo),
    areas: parsear(fila.areas, []),
    publico: parsear(fila.publico, []),
    f: fila.fecha_limite,
    fc: fila.clase_fecha,
    fe: fila.fecha_estimada ? 1 : 0,
    hist: fila.historico ? 1 : 0,
    pista: fila.pista ? 1 : 0,
    an: fila.anuncio ? 1 : 0,
    sem: fila.semaforo,
    com: limpiarTexto(eleg.comentario || ''),
    p: fila.puntaje,
    plata: fila.financiamiento ? 1 : 0,
    costo: fila.costo,
    modo: fila.modalidad,
    lugar: limpiarTexto(fila.lugar || ''),
  };
}

export function exportar(destino, { fragmento = false } = {}) {
  const abiertas = db.listar({ limite: 4000, soloAbiertas: true, orden: 'puntaje' });
  // Las ediciones pasadas viajan tambien, pero aparte y en menor cantidad: sirven
  // para reconocer que se repite todos los anos y anticipar la proxima vuelta.
  const historicas = db.listar({ limite: 120, soloAbiertas: false, historico: true, orden: 'reciente' });
  // Pistas de prensa: titulares sin ficha propia. Van pocas y aparte, porque
  // a veces son el primer aviso de algo que despues se publica formalmente.
  const pistas = db.listar({ limite: 150, soloAbiertas: true, pista: true, orden: 'puntaje' })
    .sort((a, b) => (b.anuncio || 0) - (a.anuncio || 0));
  const fichas = [...abiertas.slice(0, MAX_FICHAS), ...historicas, ...pistas].map(aJson);
  const generado = new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });

  const cuenta = {
    total: fichas.filter((f) => !f.hist && !f.pista).length,
    historicas: fichas.filter((f) => f.hist && !f.pista).length,
    pistas: fichas.filter((f) => f.pista).length,
    anuncios: fichas.filter((f) => f.pista && f.an).length,
    tecnicas: fichas.filter((f) => f.areas.includes('tecnicasEspeciales')).length,
    plata: fichas.filter((f) => f.plata).length,
    gratis: fichas.filter((f) => f.costo === 'gratis' || (['online', 'hibrido'].includes(f.modo) && f.costo !== 'pago')).length,
    mias: fichas.filter((f) => f.publico.some((p) => p.startsWith('tecnologos'))).length,
    pronto: fichas.filter((f) => !f.hist && !f.pista && diasHasta(f.f) !== null && diasHasta(f.f) >= 0 && diasHasta(f.f) <= 45).length,
  };

  const html = paginaHtml({ fichas, cuenta, generado, fragmento });
  const archivo = destino || path.join(DIR_DATOS, 'panel-movil.html');
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  fs.writeFileSync(archivo, html, 'utf8');
  return { archivo, fichas: fichas.length, pesoKb: Math.round(Buffer.byteLength(html) / 1024) };
}

function paginaHtml({ fichas, cuenta, generado, fragmento }) {
  // Las paginas publicadas en la nube de Claude reciben su propio envoltorio
  // (doctype, head, body), asi que ahi se entrega solo el contenido.
  const cuerpo = contenidoHtml({ fichas, cuenta, generado });
  if (fragmento) {
    return `<title>Radar de Crecimiento</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans+Condensed:wght@600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap">
<style>
${estilos()}
</style>
${cuerpo}`;
  }
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0d5b73">
<title>Radar de Crecimiento</title>

${cabecerasDeApp()}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans+Condensed:wght@600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap">
<style>
${estilos()}
</style>
</head>
<body>
${cuerpo}
</body>
</html>
`;
}

/** El contenido propiamente tal, igual en las dos variantes. */
function contenidoHtml({ fichas, cuenta, generado }) {
  return `<header class="barra">
  <div class="marca">
    <h1>Radar de crecimiento</h1>
    <p class="fecha">Lista al ${escaparHtml(generado)}</p>
  </div>
  <div class="conteo"><span class="cifra" id="visibles">${cuenta.total}</span><span class="rotulo">a la vista</span></div>
</header>

<nav class="filtros" aria-label="Filtros rapidos">
  <button class="chip activo" data-filtro="todo">Todo <b>${cuenta.total}</b></button>
  <button class="chip" data-filtro="pronto">Cierra pronto <b>${cuenta.pronto}</b></button>
  <button class="chip" data-filtro="tecnicas">Tecnicas especiales <b>${cuenta.tecnicas}</b></button>
  <button class="chip" data-filtro="mias">Para tecnologos <b>${cuenta.mias}</b></button>
  <button class="chip" data-filtro="plata">Con financiamiento <b>${cuenta.plata}</b></button>
  <button class="chip" data-filtro="gratis">Gratis y online <b>${cuenta.gratis}</b></button>
  <button class="chip" data-filtro="guardadas">Mis guardadas <b id="n-guardadas">0</b></button>
  <button class="chip" data-filtro="historico">Ediciones pasadas <b>${cuenta.historicas}</b></button>
  <button class="chip" data-filtro="pistas">Noticias <b>${cuenta.pistas}</b></button>
  <button class="chip" data-filtro="anuncios">Noticias que anuncian algo <b>${cuenta.anuncios}</b></button>
</nav>

<div class="buscador">
  <input type="search" id="buscar" placeholder="Buscar: braquiterapia, beca, OIEA..." autocomplete="off" spellcheck="false">
</div>

<main id="lista"></main>

<p class="vacio" id="vacio" hidden>Nada calza con eso. Prueba con otra palabra o toca Todo.</p>

<footer>
  <p><strong>Esta lista es una foto del ${escaparHtml(generado)}.</strong> Las fechas marcadas como estimadas
  vienen del calendario de ciclos historicos y hay que confirmarlas en la fuente.</p>
  <p>El semaforo de elegibilidad es una opinion del radar, no una decision: nada se descarta solo.
  Lo que marcas aca queda guardado en este telefono, no viaja al panel del computador.</p>
</footer>

<script>
const FICHAS = ${JSON.stringify(fichas)};
${guion()}
</script>`;
}

/**
 * Lo que convierte la pagina en una app instalable.
 *
 * En iPhone: Compartir > Anadir a pantalla de inicio. Con estas etiquetas se
 * abre a pantalla completa, sin barra de Safari, con icono y nombre propios.
 * En Android hace lo mismo el manifiesto, que va incrustado como data: para no
 * necesitar un archivo aparte.
 */
function cabecerasDeApp() {
  const icono = iconoDataUri(180);
  const iconoGrande = iconoDataUri(512);

  const manifiesto = {
    name: 'Radar de Crecimiento Profesional',
    short_name: 'Radar',
    description: 'Becas, cursos y congresos para tecnologia medica',
    start_url: './',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0d1419',
    theme_color: '#0d5b73',
    lang: 'es-CL',
    icons: [
      { src: icono, sizes: '180x180', type: 'image/png' },
      { src: iconoGrande, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
  const manifiestoUri = 'data:application/manifest+json;base64,' + Buffer.from(JSON.stringify(manifiesto), 'utf8').toString('base64');

  return [
    `<link rel="apple-touch-icon" href="${icono}">`,
    `<link rel="icon" type="image/png" href="${icono}">`,
    `<link rel="manifest" href="${manifiestoUri}">`,
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
    '<meta name="apple-mobile-web-app-title" content="Radar">',
    '<meta name="application-name" content="Radar">',
  ].join('\n');
}

function estilos() {
  return `
/* Paleta: consola de visualizacion. Neutros con sesgo frio y un teal clinico.
   La escala de urgencia sigue la logica de un mapa de dosis: frio = lejos,
   caliente = encima. */
:root {
  --piso: #f2f5f7;
  --papel: #ffffff;
  --tinta: #111a21;
  --tenue: #5b6b78;
  --linea: #dde4ea;
  --acento: #0d5b73;
  --frio: #3b72c9;
  --medio: #1e8e63;
  --tibio: #b57e00;
  --caliente: #c4442a;
  --verde: #1a7a52;
  --ambar: #96660a;
  --rojo: #b04030;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --piso: #0d1419;
    --papel: #151d23;
    --tinta: #e6ecf1;
    --tenue: #93a4b1;
    --linea: #23303a;
    --acento: #64b6cc;
    --frio: #7aa5e8;
    --medio: #4bbb8c;
    --tibio: #d9a73c;
    --caliente: #e8735a;
    --verde: #6fce9f;
    --ambar: #dcb05a;
    --rojo: #ef8f7c;
  }
}
:root[data-theme="dark"] {
  --piso: #0d1419;
  --papel: #151d23;
  --tinta: #e6ecf1;
  --tenue: #93a4b1;
  --linea: #23303a;
  --acento: #64b6cc;
  --frio: #7aa5e8;
  --medio: #4bbb8c;
  --tibio: #d9a73c;
  --caliente: #e8735a;
  --verde: #6fce9f;
  --ambar: #dcb05a;
  --rojo: #ef8f7c;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--piso);
  color: var(--tinta);
  font: 400 16px/1.55 "IBM Plex Sans", -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-text-size-adjust: 100%;
}

.barra {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px 12px;
  /* Instalada como app no hay barra de Safari: la cabecera tiene que
     respetar la muesca del telefono por su cuenta. */
  padding-top: max(14px, calc(env(safe-area-inset-top) + 6px));
  background: var(--acento);
  color: #fff;
}
.barra h1 {
  margin: 0;
  font: 700 19px/1.15 "IBM Plex Sans Condensed", "IBM Plex Sans", sans-serif;
  letter-spacing: .01em;
}
.fecha { margin: 2px 0 0; font-size: 12px; opacity: .78; }
.conteo { text-align: right; line-height: 1; }
.cifra {
  display: block;
  font: 600 22px/1 "IBM Plex Mono", ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
}
.rotulo { font-size: 10px; text-transform: uppercase; letter-spacing: .09em; opacity: .78; }

.filtros {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 12px 16px;
  background: var(--papel);
  border-bottom: 1px solid var(--linea);
  scrollbar-width: none;
}
.filtros::-webkit-scrollbar { display: none; }
.chip {
  flex: 0 0 auto;
  border: 1px solid var(--linea);
  background: transparent;
  color: var(--tenue);
  border-radius: 3px;
  padding: 8px 12px;
  font: 500 13px/1 "IBM Plex Sans", sans-serif;
  cursor: pointer;
  white-space: nowrap;
}
.chip b {
  font: 600 12px/1 "IBM Plex Mono", monospace;
  font-variant-numeric: tabular-nums;
  opacity: .65;
  margin-left: 4px;
}
.chip.activo {
  background: var(--acento);
  border-color: var(--acento);
  color: #fff;
}
.chip.activo b { opacity: .85; }
.chip:focus-visible, input:focus-visible, .marca-btn:focus-visible { outline: 2px solid var(--acento); outline-offset: 2px; }

.buscador { padding: 12px 16px 0; }
#buscar {
  width: 100%;
  border: 1px solid var(--linea);
  background: var(--papel);
  color: var(--tinta);
  border-radius: 3px;
  padding: 11px 12px;
  font: 400 15px/1.2 "IBM Plex Sans", sans-serif;
}

main { padding: 8px 0 0; }

/* Worklist: filas con hairline, no tarjetas flotantes. El contador de dias
   va en la columna izquierda, como en una lista de trabajo. */
.fila {
  display: grid;
  grid-template-columns: 54px 1fr;
  gap: 12px;
  padding: 16px;
  background: var(--papel);
  border-bottom: 1px solid var(--linea);
}
.fila[data-estado="descartado"] { opacity: .42; }

.plazo { text-align: center; padding-top: 2px; }
.dias {
  display: block;
  font: 600 20px/1 "IBM Plex Mono", monospace;
  font-variant-numeric: tabular-nums;
  color: var(--frio);
}
.dias.medio { color: var(--medio); }
.dias.tibio { color: var(--tibio); }
.dias.caliente { color: var(--caliente); }
.unidad { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: .09em; color: var(--tenue); margin-top: 3px; }

.titulo { margin: 0 0 5px; font: 600 16px/1.3 "IBM Plex Sans", sans-serif; text-wrap: balance; }
.titulo a { color: var(--tinta); text-decoration: none; border-bottom: 1px solid var(--acento); }
.resumen { margin: 0 0 8px; font-size: 14px; line-height: 1.5; color: var(--tinta); }
.resumen .quien { font-weight: 600; }

/* Las palabras textuales de la fuente. Van despues del resumen en espanol y se
   distinguen de el a proposito: esto no lo escribio el radar. */
.textual {
  margin: 0 0 8px;
  padding-left: 10px;
  border-left: 2px solid var(--linea);
  font-size: 13px;
  line-height: 1.5;
  color: var(--tenue);
}
.plata-bloque {
  margin: 0 0 8px;
  padding: 8px 10px;
  background: color-mix(in srgb, var(--medio) 8%, transparent);
  border-radius: 3px;
  font-size: 13px;
  line-height: 1.5;
}
.monto {
  display: inline-block;
  font: 600 14px/1 "IBM Plex Mono", monospace;
  color: var(--medio);
  margin-right: 8px;
}
.cita-plata { color: var(--tenue); }
.cita-plata.sin-dato { font-style: italic; }
/* Sin monto publicado, el bloque no se pinta de verde: no hay buena noticia. */
.plata-bloque.vacia { background: transparent; border: 1px dashed var(--linea); }

.rotulo-textual {
  display: block;
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: .09em;
  margin-bottom: 3px;
  color: var(--acento);
}

.meta { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }
.tag {
  font: 400 11px/1.4 "IBM Plex Sans", sans-serif;
  color: var(--tenue);
  border: 1px solid var(--linea);
  border-radius: 2px;
  padding: 2px 6px;
}
.tag.plata { color: var(--verde); border-color: currentColor; }
.tag.mia { color: var(--acento); border-color: currentColor; font-weight: 600; }
.tag.estimada { color: var(--tibio); border-color: currentColor; font-style: italic; }
.tag.pasada { color: var(--frio); border-color: currentColor; }
/* La noticia que anuncia algo si tiene una puerta abierta detras. */
.tag.anuncia { color: var(--tibio); border-color: currentColor; font-weight: 600; }
/* Un plazo en fin de semana se destaca: en la practica vence el viernes. */
.tag.finde { color: var(--tibio); border-color: currentColor; font-weight: 600; }
.fila[data-hist="1"] .titulo a { border-bottom-color: var(--frio); }

.semaforo { font-size: 12.5px; line-height: 1.45; color: var(--tenue); margin: 0 0 10px; }
.semaforo b { color: var(--verde); }
.semaforo.amarillo b { color: var(--ambar); }
.semaforo.rojo b { color: var(--rojo); }

.acciones { display: flex; gap: 6px; flex-wrap: wrap; }
.marca-btn {
  border: 1px solid var(--linea);
  background: transparent;
  color: var(--tenue);
  border-radius: 3px;
  padding: 8px 11px;
  font: 500 12.5px/1 "IBM Plex Sans", sans-serif;
  cursor: pointer;
}
.marca-btn[aria-pressed="true"] { background: var(--acento); border-color: var(--acento); color: #fff; }

.vacio { text-align: center; color: var(--tenue); padding: 40px 24px; font-size: 15px; }

footer {
  padding: 24px 16px calc(32px + env(safe-area-inset-bottom));
  color: var(--tenue);
  font-size: 12px;
  line-height: 1.6;
}
footer p { margin: 0 0 8px; max-width: 62ch; }

@media (min-width: 720px) {
  .barra, .filtros, .buscador, main, footer { max-width: 720px; margin-inline: auto; }
  .barra { border-radius: 0; }
  .fila { border-radius: 0; }
}

@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
`;
}

function guion() {
  return `
const lista = document.getElementById('lista');
const vacio = document.getElementById('vacio');
const visibles = document.getElementById('visibles');
const nGuardadas = document.getElementById('n-guardadas');

// Las marcas viven en este telefono. No viajan al panel del computador.
const LLAVE = 'radar-crecimiento-marcas';
let marcas = {};
try { marcas = JSON.parse(localStorage.getItem(LLAVE) || '{}'); } catch { marcas = {}; }
const guardarMarcas = () => { try { localStorage.setItem(LLAVE, JSON.stringify(marcas)); } catch {} };

let filtro = 'todo';
let busqueda = '';

const dias = (iso) => iso ? Math.round((new Date(iso + 'T12:00:00Z') - Date.now()) / 86400000) : null;

const escapar = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const ETIQUETA_SEM = { verde: 'Te calza', amarillo: 'Con condiciones', rojo: 'Poco probable' };

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];

// El dia de la semana adelante: sirve para saber de una si el plazo cae en fin
// de semana, que en la practica lo adelanta al viernes.
function fechaLarga(iso) {
  if (!iso) return 'sin fecha';
  const [a, m, d] = iso.split('-').map(Number);
  const dia = DIAS[new Date(iso + 'T12:00:00Z').getUTCDay()];
  return dia + ' ' + d + ' de ' + MESES[m - 1];
}

const esFinDeSemana = (iso) => {
  if (!iso) return false;
  const n = new Date(iso + 'T12:00:00Z').getUTCDay();
  return n === 0 || n === 6;
};

function temperatura(d) {
  if (d === null) return '';
  if (d <= 14) return 'caliente';
  if (d <= 45) return 'tibio';
  if (d <= 90) return 'medio';
  return '';
}

function pasa(f) {
  // Las ediciones pasadas solo aparecen cuando se piden: no compiten con lo abierto.
  if (filtro === 'historico') { if (!f.hist) return false; }
  else if (filtro === 'pistas') { if (!f.pista) return false; }
  else if (filtro === 'anuncios') { if (!f.pista || !f.an) return false; }
  else if (f.hist || f.pista) return false;

  if (filtro === 'tecnicas' && !f.areas.includes('tecnicasEspeciales')) return false;
  if (filtro === 'plata' && !f.plata) return false;
  if (filtro === 'gratis' && !(f.costo === 'gratis' || (['online','hibrido'].includes(f.modo) && f.costo !== 'pago'))) return false;
  if (filtro === 'mias' && !f.publico.some((p) => p.startsWith('tecnologos'))) return false;
  if (filtro === 'pronto') { const d = dias(f.f); if (d === null || d < 0 || d > 45) return false; }
  if (filtro === 'guardadas' && marcas[f.id] !== 'guardado') return false;
  if (marcas[f.id] === 'descartado' && filtro !== 'guardadas') return false;

  if (busqueda) {
    const heno = (f.t + ' ' + f.r + ' ' + f.d + ' ' + f.c + ' ' + f.o + ' ' + f.publico.join(' ')).toLowerCase();
    if (!busqueda.split(/\\s+/).every((p) => heno.includes(p))) return false;
  }
  return true;
}

/** Lo que la ficha publica sobre plata, textual. Si no publica nada, se dice. */
function bloquePlata(f) {
  const p = f.pl || {};
  const montos = (p.montos || []).length
    ? '<span class="monto">' + (p.montos || []).map(escapar).join(' · ') + '</span>'
    : '';
  const frase = (p.frases || [])[0] ? '<span class="cita-plata">' + escapar(p.frases[0]) + '</span>' : '';
  // Siempre se dice algo: que no haya dato tambien es informacion.
  const cuerpo = (montos || frase)
    ? montos + frase
    : '<span class="cita-plata sin-dato">' + "La pagina no publica el valor. Suele aparecer al entrar al formulario de inscripcion." + '</span>';
  return '<p class="plata-bloque' + (montos ? '' : ' vacia') + '"><span class="rotulo-textual">Costo y financiamiento</span>' + cuerpo + '</p>';
}

function fila(f) {
  const d = dias(f.f);
  const marca = marcas[f.id] || '';
  const esMia = f.publico.some((p) => p.startsWith('tecnologos'));

  const tags = [];
  tags.push('<span class="tag">' + escapar(f.tipo) + '</span>');
  if (esMia) tags.push('<span class="tag mia">para tecnologos medicos</span>');
  if (f.plata) tags.push('<span class="tag plata">con financiamiento</span>');
  if (f.costo === 'gratis') tags.push('<span class="tag plata">sin costo</span>');
  if (f.modo && f.modo !== 'desconocida') tags.push('<span class="tag">' + escapar(f.modo) + '</span>');
  if (f.lugar) tags.push('<span class="tag">' + escapar(f.lugar) + '</span>');
  if (f.fe) tags.push('<span class="tag estimada">fecha estimada</span>');
  if (f.hist) tags.push('<span class="tag pasada">edicion pasada</span>');
  if (f.pista && f.an) tags.push('<span class="tag anuncia">noticia: anuncia algo</span>');
  else if (f.pista) tags.push('<span class="tag pasada">noticia del gremio</span>');

  const plazo = d === null
    ? '<span class="dias">' + (f.hist ? '\u00b7' : '--') + '</span><span class="unidad">' + (f.hist ? 'ya ocurrio' : 'sin fecha') + '</span>'
    : '<span class="dias ' + temperatura(d) + '">' + d + '</span><span class="unidad">' +
      (f.fc === 'evento' ? 'dias para el evento' : 'dias de plazo') + '</span>';

  return '<article class="fila" data-id="' + escapar(f.id) + '" data-estado="' + escapar(marca) + '" data-hist="' + (f.hist || 0) + '">' +
    '<div class="plazo">' + plazo + '</div>' +
    '<div class="cuerpo">' +
      '<h2 class="titulo"><a href="' + escapar(f.u) + '" target="_blank" rel="noopener">' + escapar(f.t) + '</a></h2>' +
      (f.r ? '<p class="resumen">' + escapar(f.r) + '</p>' : '') +
      (f.c || f.d ? '<p class="textual"><span class="rotulo-textual">Lo que dice la fuente</span>' + escapar(f.c || f.d) + '</p>' : '') +
      bloquePlata(f) +
      '<div class="meta">' + tags.join('') + '</div>' +
      '<p class="semaforo ' + escapar(f.sem) + '"><b>¿Puedo yo? ' + (ETIQUETA_SEM[f.sem] || 'Por revisar') + '.</b> ' + escapar(f.com) + '</p>' +
      '<div class="acciones">' +
        '<button class="marca-btn" data-marca="guardado" aria-pressed="' + (marca === 'guardado') + '">Guardar</button>' +
        '<button class="marca-btn" data-marca="descartado" aria-pressed="' + (marca === 'descartado') + '">No me sirve</button>' +
        (f.f ? '<span class="tag' + (esFinDeSemana(f.f) ? ' finde' : '') + '">' + fechaLarga(f.f) + '</span>' : '') +
      '</div>' +
    '</div>' +
  '</article>';
}

function pintar() {
  const elegidas = FICHAS.filter(pasa);
  lista.innerHTML = elegidas.map(fila).join('');
  visibles.textContent = elegidas.length;
  vacio.hidden = elegidas.length > 0;
  nGuardadas.textContent = Object.values(marcas).filter((m) => m === 'guardado').length;
}

document.querySelectorAll('.chip').forEach((c) => {
  c.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach((x) => x.classList.remove('activo'));
    c.classList.add('activo');
    filtro = c.dataset.filtro;
    window.scrollTo({ top: 0 });
    pintar();
  });
});

let reloj;
document.getElementById('buscar').addEventListener('input', (e) => {
  clearTimeout(reloj);
  reloj = setTimeout(() => { busqueda = e.target.value.trim().toLowerCase(); pintar(); }, 220);
});

lista.addEventListener('click', (e) => {
  const b = e.target.closest('.marca-btn');
  if (!b) return;
  const id = b.closest('.fila').dataset.id;
  const quiere = b.dataset.marca;
  marcas[id] = marcas[id] === quiere ? '' : quiere;
  if (!marcas[id]) delete marcas[id];
  guardarMarcas();
  pintar();
});

pintar();
`;
}
