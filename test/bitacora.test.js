const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("../src/bitacora.js");

const cerca = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const HOY = "2026-11-02";

test("rendimiento de compras y ventas", () => {
  cerca(B.rendimiento({ direccion: "compra", precioEntrada: 100, cierre: { precio: 112 } }), 0.12);
  cerca(B.rendimiento({ direccion: "venta", precioEntrada: 50, cierre: { precio: 45 } }), 0.1);
  assert.equal(B.rendimiento({ direccion: "compra", precioEntrada: 100, cierre: null }), null);
});

test("detecta tesis escritas sabiendo el resultado", () => {
  const p = { fechaTesis: "2026-06-10", cierre: { fecha: "2026-06-01" } };
  assert.equal(B.anticipacion(p, HOY).length, 1);
  assert.equal(B.anticipacion({ fechaTesis: "2027-01-01", cierre: null }, HOY)[0], "La tesis tiene fecha futura");
  assert.deepEqual(B.anticipacion({ fechaTesis: "2026-03-01", cierre: { fecha: "2026-06-01" } }, HOY), []);
});

test("resumen del ejemplo: el humano no agregó valor", () => {
  const r = B.resumen(B.ejemplo(), HOY);
  assert.equal(r.total, 8);
  assert.equal(r.pendientes, 1);
  assert.equal(r.evaluadas, 6);
  assert.equal(r.excluidas, 1, "ZETA tiene la tesis fechada después del cierre");
  assert.equal(r.aprobadas, 4);
  cerca(r.promAprobadas, 0.055);
  cerca(r.promTodas, 0.37 / 6);
  cerca(r.valorHumano, 0.055 - 0.37 / 6);
  assert.ok(r.valorHumano < 0);
  cerca(r.aciertosHumanos, 4 / 6);
  cerca(r.brier, 1.315 / 6);
});

test("calibración por tramos de confianza", () => {
  const c = B.calibracion(B.ejemplo(), HOY);
  const tramo = c.find((t) => t.desde === 65); // ACME 70 ✓, ETA 75 ✓
  assert.equal(tramo.n, 2);
  assert.equal(tramo.tasaAcierto, 1);
  const alto = c.find((t) => t.desde === 80); // GAMA 80 ✗
  assert.equal(alto.tasaAcierto, 0);
});

test("validar marca los datos inválidos", () => {
  const ok = B.ejemplo()[0];
  assert.deepEqual(B.validar(ok), []);
  const e = B.validar({ ...ok, precioEntrada: 0, confianza: 120, fechaTesis: "ayer" });
  assert.equal(e.length, 3);
  assert.equal(B.validarLista([ok, { ...ok, activo: "" }]), "Propuesta: Falta el activo");
  assert.equal(B.validarLista({}), "El archivo no tiene una lista de propuestas");
});

test("sin propuestas cerradas no hay métricas", () => {
  const r = B.resumen([{ ...B.ejemplo()[7] }], HOY);
  assert.equal(r.evaluadas, 0);
  assert.equal(r.valorHumano, null);
  assert.equal(r.brier, null);
});
