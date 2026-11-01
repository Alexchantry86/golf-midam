// Génère les fiches terrain imprimables (PDF A4) de chaque exercice : data/fiches/<id>.pdf + classeur complet.
// Usage : node tools/fiches.mjs <dossier node_modules contenant @fontsource/fraunces et @fontsource/dm-sans>
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");
const NM = process.argv[2]; const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const font = f => "data:font/woff2;base64," + fs.readFileSync(path.join(NM, f)).toString("base64");
const FONTS = `@font-face{font-family:Fraunces;font-weight:500;src:url(${font("@fontsource/fraunces/files/fraunces-latin-500-normal.woff2")})}
@font-face{font-family:Fraunces;font-weight:700;src:url(${font("@fontsource/fraunces/files/fraunces-latin-700-normal.woff2")})}
@font-face{font-family:"DM Sans";font-weight:400;src:url(${font("@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2")})}
@font-face{font-family:"DM Sans";font-weight:500;src:url(${font("@fontsource/dm-sans/files/dm-sans-latin-500-normal.woff2")})}
@font-face{font-family:"DM Sans";font-weight:700;src:url(${font("@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff2")})}`;
const { drills } = JSON.parse(fs.readFileSync(path.join(root, "data/drills.json"), "utf8"));
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const N = "#0f2340", G = "#2f6b45", SAND = "#c9b48c", R = "#c8372d", M = "#7d7462";

