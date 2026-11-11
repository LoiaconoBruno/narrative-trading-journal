# Narrative Trading: paper de uso y guía de la idea

## Resumen

Este documento acompaña a **Narrative Trading Journal**, un experimento de *paper trading* (operaciones con plata simulada) para la idea "IA predictiva con trasfondo sociohistórico". Cada día hábil, antes de la apertura de la Bolsa de Nueva York, un workflow de GitHub Actions baja las noticias de las últimas 24 horas desde **GDELT**, le pide a **Claude** (el modelo de lenguaje de Anthropic) que clasifique los títulos, calcula cuatro **índices narrativos** por activo (Atención, Tono, Riesgo y Momento) y le pide a Claude una **propuesta** por activo: compra o venta para las próximas 5 ruedas, con una **tesis**, un **episodio histórico parecido**, una **confianza** y sus **riesgos**. Las propuestas quedan **selladas por un commit** antes de que abra el mercado y nunca se editan. Una persona las **aprueba o las rechaza** en la página. Cuando se cumple el horizonte, el pipeline mide el resultado con precios de Twelve Data y la bitácora calcula si la IA acierta, si su confianza está calibrada y si la persona agrega valor.

**Aviso:** ni la herramienta ni esta guía son una recomendación de inversión. Todo es plata simulada. El propósito es metodológico: cómo evaluar honestamente a quien hace predicciones, sea una persona o una IA.

La primera parte es un paper de uso: qué hace cada pieza, cómo se activa, qué mide cada índice y cómo se calcula, cómo se evita la trampa de anticipación, cómo se leen las métricas, cuánto cuesta y qué límites tiene. La segunda es una guía de la idea, que recorre la economía narrativa de Robert Shiller, las manías financieras según Charles Kindleberger y Carlota Perez (y la revisión de la "tulipomanía" por Peter Garber y Anne Goldgar), el razonamiento por analogías históricas de Richard Neustadt y Ernest May y los pronósticos por clase de referencia de Kahneman y Lovallo, la hipótesis de los mercados eficientes de Eugene Fama y la evidencia sobre el rendimiento de quienes operan activamente (Barber y Odean), la calibración y el puntaje de Brier, el sesgo retrospectivo de Baruch Fischhoff y el sesgo de anticipación en las pruebas históricas y en los modelos de lenguaje, y la investigación sobre humanos y automatización: la ironía de Lisanne Bainbridge, el sesgo de automatización de Parasuraman, Riley, Skitka y Mosier, y la aversión y la apreciación de los algoritmos.

## Parte I. Paper de uso

### 1. Qué es la herramienta

Narrative Trading Journal tiene dos piezas que se hablan solo a través de archivos JSON:

1. **El pipeline** (`pipeline/`, Node 22). Corre en GitHub Actions cada día hábil a las 12:05 UTC (9:05 en Buenos Aires), antes de la apertura de Nueva York: 13:30 UTC con el horario de verano de Estados Unidos y 14:30 UTC sin él. Es el único lugar donde hay keys (la de la API de Claude y la de Twelve Data), guardadas como secretos del repositorio. Escribe todo en `data/` y el workflow lo guarda con un commit.
2. **La página** (`index.html`). Es estática, sin dependencias ni paso de build, y se publica en GitHub Pages. Lee los JSON de `data/`, verifica la cadena de sellos, muestra las propuestas del día y guarda tus decisiones en tu navegador.

| Archivo | Qué guarda | ¿Cambia? |
|---|---|---|
| `data/watchlist.json` | El mercado, el horizonte y los activos, con los alias para encontrarlos en las noticias | Solo si lo editás a mano |
| `data/config.json` | El modelo, el esfuerzo de razonamiento de cada paso y cuántos artículos se clasifican por activo | Solo si lo editás a mano |
| `data/indices/ACTIVO.json` | Una entrada por rueda: conteo de artículos, los cuatro índices y los artículos con su clasificación | Se agrega una rueda por corrida |
| `data/propuestas/AAAA-MM-DD.json` | Las propuestas de una rueda, con el hash del archivo anterior | Nunca: es el sello |
| `data/resultados.json` | El rendimiento y el acierto de cada propuesta cerrada, y si cuenta | Se agregan resultados |
| `data/costos.json` | Los tokens y los dólares de cada corrida | Se agregan corridas |
| `data/estado.json` | Los días con propuestas y los avisos de la última corrida | Se reescribe en cada corrida |

La lógica pura vive en `src/` (índices, calendario, sellos, bitácora y costos) y la usan las dos piezas: el pipeline para calcular y la página para mostrar y explicar. Así la definición escrita de cada índice y su cálculo salen del mismo archivo.

### 2. El mercado y la watchlist

El mercado son **acciones que cotizan en Nueva York (NYSE y Nasdaq), en dólares**. La watchlist inicial combina cuatro empresas argentinas o con operación central en Argentina que cotizan allá, y seis grandes empresas de Estados Unidos de sectores distintos. Todas son líquidas y salen seguido en las noticias. Es un punto de partida editable en `data/watchlist.json`, no una recomendación.

| Activo | Empresa | Sector | Alias que se buscan en GDELT |
|---|---|---|---|
| MELI | MercadoLibre | Comercio electrónico y pagos | mercadolibre, mercado libre |
| YPF | YPF | Petróleo y gas | ypf |
| GGAL | Grupo Financiero Galicia | Bancos | grupo financiero galicia, banco galicia, banco de galicia |
| VIST | Vista Energy | Petróleo y gas | vista energy, vista oil |
| AAPL | Apple | Tecnología | apple, apple inc |
| MSFT | Microsoft | Software | microsoft, microsoft corp |
| NVDA | Nvidia | Semiconductores | nvidia |
| KO | Coca-Cola | Consumo masivo | coca-cola, coca cola, the coca-cola company |
| JPM | JPMorgan Chase | Bancos | jpmorgan, jp morgan, jpmorgan chase |
| XOM | ExxonMobil | Petróleo y gas | exxonmobil, exxon mobil, exxon |

Un alias coincide con una organización que GDELT detectó en el artículo si es igual o si la organización empieza con el alias seguido de un espacio: "nvidia corp" cuenta para Nvidia; "applebee" no cuenta para Apple.

La cobertura no es pareja. En una prueba con 6 horas de noticias del 11 de noviembre de 2026 (de 7:00 a 13:15 UTC, 93.712 artículos), Nvidia apareció en 582 artículos, Microsoft en 321, ExxonMobil en 85, Apple en 35, JPMorgan en 22, Coca-Cola en 2, MercadoLibre en 1, y YPF, Galicia y Vista en ninguno. Las empresas argentinas dependen mucho del flujo traducido (los medios en castellano) y de las horas en que escriben los medios argentinos; con pocos artículos, sus índices van a quedar seguido sin datos.

### 3. Cómo se activa

El workflow programado está apagado hasta que lo actives. Antes de activarlo conviene leer la sección 10, sobre costos.

