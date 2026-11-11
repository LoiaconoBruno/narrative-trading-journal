#!/usr/bin/env python3
"""Genera guia.html a partir de docs/guia.md, sin dependencias.

Uso, desde la raíz del proyecto:  python3 tools/guia.py

Entiende el Markdown que usa la guía: títulos (# a ####), párrafos, listas
con viñetas y numeradas, tablas, bloques de código, fórmulas entre $$ y,
dentro del texto, `código`, **negrita**, *cursiva*, [enlaces](url) y
direcciones http(s) sueltas.
"""
import html
import re
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ENTRADA = RAIZ / "docs" / "guia.md"
SALIDA = RAIZ / "guia.html"
PALABRAS_POR_PAGINA = 390

ESTILO = """:root{--bg:#f7f6f2;--surface:#fff;--text:#1d1c1a;--muted:#5f5b53;--border:#dcd8ce;--accent:#2f5bd3;--code:#efede6;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#141416;--surface:#1d1d21;--text:#ecebe7;--muted:#a3a09a;--border:#34343a;--accent:#8fb0ff;--code:#26262b;color-scheme:dark}}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font:17px/1.65 Georgia,"Iowan Old Style","Times New Roman",serif}
.wrap{max-width:780px;margin:0 auto;padding:24px 16px 80px}
.top{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:14px;display:flex;gap:12px;flex-wrap:wrap;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:10px}
a{color:var(--accent);overflow-wrap:anywhere}a:focus-visible{outline:3px solid var(--accent);outline-offset:2px;border-radius:2px}
h1{font-size:2rem;line-height:1.2;margin:28px 0 6px}
.sub{color:var(--muted);font-family:system-ui,sans-serif;font-size:15px;margin:0 0 20px}
h2{font-size:1.45rem;margin:48px 0 10px;padding-top:12px;border-top:1px solid var(--border)}h3{font-size:1.15rem;margin:30px 0 8px}h4{font-size:1rem;margin:22px 0 6px}
nav.toc{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 18px;font-family:system-ui,sans-serif;font-size:14.5px}
nav.toc ol{margin:6px 0;padding-left:4px;list-style:none}nav.toc .l3{padding-left:14px;list-style:none;font-size:13.5px}
code{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:.86em;background:var(--code);padding:1px 5px;border-radius:4px;overflow-wrap:anywhere}
pre{background:var(--code);padding:12px 14px;border-radius:8px;overflow-x:auto}pre code{background:none;padding:0;overflow-wrap:normal}
.eq{font-family:"Cambria Math","STIX Two Math","Latin Modern Math",Georgia,serif;font-size:1.08rem;text-align:center;margin:16px 0;padding:10px;background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow-x:auto}
blockquote{margin:16px 0;padding:4px 16px;border-left:3px solid var(--accent);color:var(--muted)}
.tw{overflow-x:auto}table{border-collapse:collapse;width:100%;font-family:system-ui,sans-serif;font-size:14.5px;margin:14px 0}
th,td{border:1px solid var(--border);padding:6px 9px;text-align:left;vertical-align:top}th{background:var(--surface)}
.meta{font-family:system-ui,sans-serif;font-size:13px;color:var(--muted)}
@media print{.top,nav.toc{display:none}body{background:#fff;color:#000}}"""


def slug(texto):
    t = unicodedata.normalize("NFD", texto).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def en_linea(texto):
    """Formato dentro de una línea. El código se aparta primero para no tocar su contenido."""
    guardados = []

    def apartar(fragmento):
        guardados.append(fragmento)
        return f"\x00{len(guardados) - 1}\x00"

    t = re.sub(r"`([^`]+)`", lambda m: apartar(f"<code>{html.escape(m.group(1), quote=False)}</code>"), texto)
    t = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)",
               lambda m: apartar(f'<a href="{html.escape(m.group(2))}">{html.escape(m.group(1), quote=False)}</a>'), t)
    def url_suelta(m):
        # Los DOI pueden tener paréntesis, como 10.1016/S0019-9958(60)90287-4: se corta solo
        # la puntuación final y un ")" de cierre que no tenga su "(" dentro de la URL.
        url, cola = m.group(0), ""
        while url and (url[-1] in ".,;:" or (url[-1] == ")" and url.count("(") < url.count(")"))):
            url, cola = url[:-1], url[-1] + cola
        return apartar(f'<a href="{html.escape(url)}">{html.escape(url, quote=False)}</a>') + cola

    t = re.sub(r"https?://[^\s<>]+", url_suelta, t)
    t = html.escape(t, quote=False)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", t)
    return re.sub(r"\x00(\d+)\x00", lambda m: guardados[int(m.group(1))], t)


def celdas(linea):
    return [c.strip() for c in linea.strip().strip("|").split("|")]