// Schémas de mise en place (vue de dessus, sans échelle)
const flag = (x, y) => `<line x1="${x}" y1="${y}" x2="${x}" y2="${y - 26}" stroke="${N}" stroke-width="1.6"/><path d="M${x} ${y - 26}l14 5-14 5z" fill="${R}"/><circle cx="${x}" cy="${y}" r="3.2" fill="${N}"/>`;
const ball = (x, y, l) => `<circle cx="${x}" cy="${y}" r="5" fill="#fff" stroke="${N}" stroke-width="1.4"/>${l ? `<text x="${x}" y="${y + 3.2}" text-anchor="middle" font-size="7" font-weight="700" fill="${N}">${l}</text>` : ""}`;
const lbl = (x, y, t, a = "middle", c = M) => `<text x="${x}" y="${y}" text-anchor="${a}" font-size="9.5" fill="${c}">${t}</text>`;
const D = {
  "cercle-putting": () => { let g = `<ellipse cx="150" cy="105" rx="135" ry="92" fill="#e4efe6"/>`;
    [[30, "1 m"], [52, "1,5 m"], [74, "2 m"]].forEach(([r, t]) => { g += `<circle cx="150" cy="105" r="${r}" fill="none" stroke="${SAND}" stroke-dasharray="3 3"/>` + `<rect x="${150 - 14}" y="${105 - r - 6}" width="28" height="11" rx="3" fill="#e4efe6"/>` + lbl(150, 105 - r + 3, t, "middle", N);
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.3; g += `<rect x="${150 + r * Math.cos(a) - 2}" y="${105 + r * Math.sin(a) - 2}" width="4" height="4" fill="${N}"/>`; } });
    return g + flag(150, 105) + lbl(150, 205, "6 tees par cercle : rentre les 6 avant de reculer"); },
  "up-down-9": () => { let g = `<path d="M60 40 Q150 10 240 40 Q280 95 235 150 Q150 185 70 150 Q25 95 60 40z" fill="#e4efe6"/>` + flag(150, 100);
    g += `<ellipse cx="62" cy="168" rx="26" ry="14" fill="#efe3c4" stroke="${SAND}"/><ellipse cx="245" cy="165" rx="24" ry="13" fill="#efe3c4" stroke="${SAND}"/>`;
    [[48, 70, "1"], [250, 60, "2"], [150, 30, "3"]].forEach(([x, y, l]) => g += ball(x, y, l));
    [[20, 25, "4"], [285, 20, "5"], [290, 110, "6"]].forEach(([x, y, l]) => g += ball(x, y, l));
    [[62, 168, "7"], [245, 165, "8"], [150, 195, "9"]].forEach(([x, y, l]) => g += ball(x, y, l));
    return g + lbl(150, 214, "1–3 chips · 4–6 pitchs 15–25 m · 7–9 bunkers ou lies difficiles"); },
  "echelle-wedges": () => { let g = `<rect x="20" y="20" width="260" height="170" rx="8" fill="#e4efe6"/>` + ball(150, 178);
    [30, 40, 50, 60, 70, 80, 90].forEach((d, i) => { const y = 168 - (d - 20) * 1.95; g += `<line x1="70" x2="230" y1="${y}" y2="${y}" stroke="${SAND}" stroke-dasharray="4 3"/>` + lbl(236, y + 3, d + " m", "start", N) + `<rect x="147" y="${y - 3}" width="6" height="6" fill="${R}"/>`; });
    return g + lbl(150, 206, "3 balles par distance, aller puis retour · note l'écart court/long"); },
  "lag-zone": () => { let g = `<rect x="10" y="40" width="280" height="120" rx="60" fill="#e4efe6"/>` + ball(40, 100);
    g += `<line x1="48" y1="100" x2="236" y2="100" stroke="${N}" stroke-dasharray="2 4"/><circle cx="250" cy="100" r="30" fill="none" stroke="${G}" stroke-width="1.6"/>` + flag(250, 100);
    return g + lbl(140, 92, "≈ 12 m", "middle", N) + lbl(250, 148, "zone d'1 m de rayon", "middle", G) + lbl(150, 190, "6 à 10 lags : compte les balles qui s'arrêtent dans la zone"); },
  "porte-chemin": () => { let g = `<rect x="20" y="30" width="260" height="150" rx="8" fill="#e4efe6"/><line x1="40" y1="105" x2="270" y2="105" stroke="${SAND}" stroke-dasharray="5 4"/>` + lbl(268, 98, "ligne de jeu →", "end");
    g += ball(150, 105) + `<rect x="105" y="118" width="22" height="9" rx="3" fill="${N}"/><rect x="172" y="84" width="22" height="9" rx="3" fill="${N}"/>`;
    g += `<path d="M95 140 Q150 112 210 74" fill="none" stroke="${R}" stroke-width="1.6" marker-end="url(#a)"/><defs><marker id="a" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="${R}"/></marker></defs>`;
    return g + lbl(116, 142, "obstacle intérieur") + lbl(183, 76, "obstacle extérieur") + lbl(150, 200, "Le club passe entre les deux : chemin de l'intérieur vers l'extérieur"); },
  "bunker-distances": () => { let g = `<ellipse cx="70" cy="110" rx="50" ry="40" fill="#efe3c4" stroke="${SAND}"/>` + ball(70, 110) + `<rect x="130" y="40" width="160" height="140" rx="60" fill="#e4efe6"/>`;
    [[5, 150], [10, 195], [20, 262]].forEach(([d, x]) => g += `<circle cx="${x}" cy="110" r="16" fill="none" stroke="${G}" stroke-dasharray="3 2"/>` + flag(x, 110) + lbl(x, 140, d + " m", "middle", N));
    return g + lbl(150, 200, "10 balles par distance · zone de 2 m autour de chaque cible"); },
  "headcover-exterieur": () => { let g = `<rect x="20" y="30" width="260" height="150" rx="8" fill="#e4efe6"/><line x1="40" y1="105" x2="270" y2="105" stroke="${SAND}" stroke-dasharray="5 4"/>` + lbl(268, 98, "ligne de jeu →", "end");
    g += ball(150, 105) + `<rect x="166" y="78" width="26" height="12" rx="4" fill="${N}"/>`;
    return g + lbl(179, 70, "headcover : 10–15 cm à l'extérieur, un peu devant") + lbl(150, 200, "Un club qui vient de l'extérieur touche le headcover"); },
};