1. **Las keys.** Creá una key de la API de Claude en la consola de Anthropic (https://platform.claude.com/) y una key gratis de Twelve Data (https://twelvedata.com/pricing, plan Basic).
2. **Los secretos.** En el repositorio de GitHub: Settings → Secrets and variables → Actions → New repository secret. Cargá `ANTHROPIC_API_KEY` y `TWELVEDATA_API_KEY`. Las keys quedan cifradas en GitHub; nunca se escriben en el repo ni llegan a la página.
3. **La prueba en seco.** En Actions → Pipeline diario → Run workflow, con la casilla de prueba en seco marcada (viene así). Baja las noticias y calcula los índices, pero no llama a Claude ni a Twelve Data y no hace commit. Sirve para ver que GDELT responde desde GitHub y cuánto tarda.
4. **La activación.** En Settings → Secrets and variables → Actions → Variables, creá `PIPELINE_ACTIVO` con el valor `si`. Desde el día hábil siguiente corre solo. Para correrlo a mano antes de la apertura, Run workflow con la casilla desmarcada.
5. **El modelo (opcional).** Por defecto usa Claude Opus 5.5. Para usar otro, creá la variable `MODELO` con `claude-sonnet-5-5` o `claude-haiku-5-5`, o cambiá `data/config.json`.

Para trabajar en la computadora:

```bash
git clone https://github.com/LoiaconoBruno/narrative-trading-journal.git
cd narrative-trading-journal
npm test
npm ci --prefix pipeline
node pipeline/correr.js --seco --horas=6 --salida=/tmp/prueba
```

La última línea es la prueba en seco con 6 horas de noticias, escrita en una carpeta aparte. La página necesita un servidor para leer `data/` (por ejemplo `python3 -m http.server` y abrir `http://localhost:8000`); con doble clic en `index.html` el navegador no deja leer esos archivos, pero el ejemplo inventado (`?ejemplo`) funciona igual porque se genera en la página.

### 4. El pipeline, paso a paso

1. **Evaluar lo que cerró.** Para cada propuesta cuyo horizonte terminó (el cierre de la quinta rueda, más una hora), pide a Twelve Data la serie diaria del activo, calcula el rendimiento desde la apertura de la rueda de la propuesta hasta el cierre de la quinta y lo guarda en `data/resultados.json`, redondeado a 0,1 %. Los precios quedan en memoria: no se guardan ni se publican. Además revisa el sello de cada archivo de propuestas (sección 6) y marca si el resultado cuenta.
2. **¿Hay rueda hoy?** El calendario de feriados de NYSE de 2026 a 2028 está en `src/calendario.js`, copiado de la página oficial (https://www.nyse.com/markets/hours-calendars). Si hoy no hay rueda, termina. Si el mercado ya abrió, no genera propuestas: una tesis escrita después de la apertura no vale. Si ya hay propuestas selladas para hoy, no las toca.
3. **Las noticias.** GDELT publica cada 15 minutos un archivo GKG 2.1 con los artículos que monitoreó y las organizaciones que nombra cada uno. Hay dos flujos: medios en inglés y medios en 65 idiomas traducidos al inglés por GDELT (el título queda en el idioma original). El pipeline baja los 96 archivos de las últimas 24 horas de cada flujo, cuenta cuántos artículos nombran a cada empresa y elige 20 por activo: primero los que la nombran en el título, después los que más la mencionan, después los más nuevos, sin títulos repetidos. GDELT anuncia cada archivo nuevo antes de que se pueda bajar (en las pruebas, hasta 45 minutos antes), así que la ventana termina en el último archivo que existe. En la prueba de 6 horas, 47 archivos se bajaron y procesaron en 18 segundos en una notebook.
4. **La clasificación.** Claude recibe los títulos (con el medio y el idioma) y devuelve, para cada uno, si es relevante para esa empresa, si es positivo, neutro o negativo para su negocio o su acción, y si describe un evento de riesgo. La respuesta tiene que respetar un esquema JSON fijo (salida estructurada de la API) y el pipeline descarta lo que no cumple. Se usa esfuerzo bajo: es una tarea de clasificación.
5. **Los índices.** Con el conteo y la clasificación se calculan los cuatro índices (sección 5) y se agrega una rueda a `data/indices/ACTIVO.json`, con los artículos y su clasificación.
6. **Las propuestas.** Claude recibe, por activo, los índices de hoy, los de las últimas 10 ruedas y hasta 12 títulos relevantes clasificados, y devuelve una propuesta por activo: dirección, confianza (un entero de 50 a 100), tesis, episodio histórico parecido con un link a Wikipedia, de 2 a 4 riesgos y los artículos que más pesan. Se usa esfuerzo medio. El pipeline valida cada propuesta, descarta las que no cumplen y comprueba que el link del episodio exista; si no responde, la propuesta queda marcada como "link sin verificar".
7. **El sello.** Escribe `data/propuestas/AAAA-MM-DD.json` con la hora de generación, la hora de apertura, el hash SHA-256 del archivo anterior y las propuestas. El workflow hace el commit y pide a GitHub Pages que publique.
8. **Costos y estado.** Guarda los tokens que informó la API en cada llamada y su costo en `data/costos.json`, y los avisos de la corrida en `data/estado.json`.

Las fallas no tiran abajo la corrida: si falta un archivo de GDELT, se sigue con los demás; si falta una key, se avisa y se hace lo que se puede; si un clasificador de seguridad de Claude rechaza el pedido, la API lo reintenta en el modelo de respaldo que recomienda Anthropic (el parámetro `fallbacks`); si la respuesta no tiene la forma pedida, ese paso se saltea y queda el aviso.

### 5. Los índices

Cada índice tiene una definición escrita en `src/indices.js`, la misma que muestra la página en «Método».

| Índice | Escala | Qué mide |
|---|---|---|
| Atención | 0 a 100; 50 es lo normal para ese activo | Cuánto se habla del activo hoy comparado con sus últimos 20 días |
| Tono | −100 a +100 | Si las noticias del día son buenas o malas para la empresa |
| Riesgo | 0 a 100 | Qué parte de las noticias habla de un evento de riesgo |
| Momento narrativo | −100 a +100 | Hacia dónde viene la narrativa, sin saltar por un día suelto |

**Atención.** Sea *n* la cantidad de artículos de las últimas 24 horas que nombran a la empresa y *N* el total de artículos procesados en esas 24 horas. La cuota es *n* cada 10.000 artículos, para que un día con menos noticias en general (un domingo, por ejemplo) no parezca un día de menos atención. Con la media y el desvío estándar de las cuotas de los 20 días anteriores:

$$ cuota = 10.000 · n / N ;  z = (cuota − media) / desvío ;  Atención = 50 + 25 · z, recortada entre 0 y 100

Un día normal da cerca de 50; dos desvíos por encima, 100. Hacen falta al menos 5 días previos: la primera semana, la Atención queda sin valor y la página dice cuántos días faltan. Si el desvío es 0, z vale 0.

**Tono.** De los hasta 20 artículos clasificados, se cuentan los relevantes, los positivos y los negativos:

$$ Tono = 100 · (positivos − negativos) / relevantes

**Riesgo.** El porcentaje de los relevantes que Claude marcó como evento de riesgo (juicio, sanción o regulación, accidente, rebaja de pronósticos, conflicto laboral, problema de deuda, salida de directivos y parecidos):

$$ Riesgo = 100 · con riesgo / relevantes

Tono y Riesgo necesitan al menos 3 artículos relevantes; con menos, quedan sin valor ese día.

**Momento narrativo.** Una media móvil exponencial del Tono, con peso 0,3 para el día:

$$ Momento(hoy) = 0,3 · Tono(hoy) + 0,7 · Momento(ayer)

El primer día es igual al Tono. Si un día no hay Tono, el Momento se mantiene.

**Las noticias que lo movieron.** En la pestaña Índices, cada rueda se despliega y muestra, con link a cada artículo: el conteo y la base de la Atención con los artículos más relevantes, los artículos positivos (▲) y negativos (▼) que movieron el Tono y el Momento, y los marcados como riesgo (⚠). El número entre paréntesis al lado de cada índice es el cambio contra la rueda anterior.

Los índices llevan a la práctica tres maneras de medir narrativas que la segunda parte describe: contar artículos, como el índice de incertidumbre de Baker, Bloom y Davis; leer el tono de los textos, como Paul Tetlock con las columnas del *Wall Street Journal*; y seguir la evolución en el tiempo, como Shiller con las curvas de contagio de una narrativa (sección 27).

### 6. Sin trampa de anticipación

Una predicción solo vale si se escribió antes de conocer el resultado. El sistema lo asegura con cinco reglas:

1. **Solo antes de la apertura.** El pipeline no genera propuestas si el mercado ya abrió, y si las propuestas terminan de generarse después de la apertura, no las guarda.
2. **Un archivo por rueda, que nunca se edita.** Si ya existe el archivo del día, el pipeline no lo toca.
3. **Una cadena de hashes.** Cada archivo guarda el SHA-256 del archivo anterior. Cambiar un archivo viejo rompe la cadena desde ahí; la página la recalcula cada vez que se abre y avisa si está rota. Es la idea del sellado de documentos digitales de Haber y Stornetta (1991), en su versión más simple.
4. **El commit como sello.** Al evaluar, el pipeline busca en la historia de git el commit que agregó cada archivo. Si su hora es posterior a la apertura de esa rueda, o si el archivo cambió después de ese commit, o si la cadena no coincide, el resultado se guarda igual pero marcado como "no cuenta", con el motivo. Esas propuestas aparecen en la bitácora y no entran en ninguna métrica.
5. **Solo hacia adelante.** Las propuestas son siempre sobre la rueda que todavía no abrió. Ningún modelo puede tener en sus datos de entrenamiento lo que pasa después de hoy, así que el problema de la sección 20.3 (un modelo que "sabe" el resultado de una fecha pasada) no aparece.

Dos advertencias honestas. La hora de un commit la puede falsear quien tenga permiso de escritura en el repositorio; los registros de cada corrida de GitHub Actions, que guarda GitHub, son el testigo externo. Y tus decisiones, que viven en tu navegador, tienen la hora de tu reloj, no la de un commit.

### 7. La pantalla «Hoy» y tus decisiones

Arriba, un tablero resume el sistema: propuestas cerradas, tasa de aciertos con su intervalo, Brier, tu valor agregado y cuántos criterios del umbral se cumplen. Debajo, las propuestas del día, **ordenadas por confianza** de mayor a menor. Cada tarjeta muestra:

- el activo, la dirección (▲ compra o ▼ venta) y la confianza, con una barra de 50 a 100;
- la tesis;
- el episodio histórico parecido, con su link si se verificó;
- los riesgos;
- las noticias que la sostienen, con link;
- los cuatro índices del día con su cambio;
- el historial de ese activo (aciertos sobre cerradas) y el Brier del sistema;
- los botones **Aprobar** y **Rechazar**, activos hasta la apertura.

Tocar de nuevo el botón elegido deshace la decisión. Las decisiones quedan en tu navegador con su hora; desde la pestaña Bitácora se pueden exportar a un JSON e importar en otro navegador. Una decisión tomada después de la apertura (por ejemplo, importada de un archivo con otra hora) se muestra como "tarde" y no cuenta.

### 8. Las métricas

La confianza es la probabilidad, de 50 a 100, que la IA le asigna a acertar la dirección: compra acierta si el cierre de la quinta rueda queda por encima de la apertura de la primera; venta, si queda por debajo. Como la IA elige la dirección que cree más probable, nunca debería decir menos de 50.

| Métrica | Cómo se calcula |
|---|---|
| Rendimiento del activo | cierre de la quinta rueda / apertura de la primera − 1, redondeado a 0,1 % |
| Rendimiento de la propuesta | el del activo en una compra, el opuesto en una venta |
| Acierto | rendimiento de la propuesta mayor que 0 (con el valor sin redondear) |
| Tasa de aciertos | aciertos / propuestas cerradas que cuentan, con intervalo de Wilson al 95 % |
| Brier | promedio de (confianza/100 − acierto)², con acierto 1 o 0 |
| Calibración | en cada tramo de confianza (50–60, 60–70, 70–80, 80–90, 90–100), confianza media contra tasa de aciertos |
| Tu valor agregado | rendimiento medio de lo que aprobaste menos el de todo lo que decidiste a tiempo, en puntos porcentuales |
| Coincidencias | veces que aprobaste una que acertó o rechazaste una que falló, sobre todo lo que decidiste |

El intervalo de Wilson (1927) para una tasa observada p̂ en n casos, con z = 1,96:

$$ (p̂ + z²/2n ± z · √(p̂(1 − p̂)/n + z²/4n²)) / (1 + z²/n)

Se usa porque, a diferencia del intervalo "más o menos dos errores estándar", no se sale de 0 y 1 ni colapsa con pocos casos.

### 9. El umbral para pensar en plata real

La página muestra cuatro criterios. Mientras no se cumplan los cuatro, ni siquiera hay que pensar en plata real:

1. **300 propuestas cerradas o más.** Con 10 activos por día se llega en unas seis semanas.
2. **60 ruedas distintas o más** con propuestas cerradas (unos tres meses), para que todo no dependa de unas pocas semanas de mercado.
3. **Brier de 0,23 o menos.** Decir siempre 50 % da 0,25: hace falta una ventaja que se note.
4. **El piso del intervalo de Wilson de la tasa de aciertos por encima de 50 %,** para que la tasa no sea suerte.

Es una vara propia, no una regla del mercado, y es una condición necesaria, no suficiente. Las propuestas de días seguidos se superponen (el horizonte de 5 ruedas de la del lunes incluye cuatro ruedas de la del martes) y los activos se mueven juntos, así que los casos no son independientes y el intervalo real es más ancho que el calculado. Además, acertar la dirección no alcanza para ganar plata: faltan los costos de operar, el tamaño de cada posición y el riesgo. Aun cumpliendo los cuatro criterios, esto no es una recomendación de inversión.

### 10. Costos

**Fuentes de datos: US$ 0.** GDELT es gratis y sin key. El plan Basic de Twelve Data es gratis, con 8 créditos por minuto y 800 por día; el pipeline usa uno por activo y solo cuando hay propuestas para evaluar, es decir, como mucho 10 por día. GitHub Actions es gratis con los ejecutores estándar en repositorios públicos (https://docs.github.com/en/billing/concepts/product-billing/github-actions), y GitHub Pages también.

**La API de Claude.** Son dos llamadas por rueda. Para estimarlas, se armaron los dos pedidos con noticias reales de GDELT del 11 de noviembre de 2026, completando hasta 20 artículos por activo (el peor caso). Midieron 31.041 caracteres el de clasificación y 31.854 el de propuestas, sumando instrucciones, datos y esquema, y las respuestas esperadas, unos 27.500 caracteres. A 3 caracteres por token (una cuenta conservadora para JSON con títulos en varios idiomas), son unos **21.000 tokens de entrada** y **9.100 de salida visible** por rueda. El razonamiento del modelo también se cobra como salida y no se puede saber de antemano, así que se supone entre 0 y 19.400 tokens más: entre **9.100 y 28.500 de salida**. Con los precios publicados por Anthropic (https://platform.claude.com/docs/en/about-claude/pricing, consultados el 11 de noviembre de 2026) y 21 ruedas por mes:

| Modelo | Entrada / salida por millón de tokens | Por rueda | Por mes |
|---|---|---|---|
| Claude Opus 5.5 | US$ 4 / US$ 20 | US$ 0,27 a 0,65 | US$ 5,59 a 13,73 |
| Claude Sonnet 5.5 | US$ 2 / US$ 10 | US$ 0,13 a 0,33 | US$ 2,79 a 6,87 |
| Claude Haiku 5.5 | US$ 0,10 / US$ 0,50 | US$ 0,007 a 0,016 | US$ 0,14 a 0,34 |

Es una estimación, no una medición. La medición empieza con la primera corrida: el pipeline guarda en `data/costos.json` los tokens que informa la API en cada llamada y su costo, y la página muestra el total del mes en «Método». Si el costo real se va del rango, se puede bajar el esfuerzo en `data/config.json`, clasificar menos artículos o cambiar de modelo.

### 11. Ejemplo resuelto

La página tiene un ejemplo con datos inventados (`?ejemplo`, o el link "mirá el ejemplo"): cinco activos ficticios (ACME, BETA, GAMA, DLTA, EPSI) y 41 ruedas, del 19 de agosto al 15 de octubre de 2026. Los índices se calculan con las fórmulas reales sobre títulos inventados; los resultados los simula una IA "bien calibrada" que acierta con la probabilidad que declara, menos 3 puntos. Las decisiones también son inventadas, y el reloj del ejemplo marca las 9:40 del 15 de octubre, hora de Buenos Aires (antes de la apertura) para que se pueda probar aprobar y rechazar. Los clics no se guardan.

Con esos datos, la página muestra:

- **205 propuestas**: 180 cerradas y 25 abiertas (las de las últimas cuatro ruedas, cuyo horizonte no terminó, y las del día).
- **Hoy**, ordenadas por confianza: DLTA compra 72 %, GAMA compra 68 %, BETA venta 63 %, EPSI venta 57 % y ACME compra 56 %.
- **Tasa de aciertos: 61 %**, con intervalo de Wilson de 53 % a 67 %.
- **Brier: 0,234**, contra 0,25 de decir siempre 50 %.
- **Tu valor agregado: +0,16 pp.** Hay 114 decisiones a tiempo sobre propuestas cerradas (62 aprobadas). Lo aprobado rindió en promedio +0,94 %; todo lo decidido, +0,78 %. La decisión coincidió con el resultado el 55 % de las veces, y 6 decisiones llegaron después de la apertura y no cuentan.
- **Umbral: 1 de 4.** Se cumple el piso del intervalo (53 %, por encima de 50 %). Faltan cerradas (180 de 300), ruedas (36 de 60) y Brier (0,234; hace falta 0,23 o menos).

| Tramo | Propuestas | Dijo | Acertó |
|---|---|---|---|
| 50–60 % | 54 | 57 % | 57 % |
| 60–70 % | 98 | 64 % | 58 % |
| 70–80 % | 22 | 74 % | 73 % |
| 80–90 % | 6 | 83 % | 83 % |
| 90–100 % | 0 | — | — |

El ejemplo enseña tres cosas. Primero, una IA que acierta 61 % de las veces, con 180 propuestas, todavía no pasa el umbral: el Brier de 0,234 apenas mejora el 0,25 de la moneda, porque la confianza promedio (64 %) está por encima de lo que acierta. Segundo, la calibración se lee con cuidado: el generador acierta, por construcción, 3 puntos menos de lo que dice, y eso se ve en el tramo más poblado (dijo 64 %, acertó 58 %), mientras que los tramos chicos (22 y 6 casos) caen sobre la diagonal por azar. Tercero, un valor agregado de +0,16 pp con 114 decisiones no distingue a un buen filtro de uno que decide al azar: la sección 23 explica por qué.

### 12. Cómo leer los resultados

- **La tasa de aciertos sola engaña.** Un 55 % de aciertos con propuestas de 80 % de confianza es una IA sobreconfiada. Hay que mirarla junto con el Brier y la calibración.
- **El Brier mide las probabilidades.** 0 es perfecto; 0,25 es decir siempre 50 %. Un Brier de 0,24 con pocas propuestas es indistinguible del azar.
- **Tu valor agregado responde la pregunta central de la idea:** ¿la persona que aprueba o rechaza mejora el resultado respecto de seguir todo lo que decidió? Si es negativo, el filtro resta.
- **Las coincidencias, solas, engañan:** coincidir el 60 % de las veces suena bien, pero si las rechazadas rinden más que las aprobadas, el filtro está restando.
- **Con pocas propuestas, todo es ruido.** La sección 23 explica cuántas hacen falta.

#### 12.1 Preguntas frecuentes

**¿Por qué todas las propuestas se evalúan, aunque las rechace?** Porque sin saber qué habría pasado con las rechazadas no se puede medir si rechazarlas estuvo bien. Es el error más común al evaluar un filtro: mirar solo lo que se aprobó.

**¿Por qué la confianza va de 50 a 100?** Porque es la probabilidad de acertar la dirección que la IA misma eligió. Si creyera que acierta menos de la mitad de las veces, debería proponer la dirección contraria.

**¿Por qué no se publican los precios?** Porque los términos de Twelve Data permiten crear datos derivados de los que no se pueda reconstruir el original, pero no redistribuir los precios. Se publica solo el rendimiento de cada propuesta, redondeado.

**¿Qué pasa si un día no corre el workflow?** Ese día no hay propuestas ni índices. GitHub puede demorar o saltear corridas programadas cuando tiene mucha carga; si la corrida llega después de la apertura, el pipeline no genera propuestas.

**¿Por qué todas las propuestas pesan lo mismo?** Por simplicidad: no hay tamaño de posición, comisiones ni riesgo. Una versión más realista ponderaría cada operación.

**¿La confianza es la de la IA o la mía?** La de la IA. Tu decisión se mide aparte (valor agregado y coincidencias), así se puede saber por separado si la IA está calibrada y si vos agregás algo.

### 13. Limitaciones

- **Cobertura despareja.** GDELT monitorea sobre todo medios en inglés y una selección de medios traducidos. Las empresas argentinas tienen pocos artículos (sección 2).
- **Solo títulos.** Claude clasifica por el título, sin leer la nota; un título engañoso se clasifica mal.
- **Arranque lento.** La Atención necesita 5 días de historia, y la calibración, cientos de propuestas.
- **Casos que no son independientes.** Horizontes superpuestos y activos correlacionados hacen que los intervalos calculados sean optimistas.
- **Sin costos ni riesgo.** No hay comisiones, tamaño de posición, impuestos ni tipo de cambio (para quien opera los CEDEAR en pesos).
- **Precios con licencia acotada.** El plan gratis de Twelve Data es para uso interno; publicar rendimientos derivados se apoya en la cláusula 2.2(c) de sus términos (https://twelvedata.com/terms), que permite crear datos derivados que no permitan reconstruir los originales. Si Twelve Data lo interpretara distinto, la alternativa es pagar un plan con derechos de redistribución o publicar solo acierto o error.
- **Decisiones sin sello.** Tus decisiones tienen la hora de tu reloj.
- **El commit no es un notario.** Quien administra el repositorio puede falsear la hora de un commit; los registros de Actions son el testigo.
- **El link del episodio se verifica, el contenido no.** Que la página de Wikipedia exista no prueba que diga lo que la tesis afirma.
- **El modelo puede equivocarse con seguridad.** El esquema JSON fija la forma de la respuesta, no su verdad.
- **Calendario hasta 2028.** Para 2029 hay que agregar los feriados; el pipeline avisa.
- **No es una recomendación de inversión.**

## Parte II. Guía de la idea

### 14. La idea: predecir con historia

La idea original se llamaba "IA predictiva con trasfondo sociohistórico". Su intuición es que los precios de los activos no se mueven solo por números (ganancias, tasas, balances) sino por **historias**: la narrativa de una tecnología que va a cambiar todo, el miedo a una crisis que recuerda a otra, la moda de una generación. Una IA que leyera la historia y el contexto cultural de un activo, y encontrara episodios pasados parecidos, podría, según la idea, anticipar movimientos que los modelos puramente numéricos no ven. Un humano revisaría cada propuesta y decidiría.

La idea tiene un antecedente literario evidente: la **psicohistoria** de Isaac Asimov en la serie *Fundación* (1951 en adelante), una ciencia ficticia que predice el comportamiento de grandes poblaciones combinando historia, sociología y estadística. También tiene un antecedente académico: la **cliodinámica** que Peter Turchin propuso en 2008 (*Nature*, 454, 34–35), que busca regularidades matemáticas en los procesos históricos de largo plazo.

La primera versión de la herramienta no tenía IA: construyó primero lo que la idea misma pedía como base, un tablero para que el humano decida y un registro para medir si agrega valor. Esta versión agrega la IA, las noticias reales y los índices, pero conserva el orden de prioridades: la parte menos glamorosa, la evaluación honesta, es la más importante. Sin ella, cualquier sistema de predicción puede parecer brillante.

### 15. La economía narrativa

#### 15.1 Shiller

Robert Shiller, Premio Nobel de Economía en 2013, dedicó su discurso presidencial ante la American Economic Association de 2017 a lo que llamó **economía narrativa** (*American Economic Review*, 107(4), 967–1004), y lo amplió en el libro *Narrative Economics: How Stories Go Viral and Drive Major Economic Events* (2019). Su tesis es que las historias que circulan en una sociedad (sobre la tecnología que quita empleos, sobre la burbuja inmobiliaria, sobre el dinero digital) se propagan como epidemias, con contagio, pico y declive, y afectan decisiones económicas reales. Propuso estudiarlas con los métodos de la epidemiología y con el análisis de grandes cantidades de texto.

Shiller había mostrado antes, en 1981 (*American Economic Review*, 71(3), 421–436), que los precios de las acciones se mueven mucho más de lo que justificarían los cambios en los dividendos futuros: hay "exceso de volatilidad". La economía narrativa es, en parte, una explicación de ese exceso. La idea de la herramienta (tesis basadas en narrativas, e índices que intentan medirlas) está directamente en esta línea.

#### 15.2 Las manías

Charles Kindleberger, en *Manias, Panics, and Crashes* (1978), describió el ciclo típico de las burbujas financieras, basándose en un modelo de Hyman Minsky: un desplazamiento (una novedad que cambia las expectativas), un auge, una euforia en la que entran inversores sin experiencia atraídos por las ganancias ajenas, un momento de pánico y un derrumbe. Cada manía tiene su historia: los canales, los ferrocarriles, la radio, internet. Son el tipo de episodio que la IA puede proponer como análogo de una tesis, y conviene conocerlos para juzgar si la analogía es buena.

Carlota Perez, en *Technological Revolutions and Financial Capital* (2002), propuso un modelo de largo plazo: cada revolución tecnológica (la máquina de vapor, el ferrocarril, la electricidad, el automóvil, la informática) pasa por una fase de **instalación**, dominada por el capital financiero y con burbujas, y una fase de **despliegue**, en la que la tecnología se difunde a toda la economía. Las burbujas, para Perez, no son solo errores: financian la infraestructura de la revolución. Una tesis del tipo "la narrativa de esta tecnología recién empieza a llegar al público masivo" es una lectura de esta clase.

#### 15.3 Los tulipanes, revisados

Una analogía muy citada, la de los tulipanes de 1637, merece una advertencia. La historia de la "tulipomanía" holandesa, en la que bulbos de tulipán se habrían vendido por el precio de una casa antes de un derrumbe que arruinó a medio país, se difundió sobre todo a partir de *Extraordinary Popular Delusions and the Madness of Crowds*, de Charles Mackay (1841). Investigaciones posteriores la revisaron. Peter Garber argumentó en 1989 (*Journal of Political Economy*, 97(3), 535–560) que muchos precios altos correspondían a variedades raras, cuyos precios caen naturalmente cuando se multiplican, y que el episodio de 1637 fue breve y acotado. Anne Goldgar, en *Tulipmania: Money, Honor, and Knowledge in the Dutch Golden Age* (2007), revisó los archivos y no encontró evidencia de la ruina generalizada que cuenta la leyenda.

La lección para la idea es doble. Primero, las analogías históricas dependen de que la historia esté bien contada: una analogía con un episodio mal entendido es una mala analogía. Segundo, las narrativas sobre el pasado también son narrativas, y también se contagian.

### 16. Razonar con analogías históricas

#### 16.1 Neustadt y May

Richard Neustadt y Ernest May, de la Escuela Kennedy de Harvard, estudiaron en *Thinking in Time: The Uses of History for Decision Makers* (1986) cómo los funcionarios de gobierno usan (y abusan de) las analogías históricas. Encontraron que las decisiones suelen tomarse con una sola analogía, elegida rápido y por parecido superficial ("esto es como Múnich 1938", "esto es otro Vietnam"), sin examinar en qué se parece y en qué no. Propusieron un método simple: escribir las semejanzas y las diferencias entre la situación actual y la analogía, y preguntarse qué predicciones haría cada una.

El "episodio histórico parecido" de cada propuesta es exactamente una analogía, y el pipeline le pide a la IA que diga por qué se parece. Una mejora natural, siguiendo a Neustadt y May, sería pedir también las **diferencias**: en qué no se parece el caso de hoy al episodio elegido.

#### 16.2 Analogías estructuradas

Kesten Green y J. Scott Armstrong estudiaron en 2007 (*International Journal of Forecasting*, 23(3), 365–376) el uso de **analogías estructuradas** para pronosticar decisiones en conflictos: pedir a expertos que listen varias situaciones análogas, califiquen su semejanza y anoten qué pasó en cada una. Los pronósticos con analogías estructuradas fueron bastante más precisos que los juicios no estructurados de los mismos expertos. Una analogía sola es una anécdota; varias, ponderadas, empiezan a ser datos.

#### 16.3 Clase de referencia

Daniel Kahneman y Dan Lovallo propusieron en 1993 (*Management Science*, 39(1), 17–31) distinguir la **visión interna** (pensar el caso con sus detalles, que lleva al optimismo) de la **visión externa** (preguntarse cómo les fue a casos parecidos, sin mirar los detalles). Bent Flyvbjerg convirtió la visión externa en un método, el **pronóstico por clase de referencia**, que hoy se usa para estimar costos y plazos de grandes obras.

Para la idea, la visión externa sugiere una pregunta incómoda pero imprescindible: de todas las veces que alguien invirtió en una "narrativa que recién empieza a llegar al público", ¿cuántas ganaron? Esa es la tasa base contra la que hay que comparar cualquier tesis narrativa.

#### 16.4 Analogías frecuentes, una por una

Estas son analogías que aparecen seguido en las tesis de inversión. Vale la pena mirarlas con el método de Neustadt y May, para practicar cómo se evalúa el episodio que propone la IA.

- **Ferrocarriles, década de 1840.** La "manía ferroviaria" británica de esa década es un caso clásico: una tecnología que efectivamente transformó la economía, financiada con una burbuja de acciones que se derrumbó en 1847. La analogía dice dos cosas a la vez: que la tecnología triunfó y que muchos de los que invirtieron en ella perdieron. Una tesis que la usa tiene que decir cuál de las dos cosas espera.
- **Tulipanes, 1637.** Como se vio en la sección 15.3, la versión popular del episodio es dudosa. Una analogía con una leyenda es frágil.
- **Bienes de consumo masivo en 2008.** La idea de que las marcas de consumo básico resisten las crisis tiene sustento en varias recesiones, pero cada crisis es distinta. Una analogía cómoda puede inflar la confianza.
- **Revival de vinilos, 2010.** Una analogía de nicho: el regreso de un formato por nostalgia. Es una buena analogía para una moda cultural, menos para predecir el valor de una empresa grande.
- **Inmigración europea en Argentina, 1880–1914.** Uno de los mayores movimientos migratorios de la historia: millones de personas, sobre todo de Italia y España, que transformaron la demografía, el consumo y la cultura del país. Es una analogía con un contexto local y una escala muy precisa; una tesis que la usa tiene que mostrar que el fenómeno actual tiene un tamaño comparable.
- **Electrodomésticos, década de 1920.** La electrificación de los hogares y la difusión de la heladera, el lavarropas y la radio son un ejemplo de adopción masiva de una tecnología de consumo, con la curva en forma de S que estudió Everett Rogers. La pregunta, otra vez, es en qué punto de la curva estaría el caso actual.

Ninguna de estas analogías es buena o mala en sí misma. Lo que importa es que la tesis diga **qué** toma de la analogía y **qué** deja afuera. Una analogía que no se puede refutar ("esto es como los ferrocarriles") no informa nada; una que hace una predicción concreta ("como en los ferrocarriles, la adopción va a tardar más que la euforia, así que el precio va a caer antes de subir") se puede evaluar con la bitácora. Como el pipeline comprueba solo que el link del episodio exista, juzgar la analogía sigue siendo trabajo del humano.

### 17. El problema de fondo: los mercados son difíciles de predecir

#### 17.1 Mercados eficientes

Eugene Fama formuló en 1970 (*Journal of Finance*, 25(2), 383–417) la **hipótesis de los mercados eficientes**: los precios reflejan toda la información disponible, así que no se puede obtener sistemáticamente un rendimiento extraordinario usando esa información. En su versión fuerte, la hipótesis es discutible y ha sido muy criticada (por Shiller entre otros: Fama y Shiller compartieron el Nobel de 2013 con Lars Peter Hansen, con posiciones parcialmente opuestas). Pero su versión débil es una advertencia sensata: si una historia es conocida por todos, probablemente ya está en el precio.

Una tesis narrativa solo puede agregar valor si la narrativa **todavía no** está en el precio: si el mercado no la incorporó o la incorporó mal. Tesis como "recién empieza a llegar al público masivo" o "todo el mundo habla de esto: narrativa saturada" son, justamente, afirmaciones sobre ese desfase. Son las afirmaciones más difíciles de sostener, y con un horizonte de 5 ruedas sobre acciones muy seguidas, como las de la watchlist, la vara es todavía más alta: la noticia de ayer suele estar en el precio de hoy.

#### 17.2 Operar es peligroso para el patrimonio

Brad Barber y Terrance Odean analizaron en 2000 (*Journal of Finance*, 55(2), 773–806) las operaciones de unos 66 000 hogares con cuentas en una agencia de bolsa entre 1991 y 1996, con un título explícito: *Trading is hazardous to your wealth*. Los que más operaban obtenían rendimientos netos bastante menores que el mercado, sobre todo por los costos de operar. Odean ya había propuesto en 1998 (*Journal of Finance*, 53(6), 1887–1934) que el **exceso de confianza** explicaba ese exceso de operaciones.

A escala profesional, los informes periódicos SPIVA de S&P Dow Jones Indices muestran, año tras año, que la mayoría de los fondos de gestión activa rinden menos que su índice de referencia en horizontes de diez años o más. Por eso uno de los próximos pasos del proyecto (comparar contra un índice de referencia) es indispensable: una estrategia que gana 6 % cuando el índice ganó 10 % no agregó valor. Hoy la bitácora mide si se acierta la dirección, no si se le gana al mercado.

### 18. Clínico contra actuarial: humanos y fórmulas

#### 18.1 Meehl

Paul Meehl publicó en 1954 *Clinical versus Statistical Prediction*, un libro breve que revisó estudios en los que se comparaban las predicciones de expertos (psicólogos, médicos, oficiales de libertad condicional) con las de fórmulas estadísticas simples. En casi todos los casos, la fórmula igualaba o superaba al experto. Robyn Dawes, David Faust y Meehl actualizaron la revisión en 1989 (*Science*, 243(4899), 1668–1674) con la misma conclusión. Los expertos aportan información valiosa, pero la combinan peor que una regla fija: son inconsistentes, se dejan llevar por casos llamativos y no aprenden bien de sus errores.

Esto no dice que los humanos no sirvan. Dice que hay que **medir** si sirven en cada caso, en vez de suponerlo. La herramienta es, en ese sentido, un dispositivo meehliano: compara la decisión humana con la regla más simple posible (seguir todo lo que se decidió).

#### 18.2 Aversión y apreciación de algoritmos

Berkeley Dietvorst, Joseph Simmons y Cade Massey mostraron en 2015 (*Journal of Experimental Psychology: General*, 144(1), 114–126) que las personas pierden la confianza en un algoritmo mucho más rápido que en un humano después de verlo equivocarse, aunque el algoritmo se equivoque menos: la **aversión a los algoritmos**. Jennifer Logg, Julia Minson y Don Moore encontraron en 2019 (*Organizational Behavior and Human Decision Processes*, 151, 90–103) el efecto contrario en otras condiciones: muchas personas siguen más el consejo de un algoritmo que el de un humano, la **apreciación de los algoritmos**, salvo cuando se trata de expertos en el tema, que tienden a descartar el algoritmo.

Las dos tendencias son relevantes para la idea. Un humano con aversión rechazaría propuestas buenas de la IA; uno con apreciación excesiva aprobaría todo sin revisar. La bitácora permite ver cuál de las dos está pasando.

### 19. El humano en el circuito

#### 19.1 Las ironías de la automatización

Lisanne Bainbridge publicó en 1983 un artículo breve que se volvió un clásico de la ingeniería de factores humanos: *Ironies of automation* (*Automatica*, 19(6), 775–779). Su argumento: cuando se automatiza un proceso y se deja a un humano para supervisarlo e intervenir en casos excepcionales, se le asigna la tarea más difícil (detectar y resolver lo que el sistema no puede) mientras se lo priva de la práctica que necesitaría para hacerlo bien. Cuanto mejor funciona la automatización, peor preparado está el humano para el día en que falla.

La idea original reconoce este riesgo con una frase: que los humanos se vuelvan **sellos de goma**. La herramienta lo hace medible.

#### 19.2 Sesgo de automatización

Raja Parasuraman y Victor Riley clasificaron en 1997 (*Human Factors*, 39(2), 230–253) los problemas de la relación entre humanos y automatización: **uso** apropiado, **mal uso** (confiar demasiado), **desuso** (confiar demasiado poco) y **abuso** (automatizar sin considerar al humano). Linda Skitka, Kathleen Mosier y Mark Burdick documentaron en 1999 (*International Journal of Human-Computer Studies*, 51(5), 991–1006) el **sesgo de automatización**: personas que, con un sistema de ayuda, cometen errores que no cometerían sin él, porque siguen sus recomendaciones equivocadas (errores de comisión) o no actúan cuando el sistema no avisa (errores de omisión).

En la bitácora, el sesgo de automatización se vería así: el humano aprueba casi todo, la tasa de aprobación tiende al 100 % y el valor agregado tiende a cero. El problema contrario, rechazar justo las propuestas buenas, se ve como un valor agregado negativo. Los dos se detectan con las mismas métricas.

#### 19.3 Qué tiene que ver el humano

Para que la decisión humana sea informada, la idea propone que el humano vea la propuesta completa: el razonamiento (tesis), la analogía, la confianza y los riesgos. Es lo que la investigación sobre **explicabilidad** sugiere, con una advertencia: mostrar explicaciones no garantiza mejores decisiones. Varios estudios encontraron que las explicaciones aumentan la confianza en el sistema aunque el sistema se equivoque, es decir, pueden empeorar el sesgo de automatización. La única manera de saber si el formato de la propuesta ayuda al humano a decidir mejor es medir, como hace la bitácora.

#### 19.4 El humano contra una regla

La comparación de la bitácora (lo aprobado contra todo lo decidido) es la más simple posible. Una comparación más exigente, en el espíritu de Meehl, es contra una **regla fija** que use la misma información que tiene el humano. Por ejemplo, "aprobar solo las propuestas con confianza de 60 % o más".

La pregunta que esta comparación permite responder es si el humano aporta algo **más allá** de seguir la confianza que declara la IA. Si sus decisiones coinciden siempre con una regla de umbral, el humano es, en el sentido de la idea, un sello de goma con un umbral. Si se aparta de la regla, la bitácora permite ver si esos apartamientos mejoran o empeoran el resultado. Agregar al resumen una o dos reglas fijas de referencia sería una mejora simple y muy informativa; todavía no está hecha.

### 20. Saber el resultado: el sesgo de anticipación

#### 20.1 Fischhoff y el sesgo retrospectivo

Baruch Fischhoff publicó en 1975 *Hindsight ≠ foresight* (*Journal of Experimental Psychology: Human Perception and Performance*, 1(3), 288–299). Pidió a personas que estimaran la probabilidad de distintos desenlaces de episodios históricos poco conocidos. A algunas les dijo cuál había sido el desenlace real; a otras, no. Las que conocían el desenlace le asignaban una probabilidad mucho más alta y no se daban cuenta de que esa información las influía. Es el **sesgo retrospectivo**: una vez que se sabe qué pasó, parece que era previsible.

En finanzas, el sesgo retrospectivo produce tesis brillantes escritas después de los hechos. La bitácora lo controla sellando cada tesis con un commit antes de la apertura: si el sello es posterior, la propuesta no cuenta (sección 6).

#### 20.2 El sesgo de anticipación en las pruebas históricas

En la evaluación de estrategias de inversión, el **sesgo de anticipación** (*look-ahead bias*) es usar, en una prueba sobre datos históricos, información que no estaba disponible en el momento simulado: un balance publicado después, un precio de cierre del día para decidir a la apertura. David Bailey, Jonathan Borwein, Marcos López de Prado y Qiji Jim Zhu advirtieron en 2014 (*Notices of the American Mathematical Society*, 61(5), 458–471) que muchas estrategias publicadas tienen rendimientos que no son más que artefactos de pruebas mal diseñadas: sesgo de anticipación, sobreajuste a los datos y la prueba de muchas variantes hasta que una parece funcionar. Campbell Harvey, Yan Liu y Heqing Zhu mostraron en 2016 (*Review of Financial Studies*, 29(1), 5–68) que, con cientos de "factores" propuestos en la literatura, la mayoría de los hallazgos probablemente son falsos positivos.

La regla de la bitácora (sellar la tesis antes, con un horizonte fijo, y medir después) es la versión más elemental de la **preregistración**: comprometerse con la predicción antes de ver el resultado.

#### 20.3 El problema de los modelos de lenguaje

El control de fechas no alcanza cuando las tesis las escribe un modelo de lenguaje. Un modelo entrenado con textos hasta cierta fecha "sabe" lo que pasó hasta esa fecha. Si se le pide que escriba una tesis "como si estuviera en marzo de 2024" sobre un activo cuyo destino posterior aparece en sus datos de entrenamiento, la tesis puede estar contaminada por ese conocimiento, aunque la fecha declarada sea correcta. Varios trabajos de 2023 y 2024 que evaluaron la capacidad de los modelos de lenguaje para predecir rendimientos bursátiles a partir de noticias discutieron este riesgo, y algunos propusieron pruebas para detectarlo (por ejemplo, comparar el desempeño antes y después de la fecha de corte del entrenamiento).

Por eso el pipeline solo pide predicciones sobre la rueda que todavía no abrió, y registra en cada archivo qué modelo respondió. Como toda predicción es sobre períodos **posteriores** a la fecha de corte de los datos de cualquier modelo, el conocimiento del entrenamiento no puede contaminar el resultado. Lo que sí puede pasar es otra cosa: que el modelo use mal la información que tiene, por ejemplo apostando a una noticia que el mercado ya incorporó.

### 21. Calibración: ¿la confianza significa algo?

#### 21.1 El puntaje de Brier

Glenn Brier, meteorólogo, propuso en 1950 (*Monthly Weather Review*, 78(1), 1–3) una manera de medir la calidad de los pronósticos probabilísticos: el promedio del cuadrado de la diferencia entre la probabilidad pronosticada y lo que pasó (1 o 0). Un pronóstico perfecto tiene Brier 0. Decir siempre 50 % da 0,25. Decir 100 % y errar siempre da 1.

Allan Murphy mostró en 1973 (*Journal of Applied Meteorology*, 12(4), 595–600) que el puntaje de Brier se puede descomponer en tres partes: la **incertidumbre** propia del fenómeno (que no depende de quien pronostica), la **confiabilidad** (si las probabilidades declaradas coinciden con las frecuencias observadas: la calibración) y la **resolución** (si los pronósticos distinguen entre casos que salen distinto). Un buen pronosticador está calibrado **y** tiene resolución: no basta con decir 60 % siempre, aunque gane el 60 % de las veces.

#### 21.2 La sobreconfianza

Sarah Lichtenstein, Baruch Fischhoff y Lawrence Phillips revisaron en 1982 la evidencia sobre calibración y encontraron que la mayoría de las personas, incluidos los expertos, están **sobreconfiadas**: sus "90 %" se cumplen bastante menos que el 90 % de las veces. Los meteorólogos son una excepción notable: están bien calibrados porque reciben retroalimentación inmediata y precisa sobre miles de pronósticos.

La lección para la idea es que la calibración se aprende con retroalimentación sistemática, y que la bitácora puede ser esa retroalimentación. El gráfico de calibración, con cientos de propuestas, va a mostrar si la confianza declarada por la IA significa algo. Una mejora posible es devolverle a la IA su propio historial de calibración en cada pedido, como el meteorólogo que ve cómo le fue ayer.

#### 21.3 Tetlock

Philip Tetlock registró durante dos décadas más de 80 000 predicciones de unos 280 expertos en política y economía, y publicó los resultados en *Expert Political Judgment* (2005): en promedio, no superaban mucho a reglas simples, y los más conocidos en los medios eran de los peores. Los mejores eran los que Tetlock llamó **zorros** (que usan muchas ideas pequeñas y dudan) frente a los **erizos** (que explican todo con una gran teoría). Una IA que explica todo con una narrativa histórica corre el riesgo de ser un erizo. Su antídoto es la medición.

### 22. Por qué con dinero simulado

La idea insiste en que todo empiece con dinero simulado, nunca real. Hay razones metodológicas, además de las obvias:

- **Separar la evaluación del resultado personal.** Con dinero real, las pérdidas duelen, y el dolor distorsiona las decisiones siguientes (la aversión a la pérdida de Kahneman y Tversky, el efecto de disposición de Shefrin y Statman: vender rápido lo que gana y aferrarse a lo que pierde). Con dinero simulado se puede evaluar el proceso de decisión con más frialdad.
- **Poder evaluar las rechazadas.** Con dinero real, lo que no se compró no tiene precio de cierre en la cuenta. En la bitácora, todas las propuestas se evalúan.
- **Acumular sin costo.** Hacen falta decenas o cientos de propuestas para evaluar algo. Con dinero simulado, el costo de esa acumulación es solo el tiempo.

La desventaja es que el *paper trading* no incluye costos de operar, impacto en los precios ni la presión psicológica real. Una estrategia que funciona en papel puede no funcionar con dinero. Pero una que no funciona en papel, casi seguro no funcionará con dinero.

### 23. Cuántas propuestas hacen falta

Con 10 propuestas por rueda, en un mes hay unas 200. ¿Alcanzan para concluir algo?

Para la tasa de aciertos, el error estándar de una proporción cerca de 50 % es √(0,25/n). Con 200 propuestas es 3,5 puntos, así que una tasa de 55 % todavía es compatible con el azar; con 400, 2,5 puntos, y 55 % empieza a distinguirse. Pero esa cuenta supone casos independientes, y no lo son: los horizontes de 5 ruedas se superponen y los activos se mueven juntos. Si en la práctica cada rueda aporta, digamos, la información de 3 casos independientes en vez de 10, hace falta más del triple de tiempo. Para la calibración, cada tramo de confianza necesita al menos veinte o treinta propuestas, y los tramos altos (80 % o más) se llenan despacio. Para el valor agregado, que compara promedios de rendimientos de varios puntos de dispersión, hacen falta del orden de cien decisiones o más.

Por eso el umbral de la sección 9 pide 300 propuestas en 60 ruedas, y aun así lo presenta como una condición necesaria. La honestidad de la herramienta está en mostrar los números junto con la advertencia de que con pocos datos son ruido.

### 24. La IA que ahora está: qué cumple el dossier y qué falta

La versión anterior de esta guía describía cómo debería ser el dossier de una IA. Ahora que la IA está conectada, vale la pena repasar la lista y ver qué se cumple:

1. **Declarar la fecha de corte y la de la tesis.** Cumplido a medias: cada archivo guarda la fecha y hora de la tesis y el modelo que respondió; como las predicciones son siempre sobre el futuro, la fecha de corte deja de importar para la anticipación.
2. **Proponer varias analogías**, no una, con sus semejanzas y diferencias (Neustadt y May; Green y Armstrong). Falta: hoy pide una sola, con sus semejanzas.
3. **Dar la tasa base**: cómo les fue, en general, a casos de esa clase de referencia (Kahneman y Lovallo). Falta.
4. **Explicar por qué la narrativa no está en el precio**, si la tesis depende de eso (Fama). A medias: la tesis tiene que decir qué noticia o índice la sostiene, pero no por qué el mercado no la incorporó.
5. **Declarar una confianza** como probabilidad, para poder calibrarla (Brier). Cumplido.
6. **Listar los riesgos** y qué observación, en el futuro, refutaría la tesis (Popper aplicado a una inversión). Cumplido a medias: lista riesgos, pero no una observación concreta que la refute.
7. **Fijar de antemano la fecha de cierre**, para evitar elegir cuándo cerrar según el resultado. Cumplido: siempre 5 ruedas.

Con esos dossiers, la bitácora ya responde por separado dos de las tres preguntas: ¿la IA está calibrada? y ¿el humano mejora o empeora el resultado al filtrar? La tercera, ¿sus propuestas superan al índice?, necesita comparar contra un índice de referencia, que todavía no está.

### 25. Riesgos, ética y regulación

Una herramienta que evalúa predicciones financieras con dinero simulado es inocua. Una IA que propone inversiones con dinero real a otras personas no lo es, y la idea debería tenerlo presente desde el principio.

**El riesgo de la narrativa convincente.** Los modelos de lenguaje son muy buenos produciendo textos plausibles. Una tesis bien escrita, con una analogía histórica elegante, puede convencer más que lo que su evidencia justifica. Es exactamente el mecanismo que Shiller describe para las narrativas económicas: lo que se contagia no es lo verdadero sino lo que se cuenta bien. Una IA de tesis narrativas podría, sin proponérselo, ser una fábrica de narrativas contagiosas.

**El riesgo de la escala.** Si muchas personas usaran la misma IA y recibieran las mismas tesis, sus decisiones se correlacionarían, y la IA podría mover los precios que pretende predecir. Es el monocultivo algorítmico que Kleinberg y Raghavan describieron para otras decisiones automatizadas: los errores de un sistema usado por todos no se compensan.

**La regulación.** En la mayoría de los países, recomendar inversiones a terceros es una actividad regulada. En la Argentina, la Ley 26.831 de Mercado de Capitales (2012) y las normas de la Comisión Nacional de Valores regulan a quienes asesoran o recomiendan inversiones al público, con requisitos de registro, idoneidad y conducta. Una IA que hiciera recomendaciones personalizadas a usuarios con dinero real caería, muy probablemente, dentro de ese marco. La bitácora registra propuestas con dinero simulado, para medirlas. Como la página es pública y las propuestas son sobre acciones reales, cada pantalla avisa que no es una recomendación de inversión. Esta guía no es asesoramiento legal: antes de usar algo así con terceros o con dinero real, hay que consultarlo con quien sepa.

**La honestidad de las métricas.** El mayor riesgo ético de un sistema de predicción es mostrar sus aciertos y esconder sus errores. La bitácora está diseñada para lo contrario: evalúa las rechazadas, sella las tesis antes del resultado, deja a la vista las que no cuentan y por qué, compara con la regla más simple y muestra el Brier y la calibración. Cualquier versión futura con IA debería conservar esa transparencia, y publicar las métricas completas antes de pedirle a nadie que confíe en sus propuestas.

### 26. Otras maneras de predecir y de evaluar predicciones

La bitácora es un dispositivo para evaluar a un pronosticador. Hay otros dispositivos, más grandes y más estudiados, que muestran cómo se puede organizar la predicción colectiva y qué rinde mejor.

#### 26.1 Mercados de predicción

Un **mercado de predicción** es un mercado en el que se compran y venden contratos que pagan según el resultado de un evento futuro: por ejemplo, un contrato que paga un peso si un candidato gana una elección y nada si pierde. El precio del contrato, entre 0 y 1, se puede leer como la probabilidad que el mercado le asigna al evento. Desde 1988, la Universidad de Iowa opera los Iowa Electronic Markets, con dinero real pero montos chicos, con fines de investigación. Joyce Berg, Robert Forsythe, Forrest Nelson y Thomas Rietz resumieron en 2008 una docena de años de resultados: en las elecciones presidenciales de Estados Unidos, los precios del mercado fueron, en la mayoría de los casos, más precisos que las encuestas publicadas en las mismas fechas.

Justin Wolfers y Eric Zitzewitz revisaron en 2004 (*Journal of Economic Perspectives*, 18(2), 107–126) la evidencia sobre mercados de predicción y concluyeron que suelen ser buenos agregadores de información, con limitaciones: funcionan peor cuando hay pocos participantes, cuando el evento es muy lejano o cuando hay incentivos para manipular el precio.

Para la idea, los mercados de predicción son una referencia útil: si existe un mercado sobre un evento, la tesis narrativa tiene que explicar no solo por qué va a pasar algo, sino por qué el mercado le asigna una probabilidad equivocada. Es la versión aplicada de la pregunta de Fama (sección 17.1).

#### 26.2 Torneos de pronóstico

Entre 2011 y 2015, la agencia de investigación de inteligencia de Estados Unidos organizó un torneo en el que varios equipos competían pronosticando cientos de eventos geopolíticos. El equipo Good Judgment Project, liderado por Philip Tetlock y Barbara Mellers, ganó con amplitud. Mellers y colaboradores publicaron en 2014 (*Psychological Science*, 25(5), 1106–1115) qué funcionó: un entrenamiento breve en razonamiento probabilístico (usar tasas base, evitar sesgos comunes), trabajar en equipos que discutían sus pronósticos y seleccionar a los mejores pronosticadores del año anterior para formar equipos de élite, los "superpronosticadores".

Jonathan Baron y colaboradores mostraron además, con datos del mismo torneo (*Decision Analysis*, 11(2), 133–145, 2014), que el promedio de muchos pronósticos individuales se mejora si se lo **extremiza**, es decir, si se lo aleja un poco del 50 %. La razón es que cada pronosticador tiene solo parte de la información, y al promediar, la confianza colectiva queda más tibia de lo que justifica la información sumada.

La bitácora mide exactamente lo que medía el torneo: el puntaje de Brier de cada pronóstico. La diferencia es de escala: el torneo tenía miles de pronósticos por participante; la bitácora suma diez por rueda.

#### 26.3 Modelos de lenguaje que pronostican

Desde 2023, varios grupos estudiaron si los modelos de lenguaje pueden pronosticar eventos futuros. Danny Halawi, Fred Zhang, Chen Yueh-Han y Jacob Steinhardt construyeron en 2024 un sistema que busca noticias recientes, las resume y genera pronósticos sobre preguntas de plataformas de pronóstico, y lo evaluaron solo con preguntas que se resolvieron después de la fecha de corte de los datos del modelo, precisamente para evitar el sesgo de anticipación de la sección 20.3. Encontraron que el sistema se acercaba al promedio de los pronosticadores humanos de esas plataformas, sin superarlo en general, y que combinar sus pronósticos con los humanos mejoraba ambos.

Ese diseño de evaluación es el que la idea necesita, y el que el pipeline sigue: preguntas que se resuelven después de la fecha de corte, comparación con una referencia humana (tus decisiones) y medición con Brier. Ya tiene la estructura y la IA; le falta el volumen.

### 27. Narrativas que se pueden medir

La economía narrativa de Shiller no se quedó en la teoría: hay métodos para medir narrativas en textos, y una IA como la que la idea propone podría usarlos.

- **Frecuencia de términos.** Shiller mismo usó la frecuencia de palabras y frases en archivos de diarios y libros digitalizados para seguir la evolución de narrativas como "burbuja inmobiliaria" o "la tecnología quita empleos": cuándo aparecen, cuándo llegan a su pico y cuándo se apagan. La curva se parece a la de una epidemia, como él proponía.
- **Índices de incertidumbre.** Scott Baker, Nicholas Bloom y Steven Davis construyeron en 2016 (*Quarterly Journal of Economics*, 131(4), 1593–1636) un índice de incertidumbre de política económica contando, en los principales diarios, los artículos que mencionan a la vez términos de economía, de incertidumbre y de política. El índice sube en elecciones disputadas, crisis fiscales y guerras, y se asocia con caídas de la inversión. Es una narrativa convertida en serie de tiempo.
- **Sentimiento en el texto.** Paul Tetlock (homónimo del de los pronósticos) mostró en 2007 (*Journal of Finance*, 62(3), 1139–1168) que la proporción de palabras negativas en una columna diaria del *Wall Street Journal* predecía caídas de corto plazo de los precios, seguidas de una reversión. El pesimismo de los medios movía el mercado, pero transitoriamente.

Estas medidas sugieren un uso más modesto y más verificable de la idea: además de una IA que cuente una historia y prediga un precio, una que mida la intensidad de una narrativa en los textos y la registre con fecha. Es lo que hacen los índices de esta versión: la Atención cuenta artículos como Baker, Bloom y Davis; el Tono y el Riesgo leen el texto como Tetlock; el Momento sigue la evolución en el tiempo. Cada propuesta sellada guarda los índices del día en que se escribió. Con suficientes propuestas, se va a poder ver si las tesis escritas con Atención alta (el pico de una narrativa) rinden distinto que las escritas con Atención baja (el principio): la hipótesis de "recién empieza a llegar al público" contra "narrativa saturada", convertida en algo que se puede medir.

### 28. Del modelo al código

| Concepto | Dónde | Qué produce |
|---|---|---|
| Definición y cálculo de los índices | `src/indices.js`: `DEFINICIONES`, `calcularDia`, `cambios`, `movieron` | Atención, Tono, Riesgo y Momento de una rueda, y qué artículos los movieron |
| Calendario de NYSE | `src/calendario.js`: `esRueda`, `rueda`, `apertura`, `cierre` | Ruedas hábiles, la quinta rueda y la hora de apertura en UTC, con y sin horario de verano |
| Sellos | `src/sellos.js`: `sha256`, `verificarCadena` | El hash de cada archivo y los archivos donde la cadena se rompe |
| Bitácora | `src/bitacora.js`: `unir`, `resumen`, `calibracion`, `umbral`, `ranking`, `validarDia` | Las métricas del sistema y del humano, los tramos de calibración y los criterios del umbral |
| Costos | `src/costos.js`: `costo`, `estimar`, `delMes` | Dólares por llamada, por rueda y por mes |
| Noticias | `pipeline/gdelt.js`: `bajarVentana`, `seleccionar` | Conteo por activo y los 20 artículos para clasificar |
| Pedidos a Claude | `pipeline/claude.js`: `pedidoClasificacion`, `pedidoPropuestas`, `interpretar…` | Los pedidos con esquema JSON y la validación de las respuestas |
| Precios | `pipeline/precios.js`: `serieDiaria`, `evaluar` | El rendimiento derivado de cada propuesta, sin guardar precios |
| Corrida | `pipeline/correr.js`: `correr` | Todo lo anterior, en orden, escrito en `data/` |

Hay 26 tests (`npm test`), que no usan red ni keys: GDELT, Twelve Data, Wikipedia y Claude están simulados. Verifican las fórmulas de los índices; el calendario, incluido el feriado de Acción de Gracias y el horario de verano; las métricas, el intervalo de Wilson, la calibración y el umbral; que la cadena de hashes se rompe al editar un archivo viejo; la lectura de los zip y de las líneas de GDELT; que los pedidos a Claude llevan salida estructurada, esfuerzo y respaldo; que se descartan las respuestas inválidas; y tres corridas completas: una que sella propuestas, encadena hashes, no reescribe un día sellado y no genera nada después de la apertura; otra que evalúa con precios en memoria, no publica ningún precio y marca como "no cuenta" una propuesta sellada tarde; y una en seco.

```js
const B = require("./src/bitacora.js");
const E = require("./src/ejemplo.js");
const d = E.datos();
const r = B.resumen(B.unir(d.dias, d.resultados, d.decisiones));
r.cerradas;      // 180
r.brier;         // ≈ 0,234
r.humano.valor;  // ≈ 0,0016 (+0,16 pp)
```

### 29. Ejercicios

1. Con el ejemplo de la página, mirá el gráfico de calibración. ¿Qué tramo está más lejos de la diagonal? ¿Cuántas propuestas tiene? ¿Le creerías?
2. Calculá a mano el Brier de alguien que dice siempre 50 % y el de alguien que dice siempre 100 % y acierta 60 % de las veces. Compará con el 0,234 del ejemplo.
3. Tomá un día de un activo en la pestaña Índices y leé los títulos que movieron el Tono. ¿Coincidís con la clasificación de Claude? Anotá cuántos cambiarías.
4. Escribí una tesis sobre uno de los activos de la watchlist, con dos analogías históricas y sus diferencias, y comparala con la que propone la IA ese día.
5. Diseñá una regla que no use la confianza (por ejemplo, "aprobar solo las compras" o "aprobar solo con Riesgo menor que 20") y, cuando haya 100 propuestas cerradas, calculá su valor contra el tuyo.
6. ¿Cuántas propuestas harían falta para distinguir una tasa de aciertos de 53 % del azar con un error estándar de 1 punto? ¿Y si cada rueda aportara solo 3 casos independientes?
7. Leé el primer capítulo de *Narrative Economics* de Shiller y anotá qué medidas propone para una narrativa. ¿Cuál se parece a la Atención y cuál al Momento?

### 30. Glosario

- **Paper trading:** operaciones con dinero simulado.
- **Tesis:** el razonamiento que justifica una propuesta.
- **Analogía histórica:** episodio pasado que se usa para razonar sobre el presente.
- **Clase de referencia:** conjunto de casos parecidos cuyo resultado sirve como tasa base.
- **Valor del humano (tu valor agregado):** diferencia entre el rendimiento medio de lo aprobado y el de todo lo que se decidió a tiempo.
- **Puntaje de Brier:** promedio del cuadrado del error de un pronóstico probabilístico.
- **Calibración:** correspondencia entre las probabilidades declaradas y las frecuencias observadas.
- **Resolución:** capacidad de los pronósticos de distinguir casos que salen distinto.
- **Sesgo retrospectivo:** sobrestimar, después de conocer un resultado, cuán previsible era.
- **Sesgo de anticipación:** usar en una evaluación información que no estaba disponible en el momento.
- **Preregistración:** comprometerse con una predicción antes de conocer el resultado.
- **Sesgo de automatización:** tendencia a seguir las recomendaciones de un sistema automático aunque estén equivocadas.
- **Economía narrativa:** estudio de cómo las historias que circulan afectan los fenómenos económicos.
- **Hipótesis de los mercados eficientes:** los precios reflejan la información disponible.
- **Atención, Tono, Riesgo y Momento:** los cuatro índices narrativos de la herramienta (sección 5).
- **Sello:** el commit que agrega un archivo de propuestas; su hora tiene que ser anterior a la apertura.
- **Cadena de hashes:** cada archivo guarda el SHA-256 del anterior, así que editar uno viejo se nota.
- **Intervalo de Wilson:** intervalo de confianza para una proporción que no se sale de 0 y 1.
- **Horizonte:** las 5 ruedas entre la apertura de la rueda de la propuesta y el cierre de la quinta.
- **GKG:** Global Knowledge Graph de GDELT, los archivos con los artículos y lo que nombran.

### 31. Conclusión

La idea de una IA que predice con trasfondo sociohistórico se apoya en una intuición respaldada por la investigación: las narrativas mueven la economía, como mostró Shiller, y las manías tienen patrones que se repiten, como describieron Kindleberger y Perez. Pero también choca con tres advertencias igual de sólidas. Los mercados incorporan rápido lo que todos saben (Fama), y quienes operan activamente suelen rendir menos que el mercado (Barber y Odean). Las analogías históricas se eligen mal y se cuentan mal (Neustadt y May; Garber y Goldgar sobre los tulipanes). Y los humanos que supervisan sistemas automáticos tienden a volverse sellos de goma o a desconfiar sin razón (Bainbridge; Parasuraman y Riley; Dietvorst y Logg).

La herramienta todavía no responde si la idea funciona, pero ahora junta los datos para responderlo sin engañarse: noticias reales todos los días, índices definidos por escrito, propuestas de una IA selladas antes del resultado, rechazadas que también se evalúan, una comparación contra la regla más simple, un puntaje de Brier, un gráfico de calibración y un umbral explícito antes de siquiera pensar en plata real. La respuesta va a tardar meses, y puede ser que no. Los próximos pasos (comparar contra un índice de referencia, pedir varias analogías con sus diferencias, agregar reglas fijas para compararlas con el humano) son los que la harían más exigente. Todo, como insiste la idea, con dinero simulado.

## Referencias

- Asimov, I. (1951). *Foundation*. Gnome Press. Ficha de la obra: https://en.wikipedia.org/wiki/Foundation_(Asimov_novel)
- Bailey, D. H., Borwein, J. M., López de Prado, M., & Zhu, Q. J. (2014). Pseudo-mathematics and financial charlatanism: The effects of backtest overfitting on out-of-sample performance. *Notices of the American Mathematical Society*, 61(5), 458–471. https://doi.org/10.1090/noti1105
- Bainbridge, L. (1983). Ironies of automation. *Automatica*, 19(6), 775–779. https://doi.org/10.1016/0005-1098(83)90046-8
- Baker, S. R., Bloom, N., & Davis, S. J. (2016). Measuring economic policy uncertainty. *Quarterly Journal of Economics*, 131(4), 1593–1636. https://doi.org/10.1093/qje/qjw024
- Barber, B. M., & Odean, T. (2000). Trading is hazardous to your wealth: The common stock investment performance of individual investors. *Journal of Finance*, 55(2), 773–806. https://doi.org/10.1111/0022-1082.00226
- Baron, J., Mellers, B. A., Tetlock, P. E., Stone, E., & Ungar, L. H. (2014). Two reasons to make aggregated probability forecasts more extreme. *Decision Analysis*, 11(2), 133–145. https://doi.org/10.1287/deca.2014.0293
- Berg, J., Forsythe, R., Nelson, F., & Rietz, T. (2008). Results from a dozen years of election futures markets research. En C. R. Plott & V. L. Smith (Eds.), *Handbook of Experimental Economics Results* (vol. 1, pp. 742–751). Elsevier. https://doi.org/10.1016/S1574-0722(07)00080-7
- Brier, G. W. (1950). Verification of forecasts expressed in terms of probability. *Monthly Weather Review*, 78(1), 1–3. https://doi.org/10.1175/1520-0493(1950)078<0001:VOFEIT>2.0.CO;2
- Dawes, R. M., Faust, D., & Meehl, P. E. (1989). Clinical versus actuarial judgment. *Science*, 243(4899), 1668–1674. https://doi.org/10.1126/science.2648573
- Dietvorst, B. J., Simmons, J. P., & Massey, C. (2015). Algorithm aversion: People erroneously avoid algorithms after seeing them err. *Journal of Experimental Psychology: General*, 144(1), 114–126. https://doi.org/10.1037/xge0000033
- Fama, E. F. (1970). Efficient capital markets: A review of theory and empirical work. *Journal of Finance*, 25(2), 383–417. https://doi.org/10.2307/2325486
- Fischhoff, B. (1975). Hindsight ≠ foresight: The effect of outcome knowledge on judgment under uncertainty. *Journal of Experimental Psychology: Human Perception and Performance*, 1(3), 288–299. https://doi.org/10.1037/0096-1523.1.3.288
- Garber, P. M. (1989). Tulipmania. *Journal of Political Economy*, 97(3), 535–560. https://doi.org/10.1086/261615
- Goldgar, A. (2007). *Tulipmania: Money, Honor, and Knowledge in the Dutch Golden Age*. University of Chicago Press. https://doi.org/10.7208/chicago/9780226301303.001.0001
- Green, K. C., & Armstrong, J. S. (2007). Structured analogies for forecasting. *International Journal of Forecasting*, 23(3), 365–376. https://doi.org/10.1016/j.ijforecast.2007.05.005
- Haber, S., & Stornetta, W. S. (1991). How to time-stamp a digital document. *Journal of Cryptology*, 3(2), 99–111. https://doi.org/10.1007/BF00196791
- Halawi, D., Zhang, F., Yueh-Han, C., & Steinhardt, J. (2024). *Approaching human-level forecasting with language models*. arXiv:2402.18563. https://doi.org/10.48550/arXiv.2402.18563
- Harvey, C. R., Liu, Y., & Zhu, H. (2016). … and the cross-section of expected returns. *Review of Financial Studies*, 29(1), 5–68. https://doi.org/10.1093/rfs/hhv059
- Kahneman, D., & Lovallo, D. (1993). Timid choices and bold forecasts: A cognitive perspective on risk taking. *Management Science*, 39(1), 17–31. https://doi.org/10.1287/mnsc.39.1.17
- Kindleberger, C. P. (1978). *Manias, Panics and Crashes: A History of Financial Crises*. Macmillan. https://doi.org/10.1007/978-1-349-04338-5
- Kleinberg, J., & Raghavan, M. (2021). Algorithmic monoculture and social welfare. *Proceedings of the National Academy of Sciences*, 118(22), e2018340118. https://doi.org/10.1073/pnas.2018340118
- Leetaru, K., & Schrodt, P. A. (2013). *GDELT: Global data on events, location and tone, 1979–2012*. Trabajo presentado en la convención anual de la International Studies Association. https://data.gdeltproject.org/documentation/ISA.2013.GDELT.pdf
- Ley 26.831 de Mercado de Capitales. (2012). *Boletín Oficial de la República Argentina*, 28 de diciembre de 2012. https://www.argentina.gob.ar/normativa/nacional/ley-26831-206592
- Lichtenstein, S., Fischhoff, B., & Phillips, L. D. (1982). Calibration of probabilities: The state of the art to 1980. En D. Kahneman, P. Slovic & A. Tversky (Eds.), *Judgment under Uncertainty: Heuristics and Biases* (pp. 306–334). Cambridge University Press. https://doi.org/10.1017/CBO9780511809477.023
- Logg, J. M., Minson, J. A., & Moore, D. A. (2019). Algorithm appreciation: People prefer algorithmic to human judgment. *Organizational Behavior and Human Decision Processes*, 151, 90–103. https://doi.org/10.1016/j.obhdp.2018.12.005
- Mackay, C. (1841). *Memoirs of Extraordinary Popular Delusions and the Madness of Crowds*. Londres: Richard Bentley. https://www.gutenberg.org/ebooks/24518
- Meehl, P. E. (1954). *Clinical versus Statistical Prediction: A Theoretical Analysis and a Review of the Evidence*. University of Minnesota Press. https://doi.org/10.1037/11281-000
- Mellers, B., Ungar, L., Baron, J., Ramos, J., Gurcay, B., Fincher, K., et al. (2014). Psychological strategies for winning a geopolitical forecasting tournament. *Psychological Science*, 25(5), 1106–1115. https://doi.org/10.1177/0956797614524255
- Murphy, A. H. (1973). A new vector partition of the probability score. *Journal of Applied Meteorology*, 12(4), 595–600. https://doi.org/10.1175/1520-0450(1973)012<0595:ANVPOT>2.0.CO;2
- Neustadt, R. E., & May, E. R. (1986). *Thinking in Time: The Uses of History for Decision Makers*. Free Press. ISBN 978-0-02-922790-9. https://catalog.hathitrust.org/Record/000360496
- Odean, T. (1998). Volume, volatility, price, and profit when all traders are above average. *Journal of Finance*, 53(6), 1887–1934. https://doi.org/10.1111/0022-1082.00078
- Parasuraman, R., & Riley, V. (1997). Humans and automation: Use, misuse, disuse, abuse. *Human Factors*, 39(2), 230–253. https://doi.org/10.1518/001872097778543886
- Perez, C. (2002). *Technological Revolutions and Financial Capital: The Dynamics of Bubbles and Golden Ages*. Edward Elgar. ISBN 978-1-84376-331-4. Capítulos con DOI, por ejemplo https://doi.org/10.4337/9781840649222.00011
- Rogers, E. M. (1962). *Diffusion of Innovations*. Free Press. Ficha de la obra: https://en.wikipedia.org/wiki/Diffusion_of_Innovations
- Shefrin, H., & Statman, M. (1985). The disposition to sell winners too early and ride losers too long: Theory and evidence. *Journal of Finance*, 40(3), 777–790. https://doi.org/10.1111/j.1540-6261.1985.tb05002.x
- Shiller, R. J. (1981). Do stock prices move too much to be justified by subsequent changes in dividends? *American Economic Review*, 71(3), 421–436. Versión de trabajo: https://www.nber.org/papers/w0456
- Shiller, R. J. (2017). Narrative economics. *American Economic Review*, 107(4), 967–1004. https://doi.org/10.1257/aer.107.4.967
- Shiller, R. J. (2019). *Narrative Economics: How Stories Go Viral and Drive Major Economic Events*. Princeton University Press. https://doi.org/10.1515/9780691189970
- Skitka, L. J., Mosier, K. L., & Burdick, M. (1999). Does automation bias decision-making? *International Journal of Human-Computer Studies*, 51(5), 991–1006. https://doi.org/10.1006/ijhc.1999.0252
- Tetlock, P. C. (2007). Giving content to investor sentiment: The role of media in the stock market. *Journal of Finance*, 62(3), 1139–1168. https://doi.org/10.1111/j.1540-6261.2007.01232.x
- Tetlock, P. E. (2005). *Expert Political Judgment: How Good Is It? How Can We Know?* Princeton University Press. https://doi.org/10.1515/9781400830312
- Turchin, P. (2008). Arise 'cliodynamics'. *Nature*, 454, 34–35. https://doi.org/10.1038/454034a
- Wilson, E. B. (1927). Probable inference, the law of succession, and statistical inference. *Journal of the American Statistical Association*, 22(158), 209–212. https://doi.org/10.1080/01621459.1927.10502953
- Wolfers, J., & Zitzewitz, E. (2004). Prediction markets. *Journal of Economic Perspectives*, 18(2), 107–126. https://doi.org/10.1257/0895330041371321
