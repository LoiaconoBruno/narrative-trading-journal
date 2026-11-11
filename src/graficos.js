// Gráficos en SVG, sin dependencias. Los colores salen del CSS (clases .g-*), así que
// siguen el modo claro y oscuro. Cada gráfico tiene su tabla o lista con los mismos datos.
const Graficos = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, padre) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (padre) padre.appendChild(n);
    return n;
  };
  const num = (x, d = 0) => x.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d }).replace("-", "−");

  function tooltip(contenedor) {
    let t = contenedor.querySelector(".g-tooltip");
    if (!t) {
      t = document.createElement("div");
      t.className = "g-tooltip";
      t.hidden = true;
      contenedor.appendChild(t);
    }
    return {
      mostrar(html, x, y) {
        t.innerHTML = html;
        t.hidden = false;
        const ancho = contenedor.clientWidth;
        const w = t.offsetWidth;
        t.style.left = Math.max(0, Math.min(ancho - w, x - w / 2)) + "px";
        t.style.top = Math.max(0, y - t.offsetHeight - 12) + "px";
      },
      ocultar() { t.hidden = true; },
    };
  }

  // Diagrama de calibración: confianza media del tramo contra tasa de acierto.
  function calibracion(contenedor, tramos) {
    contenedor.innerHTML = "";
    const conDatos = tramos.filter((t) => t.n > 0);
    if (!conDatos.length) {
      contenedor.innerHTML = '<p class="g-vacio">Todavía no hay propuestas cerradas que cuenten.</p>';
      return;
    }
    const W = Math.max(260, contenedor.clientWidth || 400);
    const H = Math.round(Math.min(360, W * 0.8));
    const m = { i: 64, d: 16, a: 16, b: 44 };
    const x = (v) => m.i + ((v - 0.5) / 0.5) * (W - m.i - m.d);
    const y = (v) => H - m.b - v * (H - m.a - m.b);
    const svg = el("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Calibración: confianza dicha contra tasa de acierto, por tramo. Los mismos datos están en la tabla de abajo." }, contenedor);
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      el("line", { x1: m.i, x2: W - m.d, y1: y(v), y2: y(v), class: "g-grilla" }, svg);
      el("text", { x: m.i - 8, y: y(v) + 4, class: "g-eje", "text-anchor": "end" }, svg).textContent = `${num(v * 100)} %`;
    }
    for (const v of [0.5, 0.6, 0.7, 0.8, 0.9, 1]) el("text", { x: x(v), y: H - m.b + 18, class: "g-eje", "text-anchor": "middle" }, svg).textContent = `${num(v * 100)} %`;
    el("text", { x: (m.i + W - m.d) / 2, y: H - 6, class: "g-eje", "text-anchor": "middle" }, svg).textContent = "Confianza que dijo la IA";
    const ey = el("text", { x: 14, y: (m.a + H - m.b) / 2, class: "g-eje", "text-anchor": "middle", transform: `rotate(-90 14 ${(m.a + H - m.b) / 2})` }, svg);
    ey.textContent = "Cuánto acertó";
    el("line", { x1: x(0.5), y1: y(0.5), x2: x(1), y2: y(1), class: "g-diagonal" }, svg);
    el("text", { x: x(0.97), y: y(0.97) + 16, class: "g-eje", "text-anchor": "end" }, svg).textContent = "calibración perfecta";
    const tip = tooltip(contenedor);
    for (const t of conDatos) {
      const cx = x(t.confianzaMedia);
      const cy = y(t.tasaAcierto);
      const g = el("g", { class: "g-punto", tabindex: "0", role: "img", "aria-label": `Tramo ${t.desde} a ${t.hasta} %: ${t.n} propuestas, dijo ${num(t.confianzaMedia * 100)} %, acertó ${num(t.tasaAcierto * 100)} %` }, svg);
      el("circle", { cx, cy, r: 16, class: "g-blanco" }, g);
      el("circle", { cx, cy, r: 6, class: "g-marca" }, g);
      el("text", { x: cx + 10, y: cy - 8, class: "g-etiqueta" }, g).textContent = `n = ${t.n}`;
      const html = `<strong>${t.desde}–${t.hasta} %</strong><br>${t.n} propuestas<br>Dijo ${num(t.confianzaMedia * 100)} % · acertó ${num(t.tasaAcierto * 100)} %`;
      const mostrar = () => tip.mostrar(html, cx, cy);
      g.addEventListener("pointerenter", mostrar);
      g.addEventListener("focus", mostrar);
      g.addEventListener("pointerleave", tip.ocultar);
      g.addEventListener("blur", tip.ocultar);
    }
  }

  // Serie de un índice en el tiempo. Los días sin valor cortan la línea.
  function serie(contenedor, { titulo, puntos, min, max, referencia, unidad = "" }) {
    contenedor.innerHTML = "";
    const h = document.createElement("h4");
    h.className = "g-titulo";
    const ultimo = [...puntos].reverse().find((p) => p.valor !== null);
    h.innerHTML = `${titulo} <span>${ultimo ? num(ultimo.valor, 1) + unidad : "sin datos"}</span>`;
    contenedor.appendChild(h);
    const caja = document.createElement("div");
    caja.className = "g-caja";
    contenedor.appendChild(caja);
    const W = Math.max(240, caja.clientWidth || contenedor.clientWidth || 300);
    const H = 140;
    const m = { i: 36, d: 12, a: 10, b: 24 };
    const n = puntos.length;
    const x = (i) => m.i + (n > 1 ? (i / (n - 1)) * (W - m.i - m.d) : (W - m.i - m.d) / 2);
    const y = (v) => H - m.b - ((v - min) / (max - min)) * (H - m.a - m.b);
    const svg = el("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${titulo}: ${n} días. El detalle está en la lista «Día por día».` }, caja);
    for (const v of [min, referencia, max]) {
      el("line", { x1: m.i, x2: W - m.d, y1: y(v), y2: y(v), class: v === referencia ? "g-referencia" : "g-grilla" }, svg);
      el("text", { x: m.i - 6, y: y(v) + 4, class: "g-eje", "text-anchor": "end" }, svg).textContent = num(v);
    }
    if (n) {
      el("text", { x: m.i, y: H - 6, class: "g-eje" }, svg).textContent = fechaCorta(puntos[0].fecha);
      el("text", { x: W - m.d, y: H - 6, class: "g-eje", "text-anchor": "end" }, svg).textContent = fechaCorta(puntos[n - 1].fecha);
    }
    let d = "";
    let abierto = false;
    puntos.forEach((p, i) => {
      if (p.valor === null) { abierto = false; return; }
      d += `${abierto ? "L" : "M"}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`;
      abierto = true;
    });
    if (d) el("path", { d, class: "g-linea" }, svg);
    puntos.forEach((p, i) => {
      const solo = p.valor !== null && (i === 0 || puntos[i - 1].valor === null) && (i === n - 1 || puntos[i + 1].valor === null);
      if (solo) el("circle", { cx: x(i), cy: y(p.valor), r: 4, class: "g-marca" }, svg);
    });
    const cruz = el("line", { y1: m.a, y2: H - m.b, class: "g-cruz", visibility: "hidden" }, svg);
    const punto = el("circle", { r: 5, class: "g-marca g-marca--borde", visibility: "hidden" }, svg);
    const tip = tooltip(caja);
    svg.addEventListener("pointermove", (ev) => {
      if (!n) return;
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(n - 1, Math.round(((px - m.i) / (W - m.i - m.d)) * (n - 1))));
      const p = puntos[i];
      cruz.setAttribute("x1", x(i)); cruz.setAttribute("x2", x(i)); cruz.setAttribute("visibility", "visible");
      if (p.valor !== null) { punto.setAttribute("cx", x(i)); punto.setAttribute("cy", y(p.valor)); punto.setAttribute("visibility", "visible"); } else punto.setAttribute("visibility", "hidden");
      tip.mostrar(`<strong>${fechaCorta(p.fecha)}</strong><br>${p.valor === null ? "sin datos" : num(p.valor, 1) + unidad}`, (x(i) / W) * r.width, p.valor === null ? m.a : (y(p.valor) / H) * r.height);
    });
    svg.addEventListener("pointerleave", () => { cruz.setAttribute("visibility", "hidden"); punto.setAttribute("visibility", "hidden"); tip.ocultar(); });
  }

  function fechaCorta(f) {
    const [a, m, d] = f.split("-");
    return `${Number(d)}/${Number(m)}`;
  }

  return { calibracion, serie, fechaCorta };
})();