def convertir(md):
    lineas = md.split("\n")
    cuerpo, indice, titulo = [], [], ""
    i = 0
    while i < len(lineas):
        l = lineas[i]
        if not l.strip():
            i += 1
            continue
        if l.startswith("```"):
            fin = i + 1
            while not lineas[fin].startswith("```"):
                fin += 1
            codigo = html.escape("\n".join(lineas[i + 1:fin]), quote=False)
            cuerpo.append(f"<pre><code>{codigo}</code></pre>")
            i = fin + 1
            continue
        m = re.match(r"^(#{1,4}) (.+)$", l)
        if m:
            nivel, texto = len(m.group(1)), m.group(2).strip()
            if nivel == 1:
                titulo = texto
            else:
                ident = slug(texto)
                cuerpo.append(f'<h{nivel} id="{ident}">{en_linea(texto)}</h{nivel}>')
                if nivel <= 3:
                    clase = ' class="l3"' if nivel == 3 else ""
                    indice.append(f'<li{clase}><a href="#{ident}">{en_linea(texto)}</a></li>')
            i += 1
            continue
        if l.startswith("$$"):
            cuerpo.append(f'<div class="eq">{html.escape(l.strip().strip("$").strip(), quote=False)}</div>')
            i += 1
            continue
        if l.startswith("|") and i + 1 < len(lineas) and re.match(r"^\|[\s:|-]+\|$", lineas[i + 1].strip()):
            cabecera = "".join(f"<th>{en_linea(c)}</th>" for c in celdas(l))
            filas = []
            i += 2
            while i < len(lineas) and lineas[i].startswith("|"):
                filas.append("<tr>" + "".join(f"<td>{en_linea(c)}</td>" for c in celdas(lineas[i])) + "</tr>")
                i += 1
            cuerpo.append(f'<div class="tw"><table><thead><tr>{cabecera}</tr></thead><tbody>{"".join(filas)}</tbody></table></div>')
            continue
        if l.startswith("> "):
            partes = []
            while i < len(lineas) and lineas[i].startswith("> "):
                partes.append(lineas[i][2:])
                i += 1
            cuerpo.append(f"<blockquote><p>{en_linea(' '.join(partes))}</p></blockquote>")
            continue
        numerada = re.match(r"^(\d+)\. ", l)
        if numerada or l.startswith("- "):
            patron = r"^\d+\. " if numerada else r"^- "
            items = []
            while i < len(lineas) and re.match(patron, lineas[i]):
                texto = re.sub(patron, "", lineas[i])
                i += 1
                sub = []   # sublista: líneas con sangría que empiezan con "- " o "1. "
                while i < len(lineas) and lineas[i].startswith("  ") and lineas[i].strip():
                    hijo = re.match(r"^\s+(?:-|\d+\.) (.*)$", lineas[i])
                    if hijo:
                        sub.append(hijo.group(1))
                    elif sub:
                        sub[-1] += " " + lineas[i].strip()
                    else:
                        texto += " " + lineas[i].strip()
                    i += 1
                anidada = f"<ul>{''.join(f'<li>{en_linea(x)}</li>' for x in sub)}</ul>" if sub else ""
                items.append(f"<li>{en_linea(texto)}{anidada}</li>")
            if numerada:
                inicio = int(numerada.group(1))
                attr = f' start="{inicio}"' if inicio != 1 else ""
                cuerpo.append(f"<ol{attr}>{''.join(items)}</ol>")
            else:
                cuerpo.append(f"<ul>{''.join(items)}</ul>")
            continue
        parrafo = [l.strip()]
        i += 1
        while i < len(lineas) and lineas[i].strip() and not re.match(r"^(#{1,4} |```|\$\$|\||- |\d+\. |> )", lineas[i]):
            parrafo.append(lineas[i].strip())
            i += 1
        cuerpo.append(f"<p>{en_linea(' '.join(parrafo))}</p>")
    return titulo, indice, cuerpo


def contar_palabras(md):
    sin_codigo = re.sub(r"```.*?```", " ", md, flags=re.S)
    return len(re.findall(r"[\wáéíóúüñÁÉÍÓÚÜÑ]+", sin_codigo))


def main():
    md = ENTRADA.read_text(encoding="utf-8")
    titulo, indice, cuerpo = convertir(md)
    palabras = contar_palabras(md)
    paginas = max(1, round(palabras / PALABRAS_POR_PAGINA))
    miles = f"{palabras:,}".replace(",", ".")
    pagina = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(titulo)}</title>
<meta name="description" content="Paper de uso y guía de la idea de Narrative Trading: noticias reales de GDELT, índices narrativos, propuestas de Claude selladas por commit y medición de aciertos, calibración y valor humano.">
<style>
{ESTILO}
</style>
</head>
<body>
<div class="wrap">
<div class="top"><a href="index.html">← Volver a la herramienta</a><span class="meta">{miles} palabras · ~{paginas} páginas</span></div>
<main>
<h1>{html.escape(titulo)}</h1>
<p class="sub">Paper de uso y guía de la idea · Bruno Loiacono · CC BY 4.0</p>
<nav class="toc" aria-label="Índice"><strong>Índice</strong><ol>{"".join(indice)}</ol></nav>
{chr(10).join(cuerpo)}
</main>
</div>
</body>
</html>
"""
    SALIDA.write_text(pagina, encoding="utf-8")
    print(f"{SALIDA.name}: {palabras} palabras, {len(indice)} entradas en el índice")


if __name__ == "__main__":
    main()
