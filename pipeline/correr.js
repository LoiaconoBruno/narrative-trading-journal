// Corrida diaria, antes de la apertura de Nueva York:
//   1. evalúa las propuestas cuyo horizonte ya cerró (precios de Twelve Data, solo en memoria);
//   2. baja las noticias de las últimas 24 horas (GDELT);
//   3. Claude clasifica los títulos y con eso se calculan los índices de cada activo;
//   4. Claude genera una propuesta por activo y se sella en data/propuestas/AAAA-MM-DD.json;
//   5. guarda costos y estado. El commit lo hace el workflow.
//
// Uso:  node pipeline/correr.js [--seco] [--salida=DIR] [--horas=24] [--fecha=AAAA-MM-DD] [--sin-traduccion]
//   --seco    no llama a Claude ni a Twelve Data (sirve para probar la parte de noticias gratis)
//   --salida  escribe en otra carpeta en vez de data/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { bajarVentana } from "./gdelt.js";
import { pedidoClasificacion, interpretarClasificacion, pedidoPropuestas, interpretarPropuestas, uso } from "./claude.js";
import { series, completas, evaluar } from "./precios.js";
import { verificarUrl } from "./analogos.js";
import { sello as selloGit } from "./git.js";

const require = createRequire(import.meta.url);
const Calendario = require("../src/calendario.js");
const Indices = require("../src/indices.js");
const Bitacora = require("../src/bitacora.js");
const Sellos = require("../src/sellos.js");
const Costos = require("../src/costos.js");

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HISTORIA_PARA_IA = 10;
const ARTICULOS_PARA_IA = 12;

const leer = (f, defecto) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : defecto);
const json = (x) => JSON.stringify(x, null, 2) + "\n";
const escribir = (f, x) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof x === "string" ? x : json(x)); };
const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

// Evalúa lo pendiente. Devuelve los resultados nuevos.
async function evaluarPendientes({ datos, estado, resultados, ahora, horizonte, activos, clave, buscar, sello, espera, registrar, avisos }) {
  const hechos = new Set(resultados.map((r) => r.id));
  const archivos = estado.propuestas.map((f) => ({ fecha: f, nombre: `${f}.json`, texto: fs.readFileSync(path.join(datos, "propuestas", `${f}.json`), "utf8") }));
  const rotos = new Set((await Sellos.verificarCadena(archivos)).map((p) => p.nombre));
  const pendientes = [];
  for (const a of archivos) {
    const d = JSON.parse(a.texto);
    const h = d.horizonte || horizonte;
    if (Date.parse(Calendario.cierre(Calendario.rueda(d.fecha, h - 1))) + 3600e3 > ahora.getTime()) continue;
    for (const p of d.propuestas) if (!hechos.has(p.id)) pendientes.push({ p: { ...p, fecha: d.fecha }, d, archivo: a });
  }
  if (!pendientes.length) return [];
  if (!clave) {
    avisos.push(`Hay ${pendientes.length} propuestas para evaluar, pero falta TWELVEDATA_API_KEY`);
    return [];
  }
  const tickers = [...new Set(pendientes.map((x) => x.p.activo))];
  const masVieja = pendientes.map((x) => x.d.fecha).sort()[0];
  let ruedas = 10;
  for (let f = masVieja; f < Calendario.hoyEnNuevaYork(ahora); f = Calendario.sumarDias(f, 1)) if (Calendario.esRueda(f)) ruedas++;
  registrar(`Precios: ${tickers.length} activos, ${ruedas} ruedas`);
  const { series: s, errores } = await series(activos.filter((a) => tickers.includes(a.ticker)), { clave, buscar, ruedas: Math.min(ruedas, 5000), espera });
  avisos.push(...errores);
  const nuevos = [];
  for (const { p, d, archivo } of pendientes) {
    if (!s[p.activo]) continue;
    const ev = evaluar(p, completas(s[p.activo], ahora), d.horizonte || horizonte);
    if (!ev) { avisos.push(`${p.id}: todavía no hay precio de cierre del horizonte`); continue; }
    const sl = sello(path.join(datos, "propuestas", archivo.nombre));
    const motivo =
      !sl ? "El archivo no tiene commit: no hay sello" :
      sl.cambios > 0 ? "El archivo cambió después de sellado" :
      rotos.has(archivo.nombre) ? "La cadena de hashes no coincide" :
      Date.parse(sl.selladaEn) >= Date.parse(d.aperturaEn) ? "Se selló después de la apertura" :
      Bitacora.validarDia(d).length ? "El archivo no tiene la forma esperada" :
      null;
    nuevos.push({ id: p.id, activo: p.activo, entrada: ev.entrada, salida: ev.salida, rendimientoActivo: ev.rendimientoActivo, acierto: ev.acierto, selladaEn: sl ? sl.selladaEn : null, cuenta: !motivo, motivo, aviso: ev.aviso });
  }
  return nuevos;
}

