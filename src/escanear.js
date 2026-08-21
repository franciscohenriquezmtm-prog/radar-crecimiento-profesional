// El escaneo: recorre el catalogo, arma las fichas y las guarda.
//
// Reglas de la casa:
//   - Una fuente que falla no puede botar el escaneo completo.
//   - Se prueban todas las estrategias de una fuente hasta que una entregue algo.
//   - Nada se descarta por elegibilidad: solo se comenta.

import fs from 'node:fs';
import path from 'node:path';
import { config, DIR_DATOS, fuentesActivas } from './config.js';
import { ejecutarEstrategia } from './lectores.js';
import { pedir } from './http.js';
import * as db from './db.js';
import { areasDe, esArchivoHistorico, tipoDe, valeLaPena } from './clasificar.js';
import {
  costoEn, detalleDelFinanciamiento, esFormacionDeFormadores, fechaEventoEn, fechaLimiteEn, idiomaEn,
  anunciaUnaOportunidad, invitaAActuar, lugarEn, modalidadEn, pareceRetrospectiva, traeFinanciamiento,
} from './extraer.js';
import { evaluar } from './elegibilidad.js';
import { puntuar } from './puntuar.js';
import { oportunidadesSemilla } from './calendario.js';
import { publicoDe, publicoEnFrasesRelevantes, resumirEnEspanol } from './resumir.js';
import { datosDeDinero, dineroEnHtml, frasesDeContenido, fusionarDinero, textoPrincipal } from './contenido.js';
import { aTextoPlano, descripcionDeclarada, frasesQueDescriben, hash, limpiarResumen, log, parecido, recortar, urlCanonica } from './util.js';

const CFG = config.escaneo || {};

/**
 * Las busquedas de noticias entregan la misma nota con direcciones distintas
 * segun la consulta que la encontro. Para esas, la identidad es el titulo.
 */
function identidadDe(item) {
  if (item.url.includes('news.google.com') || item.url.includes('bing.com/news')) {
    return `op-${hash(normalizarTitulo(item.titulo))}`;
  }
  return `op-${hash(item.url)}`;
}

const normalizarTitulo = (t) => String(t || '').toLowerCase().replace(/\s+-\s+[^-]{3,40}$/, '').replace(/\W+/g, ' ').trim();

