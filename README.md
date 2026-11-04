<div align="center">

# Narrative Trading Journal

**Bitácora sociohistórica.** Paper trading con tesis históricas y validación humana: ¿el humano en el circuito agrega valor o es un sello de goma?

[**▶ Probala en vivo**](https://loiaconobruno.github.io/narrative-trading-journal/) · [**📄 Paper y guía**](https://loiaconobruno.github.io/narrative-trading-journal/guia.html) · [Cómo funciona](#cómo-funciona) · [Limitaciones](#limitaciones)

[![Tests](https://github.com/LoiaconoBruno/narrative-trading-journal/actions/workflows/tests.yml/badge.svg)](https://github.com/LoiaconoBruno/narrative-trading-journal/actions/workflows/tests.yml)
![Dependencias: 0](https://img.shields.io/badge/dependencias-0-brightgreen)
![HTML, CSS y JavaScript](https://img.shields.io/badge/HTML%20%C2%B7%20CSS%20%C2%B7%20JS-sin%20build-f7df1e)
[![Licencia MIT](https://img.shields.io/badge/licencia-MIT-blue)](LICENSE)

<img src="docs/captura.png" alt="Captura de Narrative Trading Journal" width="800">

</div>

Bitácora de **paper trading** (plata simulada) para la idea "IA predictiva con trasfondo sociohistórico". Cada propuesta llega con una **tesis** sobre la historia y el contexto cultural del activo, un **episodio histórico parecido**, una **confianza** y sus **riesgos**. Una persona la **aprueba o la rechaza**. Cuando se cierra con un precio simulado, la bitácora mide:

- si el humano en el circuito **agrega valor**: rendimiento de lo aprobado contra el de aprobar todo;
- cuántas **decisiones humanas acertaron**;
- si la **confianza declarada está calibrada** (puntaje de Brier y gráfico de calibración);
- y marca las propuestas con **sesgo de anticipación**: tesis fechadas después del resultado, que no cuentan en el resumen.

## Por qué

La idea propone que una IA arme el análisis y un humano decida. Antes de construir la IA conviene tener lo que la idea pedía como base: (4) un tablero donde el humano ve la propuesta, el razonamiento, la confianza y los riesgos, y decide; (5) un registro de cada decisión para medir si el humano realmente agrega valor. El riesgo que la idea misma señala, que los humanos se vuelvan sellos de goma, solo se ve midiéndolo. Y todo con plata simulada, nunca real al principio.

## Instalación

No hace falta instalar nada: **[abrila en el navegador](https://loiaconobruno.github.io/narrative-trading-journal/)**.

Para usarla sin conexión o modificarla:

```bash
git clone https://github.com/LoiaconoBruno/narrative-trading-journal.git
```

Después abrí `index.html` con doble clic. No hay dependencias ni paso de build. Para correr los tests hace falta Node 18 o más nuevo:

```bash
npm test
```

## Uso

Abrí la [demo en vivo](https://loiaconobruno.github.io/narrative-trading-journal/) o `index.html` con doble clic. Las propuestas se guardan solo en ese navegador.

Ejemplo con los datos ficticios:

1. Apretá **Cargar ejemplo ficticio**: 8 propuestas sobre activos inventados (ACME, BETA, GAMA…).
2. El resumen muestra **6 de 8** propuestas evaluadas. Lo aprobado rindió **5,5 %**, aprobar todo habría rendido **6,2 %**, así que el valor del humano es **−0,7 pp**. Las decisiones humanas acertadas son el **67 %** y el Brier es **0,219**.
3. ZETA aparece con el aviso **anticipación**: su tesis tiene fecha posterior al cierre, así que queda fuera del resumen. TETA está sin decidir.
4. Apretá **Aprobar** en TETA y cerrala con fecha `2026-10-01` y precio `66`: ahora hay 7 evaluadas, lo aprobado rinde 6,4 % y el valor del humano pasa a −0,3 pp.
5. Para cargar una propuesta propia, completá el formulario. Si el precio de entrada es 0, avisa: "El precio de entrada tiene que ser mayor que 0".

## Cómo funciona

- **Rendimiento:** `cierre / entrada − 1` en compras y su opuesto en ventas.
- **Evaluadas:** propuestas decididas, cerradas y sin avisos de anticipación. Las rechazadas también se cierran, para saber qué habría pasado.
- **Valor del humano:** rendimiento promedio de lo aprobado menos el de todas las evaluadas (aprobar todo), en puntos porcentuales.
- **Decisión acertada:** aprobó y ganó, o rechazó y perdió.
- **Brier:** promedio de `(confianza − acierto)²`; 0 es perfecto y 0,25 es lo que da decir siempre 50 %.
- **Calibración:** para cada tramo de confianza, el porcentaje real de aciertos. Si la curva queda por debajo de la diagonal, la confianza está inflada.

La lógica está en `src/bitacora.js`, sin DOM, y se testea con:

```bash
npm test
```

## Limitaciones

- No hay IA ni datos de mercado: las propuestas y los precios los cargás vos. Es la estructura para evaluar a la IA (o a cualquiera) antes de construirla.
- Con pocas propuestas los números son ruido; hacen falta decenas para sacar conclusiones.
- El control de anticipación solo mira fechas. Si un modelo de lenguaje escribe tesis sobre fechas pasadas, puede "saber" lo que pasó después, y eso la bitácora no lo detecta.
- No contempla comisiones, tamaño de posición ni riesgo: cada propuesta pesa lo mismo.
- No es una recomendación de inversión.

## Próximos pasos

- Conectar un modelo de lenguaje que arme el dossier de cada activo (con fecha de corte de datos registrada).
- Comparar contra un índice de referencia.
- Correrla unos meses con 10 activos y ver si el filtro humano mejora algo.
- Leer *Narrative Economics*, de Robert Shiller (2019).

## Paper de uso y guía

[`guia.html`](https://loiaconobruno.github.io/narrative-trading-journal/guia.html) (fuente en [`docs/guia.md`](docs/guia.md)) tiene un paper de uso paso a paso y una guía de unas 20 páginas sobre la idea de fondo, con citas a los especialistas del tema.

## Licencia

MIT
