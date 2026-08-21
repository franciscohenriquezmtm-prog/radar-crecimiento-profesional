// Carga la configuracion y las claves. Nada mas.
//
// config.json  -> como piensa el radar (se versiona, no lleva secretos)
// .env         -> claves de correo y push (nunca se versiona)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DIR_DATOS = path.join(RAIZ, 'datos');
export const DIR_FUENTES = path.join(RAIZ, 'fuentes');
export const ARCHIVO_DB = path.join(DIR_DATOS, 'radar.db');

fs.mkdirSync(DIR_DATOS, { recursive: true });

/** Lee un .env sencillo: CLAVE=valor, ignora comentarios y comillas. */
function cargarEnv() {
  const f = path.join(RAIZ, '.env');
  if (!fs.existsSync(f)) return;
  for (const linea of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const t = linea.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const clave = t.slice(0, i).trim();
    let valor = t.slice(i + 1).trim();
    if (/^".*"$/.test(valor) || /^'.*'$/.test(valor)) valor = valor.slice(1, -1);
    if (process.env[clave] === undefined) process.env[clave] = valor;
  }
}
cargarEnv();

function leerJson(archivo, porDefecto = null) {
  try {
    return JSON.parse(fs.readFileSync(archivo, 'utf8'));
  } catch (e) {
    if (porDefecto !== null) return porDefecto;
    throw new Error(`No pude leer ${path.basename(archivo)}: ${e.message}`);
  }
}

export const config = leerJson(path.join(RAIZ, 'config.json'));
export const catalogo = leerJson(path.join(DIR_FUENTES, 'catalogo.json'));
export const calendarioSemilla = leerJson(path.join(DIR_FUENTES, 'calendario.json'), { ciclos: [] });

/** Fuentes activas, en orden: primero las de prioridad alta. */
export function fuentesActivas() {
  const peso = { alta: 0, media: 1, baja: 2 };
  return catalogo.fuentes
    .filter((f) => f.activa !== false && Array.isArray(f.estrategias) && f.estrategias.length)
    .sort((a, b) => (peso[a.prioridad] ?? 1) - (peso[b.prioridad] ?? 1));
}

export const env = {
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE ?? 'true') !== 'false',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    destino: process.env.CORREO_DESTINO || process.env.SMTP_USER || '',
  },
  ntfy: {
    topic: process.env.NTFY_TOPIC || '',
    server: process.env.NTFY_SERVER || 'https://ntfy.sh',
  },
  telegram: {
    token: process.env.TELEGRAM_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },
  puertoPanel: Number(process.env.PUERTO_PANEL || config.panel?.puerto || 4787),
  esperaMs: Number(process.env.ESPERA_MS || config.escaneo?.esperaMsEntrePeticiones || 900),
  nivelLog: process.env.LOG_NIVEL || 'info',
};

export const hayCorreo = Boolean(env.smtp.host && env.smtp.user && env.smtp.pass && env.smtp.destino);
export const hayPush = Boolean(env.ntfy.topic) || Boolean(env.telegram.token && env.telegram.chatId);