function fichaDesde(item, fuente, textoDetalle, descripcion0 = '', dineroTabla = null) {
  // Dos textos, con roles distintos y a proposito:
  //   corto = titulo y bajada. Es lo que la fuente dice que ES esto.
  //   largo = la ficha completa. Sirve para fechas y requisitos, pero tambien
  //           arrastra menus y pies de pagina, asi que no puede decidir el tema.
  const titulo = String(item.titulo || '').replace(/\s+/g, ' ').trim();
  const textoCorto = [titulo, item.resumen || descripcion0].filter(Boolean).join('. ');
  const textoLargo = [textoCorto, textoDetalle].filter(Boolean).join('\n');

  // El titulo manda: es lo que la fuente eligio para nombrar la cosa. Recien
  // despues se mira la bajada, y al final el cuerpo, que menciona de todo.
  const tipo = tipoDe(titulo) || tipoDe(textoCorto) || tipoDe(textoLargo) || fuente.tipo || null;

  // Archivo de ediciones pasadas: se guarda, pero aparte.
  const historico = esArchivoHistorico(titulo) || pareceRetrospectiva(titulo);

  // Pista de prensa: llego por la busqueda de noticias, no por la pagina de la
  // institucion. El radar solo ve el titular, asi que no puede competir de igual
  // a igual con una ficha que si publica su programa.
  const pista = String(item.url || '').includes('news.google');
  // Una noticia que anuncia un curso o una beca vale mucho mas que una cronica
  // del gremio, aunque las dos lleguen por el mismo camino.
  const anuncio = pista && anunciaUnaOportunidad(textoCorto);


  let areas = areasDe(textoCorto);
  let areaInferida = false;
  if (!areas.length && !fuente.amplia) {
    // El cuerpo de la ficha solo se toma en cuenta en fuentes especializadas, y
    // exigiendo dos coincidencias. En un catalogo universitario cualquier pagina
    // menciona "docente" y "academico" en el menu: por ahi se colaban diplomados
    // de Power BI clasificados como oportunidades de radioterapia.
    areas = areasDe(textoLargo, { minimo: 2 });
  }
  if (!areas.length && !fuente.amplia && fuente.areas?.length && tipo) {
    areas = [...fuente.areas];
    areaInferida = true;
  }

  if (!valeLaPena({ texto: textoCorto, titulo, tipo, areas, prioridadFuente: fuente.prioridad, grupoFuente: fuente.grupo })) {
    return null;
  }

  // Fechas, lugar y requisitos si se pueden leer del cuerpo: son datos, no temas.
  const limite = fechaLimiteEn(textoLargo);
  const evento = limite ? null : fechaEventoEn(textoLargo);
  const modalidad = modalidadEn(textoCorto) !== 'desconocida' ? modalidadEn(textoCorto) : modalidadEn(textoLargo);
  const costo = costoEn(textoCorto) !== 'desconocido' ? costoEn(textoCorto) : costoEn(textoLargo);
  // Adivinar el idioma leyendo el texto se equivoca seguido: la pagina de una
  // sociedad chilena tiene menus y nombres propios en ingles. Lo que declara la
  // fuente en el catalogo es mas confiable, y solo se adivina si no lo declara.
  const idioma = fuente.idioma || idiomaEn(textoCorto) || idiomaEn(textoLargo) || 'en';
  const lugar = lugarEn(textoCorto) || lugarEn(textoLargo);

  // Lo que sube el puntaje se lee solo del texto corto: "beca" en el menu de una
  // universidad no convierte un diplomado cualquiera en una oportunidad becada.
  const financiamiento = traeFinanciamiento(textoCorto);
  const detalleFinanciamiento = financiamiento ? detalleDelFinanciamiento(textoLargo) : [];
  const formadores = esFormacionDeFormadores(textoCorto);

  const eleg = evaluar({ texto: textoLargo, idioma, modalidad, costo, financiamiento, tipo, fuente });

  const fechaLimite = limite?.fecha || evento?.fecha || null;
  const claseFecha = limite ? 'limite' : evento ? 'evento' : null;
  const estimada = limite?.estimada || evento?.estimada || false;

  const { puntaje, detalle } = puntuar({
    areas,
    areaInferida,
    tipo,
    prioridadFuente: fuente.prioridad,
    costo,
    financiamiento,
    modalidad,
    lugar,
    banderas: eleg.banderas,
    idioma,
    formacionDeFormadores: formadores,
    certificaCreditos: /\b(certificado|certificate|creditos|credits|cme|cpd)\b/i.test(textoCorto),
    fechaLimite,
    claseFecha,
    historico,
    pista,
    anuncio,
    retrospectiva: pareceRetrospectiva(textoCorto),
    invitaAActuar: invitaAActuar(textoLargo),
    semaforo: eleg.semaforo,
    esSemilla: false,
  });

  // Primero el titulo y la bajada; si ahi no dice, se buscan las frases del
  // cuerpo que hablan explicitamente de a quien va dirigido.
  const publico = publicoDe(textoCorto).length ? publicoDe(textoCorto) : publicoEnFrasesRelevantes(textoLargo);

  // De que trata, dicho por la fuente misma. Es lo que ninguna heuristica puede
  // inventar: la descripcion propia de la actividad.
  const descripcion = recortar(descripcion0 || frasesQueDescriben(item.resumen || '') || frasesQueDescriben(textoDetalle || ''), 420);

  // De que trata y cuanto cuesta, en palabras de la fuente. Cuando la pagina no
  // lo publica quedan vacios, y el resumen lo dice explicitamente.
  const contenido = frasesDeContenido(textoDetalle || item.resumen || '', 420);
  const dinero = fusionarDinero(dineroTabla, datosDeDinero(textoDetalle || item.resumen || ''));

  const ficha = {
    id: identidadDe(item),
    url: item.url,
    titulo: recortar(titulo, 240),
    resumen: recortar(limpiarResumen(item.resumen || descripcion || textoDetalle || '', titulo), 700),
    descripcion,
    contenido,
    dinero,
    texto: recortar(textoDetalle || item.resumen || '', 4000),
    fuente_id: fuente.id,
    fuente_nombre: fuente.nombre,
    grupo: fuente.grupo,
    organizacion: fuente.nombre.split('·')[0].trim(),
    tipo,
    areas,
    idioma,
    pais: fuente.pais || null,
    lugar: lugar || item.lugar || null,
    modalidad,
    costo,
    financiamiento: financiamiento ? 1 : 0,
    fecha_inicio: evento?.fecha || null,
    fecha_fin: null,
    fecha_limite: fechaLimite,
    fecha_estimada: estimada ? 1 : 0,
    clase_fecha: claseFecha,
    fecha_publicacion: item.fecha ? String(item.fecha).slice(0, 30) : null,
    puntaje,
    puntaje_detalle: detalle,
    semaforo: eleg.semaforo,
    elegibilidad: eleg,
    es_semilla: 0,
    historico: historico ? 1 : 0,
    pista: pista ? 1 : 0,
    anuncio: anuncio ? 1 : 0,
    publico,
  };

  // El resumen en espanol se arma al final, cuando ya estan todos los datos.
  // El resumen mira el texto corto: el cuerpo completo de la pagina mete temas
  // que no son del curso sino del menu del sitio.
  ficha.resumen_es = resumirEnEspanol({ ...ficha, elegibilidad: eleg, detalleFinanciamiento, historico, pista, anuncio, textoParaTemas: textoCorto });
  return ficha;
}

