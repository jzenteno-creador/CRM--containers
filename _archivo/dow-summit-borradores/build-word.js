const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, LevelFormat,
} = require("docx");

const SRC = "/home/jzenteno/projects/Crm-containers/docs/dow-summit-2026/revision.html";
const OUT = "/home/jzenteno/projects/Crm-containers/Dow-Summit-2026-Formulario-para-completar.docx";

const ACCENT = "B8460F";
const GRIS = "6B6B6B";
const GRIS_OSC = "3D3D3D";
const ALERTA = "9A3412";
const ANCHO = 9360;

const html = fs.readFileSync(SRC, "utf8");
const ITEMS = eval(html.match(/const ITEMS = \[[\s\S]*?\n\];/)[0].replace("const ITEMS =", ""));
const PREGUNTAS = ITEMS.filter(i => i.tipo !== "riesgos");

// Un TextRun no admite \n: cada linea logica es su propio Paragraph.
const lineas = txt => txt.split(/\n\s*\n/).flatMap(bloque =>
  bloque.split("\n").map(l => l.trim()).filter(Boolean));

const parrafosDe = (txt, opts = {}) =>
  lineas(txt).map(l => new Paragraph({
    spacing: { after: opts.after ?? 100 },
    indent: opts.indent,
    children: [new TextRun({ text: l, size: opts.size ?? 20, color: opts.color ?? GRIS_OSC, italics: opts.italics })],
  }));

// Recuadro en blanco para escribir la respuesta a mano.
const recuadro = (renglones, etiqueta = "RESPUESTA") => {
  const borde = { style: BorderStyle.SINGLE, size: 4, color: "B0B0B0" };
  const vacios = Array.from({ length: renglones }, () =>
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "", size: 22 })] }));
  return new Table({
    columnWidths: [ANCHO],
    margins: { top: 120, bottom: 120, left: 180, right: 180 },
    rows: [new TableRow({
      cantSplit: true,
      children: [new TableCell({
        borders: { top: borde, bottom: borde, left: borde, right: borde },
        width: { size: ANCHO, type: WidthType.DXA },
        shading: { fill: "FCFCFC", type: ShadingType.CLEAR },
        children: [
          new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: etiqueta, size: 16, bold: true, color: GRIS, characterSpacing: 20 })],
          }),
          ...vacios,
        ],
      })],
    })],
  });
};

const rotulo = txt => new Paragraph({
  spacing: { before: 160, after: 80 },
  children: [new TextRun({ text: txt, size: 17, bold: true, color: ACCENT, characterSpacing: 16 })],
});

const hijos = [];

/* ── Portada ───────────────────────────────────────────────── */
hijos.push(
  new Paragraph({ spacing: { before: 1400, after: 0 }, children: [
    new TextRun({ text: "DOW SUPPLIER PRODUCTIVITY SUMMIT 2026", size: 20, bold: true, color: ACCENT, characterSpacing: 30 })]}),
  new Paragraph({ spacing: { before: 200, after: 100 }, children: [
    new TextRun({ text: "Submissão de Ideias e Projetos", size: 48, bold: true })]}),
  new Paragraph({ spacing: { after: 400 }, children: [
    new TextRun({ text: "Formulario para completar — las 42 preguntas, en orden", size: 26, color: GRIS })]}),
);

const intro = [
  ["Cómo está armado", "Cada pregunta trae su texto en español y, debajo, el original en portugués tal como figura en el formulario. Después viene un recuadro en blanco para que escribas tu respuesta, y abajo de todo las sugerencias que ya habíamos redactado, para que las uses de base."],
  ["Las de opción", "Las alternativas van con casilla vacía para que marques la que quieras. La sugerencia indica cuál habíamos elegido y por qué."],
  ["Las de texto libre", "Hay tres versiones escritas de cada respuesta —TÉCNICA, EJECUTIVA y COMERCIAL—. Están las tres abajo del recuadro: elegí una, mezclalas o escribí la tuya."],
  ["Idioma", "Las sugerencias están en español. El formulario se completa en portugués, así que hay que traducir el texto final antes de cargarlo."],
  ["Falta decidir", "Cuatro preguntas están marcadas como pendientes: la 8 y la 9 esperan un dato tuyo; la 13 y la 31 son decisiones. Están señaladas en el cuerpo del documento."],
];
intro.forEach(([t, d]) => {
  hijos.push(new Paragraph({ spacing: { before: 160, after: 40 }, children: [
    new TextRun({ text: t, size: 21, bold: true })]}));
  hijos.push(new Paragraph({ spacing: { after: 80 }, children: [
    new TextRun({ text: d, size: 20, color: GRIS_OSC })]}));
});

hijos.push(new Paragraph({ spacing: { before: 500 }, pageBreakBefore: false, children: [
  new TextRun({ text: "SSB International SA · Jonathan Ezequiel Zenteno Parrado · jzenteno@ssbint.com", size: 18, color: GRIS })]}));

