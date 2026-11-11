// Costo de la API de Claude. Precios en dólares por millón de tokens, de
// https://platform.claude.com/docs/en/about-claude/pricing (consultado el 2026-11-11).
// El razonamiento interno (thinking) se cobra como tokens de salida y ya viene sumado
// en usage.output_tokens. El pipeline no usa caché, pero si la API informara tokens
// de caché se cuentan con su precio.
const Costos = (() => {
  const PRECIOS = {
    "claude-opus-5-5": { nombre: "Claude Opus 5.5", entrada: 4, salida: 20, cacheEscritura: 5, cacheLectura: 0.2 },
    "claude-sonnet-5-5": { nombre: "Claude Sonnet 5.5", entrada: 2, salida: 10, cacheEscritura: 2.5, cacheLectura: 0.1 },
    "claude-haiku-5-5": { nombre: "Claude Haiku 5.5", entrada: 0.1, salida: 0.5, cacheEscritura: 0.125, cacheLectura: 0.01 },
  };
  const RUEDAS_POR_MES = 21;

  // uso: {entrada, salida, cacheEscritura, cacheLectura} en tokens.
  function costo(uso, modelo) {
    const p = PRECIOS[modelo];
    if (!p || !uso) return null;
    const t = (k) => (uso[k] || 0) * p[k];
    return (t("entrada") + t("salida") + t("cacheEscritura") + t("cacheLectura")) / 1e6;
  }

  // Estimación antes de activar: tokens por rueda (medidos o supuestos) × precio × ruedas.
  function estimar(tokensPorRueda, modelo, ruedas = RUEDAS_POR_MES) {
    const porRueda = costo(tokensPorRueda, modelo);
    return porRueda === null ? null : { porRueda, porMes: porRueda * ruedas, ruedas };
  }

  // Suma de las corridas de un mes ("AAAA-MM") de data/costos.json.
  function delMes(corridas, mes) {
    const xs = (corridas || []).filter((c) => (c.fecha || "").startsWith(mes));
    return { corridas: xs.length, dolares: xs.reduce((a, c) => a + (c.dolares || 0), 0) };
  }

  return { PRECIOS, RUEDAS_POR_MES, costo, estimar, delMes };
})();

if (typeof module !== "undefined") module.exports = Costos;
