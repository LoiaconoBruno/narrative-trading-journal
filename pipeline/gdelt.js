// Noticias de GDELT (https://www.gdeltproject.org/): los archivos GKG 2.1 que GDELT publica
// cada 15 minutos, con los artículos que monitorea y las organizaciones que nombra cada uno.
// Dos flujos: "en" (medios en inglés) y "traduccion" (65 idiomas traducidos al inglés por
// GDELT; el título queda en el idioma original). Se usan los archivos y no la API DOC
// porque la API limita a un pedido cada 5 segundos y respondía 429 de forma sostenida.
// Términos: uso y redistribución libres, citando a GDELT con un link a su sitio.
import { extraerUnico } from "./zip.js";

const BASE = "https://data.gdeltproject.org/gdeltv2/";
const SUFIJO = { en: ".gkg.csv.zip", traduccion: ".translation.gkg.csv.zip" };
const ULTIMO = { en: "lastupdate.txt", traduccion: "lastupdate-translation.txt" };
const C = { fecha: 1, medio: 3, url: 4, orgs: 13, orgsDetalle: 14, tono: 15, traduccion: 25, extras: 26 };
const QUINCE_MIN = 15 * 60 * 1000;

// V8 guarda los pedazos de un texto como referencias al texto entero: un título de
// 80 caracteres podía retener el archivo de 50 MB del que salió. Lo que se guarda
// más allá de un archivo se copia.
const copia = (x) => (x ? Buffer.from(x, "utf8").toString("utf8") : x);

const marca = (d) => d.toISOString().replace(/[-:T]/g, "").slice(0, 14);
const deMarca = (m) => new Date(`${m.slice(0, 4)}-${m.slice(4, 6)}-${m.slice(6, 8)}T${m.slice(8, 10)}:${m.slice(10, 12)}:${m.slice(12, 14)}Z`);

// Las marcas de 15 minutos de las `horas` que terminan en `hasta` (incluida).
export function marcasDeVentana(hasta, horas = 24) {
  const fin = Math.floor(hasta.getTime() / QUINCE_MIN) * QUINCE_MIN;
  const n = (horas * 60) / 15;
  return Array.from({ length: n }, (_, i) => marca(new Date(fin - (n - 1 - i) * QUINCE_MIN)));
}

export const urlArchivo = (m, flujo) => BASE + m + SUFIJO[flujo];

const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decodificar(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTIDADES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

// ¿Alguna organización nombrada coincide con un alias? Coincide si es igual o si empieza
// con el alias seguido de un espacio ("nvidia corp" para "nvidia"; "applebee" no es "apple").
export function coincide(org, alias) {
  return alias.some((a) => org === a || org.startsWith(a + " "));
}

export function parsearLinea(linea) {
  const c = linea.split("\t");
  if (c.length < 27) return null;
  const titulo = /<PAGE_TITLE>([\s\S]*?)<\/PAGE_TITLE>/.exec(c[C.extras]);
  const idioma = /srclc:([a-z]{3})/.exec(c[C.traduccion] || "");
  const f = c[C.fecha];
  return {
    fecha: f.length === 14 ? deMarca(f).toISOString().replace(".000Z", "Z") : null,
    medio: c[C.medio],
    url: c[C.url],
    orgs: c[C.orgs] ? c[C.orgs].split(";").filter(Boolean) : [],
    orgsDetalle: c[C.orgsDetalle] ? c[C.orgsDetalle].split(";").map((x) => x.slice(0, x.lastIndexOf(",")).toLowerCase()) : [],
    tonoGdelt: Number(String(c[C.tono]).split(",")[0]),
    titulo: titulo ? decodificar(titulo[1]) : "",
    idioma: idioma ? idioma[1] : "eng",
  };
}

// Suma los registros de un archivo al estado: total de artículos y candidatos por activo.
export function acumular(estado, texto, activos) {
  for (const linea of texto.split("\n")) {
    if (!linea) continue;
    const r = parsearLinea(linea);
    if (!r) continue;
    estado.total++;
    for (const a of activos) {
      if (!r.orgs.some((o) => coincide(o, a.alias))) continue;
      const e = estado.activos[a.ticker];
      if (e.urls.has(r.url)) continue;
      e.urls.add(copia(r.url));
      e.conteo++;
      if (!r.titulo || !/^https?:\/\//.test(r.url)) continue;
      const tituloMin = r.titulo.toLowerCase();
      e.candidatos.push({
        titulo: copia(r.titulo.slice(0, 300)),
        url: copia(r.url),
        medio: copia(r.medio),
        fecha: r.fecha,
        idioma: copia(r.idioma),
        tonoGdelt: isFinite(r.tonoGdelt) ? Math.round(r.tonoGdelt * 100) / 100 : null,
        menciones: r.orgsDetalle.filter((o) => coincide(o, a.alias)).length,
        enTitulo: a.alias.some((x) => tituloMin.includes(x)) || tituloMin.includes(a.nombre.toLowerCase()),
      });
    }
  }
  return estado;
}

// Los n artículos que se mandan a clasificar: primero los que nombran a la empresa en el
// título, después los que más la mencionan, después los más nuevos; sin títulos repetidos.
export function seleccionar(candidatos, n = 20) {
  const orden = [...candidatos].sort((a, b) => (b.enTitulo - a.enTitulo) || (b.menciones - a.menciones) || (b.fecha || "").localeCompare(a.fecha || ""));
  const vistos = new Set();
  const r = [];
  for (const c of orden) {
    const clave = c.titulo.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    r.push(c);
    if (r.length === n) break;
  }
  return r;
}

async function conReintentos(fn, intentos = 3) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= intentos || e.noReintentar) throw e;
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
}

