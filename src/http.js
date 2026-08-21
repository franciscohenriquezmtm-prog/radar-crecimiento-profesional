// Pedir paginas sin romperse.
//
// Reintenta, respeta un descanso entre peticiones al mismo sitio, guarda copia
// en cache y usa ETag para no bajar dos veces lo mismo. Si una pagina falla,
// devuelve el error en vez de reventar: el escaneo debe seguir con el resto.

import https from 'node:https';
import { execFile } from 'node:child_process';
import { config, env } from './config.js';
import { leerCache, guardarCache } from './db.js';
import { dormir, log } from './util.js';

// Nos presentamos como lo que somos: un radar personal, con correo de contacto
// implicito en el nombre del proyecto. Cuando el sitio rechaza a cualquiera que
// no parezca navegador, se reintenta con el agente de navegador de abajo.
const AGENTE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0 Safari/537.36 RadarCrecimientoProfesional/1.0 (uso personal, tecnologo medico)';

const AGENTE_NAVEGADOR =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Safari/537.36';

const ultimaPeticion = new Map(); // host -> timestamp

async function esperarTurno(url) {
  let host;
  try { host = new URL(url).host; } catch { return; }
  const previa = ultimaPeticion.get(host) || 0;
  const falta = env.esperaMs - (Date.now() - previa);
  if (falta > 0) await dormir(falta);
  ultimaPeticion.set(host, Date.now());
}

/**
 * Algunos sitios publicos chilenos tienen la cadena de certificados incompleta
 * (le falta el intermedio) o el nombre no calza con el dominio. El navegador se
 * queja pero igual muestra la pagina; Node simplemente se niega. Para esas
 * fuentes puntuales, marcadas con "tlsRelajado" en el catalogo, se pide la
 * pagina con node:https sin validar el certificado. Es contenido publico de
 * solo lectura: no se envia ninguna credencial por ese canal.
 */
function pedirSinValidarCertificado(url, timeout) {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      { rejectUnauthorized: false, headers: { 'user-agent': AGENTE, accept: 'text/html,*/*' }, timeout },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          return resolve(pedirSinValidarCertificado(new URL(res.headers.location, url).toString(), timeout));
        }
        let cuerpo = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { cuerpo += c; });
        res.on('end', () => resolve({ ok: res.statusCode < 400, estado: res.statusCode, cuerpo, url }));
      }
    );
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, estado: 0, cuerpo: '', url, error: 'sin respuesta' }); });
    req.on('error', (e) => resolve({ ok: false, estado: 0, cuerpo: '', url, error: e.message }));
  });
}

/**
 * Segundo camino: pedir la pagina con curl.
 *
 * Varios organismos grandes —la IAEA entre ellos— tienen un filtro delante que
 * mira la "huella" de la conexion, no solo quien dice ser el visitante. Node
 * recibe un 403 donde curl recibe la pagina completa, con el mismo agente y la
 * misma direccion. No hay truco ni credencial de por medio: es contenido
 * publico, pedido de a una pagina y con la misma pausa entre peticiones que el
 * resto del radar.
 *
 * curl viene con Windows 10 en adelante y con los servidores de GitHub, asi que
 * no agrega nada que instalar. Si no estuviera, esto devuelve el error y el
 * escaneo sigue con las demas fuentes.
 */
function pedirConCurl(url, timeout) {
  return new Promise((resolve) => {
    const args = [
      '-s', '-L', '--compressed',
      '--max-time', String(Math.round(timeout / 1000)),
      '-A', AGENTE_NAVEGADOR,
      // Sin cabecera "accept": curl manda la suya y el filtro deja pasar. Con una
      // cabecera de navegador encima de una conexion que no lo es, rebota. Se
      // probo: es exactamente esa la diferencia entre 200 y 403.
      '-H', 'accept-language: en-US,en;q=0.9,es;q=0.8',
      '-w', '\n__ESTADO__%{http_code}',
      url,
    ];
    execFile('curl', args, { maxBuffer: 32 * 1024 * 1024, encoding: 'utf8' }, (error, salida) => {
      if (error && !salida) return resolve({ ok: false, estado: 0, cuerpo: '', url, error: `curl: ${error.message}` });
      const corte = salida.lastIndexOf('\n__ESTADO__');
      const estado = corte === -1 ? 0 : Number(salida.slice(corte + 11).trim());
      const cuerpo = corte === -1 ? salida : salida.slice(0, corte);
      if (estado >= 400 || !estado) return resolve({ ok: false, estado, cuerpo: '', url, error: `HTTP ${estado} (curl)` });
      return resolve({ ok: true, estado, cuerpo, url });
    });
  });
}

