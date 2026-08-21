// Todos los comandos del radar en un solo lugar.
//
//   node src/cli.js escanear [--profundo] [--avisar]
//   node src/cli.js avisar
//   node src/cli.js salud
//   node src/cli.js horizonte
//   node src/cli.js reclasificar
//   node src/cli.js probar-fuente <id>
//   node src/cli.js probar-avisos
//   node src/cli.js sincronizar
//   node src/cli.js reiniciar

import { catalogo, config } from './config.js';
import * as db from './db.js';
import { log, fechaBonita, frasesQueDescriben, limpiarResumen, recortar, textoPlazo } from './util.js';
import { ETIQUETAS_AREA, etiquetaTipo } from './clasificar.js';

const [, , comando = 'ayuda', ...resto] = process.argv;
const banderas = new Set(resto.filter((a) => a.startsWith('--')));
const sueltos = resto.filter((a) => !a.startsWith('--'));

async function main() {
  switch (comando) {
    case 'escanear': {
      const { escanear } = await import('./escanear.js');
      const r = await escanear({ profundo: banderas.has('--profundo') });
      log.titulo('Resultado del escaneo');
      log.info(`${r.nuevos} nuevas · ${r.actualizados} actualizadas`);
      log.info(`${r.fuentesOk} fuentes respondieron · ${r.fuentesMal} fallaron`);
      log.info(`${r.semillasQuitadas} ciclos estimados fueron confirmados por su fuente real`);
      log.info(`${r.archivadas} vencidas archivadas · ${r.minutos} minutos`);
      if (banderas.has('--avisar')) {
        const { avisar } = await import('./notificar.js');
        const a = await avisar();
        log.info(a.enviado ? `Aviso enviado: ${a.nuevas} nuevas, ${a.cierres} cierres` : 'Nada que avisar');
      }
      break;
    }

    case 'avisar': {
      const { avisar } = await import('./notificar.js');
      const a = await avisar({ forzar: banderas.has('--forzar'), seco: banderas.has('--seco') });
      if (!a.seco) log.info(a.enviado ? `Aviso enviado: ${a.nuevas} nuevas, ${a.cierres} cierres` : 'Nada que avisar');
      break;
    }

    case 'probar-avisos': {
      const { probarAvisos } = await import('./notificar.js');
      await probarAvisos();
      break;
    }

    case 'salud': {
      const filas = db.salud();
      log.titulo(`Salud de las ${filas.length} fuentes revisadas`);
      const mal = filas.filter((f) => f.fallas_seguidas > 0);
      const bien = filas.filter((f) => f.fallas_seguidas === 0 && f.ultimo_exito);
      for (const f of mal) {
        console.log(`  ✖ ${f.nombre}`);
        console.log(`      ${f.fallas_seguidas} fallas seguidas · ${(f.ultimo_error || '').slice(0, 110)}`);
      }
      console.log(`\n  ${bien.length} fuentes respondiendo bien, ${mal.length} con problemas.`);
      if (mal.length) console.log('  Arregla sus estrategias en fuentes/catalogo.json. Mientras tanto el calendario semilla cubre sus ciclos.\n');
      break;
    }

    case 'horizonte': {
      const meses = Number(sueltos[0] || 12);
      if (banderas.has('--correo')) {
        const { avisarHorizonte } = await import('./notificar.js');
        const r = await avisarHorizonte(meses);
        log.info(r.enviado ? `Horizonte enviado por correo (${r.total} plazos)` : 'Nada que enviar');
        break;
      }
      const filas = db.horizonte(meses);
      log.titulo(`Proximos ${meses} meses · ${filas.length} plazos`);
      let mesActual = '';
      for (const o of filas) {
        const mes = o.fecha_limite.slice(0, 7);
        if (mes !== mesActual) {
          mesActual = mes;
          console.log(`\n  ── ${mes} ──`);
        }
        const marca = o.fecha_estimada ? ' (estimada)' : '';
        console.log(`  ${o.fecha_limite}${marca}  ${o.titulo.slice(0, 78)}`);
        console.log(`              ${etiquetaTipo(o.tipo)} · ${o.fuente_nombre} · puntaje ${o.puntaje}`);
      }
      console.log('');
      break;
    }

    case 'reclasificar': {
      // Vuelve a puntuar todo lo guardado sin pedir nada por internet.
      // Sirve despues de cambiar los pesos en config.json.
      const { areasDe, esArchivoHistorico, tipoDe, valeLaPena } = await import('./clasificar.js');
      const { evaluar } = await import('./elegibilidad.js');
      const { puntuar } = await import('./puntuar.js');
      const ex = await import('./extraer.js');
      const { publicoDe, publicoEnFrasesRelevantes, resumirEnEspanol } = await import('./resumir.js');
      const { datosDeDinero, frasesDeContenido, fusionarDinero } = await import('./contenido.js');
      const filas = db.listar({ limite: 20000, soloAbiertas: false, historico: 'ambos', pista: 'ambos' });
      let n = 0;
      let borradas = 0;
      for (const f of filas) {
        // Mismo criterio que en el escaneo: el titulo decide el tema, el cuerpo
        // solo aporta datos.
        const corto = [f.titulo, f.resumen].filter(Boolean).join('. ');
        const largo = [corto, f.texto].filter(Boolean).join('\n');
        const fuente = catalogo.fuentes.find((x) => x.id === f.fuente_id);
        const tipo = tipoDe(f.titulo) || tipoDe(corto) || tipoDe(largo) || f.tipo;
        let areas = areasDe(corto);
        let areaInferida = false;
        if (!areas.length && !fuente?.amplia) areas = areasDe(largo, { minimo: 2 });
        if (!areas.length && fuente && !fuente.amplia && fuente.areas?.length && tipo) {
          areas = [...fuente.areas];
          areaInferida = true;
        }
        // Si con los criterios de hoy esto ya no califica, se va. Nunca se
        // borra algo que tu hayas marcado: eso es tuyo.
        const sigueSirviendo = Boolean(f.es_semilla) ||
          valeLaPena({ texto: corto, titulo: f.titulo, tipo, areas, prioridadFuente: fuente?.prioridad, grupoFuente: fuente?.grupo });
        if (!sigueSirviendo && ['nuevo', 'visto'].includes(f.estado)) {
          db.db.prepare('DELETE FROM oportunidades WHERE id = ?').run(f.id);
          borradas++;
          continue;
        }

        // El idioma tambien se corrige desde el catalogo al reprocesar.
        const idioma = fuente?.idioma || f.idioma;
        const historico = esArchivoHistorico(f.titulo) || ex.pareceRetrospectiva(f.titulo);
        const pista = String(f.url || '').includes('news.google');
        const anuncio = pista && ex.anunciaUnaOportunidad(corto);
        // Se recalcula siempre desde el texto guardado: si se reciclara lo que
        // ya estaba, las mejoras al lector no llegarian nunca a las fichas viejas.
        const material = f.texto || f.resumen || '';
        const contenido = material ? frasesDeContenido(material, 420) : (f.contenido || '');
        // Los montos que ya estaban guardados salieron de las tablas de la
        // pagina, y esas no se pueden reconstruir desde el texto plano: se
        // conservan y se les suma lo que aporte el texto.
        let guardado = null;
        try { guardado = f.dinero ? JSON.parse(f.dinero) : null; } catch { guardado = null; }
        const dinero = fusionarDinero(guardado, material ? datosDeDinero(material) : null);
        const eleg = evaluar({
          texto: largo, idioma, modalidad: f.modalidad, costo: f.costo,
          financiamiento: Boolean(f.financiamiento), tipo,
        });
        const { puntaje, detalle } = puntuar({
          areas, areaInferida, tipo, prioridadFuente: fuente?.prioridad || 'media',
          costo: f.costo, financiamiento: Boolean(f.financiamiento), modalidad: f.modalidad,
          lugar: f.lugar, banderas: eleg.banderas, idioma,
          formacionDeFormadores: ex.esFormacionDeFormadores(corto),
          historico, pista, anuncio, retrospectiva: ex.pareceRetrospectiva(corto), invitaAActuar: ex.invitaAActuar(largo),
          fechaLimite: f.fecha_limite, claseFecha: f.clase_fecha,
          semaforo: eleg.semaforo, esSemilla: Boolean(f.es_semilla),
        });
        const publico = publicoDe(corto).length ? publicoDe(corto) : publicoEnFrasesRelevantes(largo);
        const resumenEs = resumirEnEspanol({
          ...f, tipo, areas, publico, idioma, elegibilidad: eleg, textoParaTemas: corto,
          detalleFinanciamiento: f.financiamiento ? ex.detalleDelFinanciamiento(largo) : [], historico, pista, anuncio, dinero,
          organizacion: f.organizacion, financiamiento: Boolean(f.financiamiento),
        });
        const descripcion = recortar(f.descripcion || frasesQueDescriben(f.resumen || '') || frasesQueDescriben(f.texto || ''), 420);
        db.db.prepare(`UPDATE oportunidades SET tipo=?, areas=?, semaforo=?, elegibilidad=?, puntaje=?,
                       puntaje_detalle=?, resumen=?, resumen_es=?, publico=?, idioma=?, descripcion=?, historico=?,
                       contenido=?, dinero=?, pista=?, anuncio=? WHERE id=?`)
          .run(tipo, JSON.stringify(areas), eleg.semaforo, JSON.stringify(eleg), puntaje, JSON.stringify(detalle),
               recortar(limpiarResumen(f.resumen || f.texto || '', f.titulo), 700),
               resumenEs, JSON.stringify(publico), idioma, descripcion, historico ? 1 : 0,
               contenido, JSON.stringify(dinero), pista ? 1 : 0, anuncio ? 1 : 0, f.id);
        n++;
      }
      log.info(`${n} fichas reclasificadas con los pesos actuales de config.json`);
      if (borradas) log.info(`${borradas} dejaron de calificar y se quitaron del panel`);
      break;
    }

    case 'exportar': {
      const { exportar } = await import('./exportar.js');
      const r = exportar(sueltos[0], { fragmento: banderas.has('--fragmento') });
      log.titulo('Panel de bolsillo generado');
      log.info(`${r.fichas} oportunidades, ${r.pesoKb} KB`);
      log.info(r.archivo);
      log.info('Es un solo archivo: se puede publicar, mandar por correo o abrir directo.');
      break;
    }

    case 'contar': {
      // Imprime solo el numero, para que el workflow pueda compararlo.
      console.log(db.db.prepare('SELECT COUNT(*) n FROM oportunidades').get().n);
      break;
    }

    case 'diagnostico': {
      const { diagnostico } = await import('./diagnostico.js');
      await diagnostico(sueltos[0]);
      break;
    }

    case 'probar-fuente': {
      const id = sueltos[0];
      const fuente = catalogo.fuentes.find((f) => f.id === id);
      if (!fuente) {
        console.log('\n  Fuentes disponibles:\n');
        for (const f of catalogo.fuentes) console.log(`    ${f.id.padEnd(28)} ${f.nombre}`);
        console.log('');
        break;
      }
      const { ejecutarEstrategia } = await import('./lectores.js');
      log.titulo(`Probando ${fuente.nombre}`);
      for (const e of fuente.estrategias) {
        const r = await ejecutarEstrategia(e);
        console.log(`  ${e.tipo} → ${e.url}`);
        console.log(`     ${r.items.length} enlaces${r.error ? ` · ${r.error}` : ''}`);
        for (const i of r.items.slice(0, 6)) console.log(`       - ${i.titulo.slice(0, 90)}`);
        if (r.items.length) break;
      }
      console.log('');
      break;
    }

    case 'sincronizar': {
      await import('./sincronizar.js');
      break;
    }

    case 'reiniciar': {
      if (!banderas.has('--si')) {
        console.log('\n  Esto borra TODAS las oportunidades guardadas, incluidas las que marcaste.');
        console.log('  Si de verdad quieres: node src/cli.js reiniciar --si\n');
        break;
      }
      db.db.exec('DELETE FROM oportunidades; DELETE FROM salud_fuentes; DELETE FROM ejecuciones;');
      db.dbCache.exec('DELETE FROM cache_http;');
      log.info('Base vaciada.');
      break;
    }

    default:
      console.log(`
  Radar de crecimiento profesional

    npm run panel              abre el panel en http://localhost:${config.panel?.puerto || 4787}
    npm run escanear           busca oportunidades nuevas
    npm run escanear:profundo  igual, pero abriendo mas fichas (mas lento)
    npm run salud              que fuentes estan fallando
    npm run horizonte          los plazos de los proximos 12 meses
    npm run reclasificar       recalcula puntajes tras editar config.json
    npm run probar-avisos      manda un correo y un push de prueba
    npm run sincronizar        baja lo que encontro el radar en la nube

    node src/cli.js probar-fuente <id>   revisa una fuente puntual
`);
  }
}

main().catch((e) => {
  log.error(e.stack || e.message);
  process.exit(1);
});
