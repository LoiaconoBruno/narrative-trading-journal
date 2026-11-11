// Bitácora: junta las propuestas selladas, sus resultados y tus decisiones, y mide.
//   - Sistema: tasa de aciertos, puntaje de Brier y calibración de la confianza.
//   - Humano: si lo que aprobaste rindió más que todo lo que decidiste (¿agregás valor
//     o sos un sello de goma?) y cuántas veces tu decisión coincidió con el resultado.
//   - Umbral: cuándo tendría sentido siquiera pensar en plata real.
// Solo cuentan las propuestas cerradas cuyo sello es anterior a la apertura y las
// decisiones tomadas antes de esa apertura. Plata simulada siempre.
const Bitacora = (() => {
  const BRIER_AZAR = 0.25; // decir siempre 50 %
  const UMBRAL = { cerradas: 300, sesiones: 60, brierMax: 0.23, wilsonMin: 0.5 };
  const TRAMOS = [[50, 60], [60, 70], [70, 80], [80, 90], [90, 101]];

  const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const ms = (iso) => (iso ? Date.parse(iso) : NaN);

  // Una lista plana: cada propuesta con su resultado y tu decisión.
  function unir(dias, resultados, decisiones) {
    const porId = new Map((resultados || []).map((r) => [r.id, r]));
    const lista = [];
    for (const d of dias || []) {
      for (const p of d.propuestas || []) {
        const decision = (decisiones && decisiones[p.id]) || null;
        lista.push({
          ...p,
          fecha: d.fecha,
          generadaEn: d.generadaEn,
          aperturaEn: d.aperturaEn,
          horizonte: d.horizonte,
          modelo: d.modelo,
          resultado: porId.get(p.id) || null,
          decision,
          decisionCuenta: decisionCuenta(decision, d.aperturaEn),
        });
      }
    }
    return lista;
  }

  function decisionCuenta(decision, aperturaEn) {
    return !!(decision && ["aprobada", "rechazada"].includes(decision.decision) && ms(decision.en) < ms(aperturaEn));
  }

  // ¿Se puede decidir todavía? Hasta la apertura de la rueda de la propuesta.
  const abiertaParaDecidir = (p, ahora = new Date()) => ahora.getTime() < ms(p.aperturaEn);

  // Rendimiento desde el punto de vista de la propuesta: positivo si acertó la dirección.
  function rendimiento(p) {
    if (!p.resultado || p.resultado.rendimientoActivo === null || p.resultado.rendimientoActivo === undefined) return null;
    const r = p.resultado.rendimientoActivo;
    return p.direccion === "venta" ? -r : r;
  }

  const cerradas = (lista) => lista.filter((p) => p.resultado && p.resultado.cuenta);

  // Intervalo de Wilson al 95 % para una proporción (Wilson, 1927).
  function wilson(k, n, z = 1.96) {
    if (!n) return null;
    const p = k / n;
    const den = 1 + (z * z) / n;
    const centro = (p + (z * z) / (2 * n)) / den;
    const medio = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
    return { inferior: centro - medio, superior: centro + medio };
  }

  const brier = (xs) => media(xs.map((p) => (p.confianza / 100 - (p.resultado.acierto ? 1 : 0)) ** 2));

  function resumen(lista) {
    const c = cerradas(lista);
    const aciertos = c.filter((p) => p.resultado.acierto).length;
    const decididas = c.filter((p) => p.decisionCuenta);
    const aprobadas = decididas.filter((p) => p.decision.decision === "aprobada");
    const promAprobadas = media(aprobadas.map(rendimiento));
    const promDecididas = media(decididas.map(rendimiento));
    return {
      total: lista.length,
      abiertas: lista.filter((p) => !p.resultado).length,
      cerradas: c.length,
      excluidas: lista.filter((p) => p.resultado && !p.resultado.cuenta).length,
      sesiones: new Set(c.map((p) => p.fecha)).size,
      aciertos,
      tasa: c.length ? aciertos / c.length : null,
      wilson: wilson(aciertos, c.length),
      brier: c.length ? brier(c) : null,
      brierAzar: BRIER_AZAR,
      rendimientoMedio: media(c.map(rendimiento)),
      humano: {
        decididas: decididas.length,
        aprobadas: aprobadas.length,
        rechazadas: decididas.length - aprobadas.length,
        tarde: lista.filter((p) => p.decision && !p.decisionCuenta).length,
        promAprobadas,
        promDecididas,
        valor: promAprobadas === null || promDecididas === null ? null : promAprobadas - promDecididas,
        coincidencias: decididas.length ? decididas.filter((p) => (p.decision.decision === "aprobada") === p.resultado.acierto).length / decididas.length : null,
      },
    };
  }

  // Calibración: en cada tramo de confianza, cuánto acertó de verdad.
  function calibracion(lista, tramos = TRAMOS) {
    const c = cerradas(lista);
    return tramos.map(([desde, hasta]) => {
      const xs = c.filter((p) => p.confianza >= desde && p.confianza < hasta);
      return {
        desde,
        hasta: Math.min(hasta, 100),
        n: xs.length,
        confianzaMedia: media(xs.map((p) => p.confianza / 100)),
        tasaAcierto: media(xs.map((p) => (p.resultado.acierto ? 1 : 0))),
      };
    });
  }

  function historialActivo(lista, activo) {
    const c = cerradas(lista).filter((p) => p.activo === activo);
    return { n: c.length, aciertos: c.filter((p) => p.resultado.acierto).length, brier: c.length ? brier(c) : null };
  }

  // Criterios para considerar plata real. Es una vara propia, no una regla del mercado:
  // ver docs/guia.md, «Umbral para plata real».
  function umbral(r) {
    const criterios = [
      { clave: "cerradas", nombre: "Propuestas cerradas", actual: r.cerradas, objetivo: `${UMBRAL.cerradas} o más`, ok: r.cerradas >= UMBRAL.cerradas },
      { clave: "sesiones", nombre: "Ruedas distintas con propuestas cerradas", actual: r.sesiones, objetivo: `${UMBRAL.sesiones} o más`, ok: r.sesiones >= UMBRAL.sesiones },
      { clave: "brier", nombre: "Puntaje de Brier", actual: r.brier, objetivo: `${String(UMBRAL.brierMax).replace(".", ",")} o menos`, ok: r.brier !== null && r.brier <= UMBRAL.brierMax },
      { clave: "wilson", nombre: "Piso del intervalo de aciertos (95 %)", actual: r.wilson ? r.wilson.inferior : null, objetivo: "más de 50 %", ok: !!r.wilson && r.wilson.inferior > UMBRAL.wilsonMin },
    ];
    return { cumple: criterios.every((c) => c.ok), cumplidos: criterios.filter((c) => c.ok).length, criterios };
  }

  // Ranking de un día: de mayor a menor confianza; a igual confianza, por activo.
  const ranking = (propuestas) => [...propuestas].sort((a, b) => b.confianza - a.confianza || a.activo.localeCompare(b.activo));

  // Forma de un archivo diario de propuestas. Devuelve la lista de errores.
  function validarDia(d, tickers) {
    const e = [];
    if (!d || typeof d !== "object") return ["No es un objeto"];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha || "")) e.push("Falta la fecha de la rueda");
    for (const k of ["generadaEn", "aperturaEn"]) if (isNaN(ms(d[k]))) e.push(`${k} no es una fecha y hora`);
    if (!(ms(d.generadaEn) < ms(d.aperturaEn))) e.push("La tesis tiene que ser anterior a la apertura");
    if (!Array.isArray(d.propuestas)) return e.concat("Faltan las propuestas");
    const vistos = new Set();
    for (const p of d.propuestas) {
      const q = p.activo || "?";
      if (tickers && !tickers.includes(p.activo)) e.push(`${q}: no está en la watchlist`);
      if (vistos.has(p.activo)) e.push(`${q}: repetido`);
      vistos.add(p.activo);
      if (p.id !== `${d.fecha}-${p.activo}`) e.push(`${q}: el id tiene que ser fecha-activo`);
      if (!["compra", "venta"].includes(p.direccion)) e.push(`${q}: la dirección es compra o venta`);
      if (!(Number.isInteger(p.confianza) && p.confianza >= 50 && p.confianza <= 100)) e.push(`${q}: la confianza es un entero de 50 a 100`);
      if (!p.tesis || !String(p.tesis).trim()) e.push(`${q}: falta la tesis`);
      if (!p.analogo || !p.analogo.episodio) e.push(`${q}: falta el episodio histórico`);
      if (!Array.isArray(p.riesgos) || !p.riesgos.length) e.push(`${q}: faltan los riesgos`);
    }
    return e;
  }

  return { BRIER_AZAR, UMBRAL, TRAMOS, unir, decisionCuenta, abiertaParaDecidir, rendimiento, wilson, resumen, calibracion, historialActivo, umbral, ranking, validarDia };
})();

if (typeof module !== "undefined") module.exports = Bitacora;
