// Panel del radar. Sin frameworks: es una sola pagina que pide JSON y pinta.

const $ = (s) => document.querySelector(s);
const contenido = $('#contenido');

let estado = { vista: 'lista', catalogos: null, atajo: 'todo', porUrgencia: false };

// ── Tema: sistema, claro u oscuro ────────────────────────────
// Sin marca en el documento manda el sistema; con data-theme manda la eleccion,
// en los dos sentidos. Queda guardada en este aparato y no viaja a ninguna parte.
const TEMAS = ['sistema', 'claro', 'oscuro'];
const NOMBRE_TEMA = { sistema: 'Tema: sistema', claro: 'Tema: claro', oscuro: 'Tema: oscuro' };

function leerTema() {
  try { return localStorage.getItem('radar-tema') || 'sistema'; } catch { return 'sistema'; }
}

function aplicarTema(tema) {
  const raiz = document.documentElement;
  if (tema === 'sistema') raiz.removeAttribute('data-theme');
  else raiz.setAttribute('data-theme', tema === 'oscuro' ? 'dark' : 'light');
  const boton = document.getElementById('tema');
  if (boton) boton.textContent = NOMBRE_TEMA[tema];
  try { localStorage.setItem('radar-tema', tema); } catch { /* navegacion privada */ }
}

aplicarTema(leerTema());

document.getElementById('tema')?.addEventListener('click', () => {
  aplicarTema(TEMAS[(TEMAS.indexOf(leerTema()) + 1) % TEMAS.length]);
});


const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const ETIQUETA_SEMAFORO = { verde: 'Te calza', amarillo: 'Con condiciones', rojo: 'Poco probable' };

function diasHasta(iso) {
  if (!iso) return null;
  return Math.round((new Date(iso + 'T12:00:00Z') - Date.now()) / 86400000);
}

function fechaBonita(iso) {
  if (!iso) return 'sin fecha limite';
  const [a, m, d] = iso.split('-').map(Number);
  const dia = DIAS[new Date(iso + 'T12:00:00Z').getUTCDay()];
  return `${dia} ${d} de ${MESES[m - 1]} de ${a}`;
}

function textoPlazo(iso, clase) {
  const d = diasHasta(iso);
  if (d === null) return '';
  const evento = clase === 'evento';
  if (d < 0) return evento ? `fue hace ${Math.abs(d)} dias` : `cerro hace ${Math.abs(d)} dias`;
  if (d === 0) return evento ? 'es hoy' : 'cierra hoy';
  if (d === 1) return evento ? 'es manana' : 'cierra manana';
  return evento ? `es en ${d} dias` : `cierra en ${d} dias`;
}

