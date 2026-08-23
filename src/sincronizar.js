// Baja a tu computador lo que encontro el radar corriendo en GitHub.
//
// El escaneo en la nube guarda su base en la rama "datos". Esto la trae y la
// funde con la tuya, respetando lo que ya marcaste como guardado, postulado o
// descartado: eso nunca se pisa.
//
//   node src/cli.js sincronizar

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { RAIZ } from './config.js';
import * as db from './db.js';
import { log } from './util.js';

const RAMA = process.env.RAMA_DATOS || 'datos';
const ARCHIVO_REMOTO = 'radar.db';

function git(args, opciones = {}) {
  return execFileSync('git', args, { cwd: RAIZ, stdio: ['ignore', 'pipe', 'pipe'], ...opciones });
}

log.titulo('Sincronizando con el radar de la nube');

try {
  git(['rev-parse', '--git-dir']);
} catch {
  log.error('Esta carpeta no es un repositorio git, asi que no hay nube desde donde bajar.');
  log.info('Si quieres el escaneo automatico, sube el proyecto a GitHub y activa el workflow.');
  process.exit(1);
}

try {
  git(['fetch', 'origin', `${RAMA}:refs/remotes/origin/${RAMA}`, '--force']);
} catch (e) {
  log.error(`No pude traer la rama "${RAMA}": ${String(e.stderr || e.message).trim().slice(0, 200)}`);
  log.info('Si el radar todavia no ha corrido en GitHub, esa rama aun no existe. Es normal la primera vez.');
  process.exit(1);
}

const temporal = path.join(os.tmpdir(), `radar-crecimiento-${process.pid}.db`);
try {
  const binario = git(['show', `origin/${RAMA}:${ARCHIVO_REMOTO}`], { encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 });
  fs.writeFileSync(temporal, binario);
} catch (e) {
  log.error(`La rama existe pero no encontre ${ARCHIVO_REMOTO} dentro: ${String(e.stderr || e.message).trim().slice(0, 160)}`);
  process.exit(1);
}

const remota = new DatabaseSync(temporal, { readOnly: true });
const filas = remota.prepare('SELECT * FROM oportunidades').all();

let nuevas = 0;
let actualizadas = 0;
let respetadas = 0;

const listaLocal = db.db.prepare('SELECT id, url, estado FROM oportunidades').all();
const locales = new Map(listaLocal.map((f) => [f.id, f]));
// El segundo indice, por url, es el que evita el choque: la url es unica en la
// base, el id no siempre coincide entre las dos maquinas.
const porUrl = new Map(listaLocal.filter((f) => f.url).map((f) => [f.url, f]));

const columnas = [
  'url', 'titulo', 'resumen', 'resumen_es', 'descripcion', 'contenido', 'dinero', 'publico', 'texto', 'fuente_id', 'fuente_nombre', 'grupo', 'organizacion',
  'tipo', 'areas', 'idioma', 'pais', 'lugar', 'modalidad', 'costo', 'financiamiento',
  'fecha_inicio', 'fecha_fin', 'fecha_limite', 'fecha_estimada', 'clase_fecha', 'fecha_publicacion',
  'puntaje', 'puntaje_detalle', 'semaforo', 'elegibilidad', 'es_semilla', 'historico', 'pista', 'anuncio', 'retro', 'siglas',
];

const insertar = db.db.prepare(`
  INSERT INTO oportunidades (id, ${columnas.join(', ')}, creado, actualizado)
  VALUES (?, ${columnas.map(() => '?').join(', ')}, ?, ?)
`);
const refrescar = db.db.prepare(`
  UPDATE oportunidades SET ${columnas.map((c) => `${c} = ?`).join(', ')}, actualizado = ? WHERE id = ?
`);

let saltadas = 0;

for (const f of filas) {
  const valores = columnas.map((c) => f[c] ?? null);
  // Primero por id; si no esta, por url, que es lo mismo con otro nombre.
  const local = locales.get(f.id) || (f.url ? porUrl.get(f.url) : null);
  try {
    if (!local) {
      insertar.run(f.id, ...valores, f.creado, f.actualizado);
      nuevas++;
      continue;
    }
    // Lo que tu decidiste manda: estado, notas y avisos no se tocan.
    if (local.estado !== 'nuevo' && local.estado !== 'visto') respetadas++;
    // Se actualiza sobre el id que ya existe aca, no sobre el de la nube: asi
    // sigue apuntando a la ficha que tu marcaste.
    refrescar.run(...valores, f.actualizado, local.id);
    actualizadas++;
  } catch (e) {
    // Una ficha con problemas no puede botar la sincronizacion completa.
    saltadas++;
    if (saltadas <= 3) log.aviso(`No pude traer "${String(f.titulo || '').slice(0, 60)}": ${e.message}`);
  }
}

remota.close();
fs.rmSync(temporal, { force: true });

log.info(`${nuevas} oportunidades nuevas desde la nube`);
log.info(`${actualizadas} actualizadas · ${respetadas} conservaron tu marca (guardada, postulada o descartada)`);
if (saltadas) log.aviso(`${saltadas} quedaron fuera por datos con problemas; el resto entro igual.`);
console.log('');