async function escanearFuente(fuente, presupuesto) {
  let resultado = null;
  let usada = null;
  let ultimoError = '';

  for (const estrategia of fuente.estrategias) {
    try {
      const r = await ejecutarEstrategia(estrategia);
      if (r.items?.length) {
        resultado = r;
        usada = `${estrategia.tipo}: ${estrategia.url}`;
        break;
      }
      ultimoError = r.error || 'sin resultados';
    } catch (e) {
      ultimoError = e.message;
    }
  }

  if (!resultado) {
    db.registrarSalud(fuente, { ok: false, error: ultimoError });
    log.aviso(`${fuente.nombre}: ${ultimoError}`);
    return { nuevos: 0, actualizados: 0, ok: false };
  }

  let nuevos = 0;
  let actualizados = 0;
  let detallesPedidos = 0;
  const maxDetalles = fuente.detalleAmplio ? 120 : (CFG.maxPaginasDetallePorFuente ?? 12);

  for (const item of resultado.items) {
    if (presupuesto.agotado()) break;
    const url = urlCanonica(item.url);
    if (!url) continue;

    const previo = db.filaPorUrl(url);
    const yaEstaba = Boolean(previo);
    // Una ficha vieja sin descripcion propia se vuelve a abrir una vez: es el
    // dato que responde "de que trata", y antes no se guardaba.
    // Se vuelve a abrir cuando falta contenido, o cuando no se le pudo leer
    // ningun monto: los aranceles viven en tablas y antes no se leian.
    const sinMonto = (() => {
      try { return !(JSON.parse(previo?.dinero || '{}').montos || []).length; } catch { return true; }
    })();
    const faltaContenido = yaEstaba && (!previo.contenido || !previo.descripcion || sinMonto);

    // Abrir la ficha completa solo vale la pena para lo que no conocemos.
    let textoDetalle = '';
    let descripcion = '';
    let dineroTabla = null;
    const preliminar = `${item.titulo} ${item.resumen || ''}`;
    const prometedor = areasDe(preliminar).length > 0 || Boolean(tipoDe(preliminar, fuente.tipo));

    // Las direcciones de Google Noticias son redirecciones opacas: abrirlas no
    // aporta texto, solo tiempo.
    const esRedireccion = url.includes('news.google.com');

    if (fuente.detalle !== false && !esRedireccion && (!yaEstaba || faltaContenido) && prometedor && detallesPedidos < maxDetalles) {
      detallesPedidos++;
      const r = await pedir(url, { maxEdadHoras: 24 * 7 });
      if (r.ok) {
        descripcion = descripcionDeclarada(r.cuerpo);
        // Los aranceles viven en tablas: se leen del HTML antes de aplanarlo.
        dineroTabla = dineroEnHtml(r.cuerpo);
        // Solo la region principal: sin menus, sin banner de cookies, sin pie.
        // Es la diferencia entre leer la pagina y leer la maqueta de la pagina.
        textoDetalle = recortar(textoPrincipal(r.cuerpo), 12000);
      }
    }

    const ficha = fichaDesde({ ...item, url }, fuente, textoDetalle, descripcion, dineroTabla);
    if (!ficha) continue;

    const estado = db.guardar(ficha);
    if (estado === 'nuevo') nuevos++;
    else if (estado === 'actualizado') actualizados++;
  }

  db.registrarSalud(fuente, { ok: true, estrategia: usada, items: resultado.items.length });
  log.info(`${fuente.nombre}: ${resultado.items.length} enlaces, ${nuevos} nuevas`);
  return { nuevos, actualizados, ok: true };
}

