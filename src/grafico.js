// Gráficos de líneas en <canvas>, sin dependencias. Toma los colores del CSS,
// así respeta el modo claro y oscuro.
const Grafico = (() => {
  function colores() {
    const s = getComputedStyle(document.documentElement);
    const v = (n) => s.getPropertyValue(n).trim();
    return {
      text: v("--text"),
      muted: v("--muted"),
      border: v("--border"),
      bg: v("--surface-2"),
      series: [v("--s1"), v("--s2"), v("--s3"), v("--s4"), v("--s5")],
    };
  }

  function preparar(canvas, alto) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 600;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(alto * dpr);
    canvas.style.height = alto + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, alto);
    return { ctx, w, h: alto };
  }

  // Marcas "redondas" (1, 2, 5 × 10^k) entre min y max.
  function marcasLindas(min, max, cantidad = 5) {
    if (!isFinite(min) || !isFinite(max)) return [];
    if (min === max) { min -= 1; max += 1; }
    const crudo = (max - min) / cantidad;
    const pot = Math.pow(10, Math.floor(Math.log10(crudo)));
    const paso = [1, 2, 5, 10].map((m) => m * pot).find((p) => p >= crudo);
    const marcas = [];
    for (let x = Math.ceil(min / paso) * paso; x <= max + paso * 1e-9; x += paso) {
      marcas.push(Math.abs(x) < paso * 1e-9 ? 0 : x);
    }
    return marcas;
  }

  function formato(x) {
    if (x === 0) return "0";
    const a = Math.abs(x);
    if (a >= 1e4 && a < 1e9 && Number.isInteger(x)) return x.toLocaleString("es-AR");
    if (a >= 1e4 || a < 1e-3) return x.toExponential(0);
    return Number(x.toPrecision(3)).toString();
  }

  // opciones: { series: [{nombre, puntos: [[x,y],...], color?, punteada?}],
  //   xEtiqueta, yEtiqueta, xMin, xMax, yMin, yMax, alto, logX, logY,
  //   verticales: [{x, etiqueta}], horizontales: [{y, etiqueta}] }
  function lineas(canvas, op) {
    const alto = op.alto || 260;
    const { ctx, w, h } = preparar(canvas, alto);
    const c = colores();
    const m = { l: 52, r: 12, t: 12, b: 40 };
    const tx = (x) => (op.logX ? Math.log10(x) : x);
    const ty = (y) => (op.logY ? Math.log10(y) : y);
    const pts = op.series.flatMap((s) => s.puntos).filter(([x, y]) => isFinite(tx(x)) && isFinite(ty(y)));
    let xMin = op.xMin ?? Math.min(...pts.map((p) => p[0]));
    let xMax = op.xMax ?? Math.max(...pts.map((p) => p[0]));
    let yMin = op.yMin ?? Math.min(...pts.map((p) => p[1]));
    let yMax = op.yMax ?? Math.max(...pts.map((p) => p[1]));
    if (!pts.length) { xMin = 0; xMax = 1; yMin = 0; yMax = 1; }
    const X0 = tx(xMin), X1 = tx(xMax), Y0 = ty(yMin), Y1 = ty(yMax === yMin ? yMin + 1 : yMax);
    const px = (x) => m.l + ((tx(x) - X0) / (X1 - X0 || 1)) * (w - m.l - m.r);
    const py = (y) => h - m.b - ((ty(y) - Y0) / (Y1 - Y0 || 1)) * (h - m.t - m.b);

    ctx.font = "12px system-ui, sans-serif";
    ctx.lineWidth = 1;
    ctx.strokeStyle = c.border;
    ctx.fillStyle = c.muted;

    const mx = op.logX ? potencias(xMin, xMax) : marcasLindas(xMin, xMax, Math.max(2, Math.floor(w / 90)));
    const my = op.logY ? potencias(yMin, yMax) : marcasLindas(yMin, yMax, 5);
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (const x of mx) {
      const X = px(x);
      if (X < m.l - 1 || X > w - m.r + 1) continue;
      ctx.beginPath(); ctx.moveTo(X, m.t); ctx.lineTo(X, h - m.b); ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillText(formato(x), X, h - m.b + 6);
    }
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (const y of my) {
      const Y = py(y);
      if (Y < m.t - 1 || Y > h - m.b + 1) continue;
      ctx.beginPath(); ctx.moveTo(m.l, Y); ctx.lineTo(w - m.r, Y); ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillText(formato(y), m.l - 6, Y);
    }
    if (op.xEtiqueta) { ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(op.xEtiqueta, m.l + (w - m.l - m.r) / 2, h - 2); }
    if (op.yEtiqueta) {
      ctx.save(); ctx.translate(12, m.t + (h - m.t - m.b) / 2); ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(op.yEtiqueta, 0, 0); ctx.restore();
    }

    ctx.save();
    ctx.beginPath(); ctx.rect(m.l, m.t, w - m.l - m.r, h - m.t - m.b); ctx.clip();
    for (const v of op.verticales || []) {
      ctx.strokeStyle = c.muted; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(px(v.x), m.t); ctx.lineTo(px(v.x), h - m.b); ctx.stroke(); ctx.setLineDash([]);
      if (v.etiqueta) { ctx.fillStyle = c.muted; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText(v.etiqueta, px(v.x) + 4, m.t + 22); }
    }
    for (const v of op.horizontales || []) {
      ctx.strokeStyle = c.muted; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(m.l, py(v.y)); ctx.lineTo(w - m.r, py(v.y)); ctx.stroke(); ctx.setLineDash([]);
      if (v.etiqueta) { ctx.fillStyle = c.muted; ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText(v.etiqueta, w - m.r - 4, py(v.y) - 2); }
    }
    op.series.forEach((s, i) => {
      ctx.strokeStyle = s.color || c.series[i % c.series.length];
      ctx.lineWidth = 2;
      ctx.setLineDash(s.punteada ? [6, 4] : []);
      ctx.beginPath();
      let empezo = false;
      for (const [x, y] of s.puntos) {
        if (!isFinite(tx(x)) || !isFinite(ty(y))) { empezo = false; continue; }
        const X = px(x), Y = py(y);
        if (!empezo) { ctx.moveTo(X, Y); empezo = true; } else ctx.lineTo(X, Y);
      }
      ctx.stroke();
    });
    ctx.restore();
    ctx.setLineDash([]);

    // Leyenda
    let lx = m.l + 8;
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    op.series.forEach((s, i) => {
      if (!s.nombre) return;
      const col = s.color || c.series[i % c.series.length];
      ctx.fillStyle = col; ctx.fillRect(lx, m.t + 8, 14, 3);
      ctx.fillStyle = c.text; ctx.fillText(s.nombre, lx + 18, m.t + 9);
      lx += 18 + ctx.measureText(s.nombre).width + 14;
    });
    return { px, py };
  }

  function potencias(min, max) {
    const out = [];
    for (let k = Math.floor(Math.log10(min)); k <= Math.ceil(Math.log10(max)); k++) out.push(Math.pow(10, k));
    return out;
  }

  return { colores, preparar, lineas, marcasLindas };
})();

if (typeof module !== "undefined") module.exports = Grafico;
