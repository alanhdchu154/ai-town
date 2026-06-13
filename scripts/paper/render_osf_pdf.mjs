#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("../..", import.meta.url).pathname);
const sourcePath = resolve(root, "docs/paper/emotional-residue/manuscript/main.tex");
const outDir = resolve(root, "docs/paper/emotional-residue/results/osf");
const htmlPath = resolve(outDir, "emotional-residue-osf-preprint.html");
const pdfPath = resolve(outDir, "emotional-residue-osf-preprint.pdf");

function htmlEscape(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function inlineTex(value) {
  return htmlEscape(value)
    .replace(/\\emph\{([^{}]+)\}/g, "<em>$1</em>")
    .replace(/\\texttt\{([^{}]+)\}/g, "<code>$1</code>")
    .replace(/\\cite\{([^{}]+)\}/g, "[$1]")
    .replace(/``/g, "&ldquo;")
    .replace(/''/g, "&rdquo;")
    .replace(/---/g, "&mdash;")
    .replace(/--/g, "&ndash;")
    .replace(/\\_/g, "_")
    .replace(/\\&/g, "&amp;")
    .replace(/\\%/g, "%")
    .replace(/\\#/g, "#")
    .replace(/\\\$/g, "$")
    .replace(/\\\{/g, "{")
    .replace(/\\\}/g, "}");
}

function inlineTexInsideHtml(value) {
  return value
    .replace(/\\emph\{([^{}]+)\}/g, "<em>$1</em>")
    .replace(/\\texttt\{([^{}]+)\}/g, "<code>$1</code>")
    .replace(/\\cite\{([^{}]+)\}/g, "[$1]")
    .replace(/``/g, "&ldquo;")
    .replace(/''/g, "&rdquo;")
    .replace(/---/g, "&mdash;")
    .replace(/--/g, "&ndash;")
    .replace(/\\_/g, "_")
    .replace(/\\&/g, "&amp;")
    .replace(/\\%/g, "%")
    .replace(/\\#/g, "#")
    .replace(/\\\$/g, "$")
    .replace(/\\\{/g, "{")
    .replace(/\\\}/g, "}");
}

function plainTex(value) {
  return value
    .replace(/\\emph\{([^{}]+)\}/g, "$1")
    .replace(/\\texttt\{([^{}]+)\}/g, "$1")
    .replace(/\\cite\{([^{}]+)\}/g, "[$1]")
    .replace(/\\_/g, "_")
    .replace(/\\&/g, "&")
    .replace(/\\%/g, "%")
    .replace(/\\#/g, "#")
    .replace(/\\\$/g, "$")
    .replace(/\\\{/g, "{")
    .replace(/\\\}/g, "}")
    .replace(/``/g, '"')
    .replace(/''/g, '"');
}

function extractCommand(source, command) {
  const match = source.match(new RegExp(`\\\\${command}\\{([\\s\\S]*?)\\}`));
  return match ? match[1].trim() : "";
}

function extractEnvironment(source, name) {
  const match = source.match(new RegExp(`\\\\begin\\{${name}\\}([\\s\\S]*?)\\\\end\\{${name}\\}`));
  return match ? match[1].trim() : "";
}

function renderTable(block) {
  const caption = block.match(/\\caption\{([\s\S]*?)\}/)?.[1]?.trim() ?? "";
  const tabular = block.match(/\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}/)?.[1] ?? "";
  const rows = tabular
    .split(/\\\\/)
    .map((row) => row.replace(/\\(toprule|midrule|bottomrule)/g, "").trim())
    .filter(Boolean)
    .map((row) => row.split("&").map((cell) => inlineTex(cell.trim())));
  if (!rows.length) return "";
  const head = rows[0];
  const body = rows.slice(1);
  return [
    '<figure class="table-figure">',
    caption ? `<figcaption>${inlineTex(caption)}</figcaption>` : "",
    "<table>",
    `<thead><tr>${head.map((cell) => `<th>${cell}</th>`).join("")}</tr></thead>`,
    `<tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>`,
    "</table>",
    "</figure>",
  ].join("\n");
}

function renderBibliography(source) {
  const bibliography = extractEnvironment(source, "thebibliography");
  if (!bibliography) return "";
  const items = bibliography
    .split(/\\bibitem\{[^}]+\}/)
    .slice(1)
    .map((item) =>
      item
        .replace(/\\newblock/g, " ")
        .replace(/\\url\{([^{}]+)\}/g, "$1")
        .replace(/\\emph\{([^{}]+)\}/g, "$1")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  return `<section><h2>References</h2><ol class="refs">${items.map((item) => `<li>${inlineTex(item)}</li>`).join("")}</ol></section>`;
}

function renderBody(source) {
  let body = source
    .replace(/^[\s\S]*?\\end\{abstract\}/, "")
    .replace(/\\begin\{thebibliography\}\{[^}]*\}[\s\S]*?\\end\{thebibliography\}/, "")
    .replace(/\\end\{document\}[\s\S]*$/, "");

  body = body.replace(/\\begin\{table\}[\s\S]*?\\end\{table\}/g, (block) => `\n\n${renderTable(block)}\n\n`);
  body = body.replace(/\\\[[\s\S]*?\\\]/g, (block) => {
    const equation = plainTex(block)
      .replace(/\\\[/g, "")
      .replace(/\\\]/g, "")
      .replace(/\\textrm\{([^{}]+)\}/g, "$1")
      .replace(/\\rightarrow/g, "->")
      .replace(/\s+/g, " ")
      .trim();
    return `\n\n<div class="equation">${htmlEscape(equation)}</div>\n\n`;
  });
  body = body.replace(/\\section\*\{([^{}]+)\}/g, "\n\n<h2>$1</h2>\n\n");
  body = body.replace(/\\section\{([^{}]+)\}/g, "\n\n<h2>$1</h2>\n\n");
  body = body.replace(/\\subsection\{([^{}]+)\}/g, "\n\n<h3>$1</h3>\n\n");
  body = body.replace(/\\paragraph\{([^{}]+)\}/g, "\n\n<h4>$1</h4>\n\n");
  body = body.replace(/\\begin\{enumerate\}/g, "\n\n<ol>\n");
  body = body.replace(/\\end\{enumerate\}/g, "\n</ol>\n\n");
  body = body.replace(/\\begin\{description\}/g, "\n\n<dl>\n");
  body = body.replace(/\\end\{description\}/g, "\n</dl>\n\n");
  body = body.replace(/\\item\[([^{}\]]+)\]\s*([^\n]+)/g, "<dt>$1</dt><dd>$2</dd>");
  body = body.replace(/\\item\s+/g, "<li>");

  const chunks = body
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      if (/^<\/?(h2|h3|h4|ol|ul|li|dl|dt|dd|figure|div|table|thead|tbody|tr|th|td)/.test(chunk)) {
        return inlineTexInsideHtml(chunk);
      }
      if (chunk.includes("<li>")) {
        return inlineTexInsideHtml(chunk);
      }
      return `<p>${inlineTex(chunk).replace(/\n/g, " ")}</p>`;
    });
  return chunks.join("\n");
}

