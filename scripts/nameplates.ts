// Gera cabeçalhos dos relatórios em português como caminhos SVG em Noto Sans SC Black
// (SIL OFL 1.1). Letras acentuadas usam a mesma escala das demais letras latinas;
// espaços separam palavras sem gerar contornos vazios ou coordenadas inválidas.
//
// Uso: node scripts/nameplates.ts <diretório do pacote @fontsource/noto-sans-sc>
//   Obtenha com npm pack @fontsource/noto-sans-sc@5.3.0 e extraia; não é dependência da aplicação.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import opentype from "opentype.js";

const pkg = process.argv[2];
if (!pkg) throw new Error("Uso: node scripts/nameplates.ts <diretório do pacote noto-sans-sc>");

/** Altura de referência nos cabeçalhos. */
const H = 220;
/** Altura dos contornos latinos. */
const CAPS = H * 0.94;
const MARGIN = 12;
const isLatin = (ch: string) => /\p{Script=Latin}/u.test(ch);
/** Espaço entre os contornos de letras vizinhas. */
function gap(a: string, b: string): number {
  if (isLatin(a) && isLatin(b)) return H * 0.07;
  if (isLatin(a) !== isLatin(b)) return H * 0.17;
  return H * 0.085;
}

const NAMEPLATES: Record<string, Array<{ text: string; accent: boolean }>> = {
  daily: [
    { text: "Relatório ", accent: true },
    { text: "diário", accent: false },
  ],
  weekly: [
    { text: "Relatório ", accent: true },
    { text: "semanal", accent: false },
  ],
  monthly: [
    { text: "Relatório ", accent: true },
    { text: "mensal", accent: false },
  ],
  archive: [
    { text: "Arquivo ", accent: true },
    { text: "diário", accent: false },
  ],
};

// Arquivo WOFF do peso 900 que contém cada caractere.
const css = readFileSync(path.join(pkg, "900.css"), "utf8");
const faces = [...css.matchAll(/url\(\.\/files\/([\w-]+)\.woff2\)[^;]*;\s*unicode-range: ([^;]+);/g)].map((m) => ({
  file: `${m[1]}.woff`,
  ranges: m[2]!.split(",").map((r) => r.trim().replace("U+", "").split("-").map((h) => parseInt(h, 16))),
}));
const fonts = new Map<string, opentype.Font>();
function fontFor(ch: string): opentype.Font {
  const cp = ch.codePointAt(0)!;
  const face = faces.find((f) => f.ranges.some(([a, b]) => cp >= a! && cp <= (b ?? a!)));
  if (!face) throw new Error(`Nenhum arquivo da fonte contém ${ch}`);
  if (!fonts.has(face.file)) {
    const buf = readFileSync(path.join(pkg, "files", face.file));
    fonts.set(face.file, opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)));
  }
  return fonts.get(face.file)!;
}

// Escala compartilhada entre letras latinas e outra para os demais caracteres.
// Os limites conjuntos em mil unidades definem altura e centralização.
const chars = [...new Set(Object.values(NAMEPLATES).flatMap((parts) => parts.flatMap((p) => [...p.text])))].filter(ch => !/\s/.test(ch));
const boxes = new Map(chars.map((ch) => [ch, fontFor(ch).getPath(ch, 0, 0, 1000).getBoundingBox()]));
function fit(group: string[], height: number) {
  const top = Math.min(...group.map((ch) => boxes.get(ch)!.y1));
  const bottom = Math.max(...group.map((ch) => boxes.get(ch)!.y2));
  const size = (1000 * height) / (bottom - top);
  return { size, baseline: -((top + bottom) / 2) * (size / 1000) };
}
const latin = fit(chars.filter(isLatin), CAPS);
const other = chars.filter(ch => !isLatin(ch));
const cjk = other.length ? fit(other, H) : latin;

const out: Record<string, { viewBox: string; accent: string; ink: string }> = {};
for (const [name, parts] of Object.entries(NAMEPLATES)) {
  const accent: string[] = [];
  const ink: string[] = [];
  let x = MARGIN;
  let prev: string | null = null;
  for (const part of parts) {
    for (const ch of part.text) {
      if (/\s/.test(ch)) { x += H * 0.3; prev = null; continue; }
      const { size, baseline } = isLatin(ch) ? latin : cjk;
      const box = boxes.get(ch)!;
      const scale = size / 1000;
      if (prev) x += gap(prev, ch);
      const origin = x - box.x1 * scale;
      (part.accent ? accent : ink).push(fontFor(ch).getPath(ch, origin, baseline, size).toPathData(1));
      x = origin + box.x2 * scale;
      prev = ch;
    }
  }
  const half = Math.max(H, CAPS) / 2 + MARGIN;
  out[name] = { viewBox: `0 ${(-half).toFixed(1)} ${(x + MARGIN).toFixed(1)} ${(2 * half).toFixed(1)}`, accent: accent.join(" "), ink: ink.join(" ") };
}

const target = "industry/brand/nameplates";
mkdirSync(target, { recursive: true });
for (const [name, n] of Object.entries(out)) {
  writeFileSync(`${target}/${name}.svg`, `<!-- Gerado por scripts/nameplates.ts. Noto Sans SC Black (SIL OFL 1.1). -->\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n.viewBox}"><path id="accent" d="${n.accent}"/><path id="ink" d="${n.ink}"/></svg>\n`);
}
writeFileSync(`${target}/index.json`, `${JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.viewBox])), null, 2)}\n`);
console.log(target, Object.fromEntries(Object.entries(out).map(([k, v]) => [k, `${v.viewBox} · ${((v.accent.length + v.ink.length) / 1000).toFixed(1)} kB`])));
