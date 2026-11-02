// Bitácora de paper trading con tesis sociohistórica y validación humana.
//
// Cada propuesta (de una IA o de quien sea) trae un activo, una dirección,
// un precio de entrada, una tesis narrativa o histórica, un episodio análogo,
// una confianza y sus riesgos. Una persona la aprueba o la rechaza. Cuando se
// cierra (con un precio simulado), la bitácora mide:
//   - el rendimiento de lo aprobado contra el de "aprobar todo" (¿el humano
//     agrega valor o es un sello de goma?),
//   - cuántas decisiones humanas acertaron,
//   - si la confianza declarada está calibrada (puntaje de Brier).
// Plata simulada siempre. No consulta mercados ni recomienda nada.
const Bitacora = (() => {
  const esFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

  function validar(p) {
    const e = [];
    if (!p.activo || !p.activo.trim()) e.push("Falta el activo");
    if (!["compra", "venta"].includes(p.direccion)) e.push("La dirección tiene que ser compra o venta");
    if (!(p.precioEntrada > 0)) e.push("El precio de entrada tiene que ser mayor que 0");
    if (!(p.confianza >= 0 && p.confianza <= 100)) e.push("La confianza va de 0 a 100");
    if (!esFecha(p.fechaTesis || "")) e.push("La fecha de la tesis no es válida");
    if (p.cierre) {
      if (!(p.cierre.precio > 0)) e.push("El precio de cierre tiene que ser mayor que 0");
      if (!esFecha(p.cierre.fecha || "")) e.push("La fecha de cierre no es válida");
    }
    return e;
  }

  // Avisos de "sesgo de anticipación": fechas que muestran que la tesis no
  // pudo haberse escrito sin saber el resultado.
  function anticipacion(p, hoy) {
    const avisos = [];
    if (hoy && p.fechaTesis > hoy) avisos.push("La tesis tiene fecha futura");
    if (p.cierre && p.cierre.fecha < p.fechaTesis) avisos.push("El cierre es anterior a la tesis: se escribió sabiendo el resultado");
    return avisos;
  }

  function rendimiento(p) {
    if (!p.cierre) return null;
    const r = p.cierre.precio / p.precioEntrada - 1;
    return p.direccion === "compra" ? r : -r;
  }

  const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  // Solo cuentan las propuestas decididas, cerradas y sin avisos de anticipación.
  function resumen(lista, hoy) {
    const validas = lista.filter((p) => p.decision && p.cierre && anticipacion(p, hoy).length === 0);
    const excluidas = lista.filter((p) => p.decision && p.cierre && anticipacion(p, hoy).length > 0).length;
    const rend = (p) => rendimiento(p);
    const aprobadas = validas.filter((p) => p.decision === "aprobada");
    const rechazadas = validas.filter((p) => p.decision === "rechazada");
    const promAprobadas = media(aprobadas.map(rend));
    const promTodas = media(validas.map(rend));
    const aciertosHumanos = validas.filter((p) => (p.decision === "aprobada") === (rend(p) > 0)).length;
    const brier = media(validas.map((p) => (p.confianza / 100 - (rend(p) > 0 ? 1 : 0)) ** 2));
    return {
      total: lista.length,
      pendientes: lista.filter((p) => !p.decision).length,
      abiertas: lista.filter((p) => p.decision === "aprobada" && !p.cierre).length,
      evaluadas: validas.length,
      excluidas,
      aprobadas: aprobadas.length,
      rechazadas: rechazadas.length,
      promAprobadas,
      promRechazadas: media(rechazadas.map(rend)),
      promTodas,
      valorHumano: promAprobadas === null || promTodas === null ? null : promAprobadas - promTodas,
      aciertosHumanos: validas.length ? aciertosHumanos / validas.length : null,
      brier,
    };
  }

  // Calibración: para cada tramo de confianza, cuánto acertaron de verdad.
  function calibracion(lista, hoy, tramos = [[0, 50], [50, 65], [65, 80], [80, 101]]) {
    const validas = lista.filter((p) => p.cierre && anticipacion(p, hoy).length === 0);
    return tramos.map(([a, b]) => {
      const xs = validas.filter((p) => p.confianza >= a && p.confianza < b);
      return {
        desde: a, hasta: Math.min(b, 100), n: xs.length,
        confianzaMedia: media(xs.map((p) => p.confianza / 100)),
        tasaAcierto: media(xs.map((p) => (rendimiento(p) > 0 ? 1 : 0))),
      };
    });
  }

  function validarLista(x) {
    if (!Array.isArray(x)) return "El archivo no tiene una lista de propuestas";
    for (const p of x) { const e = validar(p); if (e.length) return `${p.activo || "Propuesta"}: ${e[0]}`; }
    return null;
  }

  // Ocho propuestas inventadas, con activos ficticios, para ver cómo funciona.
  function ejemplo() {
    const p = (id, activo, direccion, fechaTesis, precioEntrada, confianza, decision, cierre, tesis, analogo) =>
      ({ id, activo, direccion, fechaTesis, precioEntrada, confianza, decision, cierre, tesis, analogo, riesgos: "Ejemplo ficticio." });
    return [
      p("e1", "ACME", "compra", "2026-03-02", 100, 70, "aprobada", { fecha: "2026-06-01", precio: 112 }, "La narrativa de la transición energética recién empieza a llegar al público masivo.", "Ferrocarriles, década de 1840: la adopción tardó más que la euforia."),
      p("e2", "BETA", "venta", "2026-03-05", 50, 60, "aprobada", { fecha: "2026-06-01", precio: 45 }, "Todo el mundo habla de BETA en redes: señal de narrativa saturada.", "Tulipanes, 1637."),
      p("e3", "GAMA", "compra", "2026-03-10", 20, 80, "aprobada", { fecha: "2026-06-01", precio: 18 }, "Su historia de marca resiste crisis, como en recesiones pasadas.", "Bienes de consumo masivo en 2008."),
      p("e4", "DELTA", "compra", "2026-03-12", 200, 40, "rechazada", { fecha: "2026-06-01", precio: 190 }, "Un regreso de la nostalgia de los 90 podría impulsar la marca.", "Revival de vinilos, 2010."),
      p("e5", "EPSI", "compra", "2026-03-15", 10, 55, "rechazada", { fecha: "2026-06-01", precio: 12 }, "Su mercado local vive una ola migratoria parecida a la de principios del siglo XX.", "Inmigración europea en Argentina, 1880–1914."),
      p("e6", "ZETA", "venta", "2026-06-10", 80, 65, "aprobada", { fecha: "2026-06-01", precio: 84 }, "Tesis fechada después del cierre: la bitácora la marca y la excluye.", "—"),
      p("e7", "ETA", "compra", "2026-03-20", 30, 75, "aprobada", { fecha: "2026-06-01", precio: 33 }, "El sector repite el patrón de la electrificación de los hogares.", "Electrodomésticos, década de 1920."),
      p("e8", "TETA", "compra", "2026-05-02", 60, 50, null, null, "Pendiente de decisión.", "—"),
    ];
  }

  return { validar, anticipacion, rendimiento, resumen, calibracion, validarLista, ejemplo };
})();

if (typeof module !== "undefined") module.exports = Bitacora;
