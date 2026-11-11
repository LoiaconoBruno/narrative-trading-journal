// Comprueba que la URL del episodio histórico exista. Si no responde, la propuesta queda
// igual, pero marcada como "sin verificar" y sin link.
export async function verificarUrl(url, { buscar = fetch, ms = 10000 } = {}) {
  if (!/^https:\/\//.test(url || "")) return false;
  const pedir = async (method) => {
    const res = await buscar(url, { method, redirect: "follow", signal: AbortSignal.timeout(ms), headers: { "user-agent": "bitacora-narrativa/0.2 (GitHub Actions)" } });
    return res.status;
  };
  try {
    let estado = await pedir("HEAD");
    if (estado === 405 || estado === 403) estado = await pedir("GET");
    return estado >= 200 && estado < 300;
  } catch {
    return false;
  }
}
