// Markdown (design system M0 — ayuda M10, preview del editor M8): renderer de un
// subset seguro POR CONSTRUCCIÓN — construye elementos React, jamás usa
// dangerouslySetInnerHTML; el HTML crudo del contenido se muestra como texto.
// Subset: # ## ###, **negrita**, *itálica*, `código`, ``` bloques, listas - / 1.,
// > cita, [link](url) (solo https/http/mailto/ruta/#), --- separador, párrafos.

import { Fragment } from "react";

const URL_SEGURA = /^(https?:\/\/|mailto:|\/|#)/i;

/* ---- inline: `código` → **negrita** → *itálica* → [link](url) ---- */
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  // La regex se crea POR LLAMADA: renderInline recurre (negrita/itálica/link) y una
  // /g compartida a nivel módulo corrompe lastIndex entre niveles → loop infinito
  // (OOM real detectado al prerender /design).
  const inlineRe = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)\s]+\))/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = inlineRe.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${k++}`;
    if (tok.startsWith("`")) {
      out.push(
        <code
          key={key}
          className="mono"
          style={{
            fontSize: "0.92em",
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: 4,
            padding: "1px 5px",
          }}
        >
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith("**")) {
      out.push(
        <strong key={key} style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>
          {renderInline(tok.slice(2, -2), key)}
        </strong>,
      );
    } else if (tok.startsWith("*")) {
      out.push(<em key={key}>{renderInline(tok.slice(1, -1), key)}</em>);
    } else {
      const lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok);
      if (lm && URL_SEGURA.test(lm[2])) {
        const externo = /^https?:\/\//i.test(lm[2]);
        out.push(
          <a key={key} href={lm[2]} target={externo ? "_blank" : undefined} rel={externo ? "noopener noreferrer" : undefined}>
            {renderInline(lm[1], key)}
          </a>,
        );
      } else {
        out.push(tok); // URL no permitida → texto plano
      }
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/* ---- bloques ---- */
type Bloque =
  | { tipo: "h"; nivel: 1 | 2 | 3; texto: string }
  | { tipo: "p"; texto: string }
  | { tipo: "ul"; items: string[] }
  | { tipo: "ol"; items: string[] }
  | { tipo: "quote"; lineas: string[] }
  | { tipo: "code"; codigo: string }
  | { tipo: "hr" };

function parsearBloques(source: string): Bloque[] {
  const lineas = source.replace(/\r\n?/g, "\n").split("\n");
  const bloques: Bloque[] = [];
  let i = 0;
  while (i < lineas.length) {
    const linea = lineas[i];
    if (linea.trim() === "") {
      i++;
      continue;
    }
    // bloque de código
    if (linea.trimStart().startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lineas.length && !lineas[i].trimStart().startsWith("```")) {
        buf.push(lineas[i]);
        i++;
      }
      i++; // consume el cierre
      bloques.push({ tipo: "code", codigo: buf.join("\n") });
      continue;
    }
    // heading
    const h = /^(#{1,3})\s+(.*)$/.exec(linea);
    if (h) {
      bloques.push({ tipo: "h", nivel: h[1].length as 1 | 2 | 3, texto: h[2] });
      i++;
      continue;
    }
    // hr
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(linea)) {
      bloques.push({ tipo: "hr" });
      i++;
      continue;
    }
    // lista sin orden
    if (/^\s*[-*]\s+/.test(linea)) {
      const items: string[] = [];
      while (i < lineas.length && /^\s*[-*]\s+/.test(lineas[i])) {
        items.push(lineas[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      bloques.push({ tipo: "ul", items });
      continue;
    }
    // lista ordenada
    if (/^\s*\d+[.)]\s+/.test(linea)) {
      const items: string[] = [];
      while (i < lineas.length && /^\s*\d+[.)]\s+/.test(lineas[i])) {
        items.push(lineas[i].replace(/^\s*\d+[.)]\s+/, ""));
        i++;
      }
      bloques.push({ tipo: "ol", items });
      continue;
    }
    // cita
    if (/^\s*>\s?/.test(linea)) {
      const buf: string[] = [];
      while (i < lineas.length && /^\s*>\s?/.test(lineas[i])) {
        buf.push(lineas[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      bloques.push({ tipo: "quote", lineas: buf });
      continue;
    }
    // párrafo: acumula hasta línea vacía o inicio de otro bloque
    const buf: string[] = [linea];
    i++;
    while (
      i < lineas.length &&
      lineas[i].trim() !== "" &&
      !/^(#{1,3})\s+/.test(lineas[i]) &&
      !/^\s*[-*]\s+/.test(lineas[i]) &&
      !/^\s*\d+[.)]\s+/.test(lineas[i]) &&
      !/^\s*>\s?/.test(lineas[i]) &&
      !lineas[i].trimStart().startsWith("```")
    ) {
      buf.push(lineas[i]);
      i++;
    }
    bloques.push({ tipo: "p", texto: buf.join(" ") });
  }
  return bloques;
}

export function Markdown({ source, className = "" }: { source: string; className?: string }) {
  const bloques = parsearBloques(source);
  return (
    <div className={`fd-md ${className}`}>
      {bloques.map((b, i) => {
        const key = `b${i}`;
        switch (b.tipo) {
          case "h": {
            const Tag = (`h${b.nivel + 1}` as unknown) as "h2" | "h3" | "h4"; // h1 md → h2 html (jerarquía de página)
            return <Tag key={key}>{renderInline(b.texto, key)}</Tag>;
          }
          case "p":
            return <p key={key}>{renderInline(b.texto, key)}</p>;
          case "ul":
            return (
              <ul key={key}>
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it, `${key}-${j}`)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={key}>
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it, `${key}-${j}`)}</li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote key={key}>
                {b.lineas.map((l, j) => (
                  <Fragment key={j}>
                    {renderInline(l, `${key}-${j}`)}
                    {j < b.lineas.length - 1 && <br />}
                  </Fragment>
                ))}
              </blockquote>
            );
          case "code":
            return (
              <pre key={key} className="mono">
                <code>{b.codigo}</code>
              </pre>
            );
          case "hr":
            return <hr key={key} />;
        }
      })}
    </div>
  );
}