export async function correr(op = {}) {
  const {
    raiz = RAIZ,
    datos = path.join(raiz, "data"),
    seco = false,
    horas = 24,
    flujos = ["en", "traduccion"],
    ahora = new Date(),
    env = process.env,
    buscar = fetch,
    llamar = null,
    sello = (ruta) => selloGit(ruta, raiz),
    espera,
    registrar = (m) => console.log(m),
  } = op;
  const reloj = op.reloj || (op.ahora ? () => op.ahora : () => new Date());
  const watch = leer(path.join(raiz, "data", "watchlist.json"));
  const config = leer(path.join(raiz, "data", "config.json"));
  const modelo = env.MODELO || config.modelo;
  const horizonte = watch.horizonte;
  const fecha = op.fecha || Calendario.hoyEnNuevaYork(ahora);
  const estado = leer(path.join(datos, "estado.json"), { propuestas: [] });
  const resultadosArchivo = leer(path.join(datos, "resultados.json"), { nota: "Rendimientos derivados de precios diarios de Twelve Data, redondeados a 0,1 %. No se publican precios.", resultados: [] });
  const costos = leer(path.join(datos, "costos.json"), { corridas: [] });
  const avisos = [];
  const usos = [];
  const conIA = !seco && !!env.ANTHROPIC_API_KEY && typeof llamar === "function";
  if (!seco && !env.ANTHROPIC_API_KEY) avisos.push("Falta ANTHROPIC_API_KEY: no se clasificaron noticias ni se generaron propuestas");
  const corrida = { en: iso(ahora), fecha, seco, modelo: conIA ? modelo : null };

  const terminar = (resumen) => {
    estado.actualizado = iso(reloj());
    estado.ultimaCorrida = { ...corrida, ...resumen, avisos };
    escribir(path.join(datos, "estado.json"), estado);
    escribir(path.join(datos, "resultados.json"), resultadosArchivo);
    if (usos.length) {
      const dolares = usos.reduce((a, u) => a + (u.dolares || 0), 0);
      costos.corridas.push({ fecha, en: corrida.en, usos, dolares: Math.round(dolares * 1e4) / 1e4 });
      escribir(path.join(datos, "costos.json"), costos);
    }
    for (const a of avisos) registrar(`Aviso: ${a}`);
    return { estado, avisos };
  };

  // 1. Resultados de lo que ya cerró.
  if (!seco) {
    const nuevos = await evaluarPendientes({ datos, estado, resultados: resultadosArchivo.resultados, ahora, horizonte, activos: watch.activos, clave: env.TWELVEDATA_API_KEY, buscar, sello, espera, registrar, avisos });
    resultadosArchivo.resultados.push(...nuevos);
    if (nuevos.length) registrar(`Resultados nuevos: ${nuevos.length}`);
  }

  // 2. ¿Hay rueda hoy y todavía no abrió?
  if (!Calendario.conocido(fecha)) avisos.push(`Falta el calendario de feriados de ${fecha.slice(0, 4)} en src/calendario.js`);
  if (!Calendario.esRueda(fecha)) return terminar({ nota: `El ${fecha} no hay rueda en Nueva York` });
  const aperturaEn = Calendario.apertura(fecha);
  if (ahora.getTime() >= Date.parse(aperturaEn)) return terminar({ nota: "El mercado ya abrió: no se generan propuestas para hoy (no valen tesis escritas después de la apertura)" });
  const archivoDia = path.join(datos, "propuestas", `${fecha}.json`);
  if (fs.existsSync(archivoDia)) return terminar({ nota: `Ya hay propuestas selladas para el ${fecha}: no se tocan` });

  // 3. Noticias.
  registrar(`Noticias de GDELT, últimas ${horas} horas`);
  const v = await bajarVentana({ activos: watch.activos, flujos, horas, n: config.articulosPorActivo, buscar, registrar });
  avisos.push(...v.errores);
  if (v.archivos.leidos === 0) { avisos.push("No se pudo leer ningún archivo de GDELT"); return terminar({ nota: "Sin noticias" }); }
  if (v.archivos.faltantes.length) avisos.push(`GDELT: faltaron ${v.archivos.faltantes.length} de ${v.archivos.pedidos} archivos`);

  // 4. Clasificación.
  const lotes = watch.activos.map((a) => ({ activo: a, articulos: v.porActivo[a.ticker].articulos }));
  let clasif = new Map();
  if (conIA) {
    const pedido = pedidoClasificacion(lotes, { modelo, esfuerzo: config.esfuerzo.clasificar });
    const ids = lotes.flatMap((l) => l.articulos.map((_, i) => `${l.activo.ticker}-${i}`));
    if (ids.length) {
      registrar(`Claude: clasificar ${ids.length} títulos`);
      try {
        const m = await llamar(pedido);
        const u = uso(m);
        usos.push({ tarea: "clasificar", ...u, dolares: Costos.costo(u, u.modelo) });
        clasif = interpretarClasificacion(m, ids);
        if (clasif.size < ids.length) avisos.push(`La clasificación devolvió ${clasif.size} de ${ids.length} títulos`);
      } catch (e) {
        avisos.push(`No se pudo clasificar: ${e.message}`);
      }
    }
  }

  // 5. Índices.
  const contexto = [];
  for (const { activo, articulos } of lotes) {
    const f = path.join(datos, "indices", `${activo.ticker}.json`);
    const hist = leer(f, { ticker: activo.ticker, nombre: activo.nombre, dias: [] });
    hist.dias = hist.dias.filter((d) => d.fecha < fecha);
    const conClase = articulos.map((a, i) => {
      const id = `${activo.ticker}-${i}`;
      const c = clasif.get(id);
      return { id, ...a, relevante: c ? c.relevante : null, tono: c ? c.tono : null, riesgo: c ? c.riesgo : null };
    });
    const dia = Indices.calcularDia({ fecha, conteo: v.porActivo[activo.ticker].conteo, total: v.total, articulos: conClase }, hist.dias);
    dia.ventana = v.ventana;
    hist.dias.push(dia);
    escribir(f, hist);
    const valores = (d) => ({ fecha: d.fecha, atencion: d.atencion.valor, tono: d.tono.valor, riesgo: d.riesgo.valor, momento: d.momento.valor });
    contexto.push({
      activo,
      hoy: valores(dia),
      historia: hist.dias.slice(-HISTORIA_PARA_IA - 1, -1).map(valores),
      articulos: conClase.filter((a) => a.relevante).slice(0, ARTICULOS_PARA_IA).map((a) => ({ id: a.id, titulo: a.titulo, medio: a.medio, tono: a.tono, riesgo: a.riesgo })),
      todos: conClase,
    });
  }
  registrar(`Índices de ${contexto.length} activos (${v.total} artículos en la ventana)`);

  // 6. Propuestas, selladas.
  let nota = "Índices actualizados";
  if (conIA) {
    const salida = Calendario.rueda(fecha, horizonte - 1);
    const pedido = pedidoPropuestas(contexto, { modelo, esfuerzo: config.esfuerzo.proponer, fecha, salida, horizonte });
    registrar("Claude: propuestas");
    try {
      const m = await llamar(pedido);
      const u = uso(m);
      usos.push({ tarea: "proponer", ...u, dolares: Costos.costo(u, u.modelo) });
      const tickers = watch.activos.map((a) => a.ticker);
      const { propuestas, descartes } = interpretarPropuestas(m, { tickers, idsNoticias: contexto.flatMap((c) => c.articulos.map((a) => a.id)) });
      for (const d of descartes) avisos.push(`Propuesta descartada (${d.activo}): ${d.motivo}`);
      const porId = new Map(contexto.flatMap((c) => c.todos.map((a) => [a.id, a])));
      for (const p of propuestas) p.analogo.verificado = p.analogo.url ? await verificarUrl(p.analogo.url, { buscar }) : false;
      const anteriorFecha = [...estado.propuestas].sort().pop();
      const anterior = anteriorFecha ? await Sellos.sha256(fs.readFileSync(path.join(datos, "propuestas", `${anteriorFecha}.json`), "utf8")) : null;
      const generadaEn = iso(reloj());
      const dia = {
        version: 1,
        fecha,
        generadaEn,
        aperturaEn,
        salidaEn: Calendario.cierre(salida),
        horizonte,
        modelo,
        modeloQueRespondio: u.modelo,
        noticias: { fuente: "The GDELT Project, https://www.gdeltproject.org/", ventana: v.ventana, articulos: v.total },
        anterior,
        propuestas: propuestas.map((p) => {
          const c = contexto.find((x) => x.activo.ticker === p.activo);
          return {
            id: `${fecha}-${p.activo}`,
            ...p,
            nombre: c.activo.nombre,
            indices: c.hoy,
            noticias: p.noticias.map((id) => { const a = porId.get(id); return { id, titulo: a.titulo, url: a.url, medio: a.medio }; }),
          };
        }),
      };
      const errores = Bitacora.validarDia(dia, tickers);
      if (!propuestas.length) avisos.push("No quedó ninguna propuesta válida: no se sella el día");
      else if (errores.length) avisos.push(`No se sella el día, el archivo no es válido: ${errores.join("; ")}`);
      else if (reloj().getTime() >= Date.parse(aperturaEn)) avisos.push("Las propuestas terminaron después de la apertura: no se sellan");
      else {
        escribir(archivoDia, dia);
        estado.propuestas.push(fecha);
        nota = `${propuestas.length} propuestas selladas para el ${fecha}`;
      }
    } catch (e) {
      avisos.push(`No se pudieron generar propuestas: ${e.message}`);
    }
  }
  registrar(nota);
  return terminar({ nota, noticias: { archivos: { pedidos: v.archivos.pedidos, leidos: v.archivos.leidos, faltantes: v.archivos.faltantes.length }, articulos: v.total, ventana: v.ventana } });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, "").split("="); return [k, v.length ? v.join("=") : true]; }));
  const seco = !!args.seco;
  const llamar = !seco && process.env.ANTHROPIC_API_KEY ? (await import("./llamar.js")).crearLlamador() : null;
  correr({
    seco,
    llamar,
    datos: args.salida ? path.resolve(args.salida) : undefined,
    horas: args.horas ? Number(args.horas) : 24,
    fecha: args.fecha,
    flujos: args["sin-traduccion"] ? ["en"] : ["en", "traduccion"],
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