function page(d, nRows) {
  const ms = d.measure || []; const cols = ms.length ? ms : [{ label: "Résultat" }];
  const rows = Array.from({ length: nRows || 10 }, () => `<tr><td></td>${cols.map(() => "<td></td>").join("")}<td></td></tr>`).join("");
  const li = a => (a || []).map(x => `<li>${esc(x)}</li>`).join("");
  const dia = D[d.id] ? `<svg viewBox="0 0 300 220" class="dia">${D[d.id]()}</svg>` : "";
  return `<section class="page">
  <header><div><div class="k">Fiche terrain · ${esc((d.tags || []).join(" · ") || d.area || "")}</div><h1>${esc(d.name)}</h1><p class="obj">${esc(d.objective)}</p></div><div class="fault">Défaut ciblé<br><b>${esc(d.fault || "—")}</b></div></header>
  <div class="grid ${dia ? "" : "one"}"><div>
    <h2>Matériel</h2><ul>${li(d.equipment)}</ul>
    <h2>Mise en place</h2><ul>${li(d.setup)}</ul>
    <h2>Déroulé</h2><ol>${li(d.steps)}</ol></div>${dia ? `<div class="diabox">${dia}<div class="cap">Schéma de mise en place (vue de dessus, sans échelle)</div></div>` : ""}</div>
  <div class="grid2"><div><h2>Consignes clés</h2><ul>${li(d.cues)}</ul></div><div><h2>Erreurs fréquentes</h2><ul>${li(d.errors)}</ul></div></div>
  <div class="succ"><span>Critère de réussite</span>${esc(d.success)}</div>
  <h2>Suivi${ms.length ? " · reporte ensuite les chiffres dans l'app (fiche de l'exercice › Mes résultats)" : ""}</h2>
  <table><thead><tr><th class="dt">Date</th>${cols.map(m => `<th>${esc(m.label)}${m.max ? ` <i>/ ${m.max}</i>` : m.unit ? ` <i>(${esc(m.unit)})</i>` : ""}${m.target != null ? `<br><i>obj. ${m.lower ? "≤ " : ""}${String(m.target).replace(".", ",")}</i>` : ""}</th>`).join("")}<th class="nt">Notes</th></tr></thead><tbody>${rows}</tbody></table>
  <footer>Objectif Mid-Am 2028 · alexchantry86.github.io/golf-midam · ${esc(d.id)}</footer></section>`;
}
const CSS = `${FONTS}
@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font-family:"DM Sans",sans-serif;color:${N};font-size:10.5px;line-height:1.4}
.page{width:210mm;height:297mm;padding:14mm 14mm 10mm;position:relative;page-break-after:always;overflow:hidden}
header{display:flex;justify-content:space-between;gap:12px;border-bottom:2px solid ${N};padding-bottom:7px;margin-bottom:8px}
.k{font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:#a0612f;font-weight:700}
h1{font-family:Fraunces,serif;font-size:23px;margin:2px 0 3px;font-weight:700}.obj{margin:0;font-size:11.5px}
.fault{font-size:8.5px;color:${M};text-align:right;white-space:nowrap}.fault b{font-size:10.5px;color:${N};font-weight:500}
h2{font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:#a0612f;margin:9px 0 3px;font-weight:700}
ul,ol{margin:0;padding-left:15px}li{margin-bottom:2px}
.grid{display:grid;grid-template-columns:1fr 78mm;gap:10px}.grid.one{grid-template-columns:1fr}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.diabox{border:1px solid #eadfc8;border-radius:8px;padding:6px;margin-top:9px;background:#fbf6ec}.dia{width:100%;display:block}.cap{font-size:7.5px;color:${M};text-align:center}
.succ{margin-top:10px;background:#fff3c4;border:1px solid #ecd48a;border-radius:8px;padding:7px 10px;font-size:11px}.succ span{display:block;font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:#9a6a10;font-weight:700}
table{width:100%;border-collapse:collapse;margin-top:4px;font-size:9px}th{text-align:left;font-weight:500;border-bottom:1.5px solid ${N};padding:3px 4px;vertical-align:bottom}th i{font-style:normal;color:${M}}
td{border-bottom:1px solid #d9ccb2;height:8.6mm}th.dt{width:20mm}th.nt{width:40mm}
footer{position:absolute;bottom:7mm;left:14mm;right:14mm;font-size:7.5px;color:${M};border-top:1px solid #eadfc8;padding-top:3px}`;
const html = body => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`;
const out = path.join(root, "data/fiches"); fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch(); const p = await b.newPage();
const fit = {};
for (const d of drills) { let n = 20;   // autant de lignes de suivi que la page en contient
  for (; n >= 6; n--) { await p.setContent(html(page(d, n)), { waitUntil: "load" }); await p.evaluate(() => document.fonts.ready);
    const ok = await p.evaluate(() => { const pg = document.querySelector(".page"), t = document.querySelector("table"), f = document.querySelector("footer"); return t.getBoundingClientRect().bottom < f.getBoundingClientRect().top - 6 && pg.scrollHeight <= pg.clientHeight + 2; }); if (ok) break; }
  fit[d.id] = n; await p.pdf({ path: path.join(out, d.id + ".pdf"), format: "A4", printBackground: true, preferCSSPageSize: true }); console.log(d.id, n + " lignes"); }
await p.setContent(html(drills.map(d => page(d, fit[d.id])).join("")), { waitUntil: "load" }); await p.evaluate(() => document.fonts.ready);
await p.pdf({ path: path.join(out, "classeur-exercices.pdf"), format: "A4", printBackground: true, preferCSSPageSize: true });
await b.close(); console.log("classeur ok");
