# Bitácora de tesis narrativas: paper de uso y guía de la idea

## Resumen

Este documento acompaña a **Narrative Trading Journal**, una bitácora de *paper trading* (operaciones con dinero simulado) para la idea "IA predictiva con trasfondo sociohistórico". La idea propone que una inteligencia artificial arme propuestas de inversión basadas en la historia y el contexto cultural de cada activo, y que una persona decida. Antes de construir esa IA, la herramienta construye lo que la idea pedía como base: un tablero donde cada propuesta llega con una **tesis**, un **episodio histórico parecido**, una **confianza** y sus **riesgos**; una persona la **aprueba o la rechaza**; y, cuando se cierra con un precio simulado, la bitácora mide si el humano en el circuito agrega valor, cuántas decisiones acertaron, si la confianza declarada está calibrada y qué propuestas tienen **sesgo de anticipación** (tesis fechadas después del resultado).

**Aviso:** la herramienta y esta guía no son una recomendación de inversión ni un consejo financiero. Todo lo que se describe usa activos ficticios y dinero simulado. Su propósito es metodológico: cómo evaluar honestamente a quien hace predicciones, sea una persona o una IA.

La primera parte es un paper de uso: el formulario, el ejemplo ficticio resuelto con los números de la herramienta, cómo se calcula cada métrica y los límites. La segunda es una guía de la idea, que recorre la economía narrativa de Robert Shiller, las manías financieras según Charles Kindleberger y Carlota Perez (y la revisión de la "tulipomanía" por Peter Garber y Anne Goldgar), el razonamiento por analogías históricas de Richard Neustadt y Ernest May y los pronósticos por clase de referencia de Kahneman y Lovallo, la hipótesis de los mercados eficientes de Eugene Fama y la evidencia sobre el rendimiento de quienes operan activamente (Barber y Odean), la calibración y el puntaje de Brier, el sesgo retrospectivo de Baruch Fischhoff y el sesgo de anticipación en las pruebas históricas y en los modelos de lenguaje, y la investigación sobre humanos y automatización: la ironía de Lisanne Bainbridge, el sesgo de automatización de Parasuraman, Riley, Skitka y Mosier, y la aversión y la apreciación de los algoritmos.

## Parte I. Paper de uso

### 1. Qué es la herramienta

