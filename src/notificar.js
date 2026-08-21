// Avisos: correo diario, alarma de cierre proximo y push al telefono.
//
// El correo es el producto principal. Se arma con dos secciones:
//   1. Lo nuevo que aparecio desde el ultimo aviso.
//   2. Los plazos que se estan viniendo encima y que todavia no resolviste.

import fs from 'node:fs';
import path from 'node:path';
import { config, env, hayCorreo, DIR_DATOS } from './config.js';
import * as db from './db.js';
import { sendMail } from './smtp.js';
import { etiquetaTipo, ETIQUETAS_AREA } from './clasificar.js';
import { COLOR_SEMAFORO } from './elegibilidad.js';
import { diasHasta, escaparHtml, fechaBonita, log, recortar, textoPlazo } from './util.js';

const A = config.avisos || {};

const COLORES = {
  verde: '#1d7a4c',
  amarillo: '#a06a00',
  rojo: '#a33',
};

function enHorasDeSilencio() {
  const h = new Date().getHours();
  const { desde = 23, hasta = 7 } = A.horasSilencio || {};
  return desde > hasta ? h >= desde || h < hasta : h >= desde && h < hasta;
}

function areasBonitas(json) {
  try {
    return JSON.parse(json || '[]').map((a) => ETIQUETAS_AREA[a] || a).slice(0, 3).join(' · ');
  } catch {
    return '';
  }
}

function comentarioDe(fila) {
  try {
    return JSON.parse(fila.elegibilidad || '{}').comentario || '';
  } catch {
    return '';
  }
}

/** Las siglas de la ficha, explicadas. En el correo van desplegadas: no hay
 *  donde hacer clic en la mayoria de los clientes. */
function siglasHtml(o) {
  let siglas = [];
  try { siglas = JSON.parse(o.siglas || '[]'); } catch { siglas = []; }
  if (!siglas.length) return '';
  const items = siglas
    .map((s) => `<li><strong>${escaparHtml(s.sigla)}</strong> ${escaparHtml(s.largo)}${s.es ? ' — ' + escaparHtml(s.es) : ''}</li>`)
    .join('');
  return `<ul style="font-size:11.5px;color:#777;margin:0 0 8px;padding-left:18px;line-height:1.5">${items}</ul>`;
}

/** Lo que la ficha publica sobre plata, textual. */
function plataHtml(o) {
  let p = {};
  try { p = JSON.parse(o.dinero || '{}'); } catch { p = {}; }
  const montos = (p.montos || []).join(' · ');
  const frase = (p.frases || [])[0] || "La pagina no publica el valor. Suele aparecer al entrar al formulario de inscripcion.";
  return `<div style="font-size:12.5px;background:#eef6f1;padding:7px 9px;border-radius:4px;margin:0 0 8px">
    ${montos ? `<strong style="color:#1a7a52">${escaparHtml(montos)}</strong> ` : ''}${escaparHtml(frase)}
  </div>`;
}

function tarjetaHtml(o) {
  const color = COLORES[o.semaforo] || '#555';
  const etiquetaFecha = o.clase_fecha === 'evento' ? 'Fecha del evento' : 'Cierre';
  const plazo = o.fecha_limite
    ? `${etiquetaFecha}: ${fechaBonita(o.fecha_limite)} — <strong>${textoPlazo(o.fecha_limite, o.clase_fecha)}</strong>${o.fecha_estimada ? ' <em>(estimada, confirmar en la fuente)</em>' : ''}`
    : 'sin fecha detectada';
  const etiquetas = [
    etiquetaTipo(o.tipo),
    areasBonitas(o.areas),
    o.modalidad !== 'desconocida' ? o.modalidad : null,
    o.costo === 'gratis' ? 'sin costo' : o.costo === 'pago' ? 'de pago' : null,
    o.financiamiento ? 'con financiamiento' : null,
    o.lugar || null,
  ].filter(Boolean).join(' · ');

  return `
  <div style="border-left:4px solid ${color};padding:10px 14px;margin:0 0 16px;background:#fafafa">
    <div style="font-size:12px;color:#777;margin-bottom:2px">${escaparHtml(o.fuente_nombre || '')}</div>
    <div style="font-size:16px;font-weight:600;line-height:1.35;margin-bottom:4px">
      <a href="${escaparHtml(o.url)}" style="color:#14375e;text-decoration:none">${escaparHtml(o.titulo)}</a>
    </div>
    <div style="font-size:13px;color:#333;margin-bottom:6px">${plazo}</div>
    <div style="font-size:12px;color:#666;margin-bottom:6px">${escaparHtml(etiquetas)}</div>
    ${o.contenido || o.descripcion ? `<div style="font-size:12.5px;color:#555;border-left:2px solid #ddd;padding-left:9px;margin:0 0 8px">${escaparHtml(o.contenido || o.descripcion)}</div>` : ''}
    ${plataHtml(o)}
    ${siglasHtml(o)}
    <div style="font-size:13.5px;color:#222;margin-bottom:8px;line-height:1.5">${escaparHtml(o.resumen_es || recortar(o.resumen || '', 320))}</div>
    <div style="font-size:12px;color:${color}">
      <strong>¿Puedo yo? ${COLOR_SEMAFORO[o.semaforo] || ''}.</strong> ${escaparHtml(recortar(comentarioDe(o), 400))}
    </div>
    <div style="font-size:11px;color:#999;margin-top:6px">puntaje ${o.puntaje}</div>
  </div>`;
}

