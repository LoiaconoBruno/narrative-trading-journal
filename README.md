<div align="center">

# Narrative Trading Journal

**Una IA lee noticias reales y propone en qué invertir. La bitácora mide si sirve.** Plata simulada, tesis selladas antes del resultado.

[**▶ Probala en vivo**](https://loiaconobruno.github.io/narrative-trading-journal/) · [Ver el ejemplo](https://loiaconobruno.github.io/narrative-trading-journal/?ejemplo) · [**📄 Paper y guía**](https://loiaconobruno.github.io/narrative-trading-journal/guia.html) · [Cómo funciona](#cómo-funciona) · [Limitaciones](#limitaciones)

[![Tests](https://github.com/LoiaconoBruno/narrative-trading-journal/actions/workflows/tests.yml/badge.svg)](https://github.com/LoiaconoBruno/narrative-trading-journal/actions/workflows/tests.yml)
[![Pipeline diario](https://github.com/LoiaconoBruno/narrative-trading-journal/actions/workflows/pipeline.yml/badge.svg)](https://github.com/LoiaconoBruno/narrative-trading-journal/actions/workflows/pipeline.yml)
![Página: 0 dependencias](https://img.shields.io/badge/p%C3%A1gina-0%20dependencias-brightgreen)
[![Licencia MIT](https://img.shields.io/badge/licencia-MIT-blue)](LICENSE)

<img src="docs/captura.png" alt="Captura de Narrative Trading Journal: tablero, propuestas del día ordenadas por confianza y botones para aprobar o rechazar" width="800">

</div>

Cada día hábil, antes de la apertura de Nueva York, un workflow de GitHub Actions:

1. baja las noticias de las últimas 24 horas desde [GDELT](https://www.gdeltproject.org/) (medios en inglés y en 65 idiomas traducidos);
2. le pide a **Claude** que clasifique los títulos de cada empresa y calcula cuatro **índices narrativos**: Atención, Tono, Riesgo y Momento;
3. le pide a Claude una **propuesta por activo**: compra o venta a 5 ruedas, con tesis, episodio histórico parecido, confianza y riesgos;
4. **sella** las propuestas con un commit antes de la apertura, encadenadas por SHA-256, y nunca las edita;
5. cuando cierra el horizonte, mide el resultado con precios de Twelve Data y publica solo el rendimiento.

En la página vos **aprobás o rechazás** cada propuesta antes de la apertura, y la bitácora mide si la IA acierta, si su confianza está **calibrada** (puntaje de Brier) y si vos **agregás valor**.

> **Plata simulada. No es una recomendación de inversión.** Es un experimento para medir si las propuestas de una IA sirven.

## Por qué

La idea original ("IA predictiva con trasfondo sociohistórico") propone que una IA lea la historia y el contexto de cada activo y que una persona decida. La primera versión de este repo construyó solo la base: un tablero para decidir y una bitácora para medir, con datos cargados a mano. Esta versión conecta la IA a noticias reales, pero conserva lo importante: ninguna tesis se puede escribir después del resultado, todo se mide (también lo rechazado) y hay un umbral explícito antes de siquiera pensar en plata real.

## Watchlist

Acciones que cotizan en Nueva York, en dólares: cuatro empresas argentinas o con operación central en Argentina (**MELI, YPF, GGAL, VIST**) y seis grandes de Estados Unidos de sectores distintos (**AAPL, MSFT, NVDA, KO, JPM, XOM**). Se edita en [`data/watchlist.json`](data/watchlist.json).

## Activarlo

El workflow programado está apagado hasta que lo actives:

1. Creá una key de la [API de Claude](https://platform.claude.com/) y una gratis de [Twelve Data](https://twelvedata.com/pricing).
2. En el repo: **Settings → Secrets and variables → Actions**, cargá los secretos `ANTHROPIC_API_KEY` y `TWELVEDATA_API_KEY`. Nunca van al código ni a la página.
3. Probá en seco: **Actions → Pipeline diario → Run workflow** (la casilla "seco" viene marcada). Baja noticias y calcula índices sin llamar a Claude ni a Twelve Data y sin commit.
4. Activalo: en **Variables**, creá `PIPELINE_ACTIVO` = `si`. Corre cada día hábil a las 12:05 UTC (9:05 en Buenos Aires).
5. Opcional: la variable `MODELO` (`claude-sonnet-5-5` o `claude-haiku-5-5`) cambia el modelo; por defecto es Claude Opus 5.5.

## Costos

Estimación antes de activar, con pedidos armados con noticias reales de GDELT (21.000 tokens de entrada por rueda y entre 9.100 y 28.500 de salida, según cuánto razone el modelo), [precios publicados](https://platform.claude.com/docs/en/about-claude/pricing) y 21 ruedas por mes:

| Modelo | Por mes |
|---|---|
| Claude Opus 5.5 (por defecto) | US$ 5,59 a 13,73 |
| Claude Sonnet 5.5 | US$ 2,79 a 6,87 |
| Claude Haiku 5.5 | US$ 0,14 a 0,34 |

GDELT, Twelve Data (plan Basic), GitHub Actions en un repo público y GitHub Pages: US$ 0. Después de cada corrida, el costo medido queda en `data/costos.json` y en la página. El detalle está en la sección 10 de la guía.

## Uso

Abrí la [página](https://loiaconobruno.github.io/narrative-trading-journal/). Hasta que el pipeline junte datos, mirá el [ejemplo con datos inventados](https://loiaconobruno.github.io/narrative-trading-journal/?ejemplo):

1. **Hoy:** cinco propuestas ficticias del 15 de octubre de 2026, ordenadas por confianza (DLTA compra 72 %, GAMA compra 68 %, BETA venta 63 %…). El reloj del ejemplo marca las 9:40 de Buenos Aires, antes de la apertura: apretá **Aprobar** en DLTA y la tarjeta dice "Aprobaste a las 09:40 · cuenta".
2. **El tablero:** 180 propuestas cerradas, **61 %** de aciertos (intervalo de 53 % a 67 %), **Brier 0,234** (al azar: 0,250), valor agregado **+0,16 pp** y **1 de 4** criterios del umbral.
3. **Índices:** la historia de cada activo y, rueda por rueda, los títulos que movieron el Tono (▲ ▼) y el Riesgo (⚠).
4. **Bitácora:** el gráfico de calibración (en el tramo de 60–70 %, el más poblado, dijo 64 % y acertó 58 %: el ejemplo está armado para acertar 3 puntos menos de lo que dice), los criterios del umbral, tu valor como humano y la tabla de cerradas. Ahí se exportan e importan tus decisiones.
5. **Método:** qué mide cada índice, cómo se sella, las fuentes y los costos.

## Cómo funciona

| Índice | Escala | Cálculo |
|---|---|---|
| Atención | 0–100 (50 = normal) | 50 + 25 · z, con z = (cuota de hoy − media) / desvío de los 20 días previos; cuota = artículos que nombran a la empresa cada 10.000 |
| Tono | −100 a +100 | 100 · (positivos − negativos) / relevantes, clasificados por Claude |
| Riesgo | 0–100 | 100 · con evento de riesgo / relevantes |
| Momento | −100 a +100 | 0,3 · Tono de hoy + 0,7 · Momento de ayer |

- **Sin trampa de anticipación:** no se generan propuestas después de la apertura; cada rueda es un archivo nuevo en `data/propuestas/` con el SHA-256 del anterior; al evaluar, si el commit que lo agregó es posterior a la apertura o el archivo cambió, esas propuestas **no cuentan**. Tus decisiones cuentan solo si las tomaste antes de la apertura.
- **Métricas:** acierto = la dirección fue la correcta entre la apertura de la rueda y el cierre de la quinta. Brier = promedio de (confianza − acierto)². Calibración por tramos de 10 puntos. Tu valor agregado = rendimiento medio de lo aprobado menos el de todo lo decidido.
- **Umbral para pensar en plata real:** 300 propuestas cerradas, 60 ruedas, Brier ≤ 0,23 y el piso del intervalo de Wilson de los aciertos por encima de 50 %. Una vara propia, necesaria y no suficiente.
- **Código:** la lógica pura está en `src/` (la usan la página y el pipeline); el pipeline en `pipeline/` (Node 22, con el SDK oficial de Anthropic como única dependencia); la página es HTML, CSS y JavaScript sin build, con el [sistema de diseño común](css/sistema.css) del portafolio.

```bash
git clone https://github.com/LoiaconoBruno/narrative-trading-journal.git
cd narrative-trading-journal
npm test                                                  # 26 tests, sin red ni keys
npm ci --prefix pipeline
node pipeline/correr.js --seco --horas=6 --salida=/tmp/prueba   # noticias reales, sin costo
```

## Fuentes y términos

- **Noticias:** [The GDELT Project](https://www.gdeltproject.org/). Uso y redistribución libres, citando a GDELT con un link.
- **Precios:** [Twelve Data](https://twelvedata.com/), plan gratis. Los precios no se guardan ni se publican; solo el rendimiento de cada propuesta, redondeado a 0,1 %, un dato derivado del que no se pueden reconstruir los precios ([términos](https://twelvedata.com/terms), cláusula 2.2(c)).
- **IA:** API de Claude, de Anthropic, con salida estructurada (esquema JSON) y respaldo del servidor si un clasificador de seguridad rechaza el pedido.

## Limitaciones

- Las empresas argentinas tienen poca cobertura en GDELT: en una prueba de 6 horas, Nvidia salió en 582 artículos y YPF, Galicia y Vista en ninguno.
- Claude clasifica por el título, sin leer la nota.
- La Atención necesita 5 días de historia; la calibración, cientos de propuestas.
- Los horizontes se superponen y los activos se mueven juntos: los intervalos calculados son optimistas.
- No hay comisiones, tamaño de posición, impuestos ni tipo de cambio.
- El plan gratis de Twelve Data es para uso interno; publicar rendimientos derivados se apoya en su cláusula 2.2(c).
- Tus decisiones tienen la hora de tu reloj, y la hora de un commit la puede falsear quien administra el repo.
- Del episodio histórico se verifica que el link exista, no que diga lo que la tesis afirma.
- **No es una recomendación de inversión.**

## Próximos pasos

- Comparar contra un índice de referencia, no solo contra la dirección.
- Pedir varias analogías con sus diferencias y la tasa base de la clase de referencia.
- Agregar reglas fijas (por ejemplo, "aprobar solo con confianza ≥ 65") para compararlas con el humano.
- Devolverle a la IA su propio historial de calibración en cada pedido.

## Paper de uso y guía

[`guia.html`](https://loiaconobruno.github.io/narrative-trading-journal/guia.html) (fuente en [`docs/guia.md`](docs/guia.md), generada con `python3 tools/guia.py`) tiene el paper de uso completo (pipeline, índices, sellos, métricas, umbral, costos) y una guía de unas 30 páginas sobre la idea de fondo, con 44 referencias verificadas.

## Licencia

MIT
