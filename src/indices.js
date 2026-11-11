// Índices narrativos por activo: qué mide cada uno, su escala y cómo se calcula.
// Lo usan el pipeline (para calcularlos) y la página (para mostrarlos y explicarlos),
// así la definición escrita y la cuenta salen del mismo archivo.
const Indices = (() => {
  const BASE_DIAS = 20;      // días previos con los que se compara la atención
  const BASE_MINIMA = 5;     // con menos días previos, la atención todavía no se calcula
  const RELEVANTES_MINIMOS = 3;
  const ALFA = 0.3;          // peso del día en el momento narrativo

  const DEFINICIONES = [
    {
      clave: "atencion",
      nombre: "Atención",
      escala: "0 a 100 (50 = lo normal para ese activo)",
      mide: "Cuánto se habla del activo hoy comparado con sus últimos 20 días.",
      calculo: "Se cuentan los artículos de GDELT de las últimas 24 horas que nombran a la empresa y se dividen por el total de artículos procesados en esas 24 horas (cuota por cada 10.000). Con la media y el desvío estándar de las cuotas de los 20 días anteriores: z = (cuota de hoy − media) / desvío, y Atención = 50 + 25 · z, recortada entre 0 y 100. Hacen falta al menos 5 días previos.",
      mueve: "El volumen de artículos del día; se listan los más relevantes.",
    },
    {
      clave: "tono",
      nombre: "Tono",
      escala: "−100 a +100",
      mide: "Si las noticias del día son buenas o malas para la empresa.",
      calculo: "Claude lee el título de hasta 20 artículos del día y marca cada uno como positivo, neutro o negativo para la empresa, o como no relevante. Tono = 100 · (positivos − negativos) / relevantes. Hacen falta al menos 3 artículos relevantes.",
      mueve: "Los artículos marcados como positivos o negativos.",
    },
    {
      clave: "riesgo",
      nombre: "Riesgo",
      escala: "0 a 100",
      mide: "Qué parte de las noticias habla de un evento de riesgo.",
      calculo: "Porcentaje de los artículos relevantes que Claude marca como evento de riesgo: juicio, sanción o regulación, accidente, rebaja de pronósticos, conflicto laboral, problema de deuda, salida de directivos y parecidos. Riesgo = 100 · con riesgo / relevantes. Hacen falta al menos 3 artículos relevantes.",
      mueve: "Los artículos marcados como riesgo.",
    },
    {
      clave: "momento",
      nombre: "Momento narrativo",
      escala: "−100 a +100",
      mide: "Hacia dónde viene la narrativa, sin saltar por un día suelto.",
      calculo: "Media móvil exponencial del Tono: Momento de hoy = 0,3 · Tono de hoy + 0,7 · Momento de ayer. El primer día es igual al Tono. Si un día no hay Tono, el Momento se mantiene.",
      mueve: "Los mismos artículos que el Tono, con peso 0,3.",
    },
  ];

  const redondear = (x, d = 1) => (x === null || !isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
  const media = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  function desvio(xs) {
    if (xs.length < 2) return 0;
    const m = media(xs);
    return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
  }

  // Cuota de artículos por cada 10.000 procesados.
  const cuota = (conteo, total) => (total > 0 ? (conteo / total) * 10000 : null);

  // previas: cuotas de los días anteriores, de la más vieja a la más nueva.
  function atencion(cuotaHoy, previas) {
    const base = (previas || []).filter((x) => x !== null && isFinite(x)).slice(-BASE_DIAS);
    if (cuotaHoy === null || base.length < BASE_MINIMA) {
      return { valor: null, z: null, base: { n: base.length, media: base.length ? redondear(media(base), 3) : null, desvio: null }, falta: Math.max(0, BASE_MINIMA - base.length) };
    }
    const m = media(base);
    const de = desvio(base);
    const z = de > 0 ? (cuotaHoy - m) / de : 0;
    return { valor: redondear(Math.min(100, Math.max(0, 50 + 25 * z))), z: redondear(z, 2), base: { n: base.length, media: redondear(m, 3), desvio: redondear(de, 3) }, falta: 0 };
  }

  // articulos: [{relevante, tono: "positivo"|"neutro"|"negativo", riesgo}]
  function contar(articulos) {
    const rel = (articulos || []).filter((a) => a && a.relevante);
    return {
      relevantes: rel.length,
      positivos: rel.filter((a) => a.tono === "positivo").length,
      negativos: rel.filter((a) => a.tono === "negativo").length,
      conRiesgo: rel.filter((a) => a.riesgo).length,
    };
  }

  function tono(articulos) {
    const c = contar(articulos);
    const valor = c.relevantes >= RELEVANTES_MINIMOS ? redondear((100 * (c.positivos - c.negativos)) / c.relevantes) : null;
    return { valor, positivos: c.positivos, negativos: c.negativos, relevantes: c.relevantes };
  }

  function riesgo(articulos) {
    const c = contar(articulos);
    const valor = c.relevantes >= RELEVANTES_MINIMOS ? redondear((100 * c.conRiesgo) / c.relevantes) : null;
    return { valor, conRiesgo: c.conRiesgo, relevantes: c.relevantes };
  }

  function momento(tonoHoy, momentoAyer) {
    if (tonoHoy === null || tonoHoy === undefined) return momentoAyer ?? null;
    if (momentoAyer === null || momentoAyer === undefined) return redondear(tonoHoy);
    return redondear(ALFA * tonoHoy + (1 - ALFA) * momentoAyer);
  }

  // Un día nuevo de un activo, a partir del conteo del día y de su historia.
  // historia: días anteriores [{cuota, momento: {valor}}], del más viejo al más nuevo.
  function calcularDia({ fecha, conteo, total, articulos }, historia = []) {
    const c = cuota(conteo, total);
    const previo = historia.length ? historia[historia.length - 1] : null;
    const t = tono(articulos);
    return {
      fecha,
      conteo,
      total,
      cuota: redondear(c, 3),
      atencion: atencion(c, historia.map((d) => d.cuota)),
      tono: t,
      riesgo: riesgo(articulos),
      momento: { valor: momento(t.valor, previo && previo.momento ? previo.momento.valor : null) },
      articulos: articulos || [],
    };
  }

  // Diferencia con el día anterior, para mostrar cuánto se movió cada índice.
  function cambios(dia, anterior) {
    const r = {};
    for (const { clave } of DEFINICIONES) {
      const hoy = dia && dia[clave] ? dia[clave].valor : null;
      const ayer = anterior && anterior[clave] ? anterior[clave].valor : null;
      r[clave] = { valor: hoy, cambio: hoy !== null && ayer !== null ? redondear(hoy - ayer) : null };
    }
    return r;
  }

  // Los artículos que movieron cada índice ese día.
  function movieron(dia) {
    const a = (dia && dia.articulos) || [];
    const rel = a.filter((x) => x.relevante);
    const conTono = rel.filter((x) => x.tono === "positivo" || x.tono === "negativo");
    return {
      atencion: a.slice(0, 5),
      tono: conTono,
      riesgo: rel.filter((x) => x.riesgo),
      momento: conTono,
    };
  }

  return { DEFINICIONES, BASE_DIAS, BASE_MINIMA, RELEVANTES_MINIMOS, ALFA, cuota, atencion, tono, riesgo, momento, calcularDia, cambios, movieron, redondear };
})();

if (typeof module !== "undefined") module.exports = Indices;
