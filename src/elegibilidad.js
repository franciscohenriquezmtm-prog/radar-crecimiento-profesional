// El comentario de "¿puedo yo?".
//
// Regla de la casa: NUNCA se descarta nada. Esto solo pinta un semaforo y
// escribe una frase honesta sobre que tan realista es para tu perfil.
//
//   verde    = te calza sin peros evidentes
//   amarillo = puedes, pero hay un tramite, un requisito o una duda
//   rojo     = parece que no aplica a tu caso; igual queda en el panel

import { config } from './config.js';
import { banderasDeRequisito, requisitosEn } from './extraer.js';

const perfil = config.perfil || {};

export function evaluar({ texto, idioma, modalidad, costo, financiamiento, tipo, fuente }) {
  const b = banderasDeRequisito(texto || '');
  const notas = [];
  let semaforo = 'verde';

  const bajarA = (nivel) => {
    const orden = { verde: 0, amarillo: 1, rojo: 2 };
    if (orden[nivel] > orden[semaforo]) semaforo = nivel;
  };

  if (b.mencionaTecnologos) {
    notas.push('Menciona expresamente a tecnologos medicos o radiographers: es para tu profesion.');
  }

  if (b.dirigidoAOtraProfesion && !b.mencionaTecnologos) {
    bajarA('amarillo');
    notas.push('El texto apunta a medicos o fisicos medicos. No lo descartes: en varias actividades del OIEA y de las sociedades los tecnologos medicos entran igual, sobre todo con experiencia clinica. Vale preguntar por correo.');
  }

  if (b.pideNominacionGobierno) {
    bajarA('amarillo');
    notas.push('Requiere postular a traves del canal oficial del pais, no en forma directa. En Chile eso significa la CCHEN, que es la Autoridad Nacional de Enlace ante el OIEA. Conviene tener el contacto hecho antes de que se abra el plazo.');
  }

  if (b.pidePostgrado && perfil.tienePostgrado === false) {
    bajarA('amarillo');
    notas.push('Menciona magister o doctorado entre los requisitos. Si es un requisito duro, hoy no calificas; a veces se acepta experiencia equivalente.');
  }

  if (b.pideExperiencia) {
    notas.push(`Pide una cantidad minima de anos de experiencia. Tu perfil declara ${perfil.aniosExperiencia ?? '?'} anos: revisa el numero exacto en la ficha.`);
  }

  if (b.restriccionGeografica && !b.mencionaChile && !b.mencionaLatam) {
    bajarA('rojo');
    notas.push('Parece limitado a residentes o nacionales de otra region. Queda listado igual por si abren cupos internacionales, pero es poco probable.');
  }

  if (b.mencionaChile) {
    notas.push('Menciona a Chile.');
  } else if (b.mencionaLatam) {
    notas.push('Es una actividad regional para America Latina y el Caribe: Chile entra.');
  }

  const idiomasQueManejo = perfil.idiomas || ['es', 'en'];
  if (idioma && !idiomasQueManejo.includes(idioma)) {
    bajarA('amarillo');
    notas.push(`Esta en un idioma que no declaraste manejar (${idioma}). Revisa si hay version en ingles o espanol.`);
  }

  if (modalidad === 'online' && costo === 'gratis') {
    notas.push('Online y sin costo: no hay barrera real de entrada.');
  } else if (modalidad === 'presencial' && !financiamiento) {
    notas.push('Es presencial y no se detecta financiamiento. Considera pasajes, estadia y permiso administrativo.');
  }

  if (financiamiento) {
    notas.push('Se mencionan becas, viaticos o financiamiento. Esto es lo que hace viable viajar.');
  }

  if (tipo === 'call-abstracts') {
    notas.push('Es un envio de resumenes: la fecha que importa no es la del congreso sino la del cierre del abstract.');
  }

  if (!notas.length) {
    notas.push('No se detectaron requisitos restrictivos en el texto disponible. Confirma en la ficha oficial antes de invertir tiempo.');
  }

  return {
    semaforo,
    comentario: notas.join(' '),
    requisitos: requisitosEn(texto || '').slice(0, 4),
    banderas: b,
  };
}

export const COLOR_SEMAFORO = {
  verde: 'Te calza',
  amarillo: 'Con condiciones',
  rojo: 'Poco probable',
};
