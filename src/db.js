// Base de datos local (SQLite incluido en Node, sin instalar nada).
//
// Todo lo que el radar encuentra vive aca: datos/radar.db

import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ARCHIVO_DB, DIR_DATOS } from './config.js';

export const db = new DatabaseSync(ARCHIVO_DB);

/**
 * La copia de las paginas bajadas vive en OTRO archivo, a proposito.
 *
 * radar.db es lo valioso: las oportunidades y lo que tu marcaste. Viaja a
 * GitHub todos los dias y tiene que pesar poco. La cache, en cambio, guarda el
 * HTML crudo de cientos de paginas y engorda hasta cientos de megas en una sola
 * corrida. Separarla mantiene liviano lo que importa y hace que borrarla sea
 * inofensivo: se vuelve a llenar sola.
 */
export const dbCache = new DatabaseSync(path.join(DIR_DATOS, 'cache.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;

  CREATE TABLE IF NOT EXISTS oportunidades (
    id                    TEXT PRIMARY KEY,
    url                   TEXT UNIQUE,
    titulo                TEXT NOT NULL,
    resumen               TEXT,
    resumen_es            TEXT,
    descripcion           TEXT,
    contenido             TEXT,
    dinero                TEXT,
    publico               TEXT,
    texto                 TEXT,
    fuente_id             TEXT,
    fuente_nombre         TEXT,
    grupo                 TEXT,
    organizacion          TEXT,
    tipo                  TEXT,
    areas                 TEXT,
    idioma                TEXT,
    pais                  TEXT,
    lugar                 TEXT,
    modalidad             TEXT,
    costo                 TEXT,
    financiamiento        INTEGER DEFAULT 0,
    fecha_inicio          TEXT,
    fecha_fin             TEXT,
    fecha_limite          TEXT,
    fecha_estimada        INTEGER DEFAULT 0,
    clase_fecha           TEXT,
    fecha_publicacion     TEXT,
    puntaje               INTEGER DEFAULT 0,
    puntaje_detalle       TEXT,
    semaforo              TEXT,
    elegibilidad          TEXT,
    es_semilla            INTEGER DEFAULT 0,
    historico             INTEGER DEFAULT 0,
    pista                 INTEGER DEFAULT 0,
    anuncio               INTEGER DEFAULT 0,
    estado                TEXT DEFAULT 'nuevo',
    notas_usuario         TEXT,
    avisado               INTEGER DEFAULT 0,
    hitos_avisados        TEXT DEFAULT '[]',
    creado                TEXT,
    actualizado           TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_op_puntaje  ON oportunidades(puntaje DESC);
  CREATE INDEX IF NOT EXISTS idx_op_limite   ON oportunidades(fecha_limite);
  CREATE INDEX IF NOT EXISTS idx_op_estado   ON oportunidades(estado);
  CREATE INDEX IF NOT EXISTS idx_op_fuente   ON oportunidades(fuente_id);

  CREATE TABLE IF NOT EXISTS salud_fuentes (
    id                TEXT PRIMARY KEY,
    nombre            TEXT,
    grupo             TEXT,
    prioridad         TEXT,
    ultimo_intento    TEXT,
    ultimo_exito      TEXT,
    estrategia_ok     TEXT,
    items_ultimo      INTEGER DEFAULT 0,
    fallas_seguidas   INTEGER DEFAULT 0,
    ultimo_error      TEXT
  );

  CREATE TABLE IF NOT EXISTS ejecuciones (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    inicio        TEXT,
    fin           TEXT,
    nuevos        INTEGER DEFAULT 0,
    actualizados  INTEGER DEFAULT 0,
    fuentes_ok    INTEGER DEFAULT 0,
    fuentes_mal   INTEGER DEFAULT 0,
    nota          TEXT
  );
`);

dbCache.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS cache_http (
    url           TEXT PRIMARY KEY,
    etag          TEXT,
    modificado    TEXT,
    cuerpo        TEXT,
    estado        INTEGER,
    obtenido      TEXT
  );
`);

/**
 * Columnas que se fueron agregando despues de la primera version.
 *
 * Una base creada con una version vieja del radar no las tiene, y SQLite no
 * agrega columnas solo por cambiar el CREATE TABLE. Esto las va poniendo al
 * abrir, sin tocar los datos que ya estan guardados.
 */
function agregarColumnasQueFalten() {
  const existentes = new Set(db.prepare('PRAGMA table_info(oportunidades)').all().map((c) => c.name));
  const nuevas = [
    ['clase_fecha', 'TEXT'],
    ['resumen_es', 'TEXT'],
    ['publico', 'TEXT'],
    ['descripcion', 'TEXT'],
    ['historico', 'INTEGER DEFAULT 0'],
    ['contenido', 'TEXT'],
    ['dinero', 'TEXT'],
    ['pista', 'INTEGER DEFAULT 0'],
    ['anuncio', 'INTEGER DEFAULT 0'],
  ];
  for (const [nombre, tipo] of nuevas) {
    if (!existentes.has(nombre)) db.exec(`ALTER TABLE oportunidades ADD COLUMN ${nombre} ${tipo}`);
  }
}
agregarColumnasQueFalten();

const ahora = () => new Date().toISOString();

// ── Oportunidades ────────────────────────────────────────────

const COLUMNAS = [
  'url', 'titulo', 'resumen', 'resumen_es', 'descripcion', 'contenido', 'dinero', 'publico', 'texto', 'fuente_id', 'fuente_nombre', 'grupo', 'organizacion',
  'tipo', 'areas', 'idioma', 'pais', 'lugar', 'modalidad', 'costo', 'financiamiento',
  'fecha_inicio', 'fecha_fin', 'fecha_limite', 'fecha_estimada', 'clase_fecha', 'fecha_publicacion',
  'puntaje', 'puntaje_detalle', 'semaforo', 'elegibilidad', 'es_semilla', 'historico', 'pista', 'anuncio',
];

const insertar = db.prepare(`
  INSERT INTO oportunidades (id, ${COLUMNAS.join(', ')}, creado, actualizado)
  VALUES (?, ${COLUMNAS.map(() => '?').join(', ')}, ?, ?)
`);

const actualizar = db.prepare(`
  UPDATE oportunidades SET ${COLUMNAS.map((c) => `${c} = ?`).join(', ')}, actualizado = ?
  WHERE id = ?
`);

const buscarPorId = db.prepare('SELECT * FROM oportunidades WHERE id = ?');
const buscarPorUrl = db.prepare('SELECT * FROM oportunidades WHERE url = ?');

function valores(o) {
  return COLUMNAS.map((c) => {
    const v = o[c];
    if (v === undefined || v === null) return null;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (Array.isArray(v) || (typeof v === 'object')) return JSON.stringify(v);
    return v;
  });
}

/**
 * Lo que costo trabajo leer no se pierde por una descarga fallida.
 *
 * El escaneo reescribe la ficha completa cada vez. Si el sitio nos limita el
 * paso ese dia —ESTRO lo hace cuando se le piden cuarenta paginas seguidas— la
 * ficha nueva viene sin texto, sin descripcion y sin montos, y borraba lo que
 * ya se habia leido bien. Estos campos solo se reemplazan cuando lo nuevo
 * efectivamente trae algo.
 */
const CAMPOS_CAROS = ['texto', 'contenido', 'descripcion', 'dinero', 'publico', 'resumen'];

function conservandoLoCaro(previo, nuevo) {
  const salida = { ...nuevo };
  for (const campo of CAMPOS_CAROS) {
    const valor = salida[campo];
    const vacio =
      valor === undefined || valor === null || valor === '' ||
      (Array.isArray(valor) && !valor.length) ||
      (campo === 'dinero' && !(valor?.montos?.length || valor?.frases?.length));
    if (vacio && previo[campo]) salida[campo] = previo[campo];
  }
  return salida;
}

/** Guarda o actualiza. Devuelve 'nuevo', 'actualizado' o 'igual'. */
export function guardar(o) {
  const previo = buscarPorId.get(o.id) || (o.url ? buscarPorUrl.get(o.url) : null);
  const t = ahora();
  if (!previo) {
    insertar.run(o.id, ...valores(o), t, t);
    return 'nuevo';
  }
  // No pisamos lo que el usuario ya decidio: estado y notas se conservan.
  const cambio =
    previo.titulo !== o.titulo ||
    previo.fecha_limite !== (o.fecha_limite ?? null) ||
    previo.puntaje !== (o.puntaje ?? 0) ||
    (previo.resumen || '') !== (o.resumen || '');

  actualizar.run(...valores(conservandoLoCaro(previo, { ...o, id: previo.id })), t, previo.id);
  return cambio ? 'actualizado' : 'igual';
}

export function existeUrl(url) {
  return Boolean(buscarPorUrl.get(url));
}

/** La ficha guardada para esa direccion, o null. */
export function filaPorUrl(url) {
  return buscarPorUrl.get(url) || null;
}

export function titulosRecientes(fuenteId) {
  return db
    .prepare('SELECT id, titulo, url FROM oportunidades WHERE fuente_id = ?')
    .all(fuenteId);
}

export function marcarAvisado(ids) {
  if (!ids.length) return;
  const s = db.prepare('UPDATE oportunidades SET avisado = 1 WHERE id = ?');
  for (const id of ids) s.run(id);
}

export function registrarHito(id, dias) {
  const fila = buscarPorId.get(id);
  if (!fila) return;
  const hitos = JSON.parse(fila.hitos_avisados || '[]');
  if (!hitos.includes(dias)) hitos.push(dias);
  db.prepare('UPDATE oportunidades SET hitos_avisados = ? WHERE id = ?').run(JSON.stringify(hitos), id);
}

export function cambiarEstado(id, estado, notas) {
  db.prepare('UPDATE oportunidades SET estado = ?, notas_usuario = COALESCE(?, notas_usuario), actualizado = ? WHERE id = ?')
    .run(estado, notas ?? null, ahora(), id);
}

export function listar({ estado, tipo, area, semaforo, texto, soloAbiertas, financiado, gratis, paraMi, cierraEnDias, historico, pista, anuncio, orden, limite } = {}) {
  const donde = [];
  const args = [];
  if (estado) { donde.push('estado = ?'); args.push(estado); }
  if (tipo) { donde.push('tipo = ?'); args.push(tipo); }
  if (semaforo) { donde.push('semaforo = ?'); args.push(semaforo); }
  if (area) { donde.push('areas LIKE ?'); args.push(`%"${area}"%`); }
  if (texto) {
    donde.push('(LOWER(titulo) LIKE ? OR LOWER(resumen) LIKE ? OR LOWER(resumen_es) LIKE ? OR LOWER(organizacion) LIKE ?)');
    const t = `%${String(texto).toLowerCase()}%`;
    args.push(t, t, t, t);
  }
  if (soloAbiertas) donde.push("(fecha_limite IS NULL OR fecha_limite >= date('now'))");
  // Las ediciones pasadas viven aparte: no compiten con lo que sigue abierto,
  // pero no se pierden.
  // Al pedir una vista especial, la otra deja de filtrar: una nota de prensa
  // sobre una edicion pasada es las dos cosas, y antes desaparecia de ambas.
  const pidePista = pista === true;
  const pideHistorico = historico === true;

  if (pideHistorico) donde.push('historico = 1');
  else if (historico !== 'ambos' && !pidePista) donde.push('(historico = 0 OR historico IS NULL)');

  // Las pistas de prensa viven aparte: son titulares sin ficha detras, y
  // mezcladas con lo demas tapaban las oportunidades de verdad.
  if (pidePista) donde.push('pista = 1');
  else if (pista !== 'ambos' && !pideHistorico) donde.push('(pista = 0 OR pista IS NULL)');

  // Dentro de las noticias, las que anuncian un curso o una beca.
  if (anuncio === true) donde.push('anuncio = 1');
  if (financiado) donde.push('financiamiento = 1');
  // Gratis, o a distancia sin costo declarado: casi siempre lo segundo tambien
  // es gratis, y dejarlo fuera escondia cosas utiles.
  if (gratis) donde.push("(costo = 'gratis' OR (modalidad IN ('online','hibrido') AND costo != 'pago'))");
  if (paraMi) donde.push("publico LIKE '%tecnologos%'");
  if (cierraEnDias) {
    donde.push("fecha_limite IS NOT NULL AND fecha_limite >= date('now') AND fecha_limite <= date('now', '+' || ? || ' days')");
    args.push(String(cierraEnDias));
  }
  const orderBy = orden === 'plazo'
    ? "CASE WHEN fecha_limite IS NULL THEN 1 ELSE 0 END, fecha_limite ASC, puntaje DESC"
    : orden === 'reciente'
      ? 'creado DESC'
      : 'puntaje DESC, CASE WHEN fecha_limite IS NULL THEN 1 ELSE 0 END, fecha_limite ASC';
  const sql = `SELECT * FROM oportunidades ${donde.length ? 'WHERE ' + donde.join(' AND ') : ''} ORDER BY ${orderBy} LIMIT ?`;
  return db.prepare(sql).all(...args, limite || 500);
}

export function nuevasParaAvisar(umbral) {
  return db
    .prepare(`
      SELECT * FROM oportunidades
      WHERE avisado = 0 AND puntaje >= ? AND estado NOT IN ('descartado')
        AND (historico = 0 OR historico IS NULL)
        AND (pista = 0 OR pista IS NULL)
        AND (fecha_limite IS NULL OR fecha_limite >= date('now'))
      ORDER BY puntaje DESC
    `)
    .all(umbral);
}

/** Noticias que anuncian una oportunidad concreta y aun no se avisaron. */
export function noticiasQueAnuncian(limite = 5) {
  return db
    .prepare(`
      SELECT * FROM oportunidades
      WHERE pista = 1 AND anuncio = 1 AND avisado = 0
        AND estado NOT IN ('descartado')
        AND (historico = 0 OR historico IS NULL)
      ORDER BY puntaje DESC
      LIMIT ?
    `)
    .all(limite);
}

export function cierresProximos(maxDias) {
  return db
    .prepare(`
      SELECT * FROM oportunidades
      WHERE fecha_limite IS NOT NULL
        AND fecha_limite >= date('now')
        AND fecha_limite <= date('now', '+' || ? || ' days')
        AND estado NOT IN ('descartado', 'postulado')
        -- La alarma es para plazos que se cierran. La fecha de un evento no se
        -- "pierde" igual: esa vive en la vista de horizonte.
        AND (clase_fecha = 'limite' OR es_semilla = 1)
        AND (historico = 0 OR historico IS NULL)
        AND (pista = 0 OR pista IS NULL)
      ORDER BY fecha_limite ASC
    `)
    .all(String(maxDias));
}

export function horizonte(meses = 12) {
  return db
    .prepare(`
      SELECT * FROM oportunidades
      WHERE fecha_limite IS NOT NULL
        AND fecha_limite >= date('now')
        AND fecha_limite <= date('now', '+' || ? || ' months')
        AND estado != 'descartado'
      ORDER BY fecha_limite ASC
    `)
    .all(String(meses));
}

export function resumen() {
  const q = (sql, ...a) => db.prepare(sql).get(...a);
  return {
    total: q('SELECT COUNT(*) n FROM oportunidades').n,
    abiertas: q("SELECT COUNT(*) n FROM oportunidades WHERE fecha_limite IS NULL OR fecha_limite >= date('now')").n,
    nuevas: q("SELECT COUNT(*) n FROM oportunidades WHERE estado = 'nuevo'").n,
    guardadas: q("SELECT COUNT(*) n FROM oportunidades WHERE estado = 'guardado'").n,
    postuladas: q("SELECT COUNT(*) n FROM oportunidades WHERE estado = 'postulado'").n,
    cierraEn30: q("SELECT COUNT(*) n FROM oportunidades WHERE fecha_limite BETWEEN date('now') AND date('now','+30 days') AND estado NOT IN ('descartado','postulado')").n,
    ultimaEjecucion: q('SELECT * FROM ejecuciones ORDER BY id DESC LIMIT 1') || null,
  };
}

export function archivarVencidas(dias) {
  const r = db
    .prepare(`
      DELETE FROM oportunidades
      WHERE fecha_limite IS NOT NULL
        AND fecha_limite < date('now', '-' || ? || ' days')
        AND estado IN ('nuevo', 'visto')
    `)
    .run(String(dias));
  return r.changes || 0;
}

// ── Salud de fuentes ─────────────────────────────────────────

export function registrarSalud(fuente, { ok, estrategia, items, error }) {
  const t = ahora();
  const previo = db.prepare('SELECT * FROM salud_fuentes WHERE id = ?').get(fuente.id);
  if (!previo) {
    db.prepare(`INSERT INTO salud_fuentes (id, nombre, grupo, prioridad, ultimo_intento, ultimo_exito, estrategia_ok, items_ultimo, fallas_seguidas, ultimo_error)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(fuente.id, fuente.nombre, fuente.grupo, fuente.prioridad, t, ok ? t : null, estrategia || null, items || 0, ok ? 0 : 1, error || null);
    return;
  }
  db.prepare(`UPDATE salud_fuentes SET nombre = ?, grupo = ?, prioridad = ?, ultimo_intento = ?,
              ultimo_exito = ?, estrategia_ok = ?, items_ultimo = ?, fallas_seguidas = ?, ultimo_error = ?
              WHERE id = ?`)
    .run(
      fuente.nombre, fuente.grupo, fuente.prioridad, t,
      ok ? t : previo.ultimo_exito,
      ok ? estrategia : previo.estrategia_ok,
      ok ? items : previo.items_ultimo,
      ok ? 0 : (previo.fallas_seguidas || 0) + 1,
      ok ? null : (error || 'sin detalle'),
      fuente.id
    );
}

export function salud() {
  return db.prepare('SELECT * FROM salud_fuentes ORDER BY fallas_seguidas DESC, prioridad ASC, nombre ASC').all();
}

// ── Cache de paginas ─────────────────────────────────────────

export function leerCache(url) {
  return dbCache.prepare('SELECT * FROM cache_http WHERE url = ?').get(url) || null;
}

const MAX_CUERPO = 900 * 1024;

export function guardarCache(url, { etag, modificado, cuerpo, estado }) {
  // Una pagina enorme se guarda sin cuerpo: igual sirve para el ETag.
  const guardado = cuerpo && cuerpo.length <= MAX_CUERPO ? cuerpo : null;
  dbCache.prepare(`INSERT INTO cache_http (url, etag, modificado, cuerpo, estado, obtenido)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(url) DO UPDATE SET etag = excluded.etag, modificado = excluded.modificado,
                cuerpo = excluded.cuerpo, estado = excluded.estado, obtenido = excluded.obtenido`)
    .run(url, etag || null, modificado || null, guardado, estado || 0, ahora());
}

export function limpiarCache(dias = 7) {
  dbCache.prepare("DELETE FROM cache_http WHERE obtenido < datetime('now', '-' || ? || ' days')").run(String(dias));
  dbCache.exec('VACUUM');
}

// ── Ejecuciones ──────────────────────────────────────────────

export function abrirEjecucion() {
  const r = db.prepare('INSERT INTO ejecuciones (inicio) VALUES (?)').run(ahora());
  return Number(r.lastInsertRowid);
}

export function cerrarEjecucion(id, datos) {
  db.prepare('UPDATE ejecuciones SET fin = ?, nuevos = ?, actualizados = ?, fuentes_ok = ?, fuentes_mal = ?, nota = ? WHERE id = ?')
    .run(ahora(), datos.nuevos || 0, datos.actualizados || 0, datos.fuentesOk || 0, datos.fuentesMal || 0, datos.nota || null, id);
}

export function ejecuciones(limite = 20) {
  return db.prepare('SELECT * FROM ejecuciones ORDER BY id DESC LIMIT ?').all(limite);
}
