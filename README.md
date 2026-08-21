# Radar de Crecimiento Profesional

Un radar que busca todos los días becas, cursos, congresos, pasantías, diplomados y
convocatorias para tecnología médica —radioterapia, imagenología, resonancia, medicina
nuclear, física médica y protección radiológica— y te manda un correo con lo que
apareció y con los plazos que se te vienen encima.

## Por qué existe

La IAEA abrió una postulación para capacitarse fuera de Chile y uno de sus criterios
ideales era ser alguien que **le enseña a otros tecnólogos médicos de radioterapia**.
Ese perfil calza exacto, pero la convocatoria llegó por casualidad, de rebote.

Ese es el problema real: no es que no existan oportunidades, es que no hay forma humana
de estar mirando 150 sitios distintos —la IAEA, la OPS, ESTRO, ISRRT, RSNA, la CCHEN,
ANID, Varian, Elekta, Siemens, veinte universidades— para ver cuál abrió algo esta
semana. Cuando te enteras, el plazo cerró hace un mes.

El radar mira esos 150 sitios por ti, todos los días.

## Qué busca

| Tipo | Ejemplos |
|---|---|
| Becas y fellowships | IAEA (vía CCHEN), ANID, Fulbright, Fundación Carolina, Erasmus Mundus, DAAD, OEA, TWAS |
| Cursos y capacitaciones | ESTRO School, IAEA e-learning, Campus Virtual OPS, academias de marcas, educación continua universitaria |
| Congresos y envío de resúmenes | ESTRO, ASTRO, RSNA, ECR, ISMRM, SNMMI, EANM, ALATRO, ALFIM, ISRRT, SOCHRADI |
| Postgrado | Diplomados, magíster, doctorados, certificaciones |
| Pasantías y visitas científicas | Scientific visits IAEA, observerships, intercambios |
| Docencia | Formación de formadores, concursos académicos, RAD-AID, programas de mentoría |
| Investigación | Proyectos coordinados IAEA (CRP), fondos concursables |

Y no descarta nada: si algo parece dirigido a médicos o físicos médicos, igual aparece,
con un comentario que lo dice.

## La IAEA, en particular

Como la IAEA fue el origen de todo esto, tiene tratamiento especial. Su sitio principal
está detrás de un filtro de Cloudflare que rechaza a los programas automáticos, así que
el radar la lee por seis puertas distintas:

| Puerta | Qué entrega |
|---|---|
| `iaea.org/feeds/news` y `/feeds/topnews` | El RSS oficial. Responde siempre. |
| `iaea.org/services/education-and-training/training-courses` | Los cursos de capacitación. |
| `iaea.org/services/education-and-training/online-learning/courses` | Los cursos en línea. |
| `iaea.org/services/coordinated-research-activities` | Los CRP con convocatoria abierta. |
| `iaea.org/services/technical-cooperation-programme/how-to-participate` | Cooperación técnica. |
| `conferences.iaea.org` (calendario `.ics`) | Todas sus reuniones técnicas y conferencias. |

Las páginas del sitio principal se piden con `curl` cuando el filtro rechaza la conexión
normal de Node. No hay truco ni credencial: es contenido público, pedido de a una página,
con la misma pausa entre peticiones que el resto del radar. Y si un día deja de funcionar,
cada una de esas fuentes tiene detrás una búsqueda en Google Noticias y el calendario
semilla, así que la convocatoria igual llega.

Lo que ninguna herramienta reemplaza: para las becas de Cooperación Técnica el canal
formal es la **CCHEN**, que es la Autoridad Nacional de Enlace de Chile ante el OIEA. El
radar te avisa y te lo recuerda dos veces al año, pero la llamada la haces tú.

## Las cuatro capas (por qué no se le escapan cosas)

El radar no depende de una sola forma de mirar. Cada fuente se intenta por varios
caminos, en orden, hasta que uno entregue resultados:

1. **Feeds (RSS/Atom/iCal)** — lo más confiable cuando el sitio los tiene. La IAEA
   publica en `iaea.org/feeds/news`; sus conferencias salen en un calendario `.ics`.
2. **Lectura de páginas HTML** — para los sitios sin feed. Lee los enlaces del listado,
   filtra el ruido de menús y abre las fichas prometedoras para sacar fechas y requisitos.
   También lee los datos estructurados (`JSON-LD`) que muchos sitios incrustan para Google.
