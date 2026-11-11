// Pipeline sin red ni keys: GDELT, Twelve Data, Wikipedia y Claude están simulados.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { deflateRawSync } from "node:zlib";
import { createRequire } from "node:module";
import { extraerUnico } from "../pipeline/zip.js";
import * as G from "../pipeline/gdelt.js";
import * as CL from "../pipeline/claude.js";
import * as P from "../pipeline/precios.js";
import { correr } from "../pipeline/correr.js";

const require = createRequire(import.meta.url);
const Sellos = require("../src/sellos.js");

function zip(nombre, contenido) {
  const datos = deflateRawSync(Buffer.from(contenido));
  const n = Buffer.from(nombre);
  const largo = Buffer.byteLength(contenido);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(datos.length, 18); local.writeUInt32LE(largo, 22); local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(datos.length, 20); central.writeUInt32LE(largo, 24); central.writeUInt16LE(n.length, 28);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(1, 8); fin.writeUInt16LE(1, 10); fin.writeUInt32LE(46 + n.length, 12); fin.writeUInt32LE(30 + n.length + datos.length, 16);
  return Buffer.concat([local, n, datos, central, n, fin]);
}

function linea({ fecha = "20261112110000", medio = "diario.example", url, orgs, titulo, idioma }) {
  const c = Array(27).fill("");
  c[0] = "id"; c[1] = fecha; c[2] = "1"; c[3] = medio; c[4] = url;
  c[13] = orgs.map((o) => o.toLowerCase()).join(";");
  c[14] = orgs.map((o, i) => `${o},${i * 10}`).join(";");
  c[15] = "-1.25,2,3.25,5,20,0,500";
  c[25] = idioma ? `srclc:${idioma};eng:GT-1.0` : "";
  c[26] = `<PAGE_ALTURL_AMP>x</PAGE_ALTURL_AMP><PAGE_TITLE>${titulo}</PAGE_TITLE>`;
  return c.join("\t");
}

const respuesta = (estado, cuerpo) => ({
  ok: estado >= 200 && estado < 300,
  status: estado,
  text: async () => (typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo)),
  json: async () => (typeof cuerpo === "string" ? JSON.parse(cuerpo) : cuerpo),
  arrayBuffer: async () => (Buffer.isBuffer(cuerpo) ? cuerpo.buffer.slice(cuerpo.byteOffset, cuerpo.byteOffset + cuerpo.length) : new ArrayBuffer(0)),
});

test("zip: extrae el único archivo, comprimido con deflate", () => {
  const texto = "hola\tmundo\n".repeat(1000);
  assert.equal(extraerUnico(zip("a.csv", texto)).toString(), texto);
  assert.throws(() => extraerUnico(Buffer.from("no es un zip")), /No es un zip/);
});

test("GDELT: ventana de 96 archivos, coincidencias y títulos", () => {
  const m = G.marcasDeVentana(new Date("2026-11-12T11:07:00Z"));
  assert.equal(m.length, 96);
  assert.equal(m[95], "20261112110000");
  assert.equal(m[0], "20261111111500");
  assert.ok(G.coincide("nvidia corp", ["nvidia"]));
  assert.ok(!G.coincide("applebee", ["apple"]));
  assert.equal(G.decodificar("Caf&eacute; &amp; t&#233; &#x2014; ok"), "Caf&eacute; & té — ok");
  const r = G.parsearLinea(linea({ url: "https://a.example/1", orgs: ["Nvidia Corp", "Otra"], titulo: "Nvidia &amp; algo", idioma: "spa" }));
  assert.deepEqual(r.orgs, ["nvidia corp", "otra"]);
  assert.equal(r.titulo, "Nvidia & algo");
  assert.equal(r.idioma, "spa");
  assert.equal(r.tonoGdelt, -1.25);
  assert.equal(r.fecha, "2026-11-12T11:00:00Z");
});

