// Precios diarios de Twelve Data (https://twelvedata.com/docs), solo para evaluar.
// Los precios quedan en memoria durante la corrida: no se guardan ni se publican.
// Lo único que sale es el rendimiento de cada propuesta, redondeado a 0,1 %, que es un
// dato derivado del que no se pueden reconstruir los precios (términos de Twelve Data,
// cláusula 2.2(c): https://twelvedata.com/terms).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Calendario = require("../src/calendario.js");

const ESPERA_MS = 8000; // el plan gratis permite 8 créditos por minuto; cada serie cuesta 1

export async function serieDiaria(ticker, mic, { clave, buscar = fetch, ruedas = 30 }) {
  const u = new URL("https://api.twelvedata.com/time_series");
  u.search = new URLSearchParams({ symbol: ticker, interval: "1day", outputsize: String(ruedas), apikey: clave, ...(mic ? { mic_code: mic } : {}) }).toString();
  const res = await buscar(u);
  const j = await res.json().catch(() => ({}));
  if (j.status !== "ok" || !Array.isArray(j.values)) throw new Error(`Twelve Data ${ticker}: ${j.message || j.code || res.status}`);
  return j.values
    .map((v) => ({ fecha: String(v.datetime).slice(0, 10), apertura: Number(v.open), cierre: Number(v.close) }))
    .filter((v) => v.apertura > 0 && v.cierre > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// Solo las ruedas terminadas: la de hoy cuenta recién una hora después del cierre.
export const completas = (serie, ahora = new Date()) => serie.filter((v) => Date.parse(Calendario.cierre(v.fecha)) + 3600e3 <= ahora.getTime());

// Entrada: apertura de la rueda de la propuesta. Salida: cierre de la rueda número
// `horizonte` (contando la de entrada). null si todavía no cerró.
export function evaluar(p, serie, horizonte) {
  const i = serie.findIndex((v) => v.fecha >= p.fecha);
  if (i < 0 || !serie[i + horizonte - 1]) return null;
  const entrada = serie[i];
  const salida = serie[i + horizonte - 1];
  const r = salida.cierre / entrada.apertura - 1;
  return {
    entrada: entrada.fecha,
    salida: salida.fecha,
    rendimientoActivo: Math.round(r * 1000) / 1000,
    acierto: p.direccion === "compra" ? r > 0 : r < 0,
    aviso: entrada.fecha !== p.fecha ? `No hubo precio para el ${p.fecha}: se tomó la rueda del ${entrada.fecha}` : null,
  };
}

// Series de varios activos respetando el límite por minuto.
export async function series(activos, opciones) {
  const r = {};
  const errores = [];
  for (const [i, a] of activos.entries()) {
    if (i > 0) await new Promise((ok) => setTimeout(ok, opciones.espera ?? ESPERA_MS));
    try {
      r[a.ticker] = await serieDiaria(a.ticker, a.mic, opciones);
    } catch (e) {
      errores.push(e.message);
    }
  }
  return { series: r, errores };
}
