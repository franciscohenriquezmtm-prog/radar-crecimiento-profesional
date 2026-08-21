// Prueba todas las fuentes del catalogo de una sentada y dice cuales responden.
//
// No guarda nada: sirve para revisar el catalogo despues de editarlo, o cuando
// sospechas que un sitio cambio de diseno.
//
//   node src/cli.js diagnostico            todas
//   node src/cli.js diagnostico marcas     solo un grupo

import { fuentesActivas } from './config.js';
import { ejecutarEstrategia } from './lectores.js';
import { log } from './util.js';

const EN_PARALELO = 6;

async function probar(fuente) {
  for (const e of fuente.estrategias) {
    try {
      const r = await ejecutarEstrategia(e);
      if (r.items?.length) {
        return { ok: true, items: r.items.length, estrategia: e.tipo, url: e.url, muestra: r.items[0]?.titulo || '' };
      }
      var ultimo = r.error || 'sin resultados';
    } catch (err) {
      var ultimo = err.message;
    }
  }
  return { ok: false, items: 0, error: ultimo || 'sin estrategias' };
}

export async function diagnostico(grupo) {
  const fuentes = fuentesActivas().filter((f) => !grupo || f.grupo === grupo);
  log.titulo(`Probando ${fuentes.length} fuentes${grupo ? ` del grupo ${grupo}` : ''}`);

  const resultados = [];
  const cola = [...fuentes];

  async function trabajador() {
    for (;;) {
      const f = cola.shift();
      if (!f) return;
      const r = await probar(f);
      resultados.push({ fuente: f, ...r });
      const marca = r.ok ? '✔' : '✖';
      const detalle = r.ok ? `${String(r.items).padStart(3)} enlaces · ${r.estrategia}` : `        ${r.error}`;
      console.log(`  ${marca} ${f.nombre.slice(0, 52).padEnd(54)} ${detalle}`);
    }
  }

  await Promise.all(Array.from({ length: EN_PARALELO }, trabajador));

  const buenas = resultados.filter((r) => r.ok);
  const malas = resultados.filter((r) => !r.ok);

  console.log(`\n  ${buenas.length} de ${resultados.length} fuentes responden.\n`);

  if (malas.length) {
    console.log('  Las que no respondieron:\n');
    const porGrupo = {};
    for (const m of malas) (porGrupo[m.fuente.grupo] ||= []).push(m);
    for (const [g, lista] of Object.entries(porGrupo)) {
      console.log(`   ${g}:`);
      for (const m of lista) console.log(`     - ${m.fuente.id.padEnd(26)} ${String(m.error).slice(0, 70)}`);
    }
    console.log('\n  Arregla sus estrategias en fuentes/catalogo.json.');
    console.log('  Mientras tanto, el calendario semilla cubre los ciclos conocidos de esas instituciones.\n');
  }

  return { total: resultados.length, ok: buenas.length, malas };
}