test("GDELT: cuenta todo, deduplica URLs y elige primero los que nombran a la empresa en el título", () => {
  const activos = [{ ticker: "NVDA", nombre: "Nvidia", alias: ["nvidia"] }];
  const estado = { total: 0, activos: { NVDA: { conteo: 0, urls: new Set(), candidatos: [] } } };
  const texto = [
    linea({ url: "https://a.example/1", orgs: ["nvidia"], titulo: "Mercados en baja" }),
    linea({ url: "https://a.example/2", orgs: ["nvidia corp"], titulo: "Nvidia presenta resultados" }),
    linea({ url: "https://a.example/2", orgs: ["nvidia"], titulo: "Repetida" }),
    linea({ url: "https://a.example/3", orgs: ["nvidia"], titulo: "Nvidia presenta resultados!" }),
    linea({ url: "https://a.example/4", orgs: ["otra"], titulo: "Otra cosa" }),
  ].join("\n");
  G.acumular(estado, texto, activos);
  assert.equal(estado.total, 5);
  assert.equal(estado.activos.NVDA.conteo, 3);
  const sel = G.seleccionar(estado.activos.NVDA.candidatos, 10);
  assert.deepEqual(sel.map((a) => a.url), ["https://a.example/2", "https://a.example/1"], "el título casi igual se descarta");
});

test("Claude: pedidos con salida JSON, esfuerzo y respaldo del servidor", () => {
  const lotes = [{ activo: { ticker: "NVDA", nombre: "Nvidia", sector: "Chips" }, articulos: [{ titulo: "t", medio: "m", idioma: "eng" }] }, { activo: { ticker: "KO", nombre: "Coca-Cola" }, articulos: [] }];
  const p = CL.pedidoClasificacion(lotes, { modelo: "claude-opus-5-5" });
  assert.equal(p.output_config.effort, "low");
  assert.equal(p.output_config.format.type, "json_schema");
  assert.equal(p.fallbacks, "default");
  assert.deepEqual(p.betas, ["server-side-fallback-2026-07-01"]);
  assert.ok(!("temperature" in p) && !("thinking" in p));
  const datos = JSON.parse(p.messages[0].content.replace(/^[^{]+/, ""));
  assert.deepEqual(datos.empresas.map((e) => e.ticker), ["NVDA"], "sin artículos no se manda");
  assert.equal(CL.pedidoClasificacion(lotes, { modelo: "claude-haiku-5-5" }).fallbacks, undefined);
});

test("Claude: se descartan clasificaciones y propuestas que no cumplen", () => {
  const msj = (obj) => ({ stop_reason: "end_turn", model: "claude-opus-5-5", usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: "thinking", thinking: "" }, { type: "text", text: JSON.stringify(obj) }] });
  const c = CL.interpretarClasificacion(msj({ clasificaciones: [
    { id: "A-0", relevante: true, tono: "positivo", riesgo: true },
    { id: "A-1", relevante: false, tono: "negativo", riesgo: true },
    { id: "ZZ", relevante: true, tono: "positivo", riesgo: false },
    { id: "A-2", relevante: true, tono: "raro", riesgo: false },
  ] }), ["A-0", "A-1", "A-2"]);
  assert.deepEqual([...c.keys()], ["A-0", "A-1"]);
  assert.deepEqual(c.get("A-1"), { relevante: false, tono: "neutro", riesgo: false });
  const base = { direccion: "compra", tesis: "Una tesis con sustento.", analogo: { episodio: "Un episodio real", periodo: "2010", parecido: "x", url: "https://es.wikipedia.org/wiki/X" }, riesgos: ["uno", "dos"], noticias: ["A-0", "falsa"] };
  const r = CL.interpretarPropuestas(msj({ propuestas: [
    { ...base, activo: "AAA", confianza: 64 },
    { ...base, activo: "AAA", confianza: 70 },
    { ...base, activo: "BBB", confianza: 40 },
    { ...base, activo: "CCC", confianza: 66, analogo: { ...base.analogo, url: "javascript:alert(1)" } },
  ] }), { tickers: ["AAA", "BBB", "CCC", "DDD"], idsNoticias: ["A-0"] });
  assert.deepEqual(r.propuestas.map((p) => p.activo), ["AAA", "CCC"]);
  assert.deepEqual(r.propuestas[0].noticias, ["A-0"]);
  assert.equal(r.propuestas[1].analogo.url, "");
  assert.deepEqual(r.descartes.map((d) => d.activo).sort(), ["AAA", "BBB", "DDD"]);
  assert.throws(() => CL.interpretarPropuestas({ stop_reason: "refusal", content: [] }, { tickers: [] }), /no quiso/);
  assert.deepEqual(CL.uso(msj({})), { modelo: "claude-opus-5-5", entrada: 10, salida: 5, cacheEscritura: 0, cacheLectura: 0 });
});