/** Quita las semillas que ya fueron confirmadas por una fuente real. */
function limpiarSemillasDuplicadas() {
  const semillas = db.listar({ limite: 500 }).filter((o) => o.es_semilla);
  const reales = db.listar({ limite: 2000 }).filter((o) => !o.es_semilla && o.fecha_limite);
  let quitadas = 0;
  for (const s of semillas) {
    const gemela = reales.find((r) => {
      if (parecido(r.titulo, s.titulo) < 0.5) return false;
      if (!r.fecha_limite || !s.fecha_limite) return false;
      const dif = Math.abs(new Date(r.fecha_limite) - new Date(s.fecha_limite)) / 86400000;
      return dif <= 75;
    });
    if (gemela) {
      db.db.prepare('DELETE FROM oportunidades WHERE id = ?').run(s.id);
      quitadas++;
    }
  }
  return quitadas;
}

/**
 * Copia de seguridad antes de tocar nada.
 *
 * Un escaneo escribe, borra vencidas y reclasifica. Si algo sale mal a medias,
 * conviene poder volver atras. Se guarda la copia del escaneo anterior en
 * datos/radar-respaldo.db: si un dia el panel amanece raro, basta con
 * renombrarla a radar.db.
 *
 * Se usa VACUUM INTO y no una copia del archivo: con el modo WAL, copiar el
 * .db a secas puede dejar afuera lo ultimo escrito.
 */
function respaldarBase() {
  try {
    const cuantas = db.db.prepare('SELECT COUNT(*) n FROM oportunidades').get().n;
    if (!cuantas) return;
    const destino = path.join(DIR_DATOS, 'radar-respaldo.db');
    fs.rmSync(destino, { force: true });
    db.db.exec(`VACUUM INTO '${destino.replace(/\\/g, '/').replace(/'/g, "''")}'`);
    log.detalle(`respaldo de ${cuantas} fichas en radar-respaldo.db`);
  } catch (e) {
    log.aviso(`no se pudo respaldar la base: ${e.message}`);
  }
}

export async function escanear({ profundo = false } = {}) {
  respaldarBase();
  const inicio = Date.now();
  const limiteMs = (CFG.maxMinutosPorEjecucion ?? 35) * 60000;
  const presupuesto = { agotado: () => Date.now() - inicio > limiteMs };

  const ejecucion = db.abrirEjecucion();
  let nuevos = 0;
  let actualizados = 0;
  let fuentesOk = 0;
  let fuentesMal = 0;

  // 1. Calendario semilla: barato y siempre disponible.
  const semillas = oportunidadesSemilla();
  for (const s of semillas) {
    if (db.guardar(s) === 'nuevo') nuevos++;
  }
  if (semillas.length) log.info(`Calendario semilla: ${semillas.length} ciclos proyectados`);

  // 2. Fuentes reales.
  const fuentes = fuentesActivas();
  log.titulo(`Escaneando ${fuentes.length} fuentes`);

  for (const fuente of fuentes) {
    if (presupuesto.agotado()) {
      log.aviso(`Se acabo el tiempo asignado (${CFG.maxMinutosPorEjecucion} min). Quedaron fuentes sin revisar; la proxima ejecucion parte por ellas.`);
      break;
    }
    // En modo profundo se abren muchas mas fichas por fuente: es lo que se usa
    // para rellenar datos que antes no se guardaban.
    const copia = profundo ? { ...fuente, detalle: true, detalleAmplio: true } : fuente;
    try {
      const r = await escanearFuente(copia, presupuesto);
      nuevos += r.nuevos;
      actualizados += r.actualizados;
      if (r.ok) fuentesOk++; else fuentesMal++;
    } catch (e) {
      fuentesMal++;
      db.registrarSalud(fuente, { ok: false, error: e.message });
      log.error(`${fuente.nombre}: ${e.message}`);
    }
  }

  const semillasQuitadas = limpiarSemillasDuplicadas();
  const archivadas = db.archivarVencidas(CFG.diasConservarCerradas ?? 120);
  db.limpiarCache(30);

  db.cerrarEjecucion(ejecucion, {
    nuevos, actualizados, fuentesOk, fuentesMal,
    nota: `${semillasQuitadas} semillas confirmadas por fuente real, ${archivadas} vencidas archivadas`,
  });

  return { nuevos, actualizados, fuentesOk, fuentesMal, archivadas, semillasQuitadas, minutos: Math.round((Date.now() - inicio) / 60000) };
}
