// Sellos de las propuestas: cada archivo diario guarda el SHA-256 del anterior.
// Si alguien edita un archivo viejo, la cadena se rompe desde ahí. Además, el commit
// que agrega el archivo fija la hora: el pipeline la compara con la apertura del mercado.
// Usa la Web Crypto API, que está en el navegador y en Node 22.
const Sellos = (() => {
  async function sha256(texto) {
    const bytes = new TextEncoder().encode(texto);
    const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  // archivos: [{nombre, texto}] en orden de fecha. Devuelve un problema por archivo roto.
  async function verificarCadena(archivos) {
    const problemas = [];
    let anterior = null;
    for (const { nombre, texto } of archivos) {
      let dato;
      try {
        dato = JSON.parse(texto);
      } catch {
        problemas.push({ nombre, problema: "No es JSON válido" });
        anterior = await sha256(texto);
        continue;
      }
      if ((dato.anterior || null) !== anterior) {
        problemas.push({ nombre, problema: anterior === null ? "El primer archivo no debería apuntar a otro" : "No coincide con el hash del archivo anterior: alguno de los dos cambió" });
      }
      anterior = await sha256(texto);
    }
    return problemas;
  }

  return { sha256, verificarCadena };
})();

if (typeof module !== "undefined") module.exports = Sellos;
