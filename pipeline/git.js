// El sello de un archivo: la hora del commit que lo agregó y cuántas veces cambió después.
// En GitHub Actions el checkout tiene que traer la historia completa (fetch-depth: 0).
import { execFileSync } from "node:child_process";

export function sello(ruta, cwd) {
  let salida = "";
  try {
    salida = execFileSync("git", ["log", "--format=%H %cI", "--", ruta], { cwd, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
  if (!salida) return null;
  const commits = salida.split("\n").map((l) => {
    const [hash, fecha] = l.split(" ");
    return { hash, fecha: new Date(fecha).toISOString().replace(".000Z", "Z") };
  });
  const primero = commits[commits.length - 1];
  return { selladaEn: primero.fecha, commit: primero.hash, cambios: commits.length - 1 };
}
