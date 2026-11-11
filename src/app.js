// Interfaz: lee los JSON de data/ (o el ejemplo con ?ejemplo), verifica la cadena de
// sellos y muestra Hoy, Índices, Bitácora y Método. Tus decisiones quedan en este navegador.
(() => {
  const $ = (id) => document.getElementById(id);
  const CLAVE = "narrative-trading-journal:decisiones:v1";
  const CLAVE_VIEJA = "bitacora-sociohistorica:v1";
  const EJEMPLO = new URLSearchParams(location.search).has("ejemplo");
  const POR_PAGINA = 30;
  const NB = " ";

  let D = null;
  let lista = [];
  let mostradas = POR_PAGINA;

  // ---- Formato -------------------------------------------------------------------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const enlace = (u) => (/^https?:\/\//.test(u || "") ? esc(u) : null);
  const num = (x, d = 0) => x.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const conSigno = (x, d = 1) => (x > 0 ? "+" : x < 0 ? "−" : "") + num(Math.abs(x), d);
  const pct = (x, d = 0) => (x === null || x === undefined ? "—" : `${num(x * 100, d)}${NB}%`);
  const pctSigno = (x, d = 1) => (x === null || x === undefined ? "—" : `${conSigno(x * 100, d)}${NB}%`);
  const brier = (x) => (x === null || x === undefined ? "—" : num(x, 3));
  const hora = (iso) => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const fechaLarga = (f) => new Date(f + "T12:00:00Z").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const fechaCorta = (f) => new Date(f + "T12:00:00Z").toLocaleDateString("es-AR", { day: "numeric", month: "numeric", year: "2-digit", timeZone: "UTC" });
  const ahora = () => (D && D.ejemplo ? D.ahora : new Date());
  const nombreDe = (t) => ((D.watchlist.activos || []).find((a) => a.ticker === t) || {}).nombre || t;

  // ---- Decisiones en el navegador ------------------------------------------------
  function leerDecisiones() {
    try {
      const x = JSON.parse(localStorage.getItem(CLAVE) || "{}");
      return x && typeof x === "object" ? x : {};
    } catch {
      return {};
    }
  }
  function guardarDecisiones() {
    if (D.ejemplo) return;
    try { localStorage.setItem(CLAVE, JSON.stringify(D.decisiones)); } catch { /* sin almacenamiento: queda en memoria */ }
  }
  function bajar(nombre, obj) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---- Datos ---------------------------------------------------------------------
  async function traer(ruta, tipo = "json") {
    const r = await fetch(ruta, { cache: "no-cache" });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`${ruta}: ${r.status}`);
    return tipo === "json" ? r.json() : r.text();
  }

  async function cargar() {
    if (EJEMPLO) return Ejemplo.datos();
    const [watchlist, estado] = await Promise.all([traer("data/watchlist.json"), traer("data/estado.json")]);
    if (!watchlist) throw new Error("Falta data/watchlist.json");
    // Sin estado.json el pipeline nunca corrió: no hay nada más que pedir.
    if (!estado) return { ejemplo: false, watchlist, estado: { propuestas: [] }, dias: [], resultados: [], decisiones: leerDecisiones(), indices: {}, costos: { corridas: [] }, sellos: null };
    const [resultados, costos] = await Promise.all([traer("data/resultados.json"), traer("data/costos.json")]);
    const fechas = [...((estado && estado.propuestas) || [])].sort();
    const textos = await Promise.all(fechas.map((f) => traer(`data/propuestas/${f}.json`, "text")));
    const archivos = fechas.map((f, i) => ({ nombre: `${f}.json`, texto: textos[i] })).filter((a) => a.texto);
    const problemas = globalThis.crypto && crypto.subtle ? await Sellos.verificarCadena(archivos) : null;
    const indices = {};
    await Promise.all(watchlist.activos.map(async (a) => { indices[a.ticker] = await traer(`data/indices/${a.ticker}.json`).catch(() => null); }));
    return {
      ejemplo: false,
      watchlist,
      estado,
      dias: archivos.map((a) => JSON.parse(a.texto)),
      resultados: (resultados && resultados.resultados) || [],
      decisiones: leerDecisiones(),
      indices,
      costos: costos || { corridas: [] },
      sellos: { archivos: archivos.length, problemas },
    };
  }

  // ---- Avisos y tablero ----------------------------------------------------------
  function avisos(error) {
    const partes = [];
    if (error) {
      partes.push(`<p class="aviso aviso--error"><strong>No se pudieron leer los datos.</strong> ${location.protocol === "file:" ? "Abriste la página con doble clic: el navegador no deja leer los archivos de <code>data/</code> así. Abrila desde GitHub Pages o con un servidor local." : esc(error.message)} Mientras tanto, <a href="?ejemplo">mirá el ejemplo</a>.</p>`);
    } else if (D.ejemplo) {
      partes.push(`<p class="aviso"><strong>Datos inventados.</strong> Cinco activos ficticios y resultados simulados, para ver cómo funciona antes de que el pipeline junte datos reales. Tus clics no se guardan. <a href="./">Ver los datos reales</a>.</p>`);
    } else if (!D.dias.length) {
      partes.push(`<p class="aviso"><strong>Todavía no hay propuestas.</strong> El pipeline diario no generó ninguna todavía (ver «Cómo funciona» y la guía para activarlo). Mientras tanto, <a href="?ejemplo">mirá el ejemplo</a>.</p>`);
    }
    if (D && D.sellos && D.sellos.problemas && D.sellos.problemas.length) {
      partes.push(`<p class="aviso aviso--error"><strong>La cadena de sellos está rota.</strong> ${D.sellos.problemas.map((p) => `${esc(p.nombre)}: ${esc(p.problema)}`).join(" · ")}</p>`);
    }
    const ultima = D && D.estado && D.estado.ultimaCorrida;
    if (ultima && !D.ejemplo && ultima.avisos && ultima.avisos.length) {
      partes.push(`<details class="aviso aviso--aviso"><summary>La última corrida (${esc(fechaCorta(ultima.fecha))}) dejó ${ultima.avisos.length} ${ultima.avisos.length === 1 ? "aviso" : "avisos"}</summary><ul>${ultima.avisos.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></details>`);
    }
    $("avisos").innerHTML = partes.join("");
  }

  // Cada dato dice su estado con color, ícono y palabras. Las referencias no son
  // inventadas: 50 % es tirar una moneda, 0,25 es el Brier de decir siempre 50 %,
  // 0 es que tu filtro no cambió nada.
  function tablero(r, u) {
    const h = r.humano;
    const estado = (tipo, texto) => `<span class="estado estado--${tipo}">${{ ok: "✓", aviso: "!", error: "✕", neutro: "·" }[tipo]} ${texto}</span>`;
    const aciertos = r.wilson === null ? ["neutro", "Todavía sin datos"] : r.wilson.inferior > 0.5 ? ["ok", "Mejor que una moneda"] : ["neutro", "Todavía no se distingue del azar"];
    const confianza = r.brier === null ? ["neutro", "Todavía sin datos"] : r.brier <= Bitacora.UMBRAL.brierMax ? ["ok", "Mejor que una moneda"] : r.brier < r.brierAzar ? ["aviso", "Apenas mejor que una moneda"] : ["error", "No mejor que una moneda"];
    const filtro = h.valor === null ? ["neutro", "Todavía sin decisiones"] : h.valor > 0 ? ["ok", "Sí, por ahora suma"] : h.valor < 0 ? ["error", "Por ahora resta"] : ["neutro", "Ni suma ni resta"];
    const tiles = [
      ["neutro", "Propuestas medidas", num(r.cerradas), `${num(r.abiertas)} esperando resultado${r.excluidas ? ` · ${num(r.excluidas)} no cuentan` : ""}`, ""],
      [aciertos[0], "Aciertos de la IA", pct(r.tasa), r.wilson ? `Entre ${pct(r.wilson.inferior)} y ${pct(r.wilson.superior)}, con 95${NB}% de confianza` : "Se mide cinco ruedas después de cada propuesta", estado(...aciertos)],
      [confianza[0], "¿Su confianza es creíble?", brier(r.brier), `Brier: 0 es perfecto, ${brier(r.brierAzar)} es tirar una moneda`, estado(...confianza)],
      [filtro[0], "¿Tu filtro suma?", h.valor === null ? "—" : `${conSigno(h.valor * 100, 2)}${NB}pp`, h.decididas ? `Sobre ${num(h.decididas)} decisiones tomadas a tiempo` : "Aprobá o rechazá en «Propuestas de hoy»", estado(...filtro)],
      [u.cumple ? "ok" : "neutro", "¿Pensar en plata real?", `${u.cumplidos} de 4`, "Condiciones cumplidas", estado(...(u.cumple ? ["ok", "Se cumplen las cuatro"] : ["neutro", "Todavía no"]))],
    ];
    $("tablero").innerHTML = tiles.map(([tipo, t, v, nota, est]) => `<li class="dato dato--${tipo}"><span class="dato__titulo">${t}</span><span class="dato__valor">${v}</span>${est}<span class="dato__nota">${nota}</span></li>`).join("");
  }

  // ---- Hoy -----------------------------------------------------------------------
  const ETIQUETAS = { atencion: "Atención", tono: "Tono", riesgo: "Riesgo", momento: "Momento" };

  function indicesDeTarjeta(p) {
    const hist = D.indices[p.activo];
    const dias = hist ? hist.dias.filter((d) => d.fecha <= p.fecha) : [];
    const hoy = dias[dias.length - 1];
    const cambios = hoy && hoy.fecha === p.fecha ? Indices.cambios(hoy, dias[dias.length - 2]) : null;
    return Object.keys(ETIQUETAS).map((k) => {
      const v = p.indices ? p.indices[k] : null;
      const c = cambios ? cambios[k].cambio : null;
      return `<li><span>${ETIQUETAS[k]}</span><strong>${v === null || v === undefined ? "—" : (k === "tono" || k === "momento" ? conSigno(v) : num(v, 1))}</strong>${c === null ? "" : `<em>(${conSigno(c)})</em>`}</li>`;
    }).join("");
  }

  function tarjeta(p, puesto, rs) {
    const abierta = Bitacora.abiertaParaDecidir(p, ahora());
    const hist = Bitacora.historialActivo(lista, p.activo);
    const dec = p.decision;
    const url = enlace(p.analogo.url);
    const fuente = url && p.analogo.verificado ? ` <a href="${url}">Fuente ↗</a>` : p.analogo.url ? ' <span class="chip">link sin verificar</span>' : "";
    const noticias = (p.noticias || []).map((n) => `<li>${enlace(n.url) ? `<a href="${enlace(n.url)}">${esc(n.titulo)}</a>` : esc(n.titulo)} <span class="medio">${esc(n.medio)}</span></li>`).join("");
    const estadoDec = dec
      ? `${dec.decision === "aprobada" ? "Aprobaste" : "Rechazaste"} a las ${hora(dec.en)}${p.decisionCuenta ? " · cuenta" : " · después de la apertura: no cuenta"}`
      : abierta ? `Podés decidir hasta las ${hora(p.aperturaEn)}.` : "Ya abrió el mercado: no decidiste a tiempo.";
    const boton = (valor, texto) => `<button type="button" class="btn${dec && dec.decision === valor ? " btn--primario" : ""}" data-decidir="${valor}" data-id="${esc(p.id)}" aria-pressed="${dec && dec.decision === valor ? "true" : "false"}"${abierta ? "" : " disabled"}>${texto}</button>`;
    return `<li class="propuesta panel" id="prop-${esc(p.id)}">
      <div class="propuesta__cabeza">
        <span class="propuesta__puesto" aria-label="Puesto ${puesto}">${puesto}</span>
        <div class="propuesta__activo"><h3>${esc(p.activo)} <span>${esc(p.nombre || nombreDe(p.activo))}</span></h3></div>
        <span class="dir dir--${p.direccion}">${p.direccion === "compra" ? "▲ Compra" : "▼ Venta"}</span>
        <div class="propuesta__conf"><strong>${p.confianza}${NB}%</strong><span>confianza</span></div>
      </div>
      <div class="barra" role="img" aria-label="Confianza ${p.confianza} %, en una escala de 50 a 100"><span style="width:${((p.confianza - 50) / 50) * 100}%"></span></div>
      <p class="propuesta__frase">La IA cree que <strong>${p.direccion === "compra" ? "va a subir" : "va a bajar"}</strong> de la apertura de hoy al cierre de la quinta rueda.</p>
      <p class="propuesta__tesis">${esc(p.tesis)}</p>
      <dl class="propuesta__datos">
        <div><dt>Episodio parecido</dt><dd><strong>${esc(p.analogo.episodio)}</strong>${p.analogo.periodo && p.analogo.periodo !== "—" ? ` (${esc(p.analogo.periodo)})` : ""}. ${esc(p.analogo.parecido)}${fuente}</dd></div>
        <div><dt>Riesgos</dt><dd><ul>${p.riesgos.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></dd></div>
        ${noticias ? `<div><dt>Noticias que la sostienen</dt><dd><ul class="noticias">${noticias}</ul></dd></div>` : ""}
      </dl>
      <ul class="mini-indices" aria-label="Índices del día">${indicesDeTarjeta(p)}</ul>
      <p class="propuesta__historial">${esc(p.activo)}: ${hist.n ? `${hist.aciertos} de ${hist.n} aciertos` : "sin propuestas cerradas"} · Sistema: Brier ${brier(rs.brier)}${rs.cerradas ? ` en ${num(rs.cerradas)} cerradas` : ""}</p>
      <div class="decidir" role="group" aria-label="Tu decisión sobre ${esc(p.activo)}">
        ${boton("aprobada", "Aprobar")}${boton("rechazada", "Rechazar")}
        <p class="decidir__estado" aria-live="polite">${estadoDec}</p>
      </div>
    </li>`;
  }

  function hoy(rs) {
    const dia = D.dias[D.dias.length - 1];
    if (!dia) {
      $("hoy-titulo").textContent = "Propuestas de hoy";
      $("hoy-meta").textContent = "";
      $("propuestas").innerHTML = '<li class="vacio">Cuando el pipeline corra, acá van a aparecer las propuestas del día, de mayor a menor confianza.</li>';
      return;
    }
    const esHoy = dia.fecha === Calendario.hoyEnNuevaYork(ahora());
    $("hoy-titulo").textContent = esHoy ? `Propuestas para hoy, ${fechaLarga(dia.fecha)}` : `Últimas propuestas: rueda del ${fechaLarga(dia.fecha)}`;
    const abierta = ahora().getTime() < Date.parse(dia.aperturaEn);
    const sello = D.sellos ? (D.sellos.problemas === null ? "" : D.sellos.problemas.length ? " · cadena de sellos rota" : ` · cadena de ${D.sellos.archivos} ${D.sellos.archivos === 1 ? "archivo" : "archivos"} verificada`) : "";
    $("hoy-meta").textContent = `Generadas a las ${hora(dia.generadaEn)} (tu hora) con ${dia.modelo === "ejemplo" ? "datos de ejemplo" : dia.modeloQueRespondio || dia.modelo}. Horizonte: de la apertura de esta rueda al cierre del ${fechaLarga(dia.salidaEn.slice(0, 10))}. ${abierta ? `Podés decidir hasta las ${hora(dia.aperturaEn)}.` : "El mercado ya abrió para esta rueda."}${sello}`;
    const props = Bitacora.ranking(lista.filter((p) => p.fecha === dia.fecha));
    $("propuestas").innerHTML = props.map((p, i) => tarjeta(p, i + 1, rs)).join("");
  }

  // ---- Índices -------------------------------------------------------------------
  const RANGOS = { atencion: [0, 100, 50], tono: [-100, 100, 0], riesgo: [0, 100, 50], momento: [-100, 100, 0] };

  function celda(dia, previo, k) {
    if (!dia) return "—";
    const v = dia[k] ? dia[k].valor : null;
    if (v === null || v === undefined) {
      const falta = k === "atencion" && dia.atencion && dia.atencion.falta ? `faltan ${dia.atencion.falta} días de historia` : "pocos artículos relevantes";
      return `<span class="nulo" title="${falta}">—</span><span class="visualmente-oculto"> (${falta})</span>`;
    }
    const c = Indices.cambios(dia, previo)[k].cambio;
    const valor = k === "tono" || k === "momento" ? conSigno(v) : num(v, 1);
    return `${valor}${c === null ? "" : ` <em class="delta">(${conSigno(c)})</em>`}`;
  }

  function indices() {
    const activos = D.watchlist.activos;
    if (!activos.length) {
      $("tabla-indices").tBodies[0].innerHTML = "";
      $("indices-meta").textContent = "Sin datos.";
      return;
    }
    const filas = activos.map((a) => {
      const h = D.indices[a.ticker];
      const dias = h ? h.dias : [];
      const d = dias[dias.length - 1];
      const p = dias[dias.length - 2];
      return `<tr><th scope="row"><button type="button" class="enlace" data-activo="${esc(a.ticker)}">${esc(a.ticker)}</button> <span class="medio">${esc(a.nombre)}</span></th>${["atencion", "tono", "riesgo", "momento"].map((k) => `<td data-label="${ETIQUETAS[k]}">${celda(d, p, k)}</td>`).join("")}<td data-label="Artículos">${d ? num(d.conteo) : "—"}</td></tr>`;
    });
    $("tabla-indices").tBodies[0].innerHTML = filas.join("");
    const ultimo = activos.map((a) => D.indices[a.ticker]).filter(Boolean).map((h) => h.dias[h.dias.length - 1]).filter(Boolean)[0];
    $("indices-meta").textContent = ultimo ? `Última rueda: ${fechaLarga(ultimo.fecha)}. Entre paréntesis, el cambio contra la rueda anterior. Tocá un activo para ver su historia. Fuente: GDELT.` : "Todavía no hay índices: aparecen después de la primera corrida.";
    const sel = $("activo");
    if (!sel.options.length) sel.innerHTML = activos.map((a) => `<option value="${esc(a.ticker)}">${esc(a.ticker)} · ${esc(a.nombre)}</option>`).join("");
    historia(sel.value || activos[0].ticker);
  }

  function historia(ticker) {
    const h = D.indices[ticker];
    const dias = h ? h.dias.slice(-60) : [];
    const cont = $("graficos-indices");
    cont.innerHTML = "";
    // Primero las cuatro cajas y después los gráficos: cada uno se dibuja con el ancho final de su caja.
    const cajas = Indices.DEFINICIONES.map(() => {
      const caja = document.createElement("figure");
      caja.className = "grafico panel";
      cont.appendChild(caja);
      return caja;
    });
    Indices.DEFINICIONES.forEach((d, i) => {
      const [min, max, ref] = RANGOS[d.clave];
      Graficos.serie(cajas[i], { titulo: d.nombre, puntos: dias.map((x) => ({ fecha: x.fecha, valor: x[d.clave] ? x[d.clave].valor : null })), min, max, referencia: ref });
    });
    const articulo = (a, marca) => `<li><span class="marca-tono" aria-hidden="true">${marca}</span> ${enlace(a.url) ? `<a href="${enlace(a.url)}">${esc(a.titulo)}</a>` : esc(a.titulo)} <span class="medio">${esc(a.medio)}${a.idioma && a.idioma !== "eng" && a.idioma !== "spa" ? ` · ${esc(a.idioma)}` : ""}</span></li>`;
    $("dias").innerHTML = dias.length ? [...dias].reverse().map((d, i, xs) => {
      const previo = xs[i + 1];
      const m = Indices.movieron(d);
      const resumen = ["atencion", "tono", "riesgo", "momento"].map((k) => `${ETIQUETAS[k]} ${celda(d, previo, k)}`).join(" · ");
      const tono = m.tono.map((a) => articulo(a, a.tono === "positivo" ? "▲" : "▼")).join("");
      const riesgo = m.riesgo.map((a) => articulo(a, "⚠")).join("");
      const at = d.atencion;
      const v = d.ventana && (d.ventana.en || d.ventana.traduccion);
      const horas = v ? Math.round((Date.parse(v.hasta) - Date.parse(v.desde)) / 3.6e6 + 0.25) : 24;
      const atTexto = `${num(d.conteo)} artículos que nombran a la empresa, de ${num(d.total)} en ${horas} horas (${num(d.cuota || 0, 1)} por cada 10.000)${at.base && at.base.n >= Indices.BASE_MINIMA ? `; media de los ${at.base.n} días anteriores: ${num(at.base.media, 1)}` : at.falta ? `; faltan ${at.falta} días de historia para calcular el índice` : ""}.`;
      const destacados = m.atencion.map((a) => articulo(a, "·")).join("");
      return `<details class="dia"><summary><strong>${esc(fechaLarga(d.fecha))}</strong><span>${resumen}</span></summary>
        <div class="dia__cuerpo">
          <p><strong>Atención:</strong> ${atTexto}</p>
          ${destacados ? `<p class="ayuda">Los más relevantes:</p><ul class="noticias">${destacados}</ul>` : ""}
          <p><strong>Lo que movió el Tono y el Momento</strong> (${num(d.tono.positivos || 0)} positivos, ${num(d.tono.negativos || 0)} negativos, de ${num(d.tono.relevantes || 0)} relevantes):</p>
          ${tono ? `<ul class="noticias">${tono}</ul>` : '<p class="ayuda">Ningún artículo positivo ni negativo.</p>'}
          <p><strong>Lo que movió el Riesgo:</strong></p>
          ${riesgo ? `<ul class="noticias">${riesgo}</ul>` : '<p class="ayuda">Ningún artículo marcado como riesgo.</p>'}
        </div></details>`;
    }).join("") : '<p class="ayuda">Sin datos para este activo.</p>';
  }

  // ---- Bitácora ------------------------------------------------------------------
  function bitacora(rs, u) {
    const cal = Bitacora.calibracion(lista);
    Graficos.calibracion($("grafico-calibracion"), cal);
    $("tabla-calibracion").tBodies[0].innerHTML = cal.map((t) => `<tr><td>${t.desde}–${t.hasta}${NB}%</td><td>${num(t.n)}</td><td>${pct(t.confianzaMedia)}</td><td>${pct(t.tasaAcierto)}</td></tr>`).join("");
    const valor = (c) => (c.actual === null || c.actual === undefined ? "—" : c.clave === "brier" ? brier(c.actual) : c.clave === "wilson" ? pct(c.actual, 1) : num(c.actual));
    $("criterios").innerHTML = u.criterios.map((c) => `<li class="${c.ok ? "ok" : "no"}"><span class="criterio__marca" aria-hidden="true">${c.ok ? "✓" : "○"}</span><span><strong>${c.nombre}</strong>: ${valor(c)} <span class="medio">(hace falta ${c.objetivo})</span><span class="visualmente-oculto">${c.ok ? ", cumplido" : ", sin cumplir"}</span></span></li>`).join("");
    const h = rs.humano;
    $("humano").innerHTML = h.decididas
      ? `Decidiste a tiempo sobre ${num(h.decididas)} propuestas cerradas (aprobaste ${num(h.aprobadas)}). Lo que aprobaste rindió en promedio ${pctSigno(h.promAprobadas, 2)}; todo lo que decidiste, ${pctSigno(h.promDecididas, 2)}. Diferencia: <strong>${conSigno(h.valor * 100, 2)}${NB}pp</strong>${h.valor > 0 ? ": tu filtro sumó." : h.valor < 0 ? ": tu filtro restó." : "."} Tu decisión coincidió con el resultado el ${pct(h.coincidencias)} de las veces.${h.tarde ? ` ${num(h.tarde)} decisiones llegaron después de la apertura y no cuentan.` : ""}`
      : "Todavía no hay decisiones tuyas sobre propuestas cerradas. Aprobá o rechazá en «Propuestas de hoy» antes de la apertura.";
    const cerradas = lista.filter((p) => p.resultado).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.confianza - a.confianza);
    $("cerradas-meta").textContent = cerradas.length ? `${num(cerradas.length)} cerradas. El rendimiento es el del activo desde la apertura de la rueda hasta el cierre de la quinta, visto desde la propuesta (positivo si acertó la dirección).` : "Todavía no cerró ninguna propuesta: el horizonte es de 5 ruedas.";
    const decision = (p) => !p.decision ? '<span class="medio">—</span>' : `${p.decision.decision === "aprobada" ? "Aprobada" : "Rechazada"}${p.decisionCuenta ? "" : ' <span class="medio">(tarde)</span>'}`;
    $("tabla-cerradas").tBodies[0].innerHTML = cerradas.slice(0, mostradas).map((p) => {
      const r = Bitacora.rendimiento(p);
      const res = p.resultado.cuenta ? (p.resultado.acierto ? '<span class="res res--ok">✓ Acertó</span>' : '<span class="res res--error">✗ Falló</span>') : `<span class="res">No cuenta</span> <span class="medio">${esc(p.resultado.motivo)}</span>`;
      return `<tr><td data-label="Rueda">${fechaCorta(p.fecha)}</td><td data-label="Activo">${esc(p.activo)}</td><td data-label="Propuesta">${p.direccion === "compra" ? "▲ Compra" : "▼ Venta"}</td><td data-label="Confianza">${p.confianza}${NB}%</td><td data-label="Rendimiento">${pctSigno(r)}</td><td data-label="Resultado">${res}</td><td data-label="Tu decisión">${decision(p)}</td></tr>`;
    }).join("");
    $("ver-mas").hidden = cerradas.length <= mostradas;
  }

  // ---- Método --------------------------------------------------------------------
  function metodo() {
    $("definiciones").innerHTML = Indices.DEFINICIONES.map((d) => `<section class="definicion"><h3>${d.nombre} <span class="chip">${esc(d.escala)}</span></h3><p><strong>Qué mide.</strong> ${esc(d.mide)}</p><p><strong>Cómo se calcula.</strong> ${esc(d.calculo)}</p><p><strong>Qué lo mueve.</strong> ${esc(d.mueve)}</p></section>`).join("");
    const U = Bitacora.UMBRAL;
    $("umbral-explicado").innerHTML = [
      `<strong>${U.cerradas} propuestas cerradas o más, en ${U.sesiones} ruedas distintas o más</strong> (unos tres meses). Con 10 activos por día se llega rápido a las ${U.cerradas}; las ${U.sesiones} ruedas evitan que todo dependa de unas pocas semanas de mercado.`,
      `<strong>Brier de ${num(U.brierMax, 2)} o menos.</strong> Decir siempre 50 % da ${num(Bitacora.BRIER_AZAR, 2)}: hace falta una ventaja que se note, no un empate con la moneda.`,
      "<strong>Piso del intervalo de aciertos por encima de 50 %</strong> (intervalo de Wilson al 95 %), para que la tasa no sea suerte.",
      "Es una condición necesaria, no suficiente: las propuestas de días seguidos se superponen y los activos se mueven juntos, así que el intervalo real es más ancho que el calculado. Es una vara propia, no una regla del mercado.",
    ].map((x) => `<li>${x}</li>`).join("");
    const mes = new Date().toISOString().slice(0, 7);
    const medido = Costos.delMes(D.costos.corridas, mes);
    const total = D.costos.corridas.reduce((a, c) => a + (c.dolares || 0), 0);
    $("costos-medidos").innerHTML = D.costos.corridas.length
      ? `<strong>Medido:</strong> este mes, ${num(medido.corridas)} ${medido.corridas === 1 ? "corrida" : "corridas"} por US$${NB}${num(medido.dolares, 2)}; en total, US$${NB}${num(total, 2)} en ${num(D.costos.corridas.length)} corridas (tokens informados por la API × precios publicados).`
      : "Todavía no hay corridas con la API: los costos medidos aparecen acá después de la primera.";
    const filas = Object.entries(Costos.PRECIOS).map(([id, p]) => {
      const bajo = Costos.estimar({ entrada: 21000, salida: 9100 }, id);
      const alto = Costos.estimar({ entrada: 21000, salida: 28500 }, id);
      const rango = (a, b, d) => `US$${NB}${num(a, d)} a ${num(b, d)}`;
      return `<tr><th scope="row">${p.nombre}</th><td>${rango(bajo.porRueda, alto.porRueda, 3)}</td><td>${rango(bajo.porMes, alto.porMes, 2)}</td></tr>`;
    });
    $("tabla-costos").tBodies[0].innerHTML = filas.join("");
  }

  // ---- Pestañas ------------------------------------------------------------------
  const TABS = ["hoy", "indices", "bitacora", "metodo"];
  function elegir(nombre, foco) {
    for (const t of TABS) {
      const tab = $(`tab-${t}`);
      const sel = t === nombre;
      tab.setAttribute("aria-selected", String(sel));
      tab.tabIndex = sel ? 0 : -1;
      $(`p-${t}`).hidden = !sel;
    }
    if (foco) $(`tab-${nombre}`).focus();
    if (nombre === "indices" && D) historia($("activo").value);
    if (nombre === "bitacora" && D) Graficos.calibracion($("grafico-calibracion"), Bitacora.calibracion(lista));
    try { history.replaceState(null, "", `${location.search}#${nombre}`); } catch { /* file:// */ }
  }
  TABS.forEach((t, i) => {
    $(`tab-${t}`).addEventListener("click", () => elegir(t));
    $(`tab-${t}`).addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (d) { e.preventDefault(); elegir(TABS[(i + d + TABS.length) % TABS.length], true); }
      if (e.key === "Home") { e.preventDefault(); elegir(TABS[0], true); }
      if (e.key === "End") { e.preventDefault(); elegir(TABS[TABS.length - 1], true); }
    });
  });

  // ---- Todo junto ----------------------------------------------------------------
  function pintar() {
    lista = Bitacora.unir(D.dias, D.resultados, D.decisiones);
    const rs = Bitacora.resumen(lista);
    const u = Bitacora.umbral(rs);
    avisos();
    tablero(rs, u);
    hoy(rs);
    indices();
    bitacora(rs, u);
    metodo();
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-decidir]");
    if (b) {
      const id = b.dataset.id;
      const p = lista.find((x) => x.id === id);
      if (!p || !Bitacora.abiertaParaDecidir(p, ahora())) return;
      const actual = D.decisiones[id];
      if (actual && actual.decision === b.dataset.decidir) delete D.decisiones[id];
      else D.decisiones[id] = { decision: b.dataset.decidir, en: ahora().toISOString() };
      guardarDecisiones();
      pintar();
      const nuevo = document.querySelector(`[data-decidir="${b.dataset.decidir}"][data-id="${CSS.escape(id)}"]`);
      if (nuevo) nuevo.focus();
      return;
    }
    const a = e.target.closest("[data-activo]");
    if (a) {
      $("activo").value = a.dataset.activo;
      historia(a.dataset.activo);
      $("graficos-indices").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
  $("activo").addEventListener("change", (e) => historia(e.target.value));
  $("ir-hoy").addEventListener("click", () => {
    elegir("hoy");
    $("tab-hoy").scrollIntoView({ behavior: "smooth", block: "start" });
    $("tab-hoy").focus({ preventScroll: true });
  });
  if (EJEMPLO) {
    $("ir-ejemplo").textContent = "Ver los datos reales";
    $("ir-ejemplo").href = "./";
  }
  $("ver-mas").addEventListener("click", () => { mostradas += POR_PAGINA; pintar(); });
  $("exportar").addEventListener("click", () => bajar(`decisiones-${new Date().toISOString().slice(0, 10)}.json`, { formato: "narrative-trading-journal/decisiones@1", exportadoEn: new Date().toISOString(), decisiones: D.decisiones }));
  $("importar").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const x = JSON.parse(await f.text());
      const nuevas = Object.entries((x && x.decisiones) || {}).filter(([id, d]) => !D.decisiones[id] && d && ["aprobada", "rechazada"].includes(d.decision) && !isNaN(Date.parse(d.en)));
      for (const [id, d] of nuevas) D.decisiones[id] = { decision: d.decision, en: d.en };
      guardarDecisiones();
      pintar();
      $("cerradas-meta").textContent = `Se importaron ${nuevas.length} decisiones. ` + $("cerradas-meta").textContent;
    } catch {
      $("cerradas-meta").textContent = "Ese archivo no es una exportación de decisiones.";
    }
  });
  let ancho = window.innerWidth;
  window.addEventListener("resize", () => {
    if (!D || Math.abs(window.innerWidth - ancho) < 40) return;
    ancho = window.innerWidth;
    if (!$("p-indices").hidden) historia($("activo").value);
    if (!$("p-bitacora").hidden) Graficos.calibracion($("grafico-calibracion"), Bitacora.calibracion(lista));
  });

  function avisoVersionVieja() {
    let viejo = null;
    try { viejo = localStorage.getItem(CLAVE_VIEJA); } catch { /* nada */ }
    if (!viejo || EJEMPLO) return;
    const p = document.createElement("p");
    p.className = "aviso";
    p.innerHTML = 'En este navegador quedaron propuestas cargadas a mano con la versión anterior de la bitácora. Ya no se usan, pero son tuyas: <button type="button" class="btn btn--fantasma" id="bajar-viejo">bajarlas en JSON</button>';
    $("p-bitacora").prepend(p);
    $("bajar-viejo").addEventListener("click", () => bajar("bitacora-version-anterior.json", JSON.parse(viejo)));
  }

  (async () => {
    try {
      D = await cargar();
    } catch (e) {
      D = { ejemplo: false, watchlist: { activos: [] }, estado: { propuestas: [] }, dias: [], resultados: [], decisiones: {}, indices: {}, costos: { corridas: [] }, sellos: null };
      pintar();
      avisos(e);
      return;
    }
    if (!D.watchlist.activos.length) D.watchlist.activos = [];
    pintar();
    avisoVersionVieja();
    const inicial = location.hash.slice(1);
    if (TABS.includes(inicial)) elegir(inicial);
  })();
})();