function tarjetaTexto(o) {
  const plazo = o.fecha_limite ? `${fechaBonita(o.fecha_limite)} (${textoPlazo(o.fecha_limite, o.clase_fecha)})${o.fecha_estimada ? ' [estimada]' : ''}` : 'sin fecha';
  return [
    `• ${o.titulo}`,
    `  ${o.fuente_nombre} — ${etiquetaTipo(o.tipo)}`,
    `  ${o.clase_fecha === 'evento' ? 'Fecha del evento' : 'Plazo'}: ${plazo}`,
    `  ${o.resumen_es || ''}`,
    `  ¿Puedo yo? ${COLOR_SEMAFORO[o.semaforo] || ''}: ${recortar(comentarioDe(o), 220)}`,
    `  ${o.url}`,
    '',
  ].join('\n');
}

function armarCorreo({ nuevas, cierres, noticias = [], resumen }) {
  const fecha = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:680px;margin:0 auto;color:#222">
    <h2 style="margin:0 0 4px">Radar de crecimiento profesional</h2>
    <div style="color:#777;font-size:13px;margin-bottom:18px">${fecha} · ${resumen.abiertas} oportunidades abiertas en el panel</div>

    ${cierres.length ? `
      <h3 style="margin:22px 0 10px;padding-bottom:6px;border-bottom:2px solid #a33;color:#a33">
        Se te vienen encima (${cierres.length})
      </h3>
      <p style="font-size:13px;color:#555;margin:0 0 14px">
        Plazos que aun no marcaste como postulado ni descartado.
      </p>
      ${cierres.map(tarjetaHtml).join('')}` : ''}

    ${nuevas.length ? `
      <h3 style="margin:26px 0 10px;padding-bottom:6px;border-bottom:2px solid #14375e">
        Nuevo desde el ultimo aviso (${nuevas.length})
      </h3>
      ${nuevas.map(tarjetaHtml).join('')}` : `
      <p style="font-size:14px;color:#555">Hoy no aparecio nada nuevo por sobre el umbral de puntaje ${A.umbralCorreo}.</p>`}

    ${noticias.length ? `
      <h3 style="margin:26px 0 10px;padding-bottom:6px;border-bottom:2px solid #96660a;color:#96660a">
        Noticias que suenan a oportunidad (${noticias.length})
      </h3>
      <p style="font-size:13px;color:#555;margin:0 0 14px">
        Titulares que anuncian un curso o una beca. El radar no pudo leer la ficha:
        hay que abrir el enlace para la fecha, el costo y como postular.
      </p>
      ${noticias.map(tarjetaHtml).join('')}` : ''}

    <hr style="border:none;border-top:1px solid #eee;margin:26px 0 12px">
    <div style="font-size:12px;color:#888">
      Panel local: <a href="http://localhost:${env.puertoPanel}">http://localhost:${env.puertoPanel}</a><br>
      Las fechas marcadas como estimadas vienen del calendario de ciclos historicos y hay que confirmarlas en la fuente.<br>
      Nada se descarta por elegibilidad: el semaforo es solo una opinion del radar.
    </div>
  </div>`;

  const texto = [
    `RADAR DE CRECIMIENTO PROFESIONAL — ${fecha}`,
    '',
    cierres.length ? `SE TE VIENEN ENCIMA (${cierres.length})\n` : '',
    ...cierres.map(tarjetaTexto),
    nuevas.length ? `NUEVO DESDE EL ULTIMO AVISO (${nuevas.length})\n` : 'Hoy no hubo novedades sobre el umbral.\n',
    ...nuevas.map(tarjetaTexto),
    noticias.length ? `\nNOTICIAS QUE SUENAN A OPORTUNIDAD (${noticias.length})\n` : '',
    ...noticias.map(tarjetaTexto),
    `Panel: http://localhost:${env.puertoPanel}`,
  ].join('\n');

  const asunto = cierres.length
    ? `Radar: ${cierres.length} plazo${cierres.length === 1 ? '' : 's'} por cerrar` + (nuevas.length ? ` y ${nuevas.length} nueva${nuevas.length === 1 ? '' : 's'}` : '')
    : nuevas.length
      ? `Radar: ${nuevas.length} oportunidad${nuevas.length === 1 ? '' : 'es'} nueva${nuevas.length === 1 ? '' : 's'}`
      : 'Radar: sin novedades hoy';

  return { asunto, html, texto };
}

