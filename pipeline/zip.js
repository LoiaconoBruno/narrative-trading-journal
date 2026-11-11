// Extrae el único archivo de un .zip de GDELT, sin dependencias.
// Lee el directorio central (al final del zip) para saber dónde empieza el contenido
// y con qué método está comprimido; zlib descomprime el "deflate" crudo.
import { inflateRawSync } from "node:zlib";

const FIN_DIRECTORIO = 0x06054b50;
const ENTRADA_DIRECTORIO = 0x02014b50;
const CABECERA_LOCAL = 0x04034b50;

export function extraerUnico(buf) {
  let fin = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === FIN_DIRECTORIO) { fin = i; break; }
  }
  if (fin < 0) throw new Error("No es un zip: falta el fin del directorio central");
  const inicioDirectorio = buf.readUInt32LE(fin + 16);
  if (buf.readUInt32LE(inicioDirectorio) !== ENTRADA_DIRECTORIO) throw new Error("Directorio central dañado");
  const metodo = buf.readUInt16LE(inicioDirectorio + 10);
  const comprimido = buf.readUInt32LE(inicioDirectorio + 20);
  const original = buf.readUInt32LE(inicioDirectorio + 24);
  const local = buf.readUInt32LE(inicioDirectorio + 42);
  if (comprimido === 0xffffffff || original === 0xffffffff) throw new Error("Zip64 no soportado");
  if (buf.readUInt32LE(local) !== CABECERA_LOCAL) throw new Error("Cabecera local dañada");
  const datos = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
  const contenido = buf.subarray(datos, datos + comprimido);
  if (metodo === 0) return Buffer.from(contenido);
  if (metodo === 8) return inflateRawSync(contenido);
  throw new Error(`Método de compresión ${metodo} no soportado`);
}