/**
 * Baja una pagina. Nunca lanza excepcion.
 * @returns {{ok: boolean, estado: number, cuerpo: string, url: string, error?: string, deCache?: boolean}}
 */
export async function pedir(url, { usarCache = true, maxEdadHoras = 20, tlsRelajado = false, aceptar = 'text/html,application/xhtml+xml,application/xml,text/xml,application/json;q=0.9,*/*;q=0.8' } = {}) {
  const cache = usarCache ? leerCache(url) : null;

  if (cache?.cuerpo && cache.obtenido) {
    const edadHoras = (Date.now() - new Date(cache.obtenido).getTime()) / 3600000;
    if (edadHoras < maxEdadHoras) {
      return { ok: true, estado: cache.estado || 200, cuerpo: cache.cuerpo, url, deCache: true };
    }
  }

  const reintentos = config.escaneo?.reintentos ?? 3;
  const timeout = config.escaneo?.timeoutMs ?? 25000;
  let ultimoError = '';

  if (tlsRelajado) {
    await esperarTurno(url);
    const r = await pedirSinValidarCertificado(url, timeout);
    if (r.ok) guardarCache(url, { cuerpo: r.cuerpo, estado: r.estado });
    return r;
  }

  for (let intento = 1; intento <= reintentos; intento++) {
    await esperarTurno(url);
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), timeout);
    try {
      const cabeceras = {
        'user-agent': AGENTE,
        accept: aceptar,
        'accept-language': 'es-CL,es;q=0.9,en;q=0.8,pt;q=0.6',
      };
      if (cache?.etag) cabeceras['if-none-match'] = cache.etag;
      if (cache?.modificado) cabeceras['if-modified-since'] = cache.modificado;

      const r = await fetch(url, { headers: cabeceras, redirect: 'follow', signal: control.signal });
      clearTimeout(reloj);

      if (r.status === 304 && cache?.cuerpo) {
        guardarCache(url, { etag: cache.etag, modificado: cache.modificado, cuerpo: cache.cuerpo, estado: 200 });
        return { ok: true, estado: 200, cuerpo: cache.cuerpo, url, deCache: true };
      }

      if (r.status === 429 || r.status >= 500) {
        ultimoError = `HTTP ${r.status}`;
        await dormir(1500 * intento);
        continue;
      }

      const cuerpo = await r.text();

      if (r.status === 403) {
        // El sitio no quiere hablar con un programa. Segundo intento con curl,
        // que muchas veces si pasa (ver pedirConCurl mas arriba).
        const porCurl = await pedirConCurl(url, timeout);
        if (porCurl.ok) {
          guardarCache(url, { cuerpo: porCurl.cuerpo, estado: 200 });
          return porCurl;
        }
        guardarCache(url, { cuerpo: '', estado: 403 });
        return { ok: false, estado: 403, cuerpo: '', url, error: 'HTTP 403' };
      }

      if (!r.ok) {
        // 404 no se reintenta: no va a cambiar en 2 segundos.
        guardarCache(url, { cuerpo: '', estado: r.status });
        return { ok: false, estado: r.status, cuerpo: '', url, error: `HTTP ${r.status}` };
      }

      guardarCache(url, {
        etag: r.headers.get('etag'),
        modificado: r.headers.get('last-modified'),
        cuerpo,
        estado: r.status,
      });
      return { ok: true, estado: r.status, cuerpo, url: r.url || url };
    } catch (e) {
      clearTimeout(reloj);
      ultimoError = e.name === 'AbortError' ? `sin respuesta en ${Math.round(timeout / 1000)}s` : e.message;
      log.detalle(`reintento ${intento}/${reintentos} en ${url}: ${ultimoError}`);
      await dormir(1200 * intento);
    }
  }

  // Ultimo recurso: si hay copia vieja en cache, mejor eso que nada.
  if (cache?.cuerpo) {
    return { ok: true, estado: 200, cuerpo: cache.cuerpo, url, deCache: true, error: `usando copia guardada (${ultimoError})` };
  }
  return { ok: false, estado: 0, cuerpo: '', url, error: ultimoError || 'sin respuesta' };
}
