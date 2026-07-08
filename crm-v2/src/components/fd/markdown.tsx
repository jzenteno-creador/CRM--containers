// Markdown (design system M0 — ayuda M10, preview del editor M8): renderer de un
// subset seguro POR CONSTRUCCIÓN — construye elementos React, jamás usa
// dangerouslySetInnerHTML; el HTML crudo del contenido se muestra como texto.
// Subset: # ## ###, **negrita**, *itálica*, `código`, ``` bloques, listas - / 1.,
// > cita, [link](url) (solo https/http/mailto/ruta/#), --- separador, párrafos.

import { Fragment } from "react";

const SAFE_URL = /^(https?:\/\/|mailto:|\/|#)/i;

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
      if (lm && SAFE_URL.test(lm[2])) {
        const isExternal = /^https?:\/\//i.test(lm[2]);
        out.push(
          <a key={key} href={lm[2]} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noopener noreferrer" : undefined}>
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

/* ---- blocks ---- */
type Block =
  | { type: "h"; level: 1 | 2 | 3; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; lines: string[] }
  | { type: "code"; code: string }
  | { type: "hr" };

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    // bloque de código
    if (line.trimStart().startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++; // consume el cierre
      blocks.push({ type: "code", code: buf.join("\n") });
      continue;
    }
    // heading
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push({ type: "h", level: h[1].length as 1 | 2 | 3, text: h[2] });
      i++;
      continue;
    }
    // hr
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }
    // lista sin orden
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    // lista ordenada
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }
    // cita
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", lines: buf });
      continue;
    }
    // párrafo: acumula hasta línea vacía o inicio de otro bloque
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !lines[i].trimStart().startsWith("```")
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ type: "p", text: buf.join(" ") });
  }
  return blocks;
}

export function Markdown({ source, className = "" }: { source: string; className?: string }) {
  const blocks = parseBlocks(source);
  return (
    <div className={`fd-md ${className}`}>
      {blocks.map((b, i) => {
        const key = `b${i}`;
        switch (b.type) {
          case "h": {
            const Tag = (`h${b.level + 1}` as unknown) as "h2" | "h3" | "h4"; // h1 md → h2 html (jerarquía de página)
            return <Tag key={key}>{renderInline(b.text, key)}</Tag>;
          }
          case "p":
            return <p key={key}>{renderInline(b.text, key)}</p>;
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
                {b.lines.map((l, j) => (
                  <Fragment key={j}>
                    {renderInline(l, `${key}-${j}`)}
                    {j < b.lines.length - 1 && <br />}
                  </Fragment>
                ))}
              </blockquote>
            );
          case "code":
            return (
              <pre key={key} className="mono">
                <code>{b.code}</code>
              </pre>
            );
          case "hr":
            return <hr key={key} />;
        }
      })}
    </div>
  );
}
