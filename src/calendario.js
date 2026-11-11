// Calendario de la Bolsa de Nueva York (NYSE): ruedas, feriados y hora de apertura.
// Feriados tomados de https://www.nyse.com/markets/hours-calendars (consultado el 2026-11-11).
// Para 2029 en adelante hay que agregar la lista nueva; mientras tanto, el pipeline avisa.
const Calendario = (() => {
  const FERIADOS = {
    2026: ["2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25"],
    2027: ["2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24"],
    2028: ["2028-01-17", "2028-02-21", "2028-04-14", "2028-05-29", "2028-06-19", "2028-07-04", "2028-09-04", "2028-11-23", "2028-12-25"],
  };
  const FERIADOS_SET = new Set(Object.values(FERIADOS).flat());
  const ZONA = "America/New_York";

  const aFecha = (d) => d.toISOString().slice(0, 10);
  const deFecha = (s) => new Date(s + "T12:00:00Z");

  function conocido(fecha) {
    return Object.prototype.hasOwnProperty.call(FERIADOS, fecha.slice(0, 4));
  }

  function esRueda(fecha) {
    const dia = deFecha(fecha).getUTCDay();
    return dia !== 0 && dia !== 6 && !FERIADOS_SET.has(fecha);
  }

  function sumarDias(fecha, n) {
    const d = deFecha(fecha);
    d.setUTCDate(d.getUTCDate() + n);
    return aFecha(d);
  }

  // La rueda número n contando desde fecha (n = 0 es la misma fecha si es rueda).
  function rueda(fecha, n) {
    let f = fecha;
    while (!esRueda(f)) f = sumarDias(f, 1);
    for (let i = 0; i < n; i++) {
      f = sumarDias(f, 1);
      while (!esRueda(f)) f = sumarDias(f, 1);
    }
    return f;
  }

  // Desfase de Nueva York respecto de UTC ese día, en horas (−4 en verano, −5 en invierno).
  function desfase(fecha) {
    const partes = new Intl.DateTimeFormat("en-US", { timeZone: ZONA, timeZoneName: "shortOffset" }).formatToParts(deFecha(fecha));
    const m = /GMT([+-]\d+)/.exec(partes.find((p) => p.type === "timeZoneName").value);
    return m ? Number(m[1]) : -5;
  }

  // Apertura (9:30 de Nueva York) y cierre (16:00) en UTC, como texto ISO.
  function hora(fecha, h, min) {
    const d = deFecha(fecha);
    d.setUTCHours(h - desfase(fecha), min, 0, 0);
    return d.toISOString().replace(".000Z", "Z");
  }
  const apertura = (fecha) => hora(fecha, 9, 30);
  const cierre = (fecha) => hora(fecha, 16, 0);

  // La fecha de hoy en Nueva York.
  function hoyEnNuevaYork(ahora = new Date()) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
  }

  return { FERIADOS, conocido, esRueda, sumarDias, rueda, desfase, apertura, cierre, hoyEnNuevaYork };
})();

if (typeof module !== "undefined") module.exports = Calendario;
