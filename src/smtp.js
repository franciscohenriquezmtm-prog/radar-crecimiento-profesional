// Cliente SMTP minimo sobre node:tls. Lo justo para mandarte un correo a ti
// mismo desde Gmail, Outlook o cualquier servidor con TLS directo (puerto 465)
// o STARTTLS (587). Escrito a mano para no arrastrar dependencias.
//
// La conversacion con el servidor es estrictamente por turnos: se manda un
// comando, se espera su respuesta completa, se revisa el codigo, se manda el
// siguiente. Nada de maquinas de pasos: es donde se esconden los errores de
// secuencia (mandar AUTH antes del saludo, por ejemplo).

import tls from 'node:tls';
import net from 'node:net';

const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64');

/** Envuelve un socket para poder mandar comandos y esperar respuestas. */
function conversacion(socket, timeoutMs = 20000) {
  let pendiente = null;
  let acumulado = '';

  const revisar = () => {
    if (!pendiente) return;
    // Una respuesta SMTP termina en una linea "NNN texto", sin guion tras el codigo.
    const lineas = acumulado.split(/\r?\n/).filter(Boolean);
    const ultima = lineas[lineas.length - 1];
    if (!ultima || !/^\d{3}(?: |$)/.test(ultima)) return;
    const respuesta = acumulado;
    acumulado = '';
    const { resolver, temporizador } = pendiente;
    pendiente = null;
    clearTimeout(temporizador);
    resolver({ codigo: parseInt(ultima.slice(0, 3), 10), texto: respuesta });
  };

  socket.setEncoding('utf8');
  socket.on('data', (trozo) => { acumulado += trozo; revisar(); });
  socket.on('error', (e) => {
    if (!pendiente) return;
    const { rechazar, temporizador } = pendiente;
    pendiente = null;
    clearTimeout(temporizador);
    rechazar(e);
  });

  /** Espera la proxima respuesta del servidor. */
  const esperar = () =>
    new Promise((resolver, rechazar) => {
      const temporizador = setTimeout(() => {
        pendiente = null;
        rechazar(new Error('SMTP: el servidor no respondio a tiempo'));
      }, timeoutMs);
      pendiente = { resolver, rechazar, temporizador };
      revisar();
    });

  /**
   * Manda un comando y valida el codigo de respuesta.
   * @param {string|null} comando  null = solo esperar (por ejemplo el saludo inicial)
   */
  const decir = async (comando, esperados, etiqueta) => {
    const promesa = esperar();
    if (comando !== null) socket.write(comando + '\r\n');
    const r = await promesa;
    if (esperados && !esperados.includes(r.codigo)) {
      throw new Error(`SMTP ${r.codigo} en ${etiqueta || comando || 'saludo'}: ${r.texto.trim().slice(0, 200)}`);
    }
    return r;
  };

  return { decir };
}

function codificarCabecera(valor) {
  // RFC 2047, para asuntos con tildes.
  return /^[\x20-\x7E]*$/.test(valor) ? valor : `=?UTF-8?B?${b64(valor)}?=`;
}

function armarMensaje({ de, para, asunto, texto, html }) {
  const frontera = 'rdr_' + b64(String(para) + asunto).replace(/\W/g, '').slice(0, 24);
  const cabeceras = [
    `From: ${de}`,
    `To: ${para}`,
    `Subject: ${codificarCabecera(asunto)}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${frontera}"`,
  ];
  const cuerpo = [
    `--${frontera}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64', '',
    b64(texto || '').replace(/(.{76})/g, '$1\r\n'), '',
    `--${frontera}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64', '',
    b64(html || `<pre>${texto || ''}</pre>`).replace(/(.{76})/g, '$1\r\n'), '',
    `--${frontera}--`, '',
  ];
  // Una linea que empieza con punto cerraria el mensaje antes de tiempo.
  return [...cabeceras, '', ...cuerpo].join('\r\n').replace(/\r\n\./g, '\r\n..');
}

function conectar(opciones, seguro) {
  return new Promise((resolver, rechazar) => {
    const socket = seguro ? tls.connect(opciones) : net.connect(opciones);
    socket.once(seguro ? 'secureConnect' : 'connect', () => resolver(socket));
    socket.once('error', rechazar);
  });
}

export async function sendMail(cfg, { subject, text, html }) {
  const { host, port = 465, secure = true, user, pass, from, to } = cfg;
  if (!host || !user || !pass || !to) {
    throw new Error('Configuracion de correo incompleta: faltan host, usuario, clave o destinatario');
  }
  const remitente = from || user;
  const destinatarios = String(to).split(/[,;]/).map((d) => d.trim()).filter(Boolean);
  const saludo = 'radar-crecimiento';

  let socket = await conectar({ host, port, servername: host }, secure);
  let charla = conversacion(socket);

  try {
    await charla.decir(null, [220], 'saludo del servidor');
    await charla.decir(`EHLO ${saludo}`, [250], 'EHLO');

    if (!secure) {
      // Puerto 587: se negocia el cifrado y se vuelve a saludar sobre el canal nuevo.
      await charla.decir('STARTTLS', [220], 'STARTTLS');
      const plano = socket;
      socket = tls.connect({ socket: plano, servername: host });
      await new Promise((res, rej) => {
        socket.once('secureConnect', res);
        socket.once('error', rej);
      });
      charla = conversacion(socket);
      await charla.decir(`EHLO ${saludo}`, [250], 'EHLO tras STARTTLS');
    }

    await charla.decir('AUTH LOGIN', [334], 'AUTH LOGIN');
    await charla.decir(b64(user), [334], 'usuario');
    await charla.decir(b64(pass), [235], 'contrasena');

    await charla.decir(`MAIL FROM:<${remitente}>`, [250], 'MAIL FROM');
    for (const d of destinatarios) {
      await charla.decir(`RCPT TO:<${d}>`, [250, 251], `RCPT TO ${d}`);
    }
    await charla.decir('DATA', [354], 'DATA');
    await charla.decir(
      armarMensaje({ de: remitente, para: destinatarios.join(', '), asunto: subject, texto: text, html }) + '\r\n.',
      [250],
      'envio del mensaje'
    );

    try { await charla.decir('QUIT', [221], 'QUIT'); } catch { /* da lo mismo como se despida */ }
    return true;
  } finally {
    try { socket.end(); socket.destroy(); } catch { /* ya estaba cerrado */ }
  }
}