function escapar(t) {
  return String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

async function traer(ruta) {
  const r = await fetch(ruta);
  return r.json();
}

// ── Tablero de arriba ────────────────────────────────────────

async function pintarTablero() {
  const e = await traer('/api/estado');
  estado.catalogos = e;
  const r = e.resumen;
  $('#tablero').innerHTML = `
    <div class="dato"><div class="n">${r.abiertas}</div><div class="t">abiertas</div></div>
    <div class="dato ${r.cierraEn30 ? 'alerta' : ''}"><div class="n">${r.cierraEn30}</div><div class="t">cierran en 30 dias</div></div>
    <div class="dato"><div class="n">${r.nuevas}</div><div class="t">sin revisar</div></div>
    <div class="dato"><div class="n">${r.guardadas}</div><div class="t">guardadas</div></div>
    <div class="dato"><div class="n">${r.postuladas}</div><div class="t">postuladas</div></div>
    <div class="dato"><div class="n">${e.fuentes.sanas}/${e.fuentes.total}</div><div class="t">fuentes sanas</div></div>
  `;

  const selTipo = $('#f-tipo');
  if (selTipo.options.length === 1) {
    for (const [k, v] of Object.entries(e.tipos)) selTipo.add(new Option(v, k));
    const selArea = $('#f-area');
    for (const [k, v] of Object.entries(e.areas)) selArea.add(new Option(v, k));
  }
}

// ── Tarjetas ─────────────────────────────────────────────────

/** Lo que la ficha publica sobre plata, textual. */
function bloquePlata(o) {
  const p = o.dinero || {};
  const montos = (p.montos || []).length
    ? `<span class="monto">${(p.montos || []).map(escapar).join(' · ')}</span>`
    : '';
  const frase = (p.frases || [])[0] ? `<span class="cita-plata">${escapar(p.frases[0])}</span>` : '';
  // Siempre se dice algo: que no haya dato tambien es informacion.
  const cuerpo = (montos || frase) ? `${montos}${frase}` : `<span class="cita-plata sin-dato">La pagina no publica el valor. Suele aparecer al entrar al formulario de inscripcion.</span>`;
  return `<p class="plata-bloque${montos ? '' : ' vacia'}"><span class="rotulo-textual">Costo y financiamiento</span>${cuerpo}</p>`;
}

function tarjeta(o) {
  const dias = diasHasta(o.fecha_limite);
  const urgente = dias !== null && dias <= 14;
  const eleg = o.elegibilidad || {};
  const etiquetas = [];

  if (o.tipo) etiquetas.push(`<span class="etiqueta">${escapar(estado.catalogos?.tipos?.[o.tipo] || o.tipo)}</span>`);
  for (const a of (o.areas || []).slice(0, 3)) {
    etiquetas.push(`<span class="etiqueta">${escapar(estado.catalogos?.areas?.[a] || a)}</span>`);
  }
  if (o.modalidad && o.modalidad !== 'desconocida') etiquetas.push(`<span class="etiqueta online">${escapar(o.modalidad)}</span>`);
  if (o.costo === 'gratis') etiquetas.push('<span class="etiqueta dinero">sin costo</span>');
  if (o.financiamiento) etiquetas.push('<span class="etiqueta dinero">con financiamiento</span>');
  if (o.lugar) etiquetas.push(`<span class="etiqueta">${escapar(o.lugar)}</span>`);
  if (o.es_semilla) etiquetas.push('<span class="etiqueta">ciclo conocido</span>');
  for (const p of (o.publico || []).slice(0, 2)) {
    const mio = p.startsWith('tecnologos');
    etiquetas.push(`<span class="etiqueta ${mio ? 'para-mi' : ''}">para ${escapar(p)}</span>`);
  }

  const requisitos = (eleg.requisitos || []).length
    ? `<ul class="requisitos">${eleg.requisitos.map((r) => `<li>${escapar(r)}</li>`).join('')}</ul>`
    : '';

  return `
  <article class="tarjeta ${o.semaforo || ''} ${o.estado === 'descartado' ? 'descartada' : ''}" data-id="${o.id}">
    <div class="linea-fuente">${escapar(o.fuente_nombre || '')}</div>
    <h3 class="titulo"><a href="${escapar(o.url)}" target="_blank" rel="noopener">${escapar(o.titulo)}</a></h3>
    <div class="plazo ${urgente ? 'urgente' : ''}">
      ${o.fecha_limite ? (o.clase_fecha === 'evento' ? 'Fecha del evento: ' : 'Cierre: ') : ''}${fechaBonita(o.fecha_limite)} ${o.fecha_limite ? `· ${textoPlazo(o.fecha_limite, o.clase_fecha)}` : ''}
      ${o.fecha_estimada ? '<span class="estimada">fecha estimada, confirmar en la fuente</span>' : ''}
    </div>
    <div class="etiquetas">${etiquetas.join('')}</div>
    ${o.resumen_es ? `<p class="de-que-se-trata">${escapar(o.resumen_es)}</p>` : ''}
    ${o.contenido || o.descripcion ? `<p class="textual"><span class="rotulo-textual">Lo que dice la fuente</span>${escapar(o.contenido || o.descripcion)}</p>` : ''}
    ${bloquePlata(o)}
    ${o.resumen ? `<details class="original"><summary>Texto original de la fuente</summary><p>${escapar(o.resumen)}</p></details>` : ''}
    <div class="puedo ${o.semaforo || ''}">
      <b>¿Puedo yo? ${ETIQUETA_SEMAFORO[o.semaforo] || 'Por revisar'}</b>
      ${escapar(eleg.comentario || '')}
      ${requisitos}
    </div>
    <div class="controles">
      <button class="mini ${o.estado === 'guardado' ? 'activo' : ''}" data-accion="guardado">Guardar</button>
      <button class="mini ${o.estado === 'postulado' ? 'activo' : ''}" data-accion="postulado">Ya postule</button>
      <button class="mini ${o.estado === 'descartado' ? 'activo' : ''}" data-accion="descartado">No me sirve</button>
      <span class="puntaje">puntaje ${o.puntaje}</span>
    </div>
  </article>`;
}

// ── Vistas ───────────────────────────────────────────────────

function parametros() {
  const p = new URLSearchParams();
  const texto = $('#f-texto').value.trim();
  if (texto) p.set('texto', texto);
  for (const [campo, id] of [['tipo', '#f-tipo'], ['area', '#f-area'], ['semaforo', '#f-semaforo'], ['estado', '#f-estado'], ['orden', '#f-orden']]) {
    const v = $(id).value;
    if (v) p.set(campo, v);
  }
  p.set('abiertas', $('#f-abiertas').checked ? '1' : '0');

  // Los atajos son filtros de un toque, pensados para el celular.
  if (estado.atajo === 'tecnicas') p.set('area', 'tecnicasEspeciales');
  if (estado.atajo === 'financiado') p.set('financiado', '1');
  if (estado.atajo === 'gratis') p.set('gratis', '1');
  if (estado.atajo === 'paraMi') p.set('paraMi', '1');
  if (estado.atajo === 'pronto') { p.set('cierraEnDias', '45'); p.set('orden', 'plazo'); }
  // Manda por sobre el orden que pida el atajo o el selector.
  if (estado.porUrgencia) p.set('orden', 'plazo');
  // El archivo de ediciones pasadas: no son convocatorias abiertas, pero
  // muestran que se repite y cuando, que es como uno se adelanta al proximo ciclo.
  if (estado.atajo === 'historico') { p.set('historico', '1'); p.set('abiertas', '0'); }
  // Titulares que encontro la busqueda de noticias: no tienen ficha propia,
  // pero a veces son el primer aviso de algo que despues se publica formalmente.
  if (estado.atajo === 'pistas') p.set('pista', '1');
  if (estado.atajo === 'anuncios') { p.set('pista', '1'); p.set('anuncio', '1'); }

  return p.toString();
}

async function vistaLista() {
  $('#filtros').style.display = 'flex';
  $('#atajos').style.display = 'flex';
  const datos = await traer('/api/oportunidades?' + parametros());
  contenido.innerHTML = datos.length
    ? datos.map(tarjeta).join('')
    : '<p class="vacio">Nada por aca todavia. Corre un escaneo o suelta los filtros.</p>';
}

async function vistaHorizonte() {
  $('#filtros').style.display = 'none';
  $('#atajos').style.display = 'none';
  const datos = await traer('/api/horizonte?meses=12');
  if (!datos.length) {
    contenido.innerHTML = '<p class="vacio">Sin plazos futuros registrados.</p>';
    return;
  }
  const porMes = new Map();
  for (const o of datos) {
    const clave = o.fecha_limite.slice(0, 7);
    if (!porMes.has(clave)) porMes.set(clave, []);
    porMes.get(clave).push(o);
  }
  contenido.innerHTML = [...porMes.entries()]
    .map(([mes, items]) => {
      const [a, m] = mes.split('-').map(Number);
      return `<h2 class="mes">${MESES[m - 1]} de ${a} · ${items.length}</h2>${items.map(tarjeta).join('')}`;
    })
    .join('');
}

async function vistaSalud() {
  $('#filtros').style.display = 'none';
  $('#atajos').style.display = 'none';
  const datos = await traer('/api/salud');
  const fila = (f) => {
    const clase = !f.ultimo_exito ? 'mal' : f.fallas_seguidas > 0 ? 'tibio' : 'ok';
    return `<tr>
      <td><span class="punto ${clase}"></span>${escapar(f.nombre)}</td>
      <td>${escapar(f.grupo || '')}</td>
      <td>${escapar(f.prioridad || '')}</td>
      <td>${f.items_ultimo || 0}</td>
      <td>${f.fallas_seguidas || 0}</td>
      <td>${escapar((f.ultimo_error || '').slice(0, 90))}</td>
      <td>${f.ultimo_exito ? f.ultimo_exito.slice(0, 10) : 'nunca'}</td>
    </tr>`;
  };
  contenido.innerHTML = `
    <p class="resumen">Cuando una fuente se pone en rojo hay que arreglar su lector en <code>fuentes/catalogo.json</code>.
    Mientras tanto, el calendario semilla cubre los ciclos conocidos de esa institucion.</p>
    <table class="salud">
      <thead><tr><th>Fuente</th><th>Grupo</th><th>Prioridad</th><th>Enlaces</th><th>Fallas seguidas</th><th>Ultimo error</th><th>Ultimo exito</th></tr></thead>
      <tbody>${datos.map(fila).join('')}</tbody>
    </table>`;
}

async function pintar() {
  if (estado.vista === 'lista') await vistaLista();
  else if (estado.vista === 'horizonte') await vistaHorizonte();
  else await vistaSalud();
}

// ── Eventos ──────────────────────────────────────────────────

document.querySelectorAll('.pestana').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.pestana').forEach((x) => x.classList.remove('activa'));
    b.classList.add('activa');
    estado.vista = b.dataset.vista;
    pintar();
  });
});