test("precios: rendimiento de la apertura de la rueda al cierre de la quinta", () => {
  const serie = ["2026-11-12", "2026-11-13", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"].map((fecha, i) => ({ fecha, apertura: 100 + i, cierre: 101 + i }));
  const e = P.evaluar({ fecha: "2026-11-12", direccion: "compra" }, serie, 5);
  assert.deepEqual(e, { entrada: "2026-11-12", salida: "2026-11-18", rendimientoActivo: 0.05, acierto: true, aviso: null });
  assert.equal(P.evaluar({ fecha: "2026-11-12", direccion: "venta" }, serie, 5).acierto, false);
  assert.equal(P.evaluar({ fecha: "2026-11-16", direccion: "compra" }, serie, 5), null, "todavía no cerró");
  assert.equal(P.completas(serie, new Date("2026-11-19T21:30:00Z")).length, 5, "la rueda de hoy cuenta una hora después del cierre");
});

// ---- Corrida completa ------------------------------------------------------------

function entorno() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "ntj-"));
  fs.mkdirSync(path.join(raiz, "data"));
  fs.writeFileSync(path.join(raiz, "data", "watchlist.json"), JSON.stringify({ horizonte: 5, activos: [
    { ticker: "AAA", mic: "XNAS", nombre: "Acme", sector: "Industria", alias: ["acme"] },
    { ticker: "BBB", mic: "XNYS", nombre: "Beta", sector: "Bancos", alias: ["beta corp"] },
  ] }));
  fs.writeFileSync(path.join(raiz, "data", "config.json"), JSON.stringify({ modelo: "claude-opus-5-5", esfuerzo: { clasificar: "low", proponer: "medium" }, articulosPorActivo: 20 }));
  const gkg = zip("x.csv", [
    linea({ url: "https://n.example/1", orgs: ["Acme"], titulo: "Acme gana un contrato grande" }),
    linea({ url: "https://n.example/2", orgs: ["Acme"], titulo: "Acme enfrenta una demanda" }),
    linea({ url: "https://n.example/3", orgs: ["Acme"], titulo: "Acme abre una planta" }),
    linea({ url: "https://n.example/4", orgs: ["Beta Corp"], titulo: "Beta Corp sube su dividendo", idioma: "spa" }),
    linea({ url: "https://n.example/5", orgs: ["Otra"], titulo: "Nada que ver" }),
  ].join("\n"));
  const llamadas = [];
  const buscar = async (u, op = {}) => {
    const url = String(u);
    llamadas.push({ url, metodo: op.method || "GET" });
    if (url.endsWith("lastupdate.txt")) return respuesta(200, "1 a http://data.gdeltproject.org/gdeltv2/20261112113000.gkg.csv.zip\n");
    if (url.endsWith("lastupdate-translation.txt")) return respuesta(200, "1 a http://data.gdeltproject.org/gdeltv2/20261112113000.translation.gkg.csv.zip\n");
    if (url.includes("data.gdeltproject.org")) return url.includes("20261112113000.gkg") ? respuesta(200, gkg) : respuesta(404, "");
    if (url.startsWith("https://es.wikipedia.org/")) return respuesta(200, "");
    if (url.includes("api.twelvedata.com")) {
      const fechas = ["2026-11-12", "2026-11-13", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"];
      const sube = new URL(url).searchParams.get("symbol") === "AAA";
      return respuesta(200, { status: "ok", values: fechas.map((d, i) => ({ datetime: d, open: String(100 + (sube ? i : -i)), close: String(100 + (sube ? i + 1 : -i - 1)) })).reverse() });
    }
    return respuesta(404, "");
  };
  const llamar = async (pedido) => {
    const datos = JSON.parse(pedido.messages[0].content.replace(/^[^{]+/, ""));
    const usage = { input_tokens: 1000, output_tokens: 500 };
    if (pedido.output_config.format.schema.properties.clasificaciones) {
      const clasificaciones = datos.empresas.flatMap((e) => e.articulos.map((a) => ({ id: a.id, relevante: true, tono: /demanda/.test(a.titulo) ? "negativo" : "positivo", riesgo: /demanda/.test(a.titulo) })));
      return { stop_reason: "end_turn", model: "claude-opus-5-5", usage, content: [{ type: "text", text: JSON.stringify({ clasificaciones }) }] };
    }
    const propuestas = datos.activos.map((a, i) => ({ activo: a.ticker, direccion: "compra", confianza: 60 + i * 10, tesis: `Tesis para ${a.ticker}.`, analogo: { episodio: "Episodio", periodo: "1990", parecido: "Se parece", url: i ? "https://otro.example/no" : "https://es.wikipedia.org/wiki/Episodio" }, riesgos: ["Riesgo uno", "Riesgo dos"], noticias: a.articulos.slice(0, 1).map((x) => x.id) }));
    return { stop_reason: "end_turn", model: "claude-opus-5-5", usage, content: [{ type: "text", text: JSON.stringify({ propuestas }) }] };
  };
  return { raiz, buscar, llamar, llamadas, leer: (f) => JSON.parse(fs.readFileSync(path.join(raiz, "data", f), "utf8")), texto: (f) => fs.readFileSync(path.join(raiz, "data", f), "utf8") };
}

const silencio = () => {};

test("corrida: sella propuestas antes de la apertura, encadena hashes y no reescribe", async () => {
  const e = entorno();
  const env = { ANTHROPIC_API_KEY: "prueba" };
  const base = { raiz: e.raiz, env, buscar: e.buscar, llamar: e.llamar, horas: 1, espera: 0, registrar: silencio };
  await correr({ ...base, fecha: "2026-11-12", ahora: new Date("2026-11-12T12:05:00Z") });
  const d1 = e.leer("propuestas/2026-11-12.json");
  assert.equal(d1.anterior, null);
  assert.equal(d1.aperturaEn, "2026-11-12T14:30:00Z");
  assert.equal(d1.salidaEn, "2026-11-18T21:00:00Z");
  assert.deepEqual(d1.propuestas.map((p) => [p.id, p.confianza]), [["2026-11-12-AAA", 60], ["2026-11-12-BBB", 70]]);
  assert.equal(d1.propuestas[0].analogo.verificado, true);
  assert.equal(d1.propuestas[1].analogo.verificado, false);
  assert.equal(d1.propuestas[0].noticias[0].url, "https://n.example/1");
  const ind = e.leer("indices/AAA.json").dias[0];
  assert.equal(ind.conteo, 3);
  assert.equal(ind.tono.valor, 33.3);
  assert.equal(ind.riesgo.valor, 33.3);
  assert.equal(ind.atencion.valor, null, "falta historia");
  assert.equal(e.leer("indices/BBB.json").dias[0].tono.valor, null, "un solo artículo: no alcanza");
  const costos = e.leer("costos.json").corridas[0];
  assert.equal(costos.usos.length, 2);
  assert.equal(costos.dolares, 2 * (1000 * 4 + 500 * 20) / 1e6);
  assert.deepEqual(e.leer("estado.json").propuestas, ["2026-11-12"]);

  const antes = e.texto("propuestas/2026-11-12.json");
  await correr({ ...base, fecha: "2026-11-12", ahora: new Date("2026-11-12T12:30:00Z") });
  assert.equal(e.texto("propuestas/2026-11-12.json"), antes, "un día sellado no se toca");
  assert.match(e.leer("estado.json").ultimaCorrida.nota, /no se tocan/);

  await correr({ ...base, fecha: "2026-11-13", ahora: new Date("2026-11-13T12:05:00Z") });
  assert.equal(e.leer("propuestas/2026-11-13.json").anterior, await Sellos.sha256(antes));

  await correr({ ...base, fecha: "2026-11-16", ahora: new Date("2026-11-16T14:45:00Z") });
  assert.equal(fs.existsSync(path.join(e.raiz, "data", "propuestas", "2026-11-16.json")), false);
  assert.match(e.leer("estado.json").ultimaCorrida.nota, /ya abrió/);
});

test("corrida: evalúa con precios en memoria y solo publica rendimientos; el sello tardío no cuenta", async () => {
  const e = entorno();
  const base = { raiz: e.raiz, buscar: e.buscar, llamar: e.llamar, horas: 1, espera: 0, registrar: silencio };
  await correr({ ...base, env: { ANTHROPIC_API_KEY: "x" }, fecha: "2026-11-12", ahora: new Date("2026-11-12T12:05:00Z") });
  await correr({ ...base, env: { ANTHROPIC_API_KEY: "x" }, fecha: "2026-11-13", ahora: new Date("2026-11-13T12:05:00Z") });
  const sellos = { "2026-11-12.json": { selladaEn: "2026-11-12T12:20:00Z", cambios: 0 }, "2026-11-13.json": { selladaEn: "2026-11-13T15:00:00Z", cambios: 0 } };
  await correr({ ...base, env: { ANTHROPIC_API_KEY: "x", TWELVEDATA_API_KEY: "y" }, seco: false, fecha: "2026-11-21", ahora: new Date("2026-11-21T12:05:00Z"), sello: (ruta) => sellos[path.basename(ruta)] || null });
  const r = e.leer("resultados.json").resultados;
  assert.equal(r.length, 4);
  const aaa = r.find((x) => x.id === "2026-11-12-AAA");
  assert.equal(aaa.entrada, "2026-11-12");
  assert.equal(aaa.salida, "2026-11-18");
  assert.equal(aaa.rendimientoActivo, 0.05);
  assert.equal(aaa.acierto, true);
  assert.equal(aaa.cuenta, true);
  assert.equal(r.find((x) => x.id === "2026-11-12-BBB").acierto, false);
  const tarde = r.find((x) => x.id === "2026-11-13-AAA");
  assert.equal(tarde.cuenta, false);
  assert.match(tarde.motivo, /después de la apertura/);
  const publicado = e.texto("resultados.json");
  assert.ok(!/"apertura"|"cierre"|"open"|"close"/.test(publicado), "no se publican precios");
  assert.ok(e.llamadas.filter((l) => l.url.includes("twelvedata")).length === 2, "una serie por activo");
});

test("corrida en seco: noticias e índices, sin Claude ni precios", async () => {
  const e = entorno();
  await correr({ raiz: e.raiz, seco: true, env: {}, buscar: e.buscar, horas: 1, registrar: silencio, fecha: "2026-11-12", ahora: new Date("2026-11-12T12:05:00Z") });
  assert.equal(e.leer("indices/AAA.json").dias[0].conteo, 3);
  assert.equal(fs.existsSync(path.join(e.raiz, "data", "propuestas")), false);
  assert.equal(fs.existsSync(path.join(e.raiz, "data", "costos.json")), false);
  assert.ok(!e.llamadas.some((l) => l.url.includes("twelvedata")));
});
