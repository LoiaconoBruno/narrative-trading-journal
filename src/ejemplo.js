// Datos inventados para ver la página antes de que corra el pipeline (?ejemplo).
// Cinco activos ficticios, 41 ruedas, índices calculados con las fórmulas reales y
// resultados simulados con una IA "bien calibrada": acierta con la probabilidad que dice,
// menos 3 puntos. Nada de esto es una medición: la página lo avisa arriba de todo.
const Ejemplo = (() => {
  const Cal = typeof Calendario !== "undefined" ? Calendario : require("./calendario.js");
  const Ind = typeof Indices !== "undefined" ? Indices : require("./indices.js");

  const HOY = "2026-10-15";
  const ACTIVOS = [
    { ticker: "ACME", nombre: "Acme Industrial", sector: "Industria" },
    { ticker: "BETA", nombre: "Beta Financiera", sector: "Bancos" },
    { ticker: "GAMA", nombre: "Gama Energía", sector: "Petróleo y gas" },
    { ticker: "DLTA", nombre: "Delta Software", sector: "Software" },
    { ticker: "EPSI", nombre: "Épsilon Consumo", sector: "Consumo masivo" },
  ];
  const TITULOS = {
    positivo: ["{n} supera las estimaciones del trimestre", "Analistas suben el precio objetivo de {n}", "{n} anuncia una inversión para ampliar su capacidad", "{n} cierra un contrato grande con el Estado"],
    negativo: ["{n} recorta su pronóstico de ventas", "Caen los envíos de {n} por la demanda débil", "{n} pierde a su principal cliente"],
    riesgo: ["{n} enfrenta una demanda colectiva", "El regulador investiga a {n}", "Paro en las plantas de {n}"],
    neutro: ["{n} presenta su nuevo directorio", "{n} participa de una feria del sector"],
  };

  // Generador pseudoaleatorio con semilla (mulberry32): el ejemplo sale siempre igual.
  function azar(semilla) {
    let a = semilla >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const elegir = (xs, r) => xs[Math.floor(r() * xs.length)];
  const signo = (x) => (Math.round(x) > 0 ? "+" : Math.round(x) < 0 ? "−" : "") + Math.abs(Math.round(x));
  const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

  function ruedasHasta(fecha, n) {
    const r = [];
    let f = fecha;
    while (r.length < n) {
      f = Cal.sumarDias(f, -1);
      if (Cal.esRueda(f)) r.unshift(f);
    }
    return r;
  }

  function datos() {
    const r = azar(20261023);
    const ruedas = ruedasHasta(HOY, 40).concat(HOY);
    const indices = {};
    for (const a of ACTIVOS) {
      const dias = [];
      let nivel = (r() - 0.5) * 60;
      for (const f of ruedas) {
        nivel = Math.max(-80, Math.min(80, nivel * 0.8 + (r() - 0.5) * 55));
        const articulos = Array.from({ length: 3 + Math.floor(r() * 5) }, (_, i) => {
          const tono = r() < 0.45 + nivel / 250 ? "positivo" : r() < 0.6 ? "negativo" : "neutro";
          const riesgo = tono === "negativo" && r() < 0.45;
          const titulo = elegir(TITULOS[riesgo ? "riesgo" : tono], r).replace("{n}", a.nombre);
          return { id: `${a.ticker}-${i}`, titulo, url: null, medio: `Medio de ejemplo ${"ABC"[i % 3]}`, idioma: "spa", relevante: true, tono, riesgo };
        });
        const conteo = 15 + Math.floor(r() * 30 + Math.abs(nivel) / 2);
        dias.push(Ind.calcularDia({ fecha: f, conteo, total: 380000, articulos }, dias));
      }
      indices[a.ticker] = { ticker: a.ticker, nombre: a.nombre, dias };
    }

    const dias = [];
    const resultados = [];
    const decisiones = {};
    ruedas.forEach((f, k) => {
      const aperturaEn = Cal.apertura(f);
      const generadaEn = iso(Date.parse(aperturaEn) - 80 * 60e3);
      const salida = Cal.rueda(f, 4);
      const propuestas = ACTIVOS.map((a) => {
        const d = indices[a.ticker].dias[k];
        const m = d.momento.valor ?? 0;
        const direccion = m >= 0 ? "compra" : "venta";
        const confianza = Math.min(88, 50 + Math.round(Math.abs(m) / 2.5 + r() * 12));
        const movidas = d.articulos.filter((x) => x.tono !== "neutro").slice(0, 2);
        return {
          id: `${f}-${a.ticker}`,
          activo: a.ticker,
          nombre: a.nombre,
          direccion,
          confianza,
          tesis: `Ejemplo inventado: el momento narrativo de ${a.nombre} está en ${signo(m)} y el tono del día en ${signo(d.tono.valor ?? 0)}. Con datos reales, acá va la tesis que escribe Claude a partir de las noticias del día.`,
          analogo: { episodio: "Episodio de ejemplo", periodo: "—", parecido: "Con datos reales, acá va un episodio histórico parecido con su artículo de Wikipedia.", url: "", verificado: false },
          riesgos: ["Ejemplo: un dato macro que cambie el humor del mercado.", "Ejemplo: una noticia de la empresa que no estaba en el radar."],
          noticias: movidas.map((x) => ({ id: x.id, titulo: x.titulo, url: null, medio: x.medio })),
          indices: { fecha: f, atencion: d.atencion.valor, tono: d.tono.valor, riesgo: d.riesgo.valor, momento: d.momento.valor },
        };
      });
      dias.push({ version: 1, fecha: f, generadaEn, aperturaEn, salidaEn: Cal.cierre(salida), horizonte: 5, modelo: "ejemplo", anterior: null, propuestas });
      if (salida >= HOY) return;
      for (const p of propuestas) {
        const acierto = r() < p.confianza / 100 - 0.03;
        const magnitud = 0.003 + r() * 0.05;
        const sentido = (p.direccion === "compra") === acierto ? 1 : -1;
        resultados.push({ id: p.id, activo: p.activo, entrada: f, salida, rendimientoActivo: Math.round(sentido * magnitud * 1000) / 1000, acierto, selladaEn: iso(Date.parse(generadaEn) + 6 * 60e3), cuenta: true, motivo: null });
        if (r() < 0.7) {
          const aprueba = r() < (acierto ? 0.62 : 0.45);
          const tarde = r() < 0.06;
          decisiones[p.id] = { decision: aprueba ? "aprobada" : "rechazada", en: iso(Date.parse(aperturaEn) + (tarde ? 40 : -35) * 60e3) };
        }
      }
    });

    return {
      ejemplo: true,
      ahora: new Date(Date.parse(Cal.apertura(HOY)) - 50 * 60e3),
      watchlist: { mercado: "Activos inventados", horizonte: 5, activos: ACTIVOS },
      estado: { propuestas: ruedas, ultimaCorrida: { fecha: HOY, nota: "Ejemplo", avisos: [] } },
      dias,
      resultados,
      decisiones,
      indices,
      costos: { corridas: [] },
      sellos: null,
    };
  }

  return { HOY, ACTIVOS, datos };
})();

if (typeof module !== "undefined") module.exports = Ejemplo;