/* ── Preguntas ─────────────────────────────────────────────── */
let seccion = null;
PREGUNTAS.forEach((it, i) => {
  const nuevaSeccion = it.sec !== seccion;
  if (nuevaSeccion) {
    seccion = it.sec;
    hijos.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      children: [new TextRun({ text: seccion })],
    }));
  }

  // Enunciado. keepNext evita que quede huerfano del recuadro al pie de pagina.
  hijos.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    keepNext: true,
    keepLines: true,
    spacing: nuevaSeccion ? { before: 120, after: 60 } : { before: 520, after: 60 },
    border: nuevaSeccion ? undefined
      : { top: { style: BorderStyle.SINGLE, size: 4, color: "D8D8D8", space: 14 } },
    children: [new TextRun({ text: `${it.n}. ${it.q}` })],
  }));

  hijos.push(new Paragraph({
    keepNext: true,
    spacing: { after: 120 },
    children: [new TextRun({ text: it.qpt, size: 19, italics: true, color: GRIS })],
  }));

  if (it.estado !== "ok") {
    const txt = it.estado === "falta"
      ? "PENDIENTE — falta un dato tuyo para poder enviar"
      : "A DECIDIR — hay una definición abierta acá";
    hijos.push(new Paragraph({
      keepNext: true,
      spacing: { after: 120 },
      children: [new TextRun({ text: `⚠  ${txt}`, size: 19, bold: true, color: ALERTA })],
    }));
  }

  if (it.busca) {
    hijos.push(new Paragraph({
      keepNext: true,
      spacing: { after: 60 },
      children: [
        new TextRun({ text: "Qué busca: ", size: 19, bold: true, color: GRIS }),
        new TextRun({ text: it.busca, size: 19, italics: true, color: GRIS }),
      ],
    }));
  }

  if (it.limite) {
    hijos.push(new Paragraph({
      keepNext: true,
      spacing: { after: 60 },
      children: [new TextRun({ text: `Límite del formulario: ${it.limite} caracteres.`, size: 19, italics: true, color: ALERTA })],
    }));
  }

  /* Espacio de respuesta */
  if (it.tipo === "opcion") {
    hijos.push(new Paragraph({
      keepNext: true,
      spacing: { before: 60, after: 100 },
      children: [new TextRun({
        text: it.multi ? "RESPUESTA — marcá las que correspondan (admite varias)" : "RESPUESTA — marcá una",
        size: 16, bold: true, color: GRIS, characterSpacing: 20 })],
    }));
    it.opciones.forEach(o => {
      hijos.push(new Paragraph({
        spacing: { after: 40 },
        indent: { left: 360 },
        children: [new TextRun({ text: `☐   ${o.t}`, size: 21 })],
      }));
    });
  } else {
    hijos.push(recuadro(it.tipo === "texto" ? 9 : 2));
  }

  /* Sugerencias */
  if (it.tipo === "texto") {
    rotuloYVariantes(it);
  } else if (it.tipo === "opcion") {
    const marcadas = it.opciones.filter(o => o.sel).map(o => o.t);
    hijos.push(rotulo("SUGERENCIA"));
    hijos.push(new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: marcadas.length ? "Habíamos marcado: " : "Sin marcar todavía. ", size: 20, bold: true, color: GRIS_OSC }),
        new TextRun({ text: marcadas.join("  ·  "), size: 20, bold: true, color: GRIS_OSC }),
      ],
    }));
    if (it.porQue) hijos.push(...parrafosDe(`Por qué: ${it.porQue}`, { size: 19, color: GRIS }));
    if (it.alt) hijos.push(...parrafosDe(`A tener en cuenta: ${it.alt}`, { size: 19, color: GRIS, italics: true }));
  } else {
    hijos.push(rotulo("SUGERENCIA"));
    hijos.push(new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({
        text: it.valor && it.valor.trim() ? it.valor : "— (queda en blanco a propósito, ver la nota)",
        size: 21, bold: !!(it.valor && it.valor.trim()) })],
    }));
    if (it.nota) hijos.push(...parrafosDe(it.nota, { size: 19, color: GRIS }));
  }
});

function rotuloYVariantes(it) {
  hijos.push(rotulo("SUGERENCIAS — DE LO QUE YA ESCRIBIMOS"));
  hijos.push(new Paragraph({
    spacing: { after: 140 },
    children: [new TextRun({
      text: "Tres versiones de la misma respuesta. Elegí una, combinalas o usalas de base.",
      size: 19, italics: true, color: GRIS })],
  }));
  it.v.forEach(v => {
    hijos.push(new Paragraph({
      spacing: { before: 160, after: 60 },
      children: [
        new TextRun({ text: v.tag, size: 19, bold: true, color: ACCENT, characterSpacing: 14 }),
        new TextRun({ text: `   ${v.para}`, size: 18, italics: true, color: GRIS }),
      ],
    }));
    hijos.push(...parrafosDe(v.txt, { size: 20, indent: { left: 360 } }));
  });
}

/* ── Documento ─────────────────────────────────────────────── */
const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 21 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, color: ACCENT, font: "Arial" },
        paragraph: { spacing: { before: 240, after: 300 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 25, bold: true, color: "1A1A1A", font: "Arial" },
        paragraph: { spacing: { before: 240, after: 60 }, outlineLevel: 1 } },
    ],
  },
  sections: [{
    properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    headers: { default: new Header({ children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: "Dow Supplier Productivity Summit 2026 — Formulario", size: 16, color: GRIS })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: "Página ", size: 16, color: GRIS }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GRIS }),
        new TextRun({ text: " de ", size: 16, color: GRIS }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: GRIS }),
      ] })] }) },
    children: hijos,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log(`ok -> ${OUT} (${(buf.length / 1024).toFixed(0)} KB, ${PREGUNTAS.length} preguntas)`);
});
