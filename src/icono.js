// Genera el icono del panel como PNG, sin librerias.
//
// iOS solo acepta PNG para el icono de la pantalla de inicio: un SVG lo ignora
// y deja una captura borrosa de la pagina. Como el proyecto no tiene
// dependencias, el PNG se arma a mano: pixeles crudos, deflate con node:zlib y
// los tres trozos que exige el formato (IHDR, IDAT, IEND).
//
// El dibujo son tres arcos de radar sobre fondo teal, que es la paleta del
// panel: se reconoce chico, que es lo unico que importa en una pantalla de
// inicio llena de iconos.

import zlib from 'node:zlib';

const CRC = (() => {
  const tabla = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c;
  }
  return (buf) => {
    let c = -1;
    for (const b of buf) c = tabla[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function trozo(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'latin1'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

/**
 * @param {number} lado pixeles por lado
 * @returns {Buffer} el PNG completo
 */
export function iconoPng(lado = 180) {
  const FONDO = [13, 91, 115];      // teal de la barra del panel
  const TRAZO = [235, 245, 248];    // casi blanco
  const PUNTO = [201, 138, 0];      // ambar: el "eco" del radar

  const filas = [];
  const centroX = lado * 0.5;
  const centroY = lado * 0.62;
  const grosor = Math.max(2, lado * 0.035);

  for (let y = 0; y < lado; y++) {
    // Cada fila de un PNG empieza con el byte de filtro (0 = sin filtro).
    const fila = Buffer.alloc(1 + lado * 3);
    for (let x = 0; x < lado; x++) {
      const dx = x - centroX;
      const dy = y - centroY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let color = FONDO;
      // Tres arcos concentricos, solo en la mitad de arriba.
      if (dy <= 0) {
        for (const radio of [lado * 0.16, lado * 0.29, lado * 0.42]) {
          if (Math.abs(dist - radio) < grosor / 2) color = TRAZO;
        }
      }
      // El punto detectado, arriba a la derecha.
      const px = centroX + lado * 0.22;
      const py = centroY - lado * 0.26;
      if (Math.sqrt((x - px) ** 2 + (y - py) ** 2) < lado * 0.055) color = PUNTO;
      // La antena.
      if (Math.abs(dx) < grosor / 2 && dy > -lado * 0.08 && dy < lado * 0.16) color = TRAZO;

      const i = 1 + x * 3;
      fila[i] = color[0];
      fila[i + 1] = color[1];
      fila[i + 2] = color[2];
    }
    filas.push(fila);
  }

  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(lado, 0);
  cabecera.writeUInt32BE(lado, 4);
  cabecera[8] = 8;   // bits por canal
  cabecera[9] = 2;   // color verdadero (RGB)

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', cabecera),
    trozo('IDAT', zlib.deflateSync(Buffer.concat(filas), { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}

export function iconoDataUri(lado = 180) {
  return `data:image/png;base64,${iconoPng(lado).toString('base64')}`;
}
