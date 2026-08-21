// El seguro del radar: los ciclos que se repiten todos los anos.
//
// Si manana ESTRO rehace su sitio y el lector deja de encontrar el envio de
// resumenes, esta lista igual pone la convocatoria en el panel con su fecha
// estimada y un cartel de "confirmar en la fuente". Nunca se muestra como dato
// oficial.

import { calendarioSemilla, config } from './config.js';
import { areasDe, tipoDe } from './clasificar.js';
import { evaluar } from './elegibilidad.js';
import { puntuar } from './puntuar.js';
import { hash, aIso } from './util.js';
import { publicoDe, resumirEnEspanol } from './resumir.js';

/** Proxima ocurrencia futura de un mes dado. */
function proximaFecha(mesAprox, recurrencia) {
  const hoy = new Date();
  const anio = hoy.getUTCFullYear();
  const dia = 15;
  const candidatas = [];

  const meses = recurrencia === 'semestral' ? [mesAprox, ((mesAprox + 5) % 12) + 1] : [mesAprox];
  for (const m of meses) {
    for (const a of [anio, anio + 1, anio + 2]) {
      const f = new Date(Date.UTC(a, m - 1, dia));
      if (f.getTime() > hoy.getTime()) candidatas.push(f);
    }
  }
  candidatas.sort((a, b) => a - b);
  return candidatas.length ? aIso(candidatas[0]) : null;
}

export function oportunidadesSemilla() {
  if (config.escaneo?.usarCalendarioSemilla === false) return [];

  const salida = [];
  for (const c of calendarioSemilla.ciclos || []) {
    const fecha = proximaFecha(c.mesAprox || 6, c.recurrencia);
    if (!fecha) continue;

    const texto = `${c.titulo}. ${c.notas || ''}`;
    const areas = c.areas?.length ? c.areas : areasDe(texto);
    const tipo = c.tipo || tipoDe(texto);
    const eleg = evaluar({ texto, idioma: 'es', modalidad: 'desconocida', costo: 'desconocido', financiamiento: /beca|financiamiento/i.test(texto), tipo });

    const base = {
      id: `semilla-${hash(c.id + fecha)}`,
      url: c.url,
      titulo: c.titulo,
      resumen: c.notas || '',
      texto,
      fuente_id: 'calendario-semilla',
      fuente_nombre: 'Calendario de ciclos conocidos',
      grupo: 'semilla',
      organizacion: c.organizacion || '',
      tipo,
      areas,
      idioma: 'es',
      pais: null,
      lugar: null,
      modalidad: 'desconocida',
      costo: 'desconocido',
      financiamiento: /beca|financiamiento|viatico/i.test(texto) ? 1 : 0,
      fecha_inicio: null,
      fecha_fin: null,
      fecha_limite: fecha,
      fecha_estimada: 1,
      fecha_publicacion: null,
      semaforo: eleg.semaforo,
      elegibilidad: { ...eleg, esSemilla: true },
      es_semilla: 1,
    };

    const { puntaje, detalle } = puntuar({
      areas,
      tipo,
      prioridadFuente: 'alta',
      costo: 'desconocido',
      financiamiento: Boolean(base.financiamiento),
      modalidad: 'desconocida',
      lugar: null,
      banderas: eleg.banderas,
      idioma: 'es',
      formacionDeFormadores: /docencia|formadores|ensenar/i.test(texto),
      fechaLimite: fecha,
      semaforo: eleg.semaforo,
      esSemilla: true,
    });

    const publico = publicoDe(texto);
    salida.push({
      ...base,
      publico,
      resumen_es: resumirEnEspanol({ ...base, publico, financiamiento: Boolean(base.financiamiento) }),
      puntaje,
      puntaje_detalle: detalle,
    });
  }
  return salida;
}
