// Interfaz: formulario, lista de propuestas con decisión y cierre, y resumen.
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const CLAVE = "bitacora-sociohistorica:v1";
  const hoy = () => new Date().toISOString().slice(0, 10);
  const pct = (x, d = 1) => (x === null || x === undefined ? "—" : (x * 100).toFixed(d).replace(".", ",") + " %");

  let lista = [];
  try { const x = JSON.parse(localStorage.getItem(CLAVE)); if (Array.isArray(x) && !Bitacora.validarLista(x)) lista = x; } catch { /* sin datos */ }
  const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(lista)); } catch { /* sin almacenamiento */ } };

  $("f-fecha").value = hoy();
  $("f-conf").addEventListener("input", () => { $("v-conf").textContent = $("f-conf").value + " %"; });

  $("form").addEventListener("submit", (e) => {
    e.preventDefault();
    const p = {
      id: "p" + Date.now().toString(36),
      activo: $("f-activo").value.trim().toUpperCase(),
      direccion: $("f-dir").value,
      fechaTesis: $("f-fecha").value.trim(),
      precioEntrada: parseFloat($("f-precio").value),
      tesis: $("f-tesis").value.trim(),
      analogo: $("f-analogo").value.trim(),
      confianza: parseFloat($("f-conf").value),
      riesgos: $("f-riesgos").value.trim(),
      decision: null,
      cierre: null,
    };
    const errores = Bitacora.validar(p);
    $("f-error").textContent = errores.join(". ");
    if (errores.length) return;
    lista.unshift(p);
    $("form").reset(); $("f-fecha").value = hoy(); $("v-conf").textContent = "60 %";
    render();
  });

  function tarjeta(p) {
    const avisos = Bitacora.anticipacion(p, hoy());
    const r = Bitacora.rendimiento(p);
    const estado = !p.decision
      ? `<button data-acc="aprobar" data-id="${p.id}" class="primary">Aprobar</button><button data-acc="rechazar" data-id="${p.id}">Rechazar</button>`
      : `<span class="badge ${p.decision === "aprobada" ? "ok" : ""}">${p.decision}</span>`;
    const cierre = p.cierre
      ? `<span>Cierre ${esc(p.cierre.fecha)} a ${p.cierre.precio}: <b class="${r > 0 ? "pos" : r < 0 ? "neg" : ""}">${pct(r)}</b>${p.decision === "rechazada" ? ' <span class="muted small">(lo que habría pasado)</span>' : ""}</span>`
      : p.decision
        ? `<span class="cierre"><input type="text" placeholder="AAAA-MM-DD" aria-label="Fecha de cierre" data-cf="${p.id}" value="${hoy()}"><input type="number" step="any" min="0" placeholder="Precio de cierre" aria-label="Precio de cierre" data-cp="${p.id}"><button data-acc="cerrar" data-id="${p.id}">Cerrar</button></span>`
        : "";
    return `<article class="prop">
      <h3>${esc(p.activo)} <span class="badge">${p.direccion}</span> <span class="small muted">${esc(p.fechaTesis)} · entrada ${p.precioEntrada} · confianza ${p.confianza} %</span></h3>
      ${p.tesis ? `<p>${esc(p.tesis)}</p>` : ""}
      ${p.analogo && p.analogo !== "—" ? `<p class="small muted">Análogo: ${esc(p.analogo)}</p>` : ""}
      ${p.riesgos ? `<p class="small muted">Riesgos: ${esc(p.riesgos)}</p>` : ""}
      ${avisos.map((a) => `<p class="small"><span class="badge warn">anticipación</span> ${esc(a)}. No cuenta en el resumen.</p>`).join("")}
      <div class="row">${estado} ${cierre} <button data-acc="quitar" data-id="${p.id}" class="small" aria-label="Quitar propuesta">Quitar</button></div>
      <p class="small" data-err="${p.id}" style="color:var(--bad)"></p>
    </article>`;
  }

  function render() {
    $("lista").innerHTML = lista.length ? lista.map(tarjeta).join("") : '<p class="muted">Todavía no hay propuestas. Cargá una o el ejemplo ficticio.</p>';
    const r = Bitacora.resumen(lista, hoy());
    const stat = (k, v) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`;
    $("stats").innerHTML = stat("Propuestas evaluadas", `${r.evaluadas} de ${r.total}`)
      + stat("Rendimiento de lo aprobado", pct(r.promAprobadas))
      + stat("Si se aprobaba todo", pct(r.promTodas))
      + stat("Valor del humano", r.valorHumano === null ? "—" : (r.valorHumano >= 0 ? "+" : "") + (r.valorHumano * 100).toFixed(1).replace(".", ",") + " pp")
      + stat("Decisiones humanas acertadas", pct(r.aciertosHumanos, 0))
      + stat("Brier (0 = perfecto, 0,25 = azar)", r.brier === null ? "—" : r.brier.toFixed(3).replace(".", ","));
    $("lectura").textContent = r.evaluadas === 0
      ? "Hace falta al menos una propuesta decidida y cerrada para medir algo."
      : `${r.valorHumano > 0 ? "El filtro humano mejoró el resultado" : r.valorHumano < 0 ? "El filtro humano empeoró el resultado" : "El filtro humano no cambió el resultado"} respecto de aprobar todo. ${r.excluidas ? `${r.excluidas} ${r.excluidas === 1 ? "propuesta quedó excluida" : "propuestas quedaron excluidas"} por fechas imposibles. ` : ""}${r.pendientes ? `${r.pendientes} sin decidir. ` : ""}Con pocas propuestas, todo esto es ruido: hacen falta decenas para sacar conclusiones.`;
    const cal = Bitacora.calibracion(lista, hoy()).filter((t) => t.n > 0);
    Grafico.lineas($("g-cal"), {
      series: [
        { nombre: "Acierto real por tramo", puntos: cal.map((t) => [t.confianzaMedia * 100, t.tasaAcierto * 100]) },
        { nombre: "Calibración perfecta", puntos: [[0, 0], [100, 100]], punteada: true },
      ],
      xMin: 0, xMax: 100, yMin: 0, yMax: 100,
      xEtiqueta: "confianza declarada (%)", yEtiqueta: "acierto real (%)", alto: 220,
    });
    guardar();
  }

  $("lista").addEventListener("click", (e) => {
    const b = e.target.closest("[data-acc]");
    if (!b) return;
    const p = lista.find((x) => x.id === b.dataset.id);
    if (!p) return;
    if (b.dataset.acc === "aprobar") p.decision = "aprobada";
    if (b.dataset.acc === "rechazar") p.decision = "rechazada";
    if (b.dataset.acc === "quitar") { if (!confirm(`¿Quitar ${p.activo}?`)) return; lista = lista.filter((x) => x !== p); }
    if (b.dataset.acc === "cerrar") {
      const cierre = { fecha: document.querySelector(`[data-cf="${p.id}"]`).value.trim(), precio: parseFloat(document.querySelector(`[data-cp="${p.id}"]`).value) };
      const errores = Bitacora.validar({ ...p, cierre });
      if (errores.length) { document.querySelector(`[data-err="${p.id}"]`).textContent = errores.join(". "); return; }
      p.cierre = cierre;
    }
    render();
  });

  $("ejemplo").addEventListener("click", () => {
    if (lista.length && !confirm("Esto reemplaza tus propuestas por el ejemplo ficticio. ¿Seguir?")) return;
    lista = Bitacora.ejemplo(); render();
  });
  $("borrar").addEventListener("click", () => { if (lista.length && confirm("¿Borrar todas las propuestas?")) { lista = []; render(); } });
  $("exportar").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(lista, null, 2)], { type: "application/json" }));
    a.download = "bitacora.json"; a.click(); URL.revokeObjectURL(a.href);
  });
  $("importar-btn").addEventListener("click", () => $("importar").click());
  $("importar").addEventListener("change", async () => {
    const f = $("importar").files[0];
    if (!f) return;
    try {
      const x = JSON.parse(await f.text());
      const err = Bitacora.validarLista(x);
      if (err) throw new Error(err);
      lista = x; render();
    } catch (e) { alert("No se pudo importar: " + e.message); }
    $("importar").value = "";
  });
  window.addEventListener("resize", render);
  render();
})();