const source = readFileSync(sourcePath, "utf8");
const title = extractCommand(source, "title");
const author = extractCommand(source, "author").replace(/\\\\/g, "<br>");
const date = extractCommand(source, "date");
const abstract = extractEnvironment(source, "abstract");
const body = renderBody(source);
const bibliography = renderBibliography(source);

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${htmlEscape(plainTex(title))}</title>
<style>
@page { size: Letter; margin: 0.75in; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: #171717; line-height: 1.42; font-size: 10.5pt; }
h1 { font-size: 21pt; line-height: 1.15; margin: 0 0 0.25in; text-align: center; }
.author, .date { text-align: center; margin: 0.06in 0; }
.abstract { border-top: 1px solid #aaa; border-bottom: 1px solid #aaa; margin: 0.28in 0; padding: 0.12in 0; }
.abstract h2 { margin-top: 0; font-size: 12pt; }
h2 { font-size: 15pt; margin: 0.24in 0 0.08in; page-break-after: avoid; }
h3 { font-size: 12.5pt; margin: 0.16in 0 0.06in; page-break-after: avoid; }
h4 { font-size: 10.5pt; margin: 0.12in 0 0.03in; font-weight: 700; }
p { margin: 0 0 0.08in; text-align: justify; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 9.5pt; }
ol, ul { margin-top: 0.04in; }
dl { margin: 0.06in 0; }
dt { font-weight: 700; margin-top: 0.05in; }
dd { margin: 0 0 0.04in 0.18in; }
.equation { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; text-align: center; margin: 0.12in 0; }
.table-figure { margin: 0.18in 0; page-break-inside: avoid; }
figcaption { font-weight: 600; margin-bottom: 0.06in; }
table { width: 100%; border-collapse: collapse; font-size: 9.2pt; }
th, td { border-bottom: 1px solid #ddd; padding: 4px 5px; text-align: left; vertical-align: top; }
th { border-top: 1px solid #555; border-bottom: 1px solid #555; }
.refs { font-size: 9.2pt; }
</style>
</head>
<body>
<h1>${inlineTex(title)}</h1>
<div class="author">${inlineTexInsideHtml(author)}</div>
<div class="date">${inlineTex(date)}</div>
<section class="abstract"><h2>Abstract</h2><p>${inlineTex(abstract)}</p></section>
${body}
${bibliography}
</body>
</html>
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(htmlPath, html, "utf8");

const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const pdfResult = spawnSync(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    `--print-to-pdf=${pdfPath}`,
    `file://${htmlPath}`,
  ],
  { encoding: "utf8" },
);

if (pdfResult.status !== 0) {
  console.error(pdfResult.stdout);
  console.error(pdfResult.stderr);
  process.exit(pdfResult.status ?? 1);
}

console.log(`wrote ${htmlPath}`);
console.log(`wrote ${pdfPath}`);
