// Panel local. Abre http://localhost:4787 y muestra todo lo que el radar junto.

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exec } from 'node:child_process';
import { RAIZ, config, env } from './config.js';
import * as db from './db.js';
import { ETIQUETAS_AREA, TIPOS } from './clasificar.js';
import { log } from './util.js';

const WEB = path.join(RAIZ, 'web');
const TIPOS_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

let escaneando = false;

function json(res, datos, estado = 200) {
  const cuerpo = JSON.stringify(datos);
  res.writeHead(estado, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(cuerpo);
}

function leerCuerpo(req) {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); }
    });
  });
}

function expandir(fila) {
  const parsear = (t, pd) => {
    if (t === null || t === undefined || t === '') return pd;
    let v;
    try { v = JSON.parse(t); } catch { return pd; }
    if (v === null || v === undefined) return pd;
    if (Array.isArray(pd) && !Array.isArray(v)) return pd;
    return v;
  };
  return {
    ...fila,
    areas: parsear(fila.areas, []),
    publico: parsear(fila.publico, []),
    dinero: parsear(fila.dinero, { montos: [], frases: [] }),
    siglas: parsear(fila.siglas, []),
    elegibilidad: parsear(fila.elegibilidad, {}),
    puntaje_detalle: parsear(fila.puntaje_detalle, []),
  };
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${env.puertoPanel}`);
  const ruta = url.pathname;

  try {
    if (ruta === '/api/estado') {
      const salud = db.salud();
      return json(res, {
        resumen: db.resumen(),
        perfil: config.perfil,
        intereses: config.intereses,
        tipos: Object.fromEntries(Object.entries(TIPOS).map(([k, v]) => [k, v.etiqueta])),
        areas: ETIQUETAS_AREA,
        fuentes: {
          total: salud.length,
          sanas: salud.filter((f) => f.fallas_seguidas === 0 && f.ultimo_exito).length,
          fallando: salud.filter((f) => f.fallas_seguidas > 0).length,
        },
        escaneando,
      });
    }

    if (ruta === '/api/oportunidades') {
      const p = url.searchParams;
      const filas = db.listar({
        estado: p.get('estado') || undefined,
        tipo: p.get('tipo') || undefined,
        area: p.get('area') || undefined,
        semaforo: p.get('semaforo') || undefined,
        texto: p.get('texto') || undefined,
        soloAbiertas: p.get('abiertas') !== '0',
        financiado: p.get('financiado') === '1',
        gratis: p.get('gratis') === '1',
        paraMi: p.get('paraMi') === '1',
        historico: p.get('historico') === '1' ? true : undefined,
        pista: p.get('pista') === '1' ? true : undefined,
        anuncio: p.get('anuncio') === '1' ? true : undefined,
        retro: p.get('retro') === '1' ? true : undefined,
        cierraEnDias: p.get('cierraEnDias') ? Number(p.get('cierraEnDias')) : undefined,
        orden: p.get('orden') || 'puntaje',
        limite: Number(p.get('limite') || 400),
      });
      return json(res, filas.map(expandir));
    }

    if (ruta === '/api/horizonte') {
      return json(res, db.horizonte(Number(url.searchParams.get('meses') || 12)).map(expandir));
    }

    if (ruta === '/api/salud') {
      return json(res, db.salud());
    }

    if (ruta === '/api/ejecuciones') {
      return json(res, db.ejecuciones(15));
    }

    if (ruta.startsWith('/api/oportunidad/') && req.method === 'POST') {
      const id = decodeURIComponent(ruta.split('/')[3]);
      const cuerpo = await leerCuerpo(req);
      db.cambiarEstado(id, cuerpo.estado || 'visto', cuerpo.notas);
      return json(res, { ok: true });
    }

    if (ruta === '/api/escanear' && req.method === 'POST') {
      if (escaneando) return json(res, { ok: false, mensaje: 'ya hay un escaneo en curso' });
      escaneando = true;
      json(res, { ok: true, mensaje: 'escaneo iniciado' });
      import('./escanear.js')
        .then((m) => m.escanear())
        .then((r) => log.info(`Escaneo desde el panel: ${r.nuevos} nuevas`))
        .catch((e) => log.error(e.message))
        .finally(() => { escaneando = false; });
      return;
    }

    // La version instalable, para el celular.
    //
    // Se genera al vuelo con los datos del momento. Desde el telefono:
    // abrir esta direccion en Safari o Chrome y usar "Anadir a pantalla de
    // inicio". Queda con icono propio y se abre a pantalla completa, sin barra
    // del navegador, como cualquier otra app.
    if (ruta === '/movil' || ruta === '/movil/') {
      const { exportar } = await import('./exportar.js');
      const destino = path.join(RAIZ, 'datos', 'panel-movil.html');
      exportar(destino);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(fs.readFileSync(destino));
    }

    // Archivos del panel
    const archivo = ruta === '/' ? 'index.html' : ruta.slice(1);
    const destino = path.join(WEB, archivo);
    if (!destino.startsWith(WEB) || !fs.existsSync(destino)) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('No existe');
    }
    res.writeHead(200, { 'content-type': TIPOS_MIME[path.extname(destino)] || 'application/octet-stream' });
    return res.end(fs.readFileSync(destino));
  } catch (e) {
    log.error(`panel: ${e.message}`);
    return json(res, { error: e.message }, 500);
  }
});

/**
 * Direcciones de este computador dentro de la red local, con el nombre de la
 * tarjeta. Si hay WiFi y cable a la vez, la del WiFi va primero: es la que sirve
 * para el celular.
 */
function direccionesEnLaRed() {
  const salida = [];
  for (const [tarjeta, direcciones] of Object.entries(os.networkInterfaces())) {
    for (const d of direcciones || []) {
      if (d.family === 'IPv4' && !d.internal) salida.push({ ip: d.address, tarjeta });
    }
  }
  const esWifi = (t) => /wi-?fi|wireless|inalambric/i.test(t);
  return salida.sort((a, b) => (esWifi(b.tarjeta) ? 1 : 0) - (esWifi(a.tarjeta) ? 1 : 0));
}

// Con "abrirEnRed" el panel tambien contesta a otros aparatos de la misma casa
// (tu telefono, un notebook). Sin eso, solo contesta a este computador.
const enRed = config.panel?.abrirEnRed === true;
const interfaz = enRed ? '0.0.0.0' : '127.0.0.1';

servidor.listen(env.puertoPanel, interfaz, () => {
  const direccion = `http://localhost:${env.puertoPanel}`;
  log.titulo(`Panel del radar en ${direccion}`);
  const r = db.resumen();
  log.info(`${r.total} oportunidades guardadas · ${r.abiertas} abiertas · ${r.cierraEn30} cierran en 30 dias`);

  if (enRed) {
    const ips = direccionesEnLaRed();
    if (ips.length) {
      console.log('');
      log.info('DESDE TU CELULAR, con el mismo WiFi, escribe esta direccion en el navegador:');
      console.log('');
      for (const { ip, tarjeta } of ips.slice(0, 3)) {
        console.log(`        http://${ip}:${env.puertoPanel}/movil      (${tarjeta})`);
      }
      console.log('');
      log.info('Esa direccion es la version instalable: una vez abierta, usa');
      log.info('"Compartir > Anadir a pantalla de inicio" y queda como una app,');
      log.info('con icono propio y sin barra del navegador.');
      console.log('');
      log.info('Si el celular dice que no puede conectarse, falta abrir el firewall:');
      log.info('boton derecho en "Permitir panel en el celular.bat" > Ejecutar como');
      log.info('administrador. Es una sola vez y despues funciona siempre.');
    } else {
      log.aviso('Pediste abrir en red pero no encontre una direccion de red en este equipo.');
    }
  }

  if (config.panel?.abrirNavegador) {
    const cmd = process.platform === 'win32' ? `start "" "${direccion}"` : process.platform === 'darwin' ? `open "${direccion}"` : `xdg-open "${direccion}"`;
    exec(cmd, () => {});
  }
});