3. **Sitemaps** — cuando el listado se arma con JavaScript y no hay enlaces que leer.
4. **Capa de búsqueda** — doce búsquedas permanentes en Google Noticias, en español e
   inglés. Es el último recurso: solo corre cuando las tres capas anteriores devuelven
   cero. Hoy sostiene a 21 instituciones que no se pueden leer directo (ASTRO, Elekta,
   DAAD, Radiopaedia, NCRP y otras: unas bloquean al radar, otras arman su sitio entero
   con JavaScript y no dejan un solo enlace en el HTML).

   **Lo que trae no es una ficha, es un titular.** Los enlaces de Google Noticias son
   redirecciones opacas: no se pueden seguir sin un navegador completo, y sus
   identificadores vienen encriptados. Por eso esas entradas no tienen contenido, ni
   costo, ni fecha de cierre confiable. Van en su propia sección, **Pistas de prensa**,
   con puntaje bajo, y quedan fuera del correo diario y de las alarmas de cierre.
   Sirven para enterarse de que algo existe; después hay que abrir el enlace.

Y por debajo de todo, un **calendario semilla**: los ciclos que se repiten todos los años
(resúmenes de ESTRO en octubre, ASTRO en febrero, becas ANID en marzo, cursos de la CCHEN)
están escritos a mano en `fuentes/calendario.json`. Aunque mañana ESTRO rehaga su sitio y
su lector deje de funcionar, la convocatoria igual va a aparecer en el panel con su fecha
estimada y un cartel de *confirmar en la fuente*. Cuando el escaneo encuentra la
convocatoria real, la estimada desaparece sola para no duplicar.

## El resumen en español

Cada ficha trae una línea en español que dice de qué se trata, aunque el título venga
en inglés. No es una traducción automática: se arma con lo que el radar sabe de esa
oportunidad. Por ejemplo:

> *Curso presencial sobre control de calidad y puesta en servicio, del OIEA, en Costa Rica.
> Dirigido a tecnólogos médicos de imagenología y físicos médicos, o sea a ti. Es sin costo
> y menciona becas, viáticos o financiamiento. El plazo vence el 15 de octubre de 2026.
> Se postula por el canal oficial del país, que en Chile es la CCHEN.*

Lo importante ahí es **a quién va dirigido**. El radar lo saca del texto y distingue los
nombres que se usan afuera: *radiation therapist* y *RTT* en Europa son el equivalente al
tecnólogo médico de radioterapia chileno, no al médico. Cuando la ficha no lo dice, lo
deduce del tema y avisa que lo está deduciendo.

El texto original de la fuente queda abajo, plegado, por si quieres leerlo tal cual.

## Los atajos del panel

Arriba de la lista hay una fila de botones de un toque, pensada para el celular:

- **Técnicas especiales** — IMRT, VMAT, SBRT, SRS, SFRT, braquiterapia, FLASH, protones,
  gating, DIBH, radioterapia adaptativa, MR-Linac. Es un área con peso propio en el
  puntaje, no solo un filtro.
- **Con financiamiento** — lo que menciona beca, viáticos o pasajes.
- **Gratis y online** — lo que puedes hacer desde la casa sin pagar.
- **Para tecnólogos médicos** — donde el texto nombra explícitamente a tu profesión.
- **Cierra pronto** — los próximos 45 días, ordenados por plazo.
- **Pistas de prensa** — lo que encontró la búsqueda de noticias y no tiene ficha propia
  que leer. Es el primer aviso de algo, no la convocatoria.
- **Ediciones pasadas** — el archivo. No son convocatorias abiertas, pero saber que
  ALATRO se reunió en Cancún o que la ISMRT hace su encuentro de capítulo en marzo es
  la forma de calcular cuándo hay que estar mirando para la próxima vuelta. Van aparte,
  con puntaje bajo, y nunca entran al correo ni a las alarmas de cierre.

## El semáforo "¿puedo yo?"

Cada oportunidad trae un comentario honesto sobre qué tan realista es para tu perfil:
tecnólogo médico chileno, titulado en la Universidad de Chile, con menciones en
radioterapia, imagenología, resonancia y medicina nuclear, sin postgrado todavía y
haciendo clases en la UBO.

- 🟢 **Te calza** — sin peros evidentes.
- 🟡 **Con condiciones** — puedes, pero hay un trámite o un requisito. Por ejemplo:
  *"Requiere postular por el canal oficial del país. En Chile eso significa la CCHEN,
  que es la Autoridad Nacional de Enlace ante el OIEA. Conviene tener el contacto hecho
  antes de que se abra el plazo."*