async function push(titulo, cuerpo, url, prioridad = 'default') {
  if (env.ntfy.topic) {
    try {
      await fetch(`${env.ntfy.server}/${env.ntfy.topic}`, {
        method: 'POST',
        headers: {
          Title: Buffer.from(titulo, 'utf8').toString('latin1'),
          Priority: prioridad,
          Tags: 'satellite',
          ...(url ? { Click: url } : {}),
        },
        body: cuerpo,
      });
    } catch (e) {
      log.aviso(`ntfy fallo: ${e.message}`);
    }
  }
  if (env.telegram.token && env.telegram.chatId) {
    try {
      await fetch(`https://api.telegram.org/bot${env.telegram.token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.telegram.chatId,
          text: `*${titulo}*\n${cuerpo}\n${url || ''}`,
          parse_mode: 'Markdown',
          disable_web_page_preview: false,
        }),
      });
    } catch (e) {
      log.aviso(`telegram fallo: ${e.message}`);
    }
  }
}

/** Revisa los hitos de cierre y devuelve lo que toca avisar hoy. */
function cierresQueTocaAvisar() {
  const hitos = A.hitosDeCierre || [30, 14, 7, 3, 1];
  const maxDias = Math.max(...hitos);
  const candidatas = db.cierresProximos(maxDias);
  const ordenados = [...hitos].sort((a, b) => a - b);
  const salida = [];
  for (const o of candidatas) {
    const dias = diasHasta(o.fecha_limite);
    // El hito que corresponde es el mas chico que todavia cubre los dias que faltan:
    // a 12 dias del cierre, con hitos 30/14/7, toca el de 14.
    const hito = ordenados.find((h) => dias <= h);
    if (hito === undefined) continue;
    let avisados = [];
    try { avisados = JSON.parse(o.hitos_avisados || '[]'); } catch { avisados = []; }
    if (avisados.includes(hito)) continue;
    salida.push({ ...o, hito });
  }
  return salida;
}

export async function avisar({ forzar = false, seco = false } = {}) {
  const resumen = db.resumen();
  const nuevas = db.nuevasParaAvisar(A.umbralCorreo ?? 20).slice(0, A.maxPorCorreo ?? 40);
  const cierres = cierresQueTocaAvisar().slice(0, A.maxCierresPorCorreo ?? 20);
  // Noticias que anuncian un curso o una beca: no son fichas verificadas, pero
  // suelen ser el primer aviso de algo que despues se publica formalmente.
  const noticias = db.noticiasQueAnuncian(A.maxNoticiasPorCorreo ?? 5);

  if (!nuevas.length && !cierres.length && !noticias.length && !forzar) {
    log.info('Sin novedades ni plazos que avisar hoy.');
    return { enviado: false, nuevas: 0, cierres: 0 };
  }

  const { asunto, html, texto } = armarCorreo({ nuevas, cierres, noticias, resumen });

  // Ensayo: escribe el correo a un archivo y no manda nada ni marca nada como
  // avisado. Sirve para ver como quedaria el correo de manana.
  if (seco) {
    const destino = path.join(DIR_DATOS, 'correo-de-prueba.html');
    fs.writeFileSync(destino, html, 'utf8');
    log.info(`Asunto: ${asunto}`);
    log.info(`${nuevas.length} nuevas · ${cierres.length} cierres · ${noticias.length} noticias`);
    log.info(`Correo escrito en ${destino} (no se envio nada)`);
    return { enviado: false, seco: true, nuevas: nuevas.length, cierres: cierres.length, noticias: noticias.length, archivo: destino };
  }

  if (hayCorreo && A.correoDiario !== false) {
    try {
      await sendMail(
        { ...env.smtp, from: env.smtp.user, to: env.smtp.destino },
        { subject: asunto, text: texto, html }
      );
      log.info(`Correo enviado a ${env.smtp.destino}: ${asunto}`);
      db.marcarAvisado([...nuevas, ...noticias].map((o) => o.id));
      for (const c of cierres) db.registrarHito(c.id, c.hito);
    } catch (e) {
      log.error(`No pude enviar el correo: ${e.message}`);
    }
  } else {
    log.aviso('Correo no configurado: se marca igual lo revisado para no repetir manana.');
    db.marcarAvisado([...nuevas, ...noticias].map((o) => o.id));
    for (const c of cierres) db.registrarHito(c.id, c.hito);
  }

  // Push: solo lo urgente y lo excelente, y no de madrugada.
  if (!enHorasDeSilencio()) {
    const hitosPush = A.pushEnHitosDeCierre || [7, 3, 1];
    const urgentes = cierres.filter((c) => hitosPush.includes(c.hito)).slice(0, 3);
    for (const u of urgentes) {
      await push(`Cierra en ${diasHasta(u.fecha_limite)} dias`, `${u.titulo}\n${u.fuente_nombre}`, u.url, 'high');
    }
    const top = nuevas.filter((o) => o.puntaje >= (A.umbralPush ?? 55)).slice(0, A.maxPushPorEjecucion ?? 4);
    for (const o of top) {
      await push('Oportunidad de peso', `${o.titulo}\n${o.fuente_nombre} · ${textoPlazo(o.fecha_limite)}`, o.url);
    }
  }

  return { enviado: true, nuevas: nuevas.length, cierres: cierres.length };
}

/**
 * Resumen mensual del horizonte: que se viene en los proximos 12 meses.
 * Los ciclos grandes (OIEA, becas ANID, congresos) se preparan con casi un ano
 * de anticipacion, asi que esta vista es la que permite planificar.
 */
export async function avisarHorizonte(meses = 12) {
  if (A.resumenMensualHorizonte === false) return { enviado: false };
  const filas = db.horizonte(meses);
  if (!filas.length) return { enviado: false };

  const porMes = new Map();
  for (const o of filas) {
    const clave = o.fecha_limite.slice(0, 7);
    if (!porMes.has(clave)) porMes.set(clave, []);
    porMes.get(clave).push(o);
  }

  const nombreMes = (clave) => {
    const [a, m] = clave.split('-').map(Number);
    return `${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][m - 1]} ${a}`;
  };

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:680px;margin:0 auto;color:#222">
    <h2 style="margin:0 0 4px">Horizonte de los proximos ${meses} meses</h2>
    <p style="color:#666;font-size:13px">${filas.length} plazos por delante. Lo que se posterga en marzo se pierde en octubre.</p>
    ${[...porMes.entries()].map(([mes, items]) => `
      <h3 style="margin:22px 0 8px;color:#14375e;border-bottom:1px solid #ddd;padding-bottom:4px">${nombreMes(mes)} · ${items.length}</h3>
      ${items.slice(0, 12).map(tarjetaHtml).join('')}
      ${items.length > 12 ? `<p style="font-size:12px;color:#888">y ${items.length - 12} mas en el panel</p>` : ''}
    `).join('')}
  </div>`;

  const texto = [...porMes.entries()]
    .map(([mes, items]) => `\n${nombreMes(mes).toUpperCase()}\n` + items.map(tarjetaTexto).join(''))
    .join('');

  if (!hayCorreo) {
    log.aviso('Horizonte listo pero no hay correo configurado.');
    return { enviado: false };
  }
  await sendMail(
    { ...env.smtp, from: env.smtp.user, to: env.smtp.destino },
    { subject: `Radar: que se viene en los proximos ${meses} meses`, text: texto, html }
  );
  log.info(`Resumen de horizonte enviado (${filas.length} plazos).`);
  return { enviado: true, total: filas.length };
}

/** Correo de prueba para verificar que las claves quedaron bien. */
export async function probarAvisos() {
  if (!hayCorreo) {
    log.aviso('No hay correo configurado en .env (SMTP_HOST, SMTP_USER, SMTP_PASS, CORREO_DESTINO).');
  } else {
    await sendMail(
      { ...env.smtp, from: env.smtp.user, to: env.smtp.destino },
      {
        subject: 'Radar de crecimiento profesional: prueba de correo',
        text: 'Si lees esto, el correo del radar quedo funcionando.',
        html: '<p>Si lees esto, el correo del radar quedo funcionando.</p>',
      }
    );
    log.info(`Correo de prueba enviado a ${env.smtp.destino}`);
  }
  await push('Radar de crecimiento', 'Prueba de aviso al telefono.', `http://localhost:${env.puertoPanel}`);
  log.info('Prueba de push enviada (si hay canal configurado).');
}
