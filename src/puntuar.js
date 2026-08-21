// Cuanto vale para TI cada oportunidad.
//
// El puntaje ordena el panel y decide que entra al correo y que suena en el
// telefono. Todos los pesos salen de config.json: aca no hay numeros magicos.

import { config } from './config.js';
import { diasHasta } from './util.js';

const P = config.puntajes || {};
const INTERESES = config.intereses || {};

export function puntuar(o) {
  const detalle = [];
  let total = 0;
  const sumar = (puntos, motivo) => {
    if (!puntos) return;
    total += puntos;
    detalle.push({ puntos, motivo });
  };

  // ── Areas: lo que mas manda ──────────────────────────────
  const areas = o.areas || [];
  const pesoMax = areas.reduce((max, a) => Math.max(max, INTERESES[a] ?? 0), 0);
  if (areas.length) {
    // Si el area no salio del texto sino de la fuente ("esto es de una marca de
    // radioterapia, asi que sera de radioterapia"), vale la mitad: es un
    // supuesto, no un dato.
    const factor = o.areaInferida ? 0.5 : 1;
    sumar(
      Math.round((P.porPesoDeInteres || 8) * pesoMax * factor),
      `area de interes: ${areas[0]} (peso ${pesoMax})${o.areaInferida ? ', supuesta por la fuente' : ''}`
    );
    const segundo = areas.slice(1).reduce((max, a) => Math.max(max, INTERESES[a] ?? 0), 0);
    if (segundo >= 2 && !o.areaInferida) sumar(3, `tambien toca ${areas[1]}`);
    if (pesoMax === 0) sumar(P.penalizacionInteresCero || -25, 'ninguna de sus areas te interesa hoy');
  } else {
    // Convocatoria generica de una fuente que importa (ANID abriendo becas sin
    // decir de que disciplina). Entra, pero sin el empujon del area.
    sumar(-2, 'no dice de que area es');
  }

  // ── Fuente ───────────────────────────────────────────────
  if (o.prioridadFuente === 'alta') sumar(P.fuentePrioridadAlta || 12, 'fuente prioritaria');
  else if (o.prioridadFuente === 'media') sumar(P.fuentePrioridadMedia || 6, 'fuente relevante');

  // ── Plata y acceso ───────────────────────────────────────
  if (o.financiamiento) sumar(P.traeFinanciamiento || 18, 'menciona beca, viaticos o financiamiento');
  if (o.costo === 'gratis') sumar(P.esGratis || 10, 'sin costo');
  if (o.modalidad === 'online' || o.modalidad === 'hibrido') sumar(P.esOnline || 8, 'se puede hacer a distancia');

  // ── Geografia ────────────────────────────────────────────
  if (o.lugar === 'Chile') sumar(P.esEnChile || 14, 'es en Chile');
  else if (o.banderas?.mencionaChile) sumar(P.abiertoAChile || 10, 'menciona a Chile');
  else if (o.banderas?.mencionaLatam) sumar(P.esLatam || 8, 'actividad regional latinoamericana');

  // ── Idioma ───────────────────────────────────────────────
  const mios = config.perfil?.idiomas || ['es', 'en'];
  if (o.idioma && mios.includes(o.idioma)) sumar(P.idiomaQueManejas || 5, `en ${o.idioma}, idioma que manejas`);
  else if (o.idioma) sumar(P.idiomaQueNoManejas || -6, `en ${o.idioma}, idioma que no declaraste`);

  // ── Tu caso particular: ensenar ──────────────────────────
  if (o.formacionDeFormadores && config.perfil?.docencia) {
    sumar(P.formacionDeFormadores || 16, 'formacion de formadores: justo tu perfil docente');
  }

  // ── Tipo ─────────────────────────────────────────────────
  if (o.tipo === 'beca' || o.tipo === 'pasantia') sumar(6, 'es una beca o pasantia');
  if (o.tipo === 'call-abstracts') sumar(5, 'puedes presentar trabajo');
  // Una guia o un informe tecnico se lee, no se postula. Vale, pero abajo.
  if (o.tipo === 'publicacion') sumar(-20, 'es un documento para leer, no una actividad');
  if (o.certificaCreditos) sumar(P.certificaCreditos || 4, 'entrega certificacion o creditos');

  // ── Es esto algo a lo que se pueda entrar ────────────────
  // Un titular sin ficha detras no puede rankear como un curso que publico su
  // programa, su arancel y su fecha de cierre.
  if (o.pista && o.anuncio) sumar(-10, 'es una noticia, pero anuncia algo a lo que se puede entrar');
  else if (o.pista) sumar(-28, 'es prensa del gremio: no hay nada que postular');
  if (o.historico) sumar(-30, 'es archivo de ediciones pasadas, no algo abierto');
  else if (o.retrospectiva) sumar(-22, 'parece la cronica de algo que ya paso');
  if (o.invitaAActuar) sumar(8, 'tiene una puerta abierta: se puede postular o inscribir');

  // ── Urgencia ─────────────────────────────────────────────
  // Una fecha de cierre apura. La fecha de un evento, no tanto: importa, pero
  // no es un plazo que se te vaya a pasar.
  const factorFecha = o.claseFecha === 'evento' ? 0.4 : 1;
  const urgencia = (puntos, motivo) => sumar(Math.round(puntos * factorFecha), motivo);
  const dias = diasHasta(o.fechaLimite);
  if (dias === null) {
    sumar(P.sinFechaConocida || -3, 'sin fecha limite detectada');
  } else if (dias < 0) {
    sumar(P.yaCerrado || -40, 'el plazo ya paso');
  } else if (dias <= 14) {
    urgencia(P.deadlineMuyProximo || 12, `quedan ${dias} dias`);
  } else if (dias <= 45) {
    urgencia(P.deadlineProximo || 6, `quedan ${dias} dias`);
  } else {
    urgencia(P.deadlineLejano || 2, 'plazo holgado');
  }

  // ── Semaforo de elegibilidad ─────────────────────────────
  if (o.semaforo === 'rojo') sumar(-18, 'parece no aplicar a tu perfil');
  else if (o.semaforo === 'amarillo') sumar(-4, 'tiene condiciones que revisar');
  else if (o.semaforo === 'verde') sumar(4, 'sin peros visibles para tu perfil');

  // Lo estimado por calendario vale, pero menos que lo confirmado en la fuente.
  if (o.esSemilla) sumar(-6, 'fecha estimada del ciclo historico, no confirmada');

  return { puntaje: Math.round(total), detalle };
}