- 🔴 **Poco probable** — parece limitado a otra región o profesión.

**Nada se oculta ni se borra por el semáforo.** Es una opinión del radar, no una decisión.
Los cursos que dicen *"medical physicists"* siguen apareciendo, con la nota de que en
varias actividades de la IAEA los tecnólogos médicos entran igual.

## Cómo se ordena

El puntaje decide qué va primero, qué entra al correo y qué hace sonar el teléfono. Todos
los pesos están en `config.json` y se pueden cambiar sin tocar código:

- El **área** manda (radioterapia, física médica, imagenología, resonancia, protección
  radiológica y docencia pesan 3; medicina nuclear 2; ecografía 1, para que asome sin
  inundar).
- **Financiamiento** suma fuerte (18): es lo que hace la diferencia entre mirar y poder ir.
- **Formación de formadores** suma 16, porque es el criterio que originó todo esto.
- Suman también: gratis, online, en Chile, en tu idioma, plazo próximo.
- Restan: plazo vencido, idioma que no manejas, semáforo rojo, fecha solo estimada.

## Instalación

Necesitas **Node.js 22 o superior** ([nodejs.org](https://nodejs.org)). Nada más: el
proyecto no tiene dependencias, ni siquiera `npm install`.

```bash
cd "Proyecto Rastreador de crecimiento"
node src/cli.js escanear     # el primer escaneo demora entre 20 y 35 minutos
node src/servidor.js         # abre el panel en http://localhost:4787
```

En Windows tienes tres accesos directos:

- **Escanear ahora.bat** — busca oportunidades nuevas.
- **Abrir panel.bat** — baja lo de la nube y abre el panel.
- **Que se viene.bat** — imprime los plazos de los próximos 12 meses.

## Comandos

```bash
npm run panel               # panel web en http://localhost:4787
npm run escanear            # escaneo normal
npm run escanear:profundo   # abre más fichas por fuente: más detalle, más lento
npm run horizonte           # plazos de los próximos 12 meses en consola
npm run salud               # qué fuentes están fallando
npm run diagnostico         # prueba las 155 fuentes ahora mismo, sin guardar nada
npm run reclasificar        # recalcula puntajes tras editar config.json
npm run avisar              # arma y manda el correo del día
node src/cli.js avisar --forzar --seco   # ensayo: escribe el correo a un archivo, no manda nada
npm run probar-avisos       # correo y push de prueba
npm run sincronizar         # baja lo que encontró el radar en GitHub

node src/cli.js diagnostico marcas          # solo un grupo de fuentes
node src/cli.js probar-fuente iaea-eventos  # revisa una fuente puntual
```

## El panel

Tres pestañas:

- **Oportunidades** — todo lo encontrado, con filtros por tipo, área, elegibilidad y
  estado. Cada tarjeta se marca como *Guardar*, *Ya postulé* o *No me sirve*. Lo que
  marcas nunca se pisa, ni cuando el radar vuelve a escanear ni cuando sincronizas.
- **Horizonte 12 meses** — los plazos ordenados por mes. Los ciclos grandes se preparan
  con casi un año de anticipación; esta es la vista para planificar.
- **Salud de fuentes** — cuáles responden y cuáles se rompieron.

## El correo diario

Llega una vez al día con dos secciones:

1. **Se te vienen encima** — plazos a 60, 30, 14, 7, 3 y 1 día que todavía no marcaste
   como postulado ni descartado. Cada hito avisa una sola vez.
2. **Nuevo desde el último aviso** — lo que apareció, ordenado por puntaje.

Además, el día 1 de cada mes llega el resumen del horizonte a 12 meses.

Al teléfono (ntfy o Telegram) solo llega lo urgente: cierres a 7, 3 y 1 día, y las
oportunidades de puntaje alto. Nunca entre las 23:00 y las 7:00.

### Configurar el correo

Copia `.env.example` como `.env` y llena:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=tucorreo@gmail.com
SMTP_PASS=              # contraseña de aplicación, no la clave normal
CORREO_DESTINO=tucorreo@gmail.com
```

Con Gmail necesitas verificación en 2 pasos y una **contraseña de aplicación** de
[myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) (16
caracteres, sin espacios).

Para el push, instala la app **ntfy** en el teléfono, suscríbete a un tema secreto
(por ejemplo `radar-crecimiento-9f3k2x`) y ponlo en `NTFY_TOPIC`. No requiere cuenta.

Prueba que quedó bien con `npm run probar-avisos`.

## Verlo en el celular desde cualquier parte

El panel local necesita tu computador encendido. Para mirarlo en la calle hay una
segunda versión: **el panel de bolsillo**, un solo archivo HTML con los datos adentro.

```bash
npm run exportar          # genera datos/panel-movil.html
```

Ese archivo no llama a ningún servidor: se puede publicar, mandar por correo o abrir
directo, y funciona sin conexión una vez cargado. Trae las 600 oportunidades mejor
puntuadas, con los mismos filtros, el resumen en español y el semáforo. Lo que marques
ahí se guarda en ese teléfono y no vuelve al panel del computador.

El escaneo diario de GitHub Actions lo regenera solo y lo deja como `index.html` en la
rama `datos`. Si activas **GitHub Pages** sobre esa rama tienes una dirección fija que
se actualiza sola todos los días. Ojo: Pages sobre repositorio privado necesita plan
pago; en repositorio público la página queda accesible para quien tenga el enlace (son
convocatorias públicas, pero decídelo tú).

## Instalarlo como app en el celular

El panel exportado es una **app instalable**: trae icono propio, nombre y se abre a
pantalla completa, sin barra del navegador.

1. Abre **Abrir panel.bat** en el computador.
2. En el celular, con el mismo WiFi, entra a la dirección que aparece en pantalla,
   terminada en **/movil** — por ejemplo `http://192.168.1.31:4787/movil`.
3. **Compartir → Añadir a pantalla de inicio.** Queda como cualquier otra app.

El icono se genera solo en `src/icono.js`: un PNG dibujado píxel a píxel, sin
librerías, porque iOS no acepta SVG para el icono de la pantalla de inicio.

Esa versión necesita tu computador encendido y el mismo WiFi. Para tenerla siempre,
hay que publicarla en internet (ver más abajo).

## Abrir el panel en el celular (en la casa)

El panel ya está preparado para el teléfono: la lista, los atajos y los botones se
adaptan a la pantalla chica.

1. Deja el computador encendido con el panel abierto (**Abrir panel.bat**).
2. En la pantalla aparece una dirección del tipo `http://192.168.1.31:4787`. Escríbela
   en el navegador del celular, conectado al mismo WiFi.
3. Si no carga, es el firewall de Windows: haz clic derecho en
   **Permitir panel en el celular.bat** → *Ejecutar como administrador*, una sola vez.
   La regla que crea está limitada a tu red local (`remoteip=LocalSubnet`): entra tu
   celular, no entra internet. Va con `profile=any` a propósito, porque Windows suele
   marcar la red de la casa como "pública" y con eso una regla normal no aplicaría.

Desde el celular puedes marcar *Guardar*, *Ya postulé* y *No me sirve* igual que en el
computador: es el mismo panel, no una copia.

Si estás en una red que no es tuya (el hospital, por ejemplo) y prefieres que el panel no
conteste a nadie más, pon `"abrirEnRed": false` en `config.json`.

## Que corra solo (dos caminos)

### El simple: una tarea de Windows

Haz doble clic en **Que corra solo todos los días.bat**. Eso programa el radar para que
todos los días a las 08:30 busque y te mande el correo. No necesitas cuenta de nada.

La única condición es que el computador esté encendido a esa hora. Si estaba apagado,
Windows lo intenta apenas lo prendas.

Para sacarlo: `.instalar-tarea-windows.ps1 -Quitar` en PowerShell.

### El que funciona siempre: GitHub Actions (gratis)

## Correrlo en la nube (gratis)

Igual que tus otros radares: `.github/workflows/radar-crecimiento.yml` escanea todos los
días a las 11:15 UTC en los servidores de GitHub, aunque tu computador esté apagado.

1. Sube el proyecto a un repositorio de GitHub (privado está bien).
2. En **Settings → Secrets and variables → Actions**, crea los secretos:
   `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `CORREO_DESTINO`
   y, si quieres push, `NTFY_TOPIC`.
3. Listo. La base con todo lo encontrado se guarda en la rama `datos`.
4. En tu computador, `npm run sincronizar` la baja y la funde con la tuya **sin pisar**
   lo que marcaste como guardado, postulado o descartado.

## Ajustar el radar

Todo lo que decide cómo piensa está en `config.json`, comentado línea por línea:

- `perfil` — quién eres. Cambia `tienePostgrado` a `true` cuando termines un magíster y
  el semáforo dejará de advertirte por eso.
- `intereses` — el peso de cada área, de 0 a 3. Si quieres empezar a mirar ecografía en
  serio, súbela de 1 a 3 y corre `npm run reclasificar`.
- `avisos.umbralCorreo` — bájalo si sientes que se te está escapando algo; súbelo si
  llega mucho ruido.
- `escaneo.maxMinutosPorEjecucion` — cuánto puede demorar cada escaneo.

## Agregar una fuente nueva

En `fuentes/catalogo.json`, agrega un bloque:

```json
{
  "id": "mi-fuente",
  "nombre": "Nombre que verás en el panel",
  "grupo": "sociedades",
  "prioridad": "alta",
  "pais": "Chile",
  "idioma": "es",
  "areas": ["radioterapia"],
  "detalle": true,
  "estrategias": [
    { "tipo": "feed", "url": "https://ejemplo.cl/feed" },
    { "tipo": "html", "url": "https://ejemplo.cl/cursos", "patronEnlace": "curso|taller" }
  ]
}
```

Pruébala con `node src/cli.js probar-fuente mi-fuente`. Para desactivar una sin borrarla,
agrégale `"activa": false`.

## Cuándo se rompe algo

Los sitios cambian de diseño y los lectores dejan de encontrar cosas. Por eso existe la
pestaña **Salud de fuentes** y el comando `npm run diagnostico`: te dicen exactamente cuál
dejó de responder y con qué error. Arreglar una fuente es cambiar una dirección en
`fuentes/catalogo.json`, no tocar código.

## Lo que este radar no puede hacer

Vale la pena decirlo derecho:

- **Hay dos cosas que el radar sí bota**: los menús de navegación ("News", "Courses",
  "Education and training" son la portada de una sección, no una convocatoria) y lo que
  no toca ninguna de tus áreas. Los archivos históricos no se botan: se guardan aparte.
- **El filtro de la IAEA a veces rechaza igual.** Las páginas se leen con `curl`, pero si
  se piden muchas seguidas alguna vuelve rechazada. Cuando pasa, esa fuente cae a su
  búsqueda de respaldo y al calendario semilla, así que no queda un hueco, pero puede que
  ese día una página específica no se haya revisado.
- **Las fechas se sacan leyendo texto libre**, en tres idiomas. La mayoría sale bien, pero
  una fecha mal leída es posible. Antes de organizar un viaje, confirma en la ficha oficial.
- **El radar distingue el cierre de una postulación de la fecha del evento**, pero no
  siempre acierta. La tarjeta dice cuál de las dos cree que es.
- **Se cuela ruido.** Es inevitable: la alternativa es filtrar tan fuerte que se pierdan
  cosas, y tú pediste lo contrario. Márcalo como *No me sirve* y baja de la lista.
- **Las fechas del calendario semilla son estimaciones** del ciclo histórico, no fechas
  oficiales. Siempre aparecen marcadas como tales.
- **El semáforo es una heurística**, no una asesoría. Cuando dice "poco probable", vale
  igual escribir y preguntar.

## Estructura

```
config.json                     cómo piensa el radar (sin secretos)
.env                            claves de correo y push (no se sube a git)
fuentes/catalogo.json           las 155 fuentes y sus estrategias
fuentes/calendario.json         los ciclos anuales conocidos
src/
  cli.js                        todos los comandos
  escanear.js                   el escaneo: arma las fichas y las guarda
  lectores.js                   feed, html, sitemap, ical
  http.js                       pedir páginas sin romperse
  extraer.js                    fechas, modalidad, costo, idioma, lugar
  clasificar.js                 tipo y área de cada cosa
  elegibilidad.js               el comentario "¿puedo yo?"
  puntuar.js                    el puntaje
  calendario.js                 proyecta los ciclos semilla
  notificar.js                  correo diario, alarmas y push
  smtp.js                       cliente de correo sin dependencias
  servidor.js                   el panel local
  sincronizar.js                trae lo de la nube sin pisar tus marcas
  db.js                         base SQLite (incluida en Node)
  diagnostico.js                prueba todas las fuentes
  http.js                       incluye el respaldo por curl para sitios que bloquean
web/                            el panel
datos/radar.db                  todo lo encontrado (esto es lo que viaja a la nube)
datos/cache.db                  copia de las paginas bajadas; se puede borrar sin miedo
```