$('#filtros').addEventListener('change', pintar);

document.getElementById('urgencia')?.addEventListener('click', () => {
  estado.porUrgencia = !estado.porUrgencia;
  document.getElementById('urgencia').classList.toggle('activo', estado.porUrgencia);
  pintar();
});

document.querySelectorAll('.atajo:not(.orden)').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.atajo:not(.orden)').forEach((x) => x.classList.remove('activo'));
    b.classList.add('activo');
    estado.atajo = b.dataset.atajo;
    // Un atajo manda por sobre el selector de area: si eliges "Tecnicas
    // especiales", el filtro de area estorba.
    if (estado.atajo === 'tecnicas') $('#f-area').value = '';
    if (estado.vista !== 'lista') {
      document.querySelectorAll('.pestana').forEach((x) => x.classList.remove('activa'));
      document.querySelector('.pestana[data-vista="lista"]').classList.add('activa');
      estado.vista = 'lista';
    }
    pintar();
  });
});
let reloj;
$('#f-texto').addEventListener('input', () => {
  clearTimeout(reloj);
  reloj = setTimeout(pintar, 350);
});

contenido.addEventListener('click', async (ev) => {
  const boton = ev.target.closest('.mini');
  if (!boton) return;
  const tarjeta = boton.closest('.tarjeta');
  const id = tarjeta.dataset.id;
  const accion = boton.dataset.accion;
  const yaEstaba = boton.classList.contains('activo');
  await fetch(`/api/oportunidad/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ estado: yaEstaba ? 'visto' : accion }),
  });
  await pintarTablero();
  await pintar();
});

$('#btn-escanear').addEventListener('click', async () => {
  const b = $('#btn-escanear');
  b.disabled = true;
  b.textContent = 'Escaneando...';
  await fetch('/api/escanear', { method: 'POST' });
  const revisar = setInterval(async () => {
    const e = await traer('/api/estado');
    if (!e.escaneando) {
      clearInterval(revisar);
      b.disabled = false;
      b.textContent = 'Escanear ahora';
      await pintarTablero();
      await pintar();
    }
  }, 4000);
});

pintarTablero().then(pintar);
