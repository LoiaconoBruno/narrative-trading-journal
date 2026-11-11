const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("../src/bitacora.js");
const Sellos = require("../src/sellos.js");
const Costos = require("../src/costos.js");

const cerca = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

// Cuatro propuestas de un día, tres cerradas y una no válida (sellada tarde).
const dia = {
  fecha: "2026-11-12", generadaEn: "2026-11-12T12:10:00Z", aperturaEn: "2026-11-12T14:30:00Z", horizonte: 5, modelo: "claude-opus-5-5",
  propuestas: [
    { id: "2026-11-12-AAA", activo: "AAA", direccion: "compra", confianza: 80 },
    { id: "2026-11-12-BBB", activo: "BBB", direccion: "venta", confianza: 60 },
    { id: "2026-11-12-CCC", activo: "CCC", direccion: "compra", confianza: 70 },
    { id: "2026-11-12-DDD", activo: "DDD", direccion: "compra", confianza: 55 },
  ],
};
const resultados = [
  { id: "2026-11-12-AAA", rendimientoActivo: 0.04, acierto: true, cuenta: true },
  { id: "2026-11-12-BBB", rendimientoActivo: 0.02, acierto: false, cuenta: true },
  { id: "2026-11-12-CCC", rendimientoActivo: 0.01, acierto: true, cuenta: true },
  { id: "2026-11-12-DDD", rendimientoActivo: 0.05, acierto: true, cuenta: false, motivo: "Se selló después de la apertura" },
];
const decisiones = {
  "2026-11-12-AAA": { decision: "aprobada", en: "2026-11-12T13:00:00Z" },
  "2026-11-12-BBB": { decision: "rechazada", en: "2026-11-12T13:05:00Z" },
  "2026-11-12-CCC": { decision: "aprobada", en: "2026-11-12T15:00:00Z" }, // tarde: después de la apertura
};

test("solo cuentan las decisiones tomadas antes de la apertura", () => {
  const l = B.unir([dia], resultados, decisiones);
  assert.deepEqual(l.map((p) => p.decisionCuenta), [true, true, false, false]);
  assert.equal(B.abiertaParaDecidir(l[0], new Date("2026-11-12T14:29:59Z")), true);
  assert.equal(B.abiertaParaDecidir(l[0], new Date("2026-11-12T14:30:00Z")), false);
});

test("resumen del sistema y del humano", () => {
  const r = B.resumen(B.unir([dia], resultados, decisiones));
  assert.equal(r.cerradas, 3);
  assert.equal(r.excluidas, 1);
  assert.equal(r.aciertos, 2);
  cerca(r.brier, ((0.8 - 1) ** 2 + (0.6 - 0) ** 2 + (0.7 - 1) ** 2) / 3);
  cerca(r.rendimientoMedio, (0.04 - 0.02 + 0.01) / 3, 1e-12);
  assert.equal(r.humano.decididas, 2);
  assert.equal(r.humano.tarde, 1);
  cerca(r.humano.valor, 0.04 - (0.04 - 0.02) / 2, 1e-12); // aprobó AAA (+4 %), rechazó BBB (−2 %)
  assert.equal(r.humano.coincidencias, 1, "aprobó la que acertó y rechazó la que falló");
});

test("intervalo de Wilson", () => {
  const w = B.wilson(60, 100);
  cerca(w.inferior, 0.502, 1e-3);
  cerca(w.superior, 0.691, 1e-3);
  assert.equal(B.wilson(0, 0), null);
});

test("calibración por tramos e historial por activo", () => {
  const l = B.unir([dia], resultados, decisiones);
  const c = B.calibracion(l);
  assert.equal(c.find((t) => t.desde === 80).tasaAcierto, 1);
  assert.equal(c.find((t) => t.desde === 60).tasaAcierto, 0);
  assert.equal(c.find((t) => t.desde === 50).n, 0, "DDD no cuenta");
  assert.deepEqual(B.historialActivo(l, "AAA"), { n: 1, aciertos: 1, brier: (0.8 - 1) ** 2 });
});

test("umbral para plata real: cuatro criterios", () => {
  const u = B.umbral(B.resumen(B.unir([dia], resultados, decisiones)));
  assert.equal(u.cumple, false);
  assert.equal(u.criterios.length, 4);
  const listo = B.umbral({ cerradas: 400, sesiones: 70, brier: 0.22, wilson: { inferior: 0.53 } });
  assert.equal(listo.cumple, true);
});

test("ranking por confianza y validación del archivo diario", () => {
  assert.deepEqual(B.ranking(dia.propuestas).map((p) => p.activo), ["AAA", "CCC", "BBB", "DDD"]);
  const bueno = { ...dia, propuestas: [{ id: "2026-11-12-AAA", activo: "AAA", direccion: "compra", confianza: 80, tesis: "x", analogo: { episodio: "y" }, riesgos: ["z"] }] };
  assert.deepEqual(B.validarDia(bueno, ["AAA"]), []);
  const malo = { ...bueno, generadaEn: "2026-11-12T15:00:00Z", propuestas: [{ ...bueno.propuestas[0], confianza: 45, activo: "ZZZ" }] };
  const e = B.validarDia(malo, ["AAA"]);
  assert.ok(e.some((x) => /anterior a la apertura/.test(x)));
  assert.ok(e.some((x) => /watchlist/.test(x)));
  assert.ok(e.some((x) => /50 a 100/.test(x)));
});

test("sellos: la cadena se rompe si se edita un archivo viejo", async () => {
  const a = JSON.stringify({ anterior: null, n: 1 });
  const b = JSON.stringify({ anterior: await Sellos.sha256(a), n: 2 });
  assert.deepEqual(await Sellos.verificarCadena([{ nombre: "a", texto: a }, { nombre: "b", texto: b }]), []);
  const editado = a.replace('"n":1', '"n":9');
  const p = await Sellos.verificarCadena([{ nombre: "a", texto: editado }, { nombre: "b", texto: b }]);
  assert.deepEqual(p.map((x) => x.nombre), ["b"]);
  assert.equal(await Sellos.sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("costos con los precios publicados", () => {
  assert.equal(Costos.costo({ entrada: 1e6, salida: 1e6 }, "claude-opus-5-5"), 24);
  assert.equal(Costos.costo({ entrada: 1e6, salida: 1e6 }, "claude-haiku-5-5"), 0.6);
  assert.equal(Costos.costo({ entrada: 1 }, "otro"), null);
  cerca(Costos.estimar({ entrada: 20000, salida: 10000 }, "claude-sonnet-5-5").porMes, 21 * 0.14, 1e-12);
  assert.deepEqual(Costos.delMes([{ fecha: "2026-11-12", dolares: 0.5 }, { fecha: "2026-12-01", dolares: 1 }], "2026-11"), { corridas: 1, dolares: 0.5 });
});