// La última marca publicada de un flujo (GDELT la anuncia en lastupdate*.txt).
export async function ultimaMarca(flujo, buscar = fetch) {
  const r = await conReintentos(async () => {
    const res = await buscar(BASE + ULTIMO[flujo]);
    if (!res.ok) throw new Error(`lastupdate ${res.status}`);
    return res.text();
  });
  const m = /(\d{14})\.(?:translation\.)?gkg\.csv\.zip/.exec(r);
  if (!m) throw new Error("lastupdate sin archivo GKG");
  return deMarca(m[1]);
}

// GDELT anuncia el archivo nuevo antes de que se pueda bajar (en las pruebas, hasta 45
// minutos antes): se retrocede de a 15 minutos hasta encontrar el último que existe.
export async function ultimaDisponible(flujo, buscar = fetch, intentos = 12) {
  let t = (await ultimaMarca(flujo, buscar)).getTime();
  for (let i = 0; i < intentos; i++, t -= QUINCE_MIN) {
    const res = await buscar(urlArchivo(marca(new Date(t)), flujo), { method: "HEAD" }).catch(() => null);
    if (res && res.ok) return new Date(t);
  }
  throw new Error(`GDELT: no hay archivos ${flujo} disponibles en las últimas ${intentos * 15} minutos`);
}

// Baja y procesa las 24 horas que terminan en el último archivo publicado.
export async function bajarVentana({ activos, flujos = ["en", "traduccion"], horas = 24, n = 20, concurrencia = 4, buscar = fetch, registrar = () => {} }) {
  const estado = { total: 0, activos: Object.fromEntries(activos.map((a) => [a.ticker, { conteo: 0, urls: new Set(), candidatos: [] }])) };
  const archivos = { pedidos: 0, leidos: 0, faltantes: [] };
  const ventana = {};
  const tareas = [];
  const errores = [];
  for (const flujo of flujos) {
    let hasta;
    try {
      hasta = await ultimaDisponible(flujo, buscar);
    } catch (e) {
      errores.push(e.message);
      continue;
    }
    const marcas = marcasDeVentana(hasta, horas);
    ventana[flujo] = { desde: deMarca(marcas[0]).toISOString(), hasta: hasta.toISOString() };
    for (const m of marcas) tareas.push({ m, flujo });
  }
  archivos.pedidos = tareas.length;
  let siguiente = 0;
  async function trabajador() {
    while (siguiente < tareas.length) {
      const { m, flujo } = tareas[siguiente++];
      try {
        const buf = await conReintentos(async () => {
          const res = await buscar(urlArchivo(m, flujo));
          if (res.status === 404) throw Object.assign(new Error("404"), { noReintentar: true });
          if (!res.ok) throw new Error(String(res.status));
          return Buffer.from(await res.arrayBuffer());
        });
        acumular(estado, extraerUnico(buf).toString("utf8"), activos);
        archivos.leidos++;
      } catch (e) {
        archivos.faltantes.push(`${flujo}:${m} (${e.message})`);
      }
      if ((archivos.leidos + archivos.faltantes.length) % 24 === 0) registrar(`GDELT: ${archivos.leidos + archivos.faltantes.length}/${tareas.length} archivos`);
    }
  }
  await Promise.all(Array.from({ length: concurrencia }, trabajador));
  registrar(`GDELT: ${archivos.leidos} archivos leídos, ${estado.total} artículos; memoria en uso ${Math.round(process.memoryUsage().rss / 1e6)} MB`);
  const porActivo = {};
  for (const a of activos) {
    const e = estado.activos[a.ticker];
    porActivo[a.ticker] = { conteo: e.conteo, articulos: seleccionar(e.candidatos, n) };
  }
  return { ventana, archivos, errores, total: estado.total, porActivo };
}