Narrative Trading Journal es una página estática sin dependencias que se abre desde la [demo en vivo](https://loiaconobruno.github.io/narrative-trading-journal/) o con doble clic en `index.html`. Las propuestas se guardan solo en el navegador donde se usa. No hay IA ni datos de mercado: las propuestas y los precios los carga el usuario.

La página tiene tres zonas:

1. **Nueva propuesta:** un formulario con activo, dirección (compra o venta), fecha de la tesis, precio de entrada, tesis, episodio histórico parecido, confianza y riesgos. Debajo, los botones Cargar ejemplo ficticio, Exportar JSON, Importar JSON y Borrar todo.
2. **¿El humano agrega valor?:** el resumen de métricas y el gráfico de calibración.
3. **Propuestas:** la lista, con los botones para aprobar, rechazar y cerrar cada una, y los avisos.

La lógica está en `src/bitacora.js`, sin acceso al DOM. Los tests se corren con `npm test` (Node 18 o más nuevo).

### 2. Instalación

```bash
git clone https://github.com/LoiaconoBruno/narrative-trading-journal.git
cd narrative-trading-journal
npm test
```

Después se abre `index.html` con doble clic.

### 3. Los campos de una propuesta

| Campo | Qué es |
|---|---|
| Activo | El nombre del activo (en el ejemplo, nombres inventados) |
| Dirección | Compra (se gana si el precio sube) o venta (se gana si baja) |
| Fecha de la tesis | Cuándo se escribió la propuesta, en formato AAAA-MM-DD |
| Precio de entrada | El precio simulado al momento de la tesis; tiene que ser mayor que 0 |
| Tesis | El razonamiento: historia, contexto cultural, narrativa |
| Episodio histórico parecido | La analogía que sostiene la tesis |
| Confianza | De 0 % a 100 %: qué probabilidad le asigna quien propone a que la operación gane |
| Riesgos | Qué podría salir mal |

Después de agregarla, la propuesta se puede **aprobar** o **rechazar** (la decisión humana) y, más tarde, **cerrar** con una fecha y un precio de cierre. Las rechazadas también se cierran: así se sabe qué habría pasado si se aprobaban.

### 4. Las métricas

| Métrica | Cómo se calcula |
|---|---|
| Rendimiento | Compra: cierre / entrada − 1. Venta: lo opuesto |
| Evaluadas | Propuestas decididas, cerradas y sin aviso de anticipación |
| Rendimiento de lo aprobado | Promedio de los rendimientos de las aprobadas evaluadas |
| Aprobar todo | Promedio de los rendimientos de todas las evaluadas |
| Valor del humano | Rendimiento de lo aprobado menos aprobar todo, en puntos porcentuales |
| Decisiones acertadas | Fracción de evaluadas en que el humano aprobó y la operación ganó, o rechazó y perdió |
| Brier | Promedio de (confianza − resultado)², donde resultado es 1 si la operación ganó y 0 si no |
| Calibración | Para cada tramo de confianza, el porcentaje real de operaciones ganadoras |

### 5. El aviso de anticipación

Una propuesta cuya fecha de tesis es **posterior** a la fecha de cierre se marca con el aviso **anticipación**: fue escrita cuando el resultado ya se conocía. Esas propuestas se muestran pero **no cuentan** en el resumen. La sección 16 explica por qué este control es tan importante, y por qué no alcanza.

### 6. Ejemplo resuelto

1. **Cargar ejemplo ficticio.** Ocho propuestas sobre activos inventados:

| Activo | Dirección | Confianza | Decisión | Entrada → cierre | Rendimiento | Analogía |
|---|---|---|---|---|---|---|
| ACME | compra | 70 % | aprobada | 100 → 112 | +12 % | Ferrocarriles, década de 1840 |
| BETA | venta | 60 % | aprobada | 50 → 45 | +10 % | Tulipanes, 1637 |
| GAMA | compra | 80 % | aprobada | 20 → 18 | −10 % | Bienes de consumo masivo en 2008 |
| DELTA | compra | 40 % | rechazada | 200 → 190 | −5 % | Revival de vinilos, 2010 |
| EPSI | compra | 55 % | rechazada | 10 → 12 | +20 % | Inmigración europea en Argentina, 1880–1914 |
| ZETA | venta | 65 % | aprobada | 80 → 84 | −5 % | — (tesis fechada después del cierre) |
| ETA | compra | 75 % | aprobada | 30 → 33 | +10 % | Electrodomésticos, década de 1920 |
| TETA | compra | 50 % | sin decidir | 60 → — | — | — |

2. **El resumen.** Muestra **6 de 8** propuestas evaluadas: ZETA queda excluida por anticipación y TETA está sin decidir ni cerrar.
   - Lo aprobado (ACME, BETA, GAMA, ETA) rindió en promedio **5,5 %**: (12 + 10 − 10 + 10) / 4.
   - Aprobar todo (las seis evaluadas) habría rendido **6,2 %**: (12 + 10 − 10 − 5 + 20 + 10) / 6 ≈ 6,17.
   - El **valor del humano** es 5,5 − 6,17 ≈ **−0,7 puntos porcentuales**: el filtro humano empeoró el resultado respecto de aprobar todo. La razón es EPSI: el humano la rechazó y rindió 20 %.
   - Las **decisiones acertadas** son el **67 %**: acertó con ACME, BETA, ETA (aprobó y ganaron) y DELTA (rechazó y perdió); se equivocó con GAMA (aprobó y perdió) y EPSI (rechazó y ganó). Cuatro de seis.
   - El **Brier** es **0,219**: (0,09 + 0,16 + 0,64 + 0,16 + 0,2025 + 0,0625) / 6.
3. **ZETA** aparece con el aviso **anticipación**: su tesis tiene fecha 2026-06-10, posterior al cierre del 2026-06-01.
4. **TETA.** Apretando **Aprobar** y cerrándola con fecha 2026-10-01 y precio 66 (+10 %), hay 7 evaluadas, lo aprobado rinde **6,4 %** y el valor del humano pasa a **−0,3 pp**.
5. **Validación.** Si se carga una propuesta con precio de entrada 0, la página avisa: "El precio de entrada tiene que ser mayor que 0".

### 7. La calibración del ejemplo

Con las seis evaluadas, el gráfico de calibración agrupa las propuestas por tramo de confianza:

| Tramo de confianza | Propuestas | Confianza media | Aciertos reales |
|---|---|---|---|
| 0 a 50 % | 1 (DELTA) | 40 % | 0 % |
| 50 a 65 % | 2 (BETA, EPSI) | 57,5 % | 100 % |
| 65 a 80 % | 2 (ACME, ETA) | 72,5 % | 100 % |
| 80 a 100 % | 1 (GAMA) | 80 % | 0 % |

Con una calibración perfecta, los puntos caerían sobre la diagonal: de las propuestas con 70 % de confianza, ganaría el 70 %. Con tan pocas propuestas, los puntos saltan entre 0 % y 100 %, y no se puede concluir nada. Lo único que el ejemplo sugiere (y que habría que confirmar con decenas de propuestas) es que la propuesta con más confianza, GAMA, fue la que perdió.

### 8. Cómo leer los resultados

- **El valor del humano** responde la pregunta central de la idea: ¿la persona que aprueba o rechaza mejora el resultado respecto de aprobar todo? Un valor negativo, como en el ejemplo, dice que el filtro humano restó.
- **Las decisiones acertadas** solas engañan: un 67 % suena bien, pero si las rechazadas ganan más que las aprobadas, el filtro está restando. Hay que mirarlas junto con el valor del humano.
- **El Brier** mide las probabilidades, no las decisiones. 0 es perfecto; 0,25 es lo que se obtiene diciendo siempre 50 %. El 0,219 del ejemplo es apenas mejor que no saber nada.
- **Con pocas propuestas, todo es ruido.** Seis operaciones no dicen nada sobre la habilidad de nadie. La sección 19 explica cuántas harían falta.

#### 8.1 Preguntas frecuentes

**¿Por qué hay que cerrar las rechazadas?** Porque sin saber qué habría pasado con ellas, no se puede medir si rechazarlas fue una buena decisión. Es el error más común al evaluar un filtro: mirar solo lo que se aprobó.

**¿Qué precio de cierre pongo en una propuesta ficticia?** El que se quiera simular. La herramienta está pensada para registrar propuestas con precios reales de cierre en una fecha fijada de antemano, pero también sirve para practicar con datos inventados, como el ejemplo.

**¿Por qué todas las propuestas pesan lo mismo?** Por simplicidad: la herramienta no maneja tamaño de posición, comisiones ni riesgo. Una versión más realista ponderaría cada operación por cuánto se invirtió.

**¿La confianza es la del humano o la de quien propone?** La de quien propone (en la idea, la IA). La decisión del humano se mide aparte, con el valor del humano y las decisiones acertadas. Así se puede saber por separado si la IA está calibrada y si el humano agrega algo.

**¿Dónde se guardan los datos?** Solo en el navegador. Exportar JSON permite guardarlos o pasarlos a otro lado.

#### 8.2 Recorrido guiado

1. **Cargá el ejemplo** y leé las tesis y analogías de cada propuesta antes de mirar los resultados. Para cada una, anotá si la habrías aprobado.
2. **Compará tus decisiones con las del ejemplo.** ¿Tu filtro habría agregado valor? (Podés calcularlo con la tabla de la sección 6.)
3. **Mirá ZETA.** Leé su tesis y su fecha. Es el caso de alguien que escribió la tesis sabiendo el resultado; la bitácora lo excluye.
4. **Decidí TETA.** Probá aprobarla y cerrarla con distintos precios (54, 60, 66). Mirá cómo cambia el valor del humano en cada caso.
5. **Agregá una propuesta propia,** sobre un activo inventado, con fecha de cierre futura. Dejala abierta: así funciona el registro real, comprometiéndose antes de saber.
6. **Exportá** el JSON y guardalo con fecha. Es la evidencia de que las tesis existían antes de los resultados.

### 9. Limitaciones

- No hay IA ni datos de mercado: es la estructura para evaluar a la IA (o a cualquiera) antes de construirla.
- Con pocas propuestas los números son ruido; hacen falta decenas para sacar conclusiones.
- El control de anticipación solo mira fechas. Si un modelo de lenguaje escribe tesis sobre fechas pasadas, puede "saber" lo que pasó después, y eso la bitácora no lo detecta.
- No contempla comisiones, tamaño de posición ni riesgo.
- **No es una recomendación de inversión.**

## Parte II. Guía de la idea

### 10. La idea: predecir con historia

La idea original se llamaba "IA predictiva con trasfondo sociohistórico". Su intuición es que los precios de los activos no se mueven solo por números (ganancias, tasas, balances) sino por **historias**: la narrativa de una tecnología que va a cambiar todo, el miedo a una crisis que recuerda a otra, la moda de una generación. Una IA que leyera la historia y el contexto cultural de un activo, y encontrara episodios pasados parecidos, podría, según la idea, anticipar movimientos que los modelos puramente numéricos no ven. Un humano revisaría cada propuesta y decidiría.

La idea tiene un antecedente literario evidente: la **psicohistoria** de Isaac Asimov en la serie *Fundación* (1951 en adelante), una ciencia ficticia que predice el comportamiento de grandes poblaciones combinando historia, sociología y estadística. También tiene un antecedente académico: la **cliodinámica** que Peter Turchin propuso en 2008 (*Nature*, 454, 34–35), que busca regularidades matemáticas en los procesos históricos de largo plazo.

La herramienta no construye la IA. Construye primero lo que la idea misma pedía como base: un tablero para que el humano decida y un registro para medir si agrega valor. Es la parte menos glamorosa y la más importante: sin una evaluación honesta, cualquier sistema de predicción puede parecer brillante.

### 11. La economía narrativa

#### 11.1 Shiller

Robert Shiller, Premio Nobel de Economía en 2013, dedicó su discurso presidencial ante la American Economic Association de 2017 a lo que llamó **economía narrativa** (*American Economic Review*, 107(4), 967–1004), y lo amplió en el libro *Narrative Economics: How Stories Go Viral and Drive Major Economic Events* (2019). Su tesis es que las historias que circulan en una sociedad (sobre la tecnología que quita empleos, sobre la burbuja inmobiliaria, sobre el dinero digital) se propagan como epidemias, con contagio, pico y declive, y afectan decisiones económicas reales. Propuso estudiarlas con los métodos de la epidemiología y con el análisis de grandes cantidades de texto.

Shiller había mostrado antes, en 1981 (*American Economic Review*, 71(3), 421–436), que los precios de las acciones se mueven mucho más de lo que justificarían los cambios en los dividendos futuros: hay "exceso de volatilidad". La economía narrativa es, en parte, una explicación de ese exceso. La idea de la herramienta (tesis basadas en narrativas) está directamente en esta línea, y leer el libro de Shiller es uno de sus próximos pasos.

#### 11.2 Las manías

Charles Kindleberger, en *Manias, Panics, and Crashes* (1978), describió el ciclo típico de las burbujas financieras, basándose en un modelo de Hyman Minsky: un desplazamiento (una novedad que cambia las expectativas), un auge, una euforia en la que entran inversores sin experiencia atraídos por las ganancias ajenas, un momento de pánico y un derrumbe. Cada manía tiene su historia: los canales, los ferrocarriles, la radio, internet. El ejemplo de la herramienta usa dos de esas historias como analogías: los ferrocarriles de la década de 1840 (ACME) y los tulipanes de 1637 (BETA).

Carlota Perez, en *Technological Revolutions and Financial Capital* (2002), propuso un modelo de largo plazo: cada revolución tecnológica (la máquina de vapor, el ferrocarril, la electricidad, el automóvil, la informática) pasa por una fase de **instalación**, dominada por el capital financiero y con burbujas, y una fase de **despliegue**, en la que la tecnología se difunde a toda la economía. Las burbujas, para Perez, no son solo errores: financian la infraestructura de la revolución. La tesis de ACME en el ejemplo ("la narrativa de la transición energética recién empieza a llegar al público masivo") es una lectura de este tipo.

#### 11.3 Los tulipanes, revisados

La analogía de BETA, los tulipanes de 1637, merece una advertencia. La historia de la "tulipomanía" holandesa, en la que bulbos de tulipán se habrían vendido por el precio de una casa antes de un derrumbe que arruinó a medio país, se difundió sobre todo a partir de *Extraordinary Popular Delusions and the Madness of Crowds*, de Charles Mackay (1841). Investigaciones posteriores la revisaron. Peter Garber argumentó en 1989 (*Journal of Political Economy*, 97(3), 535–560) que muchos precios altos correspondían a variedades raras, cuyos precios caen naturalmente cuando se multiplican, y que el episodio de 1637 fue breve y acotado. Anne Goldgar, en *Tulipmania: Money, Honor, and Knowledge in the Dutch Golden Age* (2007), revisó los archivos y no encontró evidencia de la ruina generalizada que cuenta la leyenda.

La lección para la idea es doble. Primero, las analogías históricas dependen de que la historia esté bien contada: una analogía con un episodio mal entendido es una mala analogía. Segundo, las narrativas sobre el pasado también son narrativas, y también se contagian.

### 12. Razonar con analogías históricas

#### 12.1 Neustadt y May

Richard Neustadt y Ernest May, de la Escuela Kennedy de Harvard, estudiaron en *Thinking in Time: The Uses of History for Decision Makers* (1986) cómo los funcionarios de gobierno usan (y abusan de) las analogías históricas. Encontraron que las decisiones suelen tomarse con una sola analogía, elegida rápido y por parecido superficial ("esto es como Múnich 1938", "esto es otro Vietnam"), sin examinar en qué se parece y en qué no. Propusieron un método simple: escribir las semejanzas y las diferencias entre la situación actual y la analogía, y preguntarse qué predicciones haría cada una.

El campo "Episodio histórico parecido" de la herramienta es exactamente una analogía. Una mejora natural, siguiendo a Neustadt y May, sería pedir también las **diferencias**: en qué no se parece el activo de hoy a los ferrocarriles de 1840.

#### 12.2 Analogías estructuradas

Kesten Green y J. Scott Armstrong estudiaron en 2007 (*International Journal of Forecasting*, 23(3), 365–376) el uso de **analogías estructuradas** para pronosticar decisiones en conflictos: pedir a expertos que listen varias situaciones análogas, califiquen su semejanza y anoten qué pasó en cada una. Los pronósticos con analogías estructuradas fueron bastante más precisos que los juicios no estructurados de los mismos expertos. Una analogía sola es una anécdota; varias, ponderadas, empiezan a ser datos.

#### 12.3 Clase de referencia

Daniel Kahneman y Dan Lovallo propusieron en 1993 (*Management Science*, 39(1), 17–31) distinguir la **visión interna** (pensar el caso con sus detalles, que lleva al optimismo) de la **visión externa** (preguntarse cómo les fue a casos parecidos, sin mirar los detalles). Bent Flyvbjerg convirtió la visión externa en un método, el **pronóstico por clase de referencia**, que hoy se usa para estimar costos y plazos de grandes obras.

Para la idea, la visión externa sugiere una pregunta incómoda pero imprescindible: de todas las veces que alguien invirtió en una "narrativa que recién empieza a llegar al público", ¿cuántas ganaron? Esa es la tasa base contra la que hay que comparar cualquier tesis narrativa.

#### 12.4 Las analogías del ejemplo, una por una

Las propuestas ficticias del ejemplo usan analogías reales, y vale la pena mirarlas con el método de Neustadt y May, no para juzgar los activos inventados sino para practicar cómo se evalúa una analogía.

- **Ferrocarriles, década de 1840 (ACME).** La "manía ferroviaria" británica de esa década es un caso clásico: una tecnología que efectivamente transformó la economía, financiada con una burbuja de acciones que se derrumbó en 1847. La analogía dice dos cosas a la vez: que la tecnología triunfó y que muchos de los que invirtieron en ella perdieron. Una tesis que la usa tiene que decir cuál de las dos cosas espera.
- **Tulipanes, 1637 (BETA).** Como se vio en la sección 11.3, la versión popular del episodio es dudosa. Una analogía con una leyenda es frágil.
- **Bienes de consumo masivo en 2008 (GAMA).** La idea de que las marcas de consumo básico resisten las crisis tiene sustento en varias recesiones, pero cada crisis es distinta. En el ejemplo, la propuesta con más confianza fue la que perdió: una analogía cómoda puede inflar la confianza.
- **Revival de vinilos, 2010 (DELTA).** Una analogía de nicho: el regreso de un formato por nostalgia. Es una buena analogía para una moda cultural, menos para predecir el valor de una empresa grande.
- **Inmigración europea en Argentina, 1880–1914 (EPSI).** Uno de los mayores movimientos migratorios de la historia: millones de personas, sobre todo de Italia y España, que transformaron la demografía, el consumo y la cultura del país. Es una analogía con un contexto local y una escala muy precisa; una tesis que la usa tiene que mostrar que el fenómeno actual tiene un tamaño comparable.
- **Electrodomésticos, década de 1920 (ETA).** La electrificación de los hogares y la difusión de la heladera, el lavarropas y la radio son un ejemplo de adopción masiva de una tecnología de consumo, con la curva en forma de S que estudió Everett Rogers. La pregunta, otra vez, es en qué punto de la curva estaría el caso actual.

Ninguna de estas analogías es buena o mala en sí misma. Lo que importa es que la tesis diga **qué** toma de la analogía y **qué** deja afuera. Una analogía que no se puede refutar ("esto es como los ferrocarriles") no informa nada; una que hace una predicción concreta ("como en los ferrocarriles, la adopción va a tardar más que la euforia, así que el precio va a caer antes de subir") se puede evaluar con la bitácora.

### 13. El problema de fondo: los mercados son difíciles de predecir

#### 13.1 Mercados eficientes

Eugene Fama formuló en 1970 (*Journal of Finance*, 25(2), 383–417) la **hipótesis de los mercados eficientes**: los precios reflejan toda la información disponible, así que no se puede obtener sistemáticamente un rendimiento extraordinario usando esa información. En su versión fuerte, la hipótesis es discutible y ha sido muy criticada (por Shiller entre otros: Fama y Shiller compartieron el Nobel de 2013 con Lars Peter Hansen, con posiciones parcialmente opuestas). Pero su versión débil es una advertencia sensata: si una historia es conocida por todos, probablemente ya está en el precio.

Una tesis narrativa solo puede agregar valor si la narrativa **todavía no** está en el precio: si el mercado no la incorporó o la incorporó mal. La tesis de ACME ("recién empieza a llegar al público masivo") y la de BETA ("todo el mundo habla de BETA: narrativa saturada") son, justamente, afirmaciones sobre ese desfase. Son las afirmaciones más difíciles de sostener.

#### 13.2 Operar es peligroso para el patrimonio

Brad Barber y Terrance Odean analizaron en 2000 (*Journal of Finance*, 55(2), 773–806) las operaciones de unos 66 000 hogares con cuentas en una agencia de bolsa entre 1991 y 1996, con un título explícito: *Trading is hazardous to your wealth*. Los que más operaban obtenían rendimientos netos bastante menores que el mercado, sobre todo por los costos de operar. Odean ya había propuesto en 1998 (*Journal of Finance*, 53(6), 1887–1934) que el **exceso de confianza** explicaba ese exceso de operaciones.

A escala profesional, los informes periódicos SPIVA de S&P Dow Jones Indices muestran, año tras año, que la mayoría de los fondos de gestión activa rinden menos que su índice de referencia en horizontes de diez años o más. Por eso el segundo próximo paso del proyecto (comparar contra un índice de referencia) es indispensable: una estrategia que gana 6 % cuando el índice ganó 10 % no agregó valor.

### 14. Clínico contra actuarial: humanos y fórmulas

#### 14.1 Meehl

Paul Meehl publicó en 1954 *Clinical versus Statistical Prediction*, un libro breve que revisó estudios en los que se comparaban las predicciones de expertos (psicólogos, médicos, oficiales de libertad condicional) con las de fórmulas estadísticas simples. En casi todos los casos, la fórmula igualaba o superaba al experto. Robyn Dawes, David Faust y Meehl actualizaron la revisión en 1989 (*Science*, 243(4899), 1668–1674) con la misma conclusión. Los expertos aportan información valiosa, pero la combinan peor que una regla fija: son inconsistentes, se dejan llevar por casos llamativos y no aprenden bien de sus errores.

Esto no dice que los humanos no sirvan. Dice que hay que **medir** si sirven en cada caso, en vez de suponerlo. La herramienta es, en ese sentido, un dispositivo meehliano: compara la decisión humana con la regla más simple posible (aprobar todo).

#### 14.2 Aversión y apreciación de algoritmos

Berkeley Dietvorst, Joseph Simmons y Cade Massey mostraron en 2015 (*Journal of Experimental Psychology: General*, 144(1), 114–126) que las personas pierden la confianza en un algoritmo mucho más rápido que en un humano después de verlo equivocarse, aunque el algoritmo se equivoque menos: la **aversión a los algoritmos**. Jennifer Logg, Julia Minson y Don Moore encontraron en 2019 (*Organizational Behavior and Human Decision Processes*, 151, 90–103) el efecto contrario en otras condiciones: muchas personas siguen más el consejo de un algoritmo que el de un humano, la **apreciación de los algoritmos**, salvo cuando se trata de expertos en el tema, que tienden a descartar el algoritmo.

Las dos tendencias son relevantes para la idea. Un humano con aversión rechazaría propuestas buenas de la IA; uno con apreciación excesiva aprobaría todo sin revisar. La bitácora permite ver cuál de las dos está pasando.

### 15. El humano en el circuito

#### 15.1 Las ironías de la automatización

Lisanne Bainbridge publicó en 1983 un artículo breve que se volvió un clásico de la ingeniería de factores humanos: *Ironies of automation* (*Automatica*, 19(6), 775–779). Su argumento: cuando se automatiza un proceso y se deja a un humano para supervisarlo e intervenir en casos excepcionales, se le asigna la tarea más difícil (detectar y resolver lo que el sistema no puede) mientras se lo priva de la práctica que necesitaría para hacerlo bien. Cuanto mejor funciona la automatización, peor preparado está el humano para el día en que falla.

La idea original reconoce este riesgo con una frase: que los humanos se vuelvan **sellos de goma**. La herramienta lo hace medible.

#### 15.2 Sesgo de automatización

Raja Parasuraman y Victor Riley clasificaron en 1997 (*Human Factors*, 39(2), 230–253) los problemas de la relación entre humanos y automatización: **uso** apropiado, **mal uso** (confiar demasiado), **desuso** (confiar demasiado poco) y **abuso** (automatizar sin considerar al humano). Linda Skitka, Kathleen Mosier y Mark Burdick documentaron en 1999 (*International Journal of Human-Computer Studies*, 51(5), 991–1006) el **sesgo de automatización**: personas que, con un sistema de ayuda, cometen errores que no cometerían sin él, porque siguen sus recomendaciones equivocadas (errores de comisión) o no actúan cuando el sistema no avisa (errores de omisión).

En la bitácora, el sesgo de automatización se vería así: el humano aprueba casi todo, la tasa de aprobación tiende al 100 % y el valor del humano tiende a cero. El ejemplo muestra otro problema, el contrario: el humano rechazó la mejor propuesta (EPSI). Los dos se detectan con las mismas métricas.

#### 15.3 Qué tiene que ver el humano

Para que la decisión humana sea informada, la idea propone que el humano vea la propuesta completa: el razonamiento (tesis), la analogía, la confianza y los riesgos. Es lo que la investigación sobre **explicabilidad** sugiere, con una advertencia: mostrar explicaciones no garantiza mejores decisiones. Varios estudios encontraron que las explicaciones aumentan la confianza en el sistema aunque el sistema se equivoque, es decir, pueden empeorar el sesgo de automatización. La única manera de saber si el formato de la propuesta ayuda al humano a decidir mejor es medir, como hace la bitácora.

#### 15.4 El humano contra una regla

La comparación de la bitácora (lo aprobado contra aprobar todo) es la más simple posible. Una comparación más exigente, en el espíritu de Meehl, es contra una **regla fija** que use la misma información que tiene el humano. Por ejemplo, "aprobar solo las propuestas con confianza de 60 % o más".

En el ejemplo, esa regla aprueba BETA (60), ACME (70), ETA (75) y GAMA (80), y rechaza DELTA (40) y EPSI (55): exactamente las mismas decisiones que tomó el humano. El humano del ejemplo, en la práctica, se comportó como esa regla. Otra regla, "aprobar solo con confianza mayor que 70 %", aprueba ETA y GAMA: rendimiento promedio de 0 %, mucho peor.

La pregunta que esta comparación permite responder es si el humano aporta algo **más allá** de seguir la confianza que declara la IA. Si sus decisiones coinciden siempre con una regla de umbral, el humano es, en el sentido de la idea, un sello de goma con un umbral. Si se aparta de la regla, la bitácora permite ver si esos apartamientos mejoran o empeoran el resultado. Agregar al resumen una o dos reglas fijas de referencia sería una mejora simple y muy informativa.

### 16. Saber el resultado: el sesgo de anticipación

#### 16.1 Fischhoff y el sesgo retrospectivo

Baruch Fischhoff publicó en 1975 *Hindsight ≠ foresight* (*Journal of Experimental Psychology: Human Perception and Performance*, 1(3), 288–299). Pidió a personas que estimaran la probabilidad de distintos desenlaces de episodios históricos poco conocidos. A algunas les dijo cuál había sido el desenlace real; a otras, no. Las que conocían el desenlace le asignaban una probabilidad mucho más alta y no se daban cuenta de que esa información las influía. Es el **sesgo retrospectivo**: una vez que se sabe qué pasó, parece que era previsible.

En finanzas, el sesgo retrospectivo produce tesis brillantes escritas después de los hechos. La bitácora lo controla de la manera más simple posible: si la fecha de la tesis es posterior al cierre, la propuesta no cuenta. Es el caso de ZETA en el ejemplo.

#### 16.2 El sesgo de anticipación en las pruebas históricas

En la evaluación de estrategias de inversión, el **sesgo de anticipación** (*look-ahead bias*) es usar, en una prueba sobre datos históricos, información que no estaba disponible en el momento simulado: un balance publicado después, un precio de cierre del día para decidir a la apertura. David Bailey, Jonathan Borwein, Marcos López de Prado y Qiji Jim Zhu advirtieron en 2014 (*Notices of the American Mathematical Society*, 61(5), 458–471) que muchas estrategias publicadas tienen rendimientos que no son más que artefactos de pruebas mal diseñadas: sesgo de anticipación, sobreajuste a los datos y la prueba de muchas variantes hasta que una parece funcionar. Campbell Harvey, Yan Liu y Heqing Zhu mostraron en 2016 (*Review of Financial Studies*, 29(1), 5–68) que, con cientos de "factores" propuestos en la literatura, la mayoría de los hallazgos probablemente son falsos positivos.

La regla de la bitácora (escribir la tesis antes, con fecha, y cerrar después) es la versión más elemental de la **preregistración**: comprometerse con la predicción antes de ver el resultado.

#### 16.3 El problema de los modelos de lenguaje

El control de fechas no alcanza cuando las tesis las escribe un modelo de lenguaje. Un modelo entrenado con textos hasta cierta fecha "sabe" lo que pasó hasta esa fecha. Si se le pide que escriba una tesis "como si estuviera en marzo de 2024" sobre un activo cuyo destino posterior aparece en sus datos de entrenamiento, la tesis puede estar contaminada por ese conocimiento, aunque la fecha declarada sea correcta. Varios trabajos de 2023 y 2024 que evaluaron la capacidad de los modelos de lenguaje para predecir rendimientos bursátiles a partir de noticias discutieron este riesgo, y algunos propusieron pruebas para detectarlo (por ejemplo, comparar el desempeño antes y después de la fecha de corte del entrenamiento).

Por eso el primer próximo paso del proyecto especifica "con fecha de corte de datos registrada": cada dossier generado por un modelo debería indicar hasta qué fecha llegan los datos del modelo, y solo deberían evaluarse predicciones sobre períodos **posteriores** a esa fecha. Es la única manera de que el control de anticipación de la bitácora tenga sentido con una IA.

### 17. Calibración: ¿la confianza significa algo?

#### 17.1 El puntaje de Brier

Glenn Brier, meteorólogo, propuso en 1950 (*Monthly Weather Review*, 78(1), 1–3) una manera de medir la calidad de los pronósticos probabilísticos: el promedio del cuadrado de la diferencia entre la probabilidad pronosticada y lo que pasó (1 o 0). Un pronóstico perfecto tiene Brier 0. Decir siempre 50 % da 0,25. Decir 100 % y errar siempre da 1.

Allan Murphy mostró en 1973 (*Journal of Applied Meteorology*, 12(4), 595–600) que el puntaje de Brier se puede descomponer en tres partes: la **incertidumbre** propia del fenómeno (que no depende de quien pronostica), la **confiabilidad** (si las probabilidades declaradas coinciden con las frecuencias observadas: la calibración) y la **resolución** (si los pronósticos distinguen entre casos que salen distinto). Un buen pronosticador está calibrado **y** tiene resolución: no basta con decir 60 % siempre, aunque gane el 60 % de las veces.

#### 17.2 La sobreconfianza

Sarah Lichtenstein, Baruch Fischhoff y Lawrence Phillips revisaron en 1982 la evidencia sobre calibración y encontraron que la mayoría de las personas, incluidos los expertos, están **sobreconfiadas**: sus "90 %" se cumplen bastante menos que el 90 % de las veces. Los meteorólogos son una excepción notable: están bien calibrados porque reciben retroalimentación inmediata y precisa sobre miles de pronósticos.

La lección para la idea es que la calibración se aprende con retroalimentación sistemática, y que la bitácora puede ser esa retroalimentación. El gráfico de calibración, con decenas de propuestas, mostraría si la confianza declarada por la IA (o por quien sea) significa algo.

#### 17.3 Tetlock

Philip Tetlock registró durante dos décadas más de 80 000 predicciones de unos 280 expertos en política y economía, y publicó los resultados en *Expert Political Judgment* (2005): en promedio, no superaban mucho a reglas simples, y los más conocidos en los medios eran de los peores. Los mejores eran los que Tetlock llamó **zorros** (que usan muchas ideas pequeñas y dudan) frente a los **erizos** (que explican todo con una gran teoría). Una IA que explica todo con una narrativa histórica corre el riesgo de ser un erizo. Su antídoto es la medición.

### 18. Por qué con dinero simulado

La idea insiste en que todo empiece con dinero simulado, nunca real. Hay razones metodológicas, además de las obvias:

- **Separar la evaluación del resultado personal.** Con dinero real, las pérdidas duelen, y el dolor distorsiona las decisiones siguientes (la aversión a la pérdida de Kahneman y Tversky, el efecto de disposición de Shefrin y Statman: vender rápido lo que gana y aferrarse a lo que pierde). Con dinero simulado se puede evaluar el proceso de decisión con más frialdad.
- **Poder cerrar las rechazadas.** Con dinero real, lo que no se compró no tiene precio de cierre en la cuenta. En la bitácora, todo se cierra.
- **Acumular sin costo.** Hacen falta decenas o cientos de propuestas para evaluar algo. Con dinero simulado, el costo de esa acumulación es solo el tiempo.

La desventaja es que el *paper trading* no incluye costos de operar, impacto en los precios ni la presión psicológica real. Una estrategia que funciona en papel puede no funcionar con dinero. Pero una que no funciona en papel, casi seguro no funcionará con dinero.

### 19. Cuántas propuestas hacen falta

Con seis propuestas evaluadas, el valor del humano del ejemplo (−0,7 puntos porcentuales) es indistinguible del azar. ¿Cuántas harían falta?

Una cuenta aproximada: si los rendimientos de las propuestas tienen una dispersión típica de unos 10 puntos porcentuales (como en el ejemplo) y se quiere detectar un valor del humano de 2 puntos porcentuales, la dispersión del promedio tiene que ser menor que unos 1 punto, lo que requiere del orden de cien propuestas evaluadas, y más si las aprobadas son una fracción chica. Para la calibración, cada tramo de confianza necesita al menos veinte o treinta propuestas para que su porcentaje de aciertos tenga una incertidumbre razonable.

El tercer próximo paso del proyecto (correrla unos meses con diez activos) es un buen comienzo para probar el proceso, no para sacar conclusiones. La honestidad de la herramienta está en mostrar los números junto con la advertencia de que con pocos datos son ruido.

### 20. La IA que falta: cómo debería ser el dossier

El primer próximo paso es conectar un modelo de lenguaje que arme el dossier de cada activo. Con lo visto en esta guía, un dossier útil debería:

1. **Declarar la fecha de corte** de los datos del modelo y la fecha de la tesis.
2. **Proponer varias analogías**, no una, con sus semejanzas y diferencias (Neustadt y May; Green y Armstrong).
3. **Dar la tasa base**: cómo les fue, en general, a casos de esa clase de referencia (Kahneman y Lovallo).
4. **Explicar por qué la narrativa no está en el precio**, si la tesis depende de eso (Fama).
5. **Declarar una confianza** como probabilidad, para poder calibrarla (Brier).
6. **Listar los riesgos** y qué observación, en el futuro, refutaría la tesis (Popper aplicado a una inversión).
7. **Fijar de antemano la fecha de cierre**, para evitar elegir cuándo cerrar según el resultado.

Con esos dossiers, la bitácora permitiría responder por separado tres preguntas: ¿la IA está calibrada?, ¿sus propuestas, aprobadas todas, superan al índice?, ¿el humano mejora o empeora el resultado al filtrar?

### 21. Riesgos, ética y regulación

Una herramienta que evalúa predicciones financieras con dinero simulado es inocua. Una IA que propone inversiones con dinero real a otras personas no lo es, y la idea debería tenerlo presente desde el principio.

**El riesgo de la narrativa convincente.** Los modelos de lenguaje son muy buenos produciendo textos plausibles. Una tesis bien escrita, con una analogía histórica elegante, puede convencer más que lo que su evidencia justifica. Es exactamente el mecanismo que Shiller describe para las narrativas económicas: lo que se contagia no es lo verdadero sino lo que se cuenta bien. Una IA de tesis narrativas podría, sin proponérselo, ser una fábrica de narrativas contagiosas.

**El riesgo de la escala.** Si muchas personas usaran la misma IA y recibieran las mismas tesis, sus decisiones se correlacionarían, y la IA podría mover los precios que pretende predecir. Es el monocultivo algorítmico que Kleinberg y Raghavan describieron para otras decisiones automatizadas: los errores de un sistema usado por todos no se compensan.

**La regulación.** En la mayoría de los países, recomendar inversiones a terceros es una actividad regulada. En la Argentina, la Ley 26.831 de Mercado de Capitales (2012) y las normas de la Comisión Nacional de Valores regulan a quienes asesoran o recomiendan inversiones al público, con requisitos de registro, idoneidad y conducta. Una IA que hiciera recomendaciones personalizadas a usuarios con dinero real caería, muy probablemente, dentro de ese marco. La bitácora, que solo registra propuestas propias con dinero simulado, no.

**La honestidad de las métricas.** El mayor riesgo ético de un sistema de predicción es mostrar sus aciertos y esconder sus errores. La bitácora está diseñada para lo contrario: cierra las rechazadas, excluye las tesis con anticipación, compara con la regla más simple y muestra el Brier. Cualquier versión futura con IA debería conservar esa transparencia, y publicar las métricas completas antes de pedirle a nadie que confíe en sus propuestas.

### 22. Del modelo al código

| Concepto | En `src/bitacora.js` | Qué produce |
|---|---|---|
| Validación de una propuesta | `validar(p)` | Errores como "El precio de entrada tiene que ser mayor que 0" |
| Sesgo de anticipación | `anticipacion(p)` | Si la tesis es posterior al cierre |
| Rendimiento | `rendimiento(p)` | cierre / entrada − 1, o su opuesto en ventas |
| Resumen | `resumen(lista)` | Evaluadas, excluidas, promedios, valor del humano, aciertos, Brier |
| Calibración | `calibracion(lista)` | Tramos de confianza con su tasa de acierto real |
| Validación de una lista importada | `validarLista(lista)` | Errores en un JSON importado |
| Ejemplo | `ejemplo()` | Las ocho propuestas ficticias |

Los tests verifican: el rendimiento de compras y ventas; que se detectan tesis escritas sabiendo el resultado; que en el resumen del ejemplo el humano no agregó valor; la calibración por tramos de confianza; que la validación marca los datos inválidos, y que sin propuestas cerradas no hay métricas.

```js
const B = require("./src/bitacora.js");
const r = B.resumen(B.ejemplo());
r.evaluadas;      // 6
r.valorHumano;    // ≈ −0,0067
r.brier;          // ≈ 0,219
```

### 23. Ejercicios

1. Con el ejemplo, calculá a mano qué habría pasado con el valor del humano si hubiera aprobado EPSI. ¿Y si además hubiera rechazado GAMA?
2. Escribí una tesis narrativa sobre un activo inventado, con dos analogías históricas y sus diferencias. Fijá la fecha de cierre de antemano.
3. Calculá el Brier de alguien que dice siempre 50 % en las seis propuestas del ejemplo. Compará con el 0,219.
4. Investigá la historia de la tulipomanía en Garber o Goldgar y escribí qué cambia de la analogía de BETA.
5. Diseñá una regla que no use la confianza (por ejemplo, "aprobar solo las compras" o "aprobar solo las propuestas con analogía anterior a 1950") y calculá su valor sobre el ejemplo. ¿Supera al humano?
6. ¿Cuántas propuestas necesitarías para que un valor del humano de 2 puntos porcentuales fuera distinguible del azar, si la dispersión de los rendimientos es de 15 puntos?
7. Leé el primer capítulo de *Narrative Economics* de Shiller y anotá qué métricas propone para medir una narrativa.

### 24. Glosario

- **Paper trading:** operaciones con dinero simulado.
- **Tesis:** el razonamiento que justifica una propuesta.
- **Analogía histórica:** episodio pasado que se usa para razonar sobre el presente.
- **Clase de referencia:** conjunto de casos parecidos cuyo resultado sirve como tasa base.
- **Valor del humano:** diferencia entre el rendimiento de lo aprobado y el de aprobar todo.
- **Puntaje de Brier:** promedio del cuadrado del error de un pronóstico probabilístico.
- **Calibración:** correspondencia entre las probabilidades declaradas y las frecuencias observadas.
- **Resolución:** capacidad de los pronósticos de distinguir casos que salen distinto.
- **Sesgo retrospectivo:** sobrestimar, después de conocer un resultado, cuán previsible era.
- **Sesgo de anticipación:** usar en una evaluación información que no estaba disponible en el momento.
- **Preregistración:** comprometerse con una predicción antes de conocer el resultado.
- **Sesgo de automatización:** tendencia a seguir las recomendaciones de un sistema automático aunque estén equivocadas.
- **Economía narrativa:** estudio de cómo las historias que circulan afectan los fenómenos económicos.
- **Hipótesis de los mercados eficientes:** los precios reflejan la información disponible.

### 25. Conclusión

La idea de una IA que predice con trasfondo sociohistórico se apoya en una intuición respaldada por la investigación: las narrativas mueven la economía, como mostró Shiller, y las manías tienen patrones que se repiten, como describieron Kindleberger y Perez. Pero también choca con tres advertencias igual de sólidas. Los mercados incorporan rápido lo que todos saben (Fama), y quienes operan activamente suelen rendir menos que el mercado (Barber y Odean). Las analogías históricas se eligen mal y se cuentan mal (Neustadt y May; Garber y Goldgar sobre los tulipanes). Y los humanos que supervisan sistemas automáticos tienden a volverse sellos de goma o a desconfiar sin razón (Bainbridge; Parasuraman y Riley; Dietvorst y Logg).

La herramienta no responde si la idea funciona. Construye lo necesario para responderlo sin engañarse: tesis fechadas antes del resultado, rechazadas que también se cierran, una comparación contra la regla más simple (aprobar todo), un puntaje de Brier y un gráfico de calibración. En el ejemplo ficticio, el humano no agregó valor y la confianza no significó mucho; con seis propuestas, eso tampoco significa nada. Los próximos pasos (conectar un modelo con fecha de corte registrada, comparar contra un índice y acumular meses de propuestas) son los que permitirían saberlo. Todo, como insiste la idea, con dinero simulado.

## Referencias

- Asimov, I. (1951). *Foundation*. Gnome Press.
- Bailey, D. H., Borwein, J. M., López de Prado, M., & Zhu, Q. J. (2014). Pseudo-mathematics and financial charlatanism: The effects of backtest overfitting on out-of-sample performance. *Notices of the American Mathematical Society*, 61(5), 458–471. https://doi.org/10.1090/noti1105
- Bainbridge, L. (1983). Ironies of automation. *Automatica*, 19(6), 775–779. https://doi.org/10.1016/0005-1098(83)90046-8
- Barber, B. M., & Odean, T. (2000). Trading is hazardous to your wealth: The common stock investment performance of individual investors. *Journal of Finance*, 55(2), 773–806. https://doi.org/10.1111/0022-1082.00226
- Brier, G. W. (1950). Verification of forecasts expressed in terms of probability. *Monthly Weather Review*, 78(1), 1–3. https://doi.org/10.1175/1520-0493(1950)078<0001:VOFEIT>2.0.CO;2
- Dawes, R. M., Faust, D., & Meehl, P. E. (1989). Clinical versus actuarial judgment. *Science*, 243(4899), 1668–1674. https://doi.org/10.1126/science.2648573
- Dietvorst, B. J., Simmons, J. P., & Massey, C. (2015). Algorithm aversion: People erroneously avoid algorithms after seeing them err. *Journal of Experimental Psychology: General*, 144(1), 114–126. https://doi.org/10.1037/xge0000033
- Fama, E. F. (1970). Efficient capital markets: A review of theory and empirical work. *Journal of Finance*, 25(2), 383–417. https://doi.org/10.2307/2325486
- Fischhoff, B. (1975). Hindsight ≠ foresight: The effect of outcome knowledge on judgment under uncertainty. *Journal of Experimental Psychology: Human Perception and Performance*, 1(3), 288–299. https://doi.org/10.1037/0096-1523.1.3.288
- Garber, P. M. (1989). Tulipmania. *Journal of Political Economy*, 97(3), 535–560. https://doi.org/10.1086/261615
- Goldgar, A. (2007). *Tulipmania: Money, Honor, and Knowledge in the Dutch Golden Age*. University of Chicago Press. ISBN 978-0-226-30125-9.
- Green, K. C., & Armstrong, J. S. (2007). Structured analogies for forecasting. *International Journal of Forecasting*, 23(3), 365–376. https://doi.org/10.1016/j.ijforecast.2007.05.005
- Harvey, C. R., Liu, Y., & Zhu, H. (2016). … and the cross-section of expected returns. *Review of Financial Studies*, 29(1), 5–68. https://doi.org/10.1093/rfs/hhv059
- Kahneman, D., & Lovallo, D. (1993). Timid choices and bold forecasts: A cognitive perspective on risk taking. *Management Science*, 39(1), 17–31. https://doi.org/10.1287/mnsc.39.1.17
- Kindleberger, C. P. (1978). *Manias, Panics, and Crashes: A History of Financial Crises*. Basic Books.
- Kleinberg, J., & Raghavan, M. (2021). Algorithmic monoculture and social welfare. *Proceedings of the National Academy of Sciences*, 118(22), e2018340118. https://doi.org/10.1073/pnas.2018340118
- Ley 26.831 de Mercado de Capitales. (2012). *Boletín Oficial de la República Argentina*, 28 de diciembre de 2012.
- Lichtenstein, S., Fischhoff, B., & Phillips, L. D. (1982). Calibration of probabilities: The state of the art to 1980. En D. Kahneman, P. Slovic & A. Tversky (Eds.), *Judgment under Uncertainty: Heuristics and Biases* (pp. 306–334). Cambridge University Press.
- Logg, J. M., Minson, J. A., & Moore, D. A. (2019). Algorithm appreciation: People prefer algorithmic to human judgment. *Organizational Behavior and Human Decision Processes*, 151, 90–103. https://doi.org/10.1016/j.obhdp.2018.12.005
- Mackay, C. (1841). *Memoirs of Extraordinary Popular Delusions and the Madness of Crowds*. Londres: Richard Bentley.
- Meehl, P. E. (1954). *Clinical versus Statistical Prediction: A Theoretical Analysis and a Review of the Evidence*. University of Minnesota Press.
- Murphy, A. H. (1973). A new vector partition of the probability score. *Journal of Applied Meteorology*, 12(4), 595–600. https://doi.org/10.1175/1520-0450(1973)012<0595:ANVPOT>2.0.CO;2
- Neustadt, R. E., & May, E. R. (1986). *Thinking in Time: The Uses of History for Decision Makers*. Free Press. ISBN 978-0-02-922790-2.
- Odean, T. (1998). Volume, volatility, price, and profit when all traders are above average. *Journal of Finance*, 53(6), 1887–1934. https://doi.org/10.1111/0022-1082.00078
- Parasuraman, R., & Riley, V. (1997). Humans and automation: Use, misuse, disuse, abuse. *Human Factors*, 39(2), 230–253. https://doi.org/10.1518/001872097778543886
- Perez, C. (2002). *Technological Revolutions and Financial Capital: The Dynamics of Bubbles and Golden Ages*. Edward Elgar. ISBN 978-1-84376-331-8.
- Rogers, E. M. (1962). *Diffusion of Innovations*. Free Press.
- Shefrin, H., & Statman, M. (1985). The disposition to sell winners too early and ride losers too long: Theory and evidence. *Journal of Finance*, 40(3), 777–790. https://doi.org/10.1111/j.1540-6261.1985.tb05002.x
- Shiller, R. J. (1981). Do stock prices move too much to be justified by subsequent changes in dividends? *American Economic Review*, 71(3), 421–436.
- Shiller, R. J. (2017). Narrative economics. *American Economic Review*, 107(4), 967–1004. https://doi.org/10.1257/aer.107.4.967
- Shiller, R. J. (2019). *Narrative Economics: How Stories Go Viral and Drive Major Economic Events*. Princeton University Press. ISBN 978-0-691-18229-2.
- Skitka, L. J., Mosier, K. L., & Burdick, M. (1999). Does automation bias decision-making? *International Journal of Human-Computer Studies*, 51(5), 991–1006. https://doi.org/10.1006/ijhc.1999.0252
- Tetlock, P. E. (2005). *Expert Political Judgment: How Good Is It? How Can We Know?* Princeton University Press. ISBN 978-0-691-12302-8.
- Turchin, P. (2008). Arise 'cliodynamics'. *Nature*, 454, 34–35. https://doi.org/10.1038/454034a
