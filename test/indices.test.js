const test = require("node:test");
const assert = require("node:assert/strict");
const I = require("../src/indices.js");

const art = (relevante, tono, riesgo = false) => ({ relevante, tono, riesgo });

test("atención: sin 5 días previos no se calcula y dice cuántos faltan", () => {
  const a = I.atencion(10, [8, 9, 10]);
  assert.equal(a.valor, null);
  assert.equal(a.falta, 2);
});

test("atención: 50 + 25·z contra los 20 días anteriores, recortada entre 0 y 100", () => {
  const base = [8, 9, 10, 11, 12]; // media 10, desvío √2,5
  const de = Math.sqrt(2.5);
  assert.equal(I.atencion(10, base).valor, 50);
  assert.equal(I.atencion(10 + de, base).valor, 75);
  assert.equal(I.atencion(10 + 3 * de, base).valor, 100);
  assert.equal(I.atencion(10 - 3 * de, base).valor, 0);
  // Solo cuentan los últimos 20 días.
  const largo = Array(30).fill(100).concat(Array(20).fill(10));
  assert.equal(I.atencion(10, largo).base.media, 10);
  // Desvío cero: z = 0.
  assert.equal(I.atencion(7, [5, 5, 5, 5, 5]).valor, 50);
});

test("tono y riesgo: solo con 3 artículos relevantes o más", () => {
  const xs = [art(true, "positivo"), art(true, "positivo", true), art(true, "negativo"), art(true, "neutro"), art(false, "neutro", true)];
  assert.equal(I.tono(xs).valor, 25); // (2 − 1) / 4
  assert.equal(I.riesgo(xs).valor, 25); // 1 de 4 (el no relevante no cuenta)
  assert.equal(I.tono(xs.slice(0, 2)).valor, null);
  assert.equal(I.tono([art(null, null), art(null, null), art(null, null)]).valor, null, "sin clasificar no hay tono");
});

test("momento: media móvil exponencial del tono, α = 0,3", () => {
  assert.equal(I.momento(40, null), 40);
  assert.equal(I.momento(40, 10), 19);
  assert.equal(I.momento(null, 19), 19, "sin tono se mantiene");
});

test("un día nuevo usa la historia para la atención y el momento", () => {
  const hist = [1, 2, 3, 4, 5].map((k) => ({ cuota: 10, momento: { valor: 20 } }));
  hist[4].cuota = 12;
  const d = I.calcularDia({ fecha: "2026-11-12", conteo: 30, total: 20000, articulos: [art(true, "positivo"), art(true, "positivo"), art(true, "neutro")] }, hist);
  assert.equal(d.cuota, 15);
  assert.ok(d.atencion.valor > 90);
  assert.equal(d.tono.valor, 66.7);
  assert.equal(d.momento.valor, I.redondear(0.3 * 66.7 + 0.7 * 20));
  const c = I.cambios(d, { tono: { valor: 50 }, atencion: { valor: null } });
  assert.equal(c.tono.cambio, 16.7);
  assert.equal(c.atencion.cambio, null);
  assert.equal(I.movieron(d).tono.length, 2);
});

test("cada índice tiene definición, escala y cálculo por escrito", () => {
  for (const d of I.DEFINICIONES) {
    for (const k of ["nombre", "escala", "mide", "calculo", "mueve"]) assert.ok(d[k] && d[k].length > 3, `${d.clave}.${k}`);
  }
  assert.deepEqual(I.DEFINICIONES.map((d) => d.clave), ["atencion", "tono", "riesgo", "momento"]);
});
