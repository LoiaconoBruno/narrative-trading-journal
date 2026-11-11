const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../src/calendario.js");

test("ruedas: fines de semana y feriados de NYSE no cuentan", () => {
  assert.equal(C.esRueda("2026-11-12"), true);
  assert.equal(C.esRueda("2026-11-14"), false, "sábado");
  assert.equal(C.esRueda("2026-11-26"), false, "Acción de Gracias");
  assert.equal(C.esRueda("2026-11-27"), true, "cierre temprano, pero abre");
  assert.equal(C.esRueda("2027-07-05"), false, "Día de la Independencia, observado");
  assert.equal(C.conocido("2028-05-01"), true);
  assert.equal(C.conocido("2029-01-02"), false);
});

test("la quinta rueda saltea el feriado", () => {
  assert.equal(C.rueda("2026-11-23", 4), "2026-11-30");
  assert.equal(C.rueda("2026-11-12", 4), "2026-11-18");
  assert.equal(C.rueda("2026-11-14", 0), "2026-11-16", "si cae sábado, la primera rueda es el lunes");
});

test("apertura a las 9:30 de Nueva York, con y sin horario de verano", () => {
  assert.equal(C.apertura("2026-11-12"), "2026-11-12T14:30:00Z");
  assert.equal(C.apertura("2026-07-15"), "2026-07-15T13:30:00Z");
  assert.equal(C.cierre("2026-11-12"), "2026-11-12T21:00:00Z");
  assert.equal(C.hoyEnNuevaYork(new Date("2026-11-12T03:00:00Z")), "2026-11-11");
});
