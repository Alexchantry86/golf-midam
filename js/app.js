/* Objectif Mid-Am 2028 — app de pilotage golf (GitHub Pages + Firebase). */
(function () {
"use strict";
const APP_VERSION = "1.8.3";
const DEMO = /[?&]demo=1/.test(location.search);

/* ---------- Utilitaires ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const iso = (d = new Date()) => { const z = d.getTimezoneOffset() * 60000; return new Date(d - z).toISOString().slice(0, 10); };
const D = s => new Date(s + "T12:00:00");
const fmtD = s => s ? D(s).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtDs = s => s ? D(s).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) : "—";
const fmtDl = s => s ? D(s).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "—";
const n1 = v => v == null || !isFinite(v) ? "—" : Number(v).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const n0 = v => v == null || !isFinite(v) ? "—" : Math.round(v).toLocaleString("fr-FR");
const pc = v => v == null || !isFinite(v) ? "—" : Math.round(v) + "%";
const pct = v => v == null || !isFinite(v) ? "—" : Math.round(v) + " %";
const sgn = v => v == null || !isFinite(v) ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const num = v => { if (v === "" || v == null) return null; const x = parseFloat(String(v).replace(",", ".")); return isFinite(x) ? x : null; };
const byDateDesc = (a, b) => (b.date || "").localeCompare(a.date || "");
const daysBetween = (a, b) => Math.round((D(b) - D(a)) / 864e5);
const mondayOf = s => { const d = D(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return iso(d); };
const sizeTxt = b => b > 1048576 ? n1(b / 1048576) + " Mo" : n0(b / 1024) + " Ko";
const ytId = u => { const m = String(u || "").match(/(?:youtu\.be\/|[?&]v=|shorts\/|embed\/)([\w-]{11})/); return m ? m[1] : null; };
const clean = o => JSON.parse(JSON.stringify(o, (k, v) => v === undefined ? null : v));
const safeName = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-80);
const mmss = s => { const a = Math.abs(Math.round(s)); return (s < 0 ? "+" : "") + String(Math.floor(a / 60)).padStart(2, "0") + ":" + String(a % 60).padStart(2, "0"); };
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
let tt; function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, m.length > 45 ? 7000 : 2200); }
async function fetchJSON(p) { const r = await fetch(p + "?v=" + Date.now()); if (!r.ok) throw new Error(p); return r.json(); }

const DOMAINS = ["Long jeu", "Fers", "Wedges", "Petit jeu", "Bunker", "Putting", "Parcours", "Physique / vitesse", "Mental / routine"];
const TAGS = ["Physique", "Long jeu", "Petit jeu", "Putting"];
const TAG_COLOR = { "Physique": "#c8372d", "Long jeu": "#0f2340", "Petit jeu": "#a0612f", "Putting": "#2f6b45" };
const DOMAIN_TAG = { "Physique / vitesse": "Physique", "Physique": "Physique", "Long jeu": "Long jeu", "Fers": "Long jeu", "Wedges": "Petit jeu", "Petit jeu": "Petit jeu", "Bunker": "Petit jeu", "Putting": "Putting" };
const tagPill = t => `<span class="tag" style="--c:${TAG_COLOR[t] || "#7d7462"}">${esc(t)}</span>`;
const tagsHtml = a => a && a.length ? `<span class="tags">${a.map(tagPill).join("")}</span>` : "";
function sessionTags(s) { const set = new Set(); for (const b of s.blocks || []) for (const t of ((S.drills[b.drill] || {}).tags || [])) set.add(t); return TAGS.filter(t => set.has(t)); }
function freeTags(s) { if (Array.isArray(s.tags) && s.tags.length) return s.tags; const t = DOMAIN_TAG[s.domain]; return t ? [t] : []; }
const AREA_COLOR = { "Long jeu": "#0f2340", "Fers": "#2c5aa0", "Wedges": "#a0612f", "Petit jeu": "#c8372d", "Bunker": "#c9b48c", "Putting": "#2f6b45", "Parcours": "#2c5aa0", "Physique": "#c8372d", "Physique / vitesse": "#c8372d", "Mental / routine": "#a0612f", "Test": "#7d7462", "Contrôle": "#7d7462" };
const areaColor = a => AREA_COLOR[a] || "#7d7462";
const METRICS = {
  fw: { label: "Fairways touchés", unit: "%", t: 60, dir: "high", short: "Fairways" },
  gir: { label: "Greens en régulation /18", t: 12, dir: "high", short: "GIR /18" },
  scr: { label: "Scrambling", unit: "%", t: 60, dir: "high", short: "Scrambling" },
  putts: { label: "Putts /18", t: 29.5, dir: "low", short: "Putts /18" },
  three: { label: "3-putts /18", t: 0.5, dir: "low", short: "3-putts /18" },
  short: { label: "Putts < 2 m manqués /18", t: 0.5, dir: "low", short: "Putts < 2 m ratés" },
  pen: { label: "Pénalités /18", t: 0.3, dir: "low", short: "Pénalités /18" }
};
const IC = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  flag: '<path d="M6 21V4l11 4-11 4"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  play: '<polygon points="8,5 19,12 8,19" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="5" width="4" height="14" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" fill="currentColor" stroke="none"/>',
  prev: '<path d="M19 20L9 12l10-8zM5 19V5"/>', next: '<path d="M5 4l10 8-10 8zM19 5v14"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  dumb: '<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>', target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>'
};
const icon = (k, st) => `<svg class="i" viewBox="0 0 24 24"${st ? ` style="${st}"` : ""}>${IC[k]}</svg>`;

/* ---------- État ---------- */
const S = {
  user: null, role: null, plan: null, drills: {}, drillList: [], profile: null,
  data: { courseRequests: [], rounds: [], courses: [], lessons: [], sessions: [], validations: [], notes: [], videos: [], drillLinks: [] },
  catalog: [], setup: { q: "", club: null, course: null, tee: null }, loaded: false, planFilter: "todo", vidFilter: "all", perf: { course: "", round: "all" }, draft: null, hole: 0, subs: [], run: null
};
const canEdit = () => S.role === "admin";
const valOf = id => S.data.validations.find(v => v._id === id) || null;

/* ---------- Accès aux données ---------- */
let Store;
function firebaseStore() {
  const db = firebase.firestore(), st = firebase.storage(); st.setMaxUploadRetryTime(90000);
  const TS = () => firebase.firestore.FieldValue.serverTimestamp();
  return {
    listen(col, cb) { return db.collection(col).onSnapshot(s => cb(s.docs.map(d => ({ ...d.data(), _id: d.id }))), e => { console.error(col, e); toast("Lecture impossible : " + col); }); },
    listenDoc(path, cb) { return db.doc(path).onSnapshot(s => cb(s.exists ? s.data() : null), e => console.error(path, e)); },
    async add(col, data) { const r = await db.collection(col).add({ ...clean(data), createdAt: TS(), updatedAt: TS() }); return r.id; },
    async set(col, id, data, merge) { await db.collection(col).doc(id).set({ ...clean(data), updatedAt: TS() }, { merge: !!merge }); },
    async del(col, id) { await db.collection(col).doc(id).delete(); },
    upload(path, file, onProg) {
      const ext = (file.name.split(".").pop() || "").toLowerCase(), guess = { mp4: "video/mp4", mov: "video/quicktime", m4v: "video/x-m4v", "3gp": "video/3gpp", webm: "video/webm", avi: "video/x-msvideo" }[ext];
      const ref = st.ref(path); const task = ref.put(file, { contentType: file.type || guess || "application/octet-stream" });
      S.uploadTask = task;
      return new Promise((res, rej) => task.on("state_changed", s => onProg && onProg(s.bytesTransferred / s.totalBytes, s.bytesTransferred, s.totalBytes), e => { S.uploadTask = null; rej(e); }, async () => { S.uploadTask = null; res({ path, url: await ref.getDownloadURL() }); }));
    },
    async removeFile(path) { try { await st.ref(path).delete(); } catch (e) { console.warn(e); } },
    async userDoc(uid) { const s = await db.doc("users/" + uid).get(); return s.exists ? s.data() : null; }
  };
}
function demoStore() {
  const mem = { courseRequests: [], rounds: [], courses: [], lessons: [], sessions: [], validations: [], notes: [], videos: [], drillLinks: [], profile: [] };
  const L = {}; let seq = 1;
  const emit = col => (L[col] || []).forEach(cb => cb(mem[col].map(x => ({ ...x }))));
  const api = {
    listen(col, cb) { (L[col] = L[col] || []).push(cb); setTimeout(() => cb(mem[col].map(x => ({ ...x }))), 0); return () => {}; },
    listenDoc(path, cb) { const [c, id] = path.split("/"); api.listen(c, a => cb((a.find(x => x._id === id) || null))); return () => {}; },
    async add(col, data) { const id = "d" + (seq++); mem[col].push({ ...clean(data), _id: id }); emit(col); return id; },
    async set(col, id, data, merge) { const i = mem[col].findIndex(x => x._id === id); const v = { ...(merge && i >= 0 ? mem[col][i] : {}), ...clean(data), _id: id }; if (i >= 0) mem[col][i] = v; else mem[col].push(v); emit(col); },
    async del(col, id) { mem[col] = mem[col].filter(x => x._id !== id); emit(col); },
    async upload(path, file, onProg) { for (let i = 1; i <= 4; i++) { await new Promise(r => setTimeout(r, 150)); onProg && onProg(i / 4, file.size * i / 4, file.size); } return { path, url: URL.createObjectURL(file) }; },
    async removeFile() {}
  };
  const pars = [4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 3, 4, 4, 5, 4, 3, 4, 5];
  mem.courses.push({ _id: "c1", name: "Parcours de démonstration", pars });
  const mk = (date, seed) => ({ date, courseId: "c1", course: "Parcours de démonstration", type: "Compétition", holesCount: 18, startHole: 1,
    holesData: pars.map((p, i) => { const r = (seed * 7 + i * 13) % 10; const score = p + (r < 2 ? -1 : r < 7 ? 0 : r < 9 ? 1 : 2); const putts = r === 8 ? 3 : r < 2 ? 1 : 2;
      return { n: i + 1, par: p, score, putts, fw: p === 3 ? null : (r % 3 === 0 ? "L" : r % 5 === 0 ? "R" : "Y"), short: r === 7 ? 1 : 0, pen: r === 9 ? 1 : 0 }; }), cost: "Exemple de données de démonstration." });
  mem.rounds.push({ ...mk("2026-10-10", 1), _id: "r1" }, { ...mk("2026-10-18", 2), _id: "r2" }, { ...mk("2026-10-21", 3), _id: "r3" });
  const nine = r => ({ ...r, holesCount: 9, holesData: r.holesData.slice(0, 9) });
  [["2026-05-09", 4], ["2026-05-23", 5, 9], ["2026-06-06", 6], ["2026-06-20", 7], ["2026-06-27", 8, 9], ["2026-07-11", 9], ["2026-07-25", 1], ["2026-08-08", 2], ["2026-08-14", 3, 9], ["2026-08-22", 4], ["2026-08-29", 5], ["2026-09-12", 6], ["2026-09-19", 7, 9], ["2026-09-26", 8], ["2026-10-04", 9, 9]]
    .forEach(([dt, sd, h], k) => { const r = mk(dt, sd); mem.rounds.push({ ...(h ? nine(r) : r), _id: "x" + k }); });
  mem.profile.push({ _id: "main", indexHistory: [{ date: "2026-09-01", value: 1.4 }, { date: "2026-10-24", value: 1.0 }] });
  return api;
}
function startData() {
  if (S.subs.length) return;
  for (const col of ["rounds", "courses", "lessons", "sessions", "validations", "notes", "videos", "drillLinks", "courseRequests"]) S.subs.push(Store.listen(col, arr => { S.data[col] = arr; S.loaded = true; render(); }));
  S.subs.push(Store.listenDoc("profile/main", d => { S.profile = d; render(); }));
}

/* ---------- Démarrage ---------- */
async function boot() {
  try {
    const [plan, drills, cat] = await Promise.all([fetchJSON("data/plan.json"), fetchJSON("data/drills.json"), fetchJSON("data/courses.json").catch(() => ({ clubs: [] }))]);
    S.catalog = cat.clubs || [];
    S.plan = plan; S.drillList = drills.drills; drills.drills.forEach(d => S.drills[d.id] = d);
  } catch (e) { $("#app").innerHTML = `<p class="muted" style="padding-top:40px">Impossible de charger le plan. Recharge la page.</p>`; return; }
  S.draft = lsGet("golf-draft", null);
  window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
  if (DEMO) { Store = demoStore(); S.user = { email: "démo" }; S.role = "admin"; startData(); render(); return; }
  if (!window.FIREBASE_CONFIG) { $("#app").innerHTML = loginHead() + `<div class="empty"><b>Configuration Firebase en attente</b>Le fichier js/config.js n'est pas encore renseigné. Aperçu possible avec <a href="?demo=1">le mode démonstration</a>.</div>`; return; }
  firebase.initializeApp(window.FIREBASE_CONFIG);
  Store = firebaseStore();
  firebase.auth().onAuthStateChanged(async u => {
    if (!u) { S.user = null; renderLogin(); return; }
    let ud = null; try { ud = await Store.userDoc(u.uid); } catch (e) { console.error(e); }
    if (!ud || ud.active !== true) { renderDenied(u); return; }
    S.user = u; S.role = ud.role || "lecture"; startData(); render();
  });
}
function loginHead() { return `<header class="top"><div><div class="hello">Championnat d'Europe Mid-Amateur</div><h1>Objectif Mid-Am 2028</h1></div></header>`; }
function renderLogin() {
  $("#app").innerHTML = `<div class="login">${loginHead()}<form id="login" class="stack card">
  <div class="f"><label for="l-email">E-mail</label><input id="l-email" type="email" autocomplete="username" required></div>
  <div class="f"><label for="l-pw">Mot de passe</label><input id="l-pw" type="password" autocomplete="current-password" required></div>
  <button class="btn" type="submit">Se connecter</button>
  <button class="btn ghost sm" type="button" id="l-reset">Mot de passe oublié</button>
  <p class="small muted" id="l-err" hidden></p></form></div>`;
  $("#login").addEventListener("submit", async e => {
    e.preventDefault(); const err = $("#l-err"); err.hidden = true;
    try { await firebase.auth().signInWithEmailAndPassword($("#l-email").value.trim(), $("#l-pw").value); }
    catch (x) { err.textContent = "Connexion refusée : vérifie l'e-mail et le mot de passe."; err.hidden = false; }
  });
  $("#l-reset").addEventListener("click", async () => {
    const em = $("#l-email").value.trim(); const err = $("#l-err");
    if (!em) { err.textContent = "Saisis ton e-mail puis clique à nouveau."; err.hidden = false; return; }
    try { await firebase.auth().sendPasswordResetEmail(em); err.textContent = "E-mail de réinitialisation envoyé."; } catch (x) { err.textContent = "Envoi impossible pour cette adresse."; }
    err.hidden = false;
  });
}
function renderDenied(u) {
  $("#app").innerHTML = `<div class="login">${loginHead()}<div class="empty"><b>Compte non autorisé</b>Le compte ${esc(u.email)} n'est pas activé. Crée dans Firestore le document users/${esc(u.uid)} avec role = "admin" et active = true.</div><button class="btn ghost sm" data-act="logout">Se déconnecter</button></div>`;
}

/* ---------- Rendu ---------- */
const TAB_OF = { tableau: "tableau", plan: "plan", seance: "plan", exercice: "plan", parties: "parties", partie: "parties", plus: "plus", entrainements: "plus", entrainement: "plus", cours: "plus", videos: "plus" };
function parts() { return (location.hash.replace(/^#\/?/, "") || "tableau").split("/").map(decodeURIComponent); }
function render() {
  if (!S.user) return;
  const p = parts(); const tab = TAB_OF[p[0]] || "tableau";
  const keep = {}; document.querySelectorAll("#view [data-keep]").forEach(el => { if (el.value) keep[el.id] = el.value; });
  const focusId = document.activeElement && document.activeElement.id;
  const views = { tableau: vTableau, plan: vPlan, seance: vSeance, exercice: vExercice, entrainements: vEntrainements, entrainement: vEntrainement, cours: vCours, parties: vParties, partie: vPartie, videos: vVideos, plus: vPlus };
  const v = views[p[0]] || vTableau;
  let out; try { out = v(p); } catch (e) { console.error(e); out = { body: `<div class="empty"><b>Erreur d'affichage</b>${esc(e.message)}</div>` }; }
  if (typeof out === "string") out = { body: out };
  const head = out.title === false ? "" : `<header class="top"><div style="min-width:0">${out.back ? `<a class="back" href="${out.back[0]}" ${out.back[0] === "#" ? 'data-act="back"' : ""}>← ${esc(out.back[1])}</a>` : `<div class="hello">${esc(out.kicker || fmtDl(iso()))}</div>`}<h1>${out.title || "Objectif Mid-Am 2028"}</h1></div>${out.right || ""}</header>`;
  const tb = (k, l, ic) => `<a href="#/${k}" ${k === tab ? 'aria-current="page"' : ""}>${icon(ic)}${l}</a>`;
  $("#app").innerHTML = `${head}<main id="view">${out.body}</main><p class="xs muted" style="margin-top:36px">v${APP_VERSION}${DEMO ? " · mode démonstration" : ""}</p>
    <nav class="tabbar">${tb("tableau", "Accueil", "home")}${tb("plan", "Séances", "cal")}${canEdit() ? `<button class="plus" data-act="add-menu" aria-label="Ajouter">${icon("plus")}</button>` : ""}${tb("parties", "Parties", "flag")}${tb("plus", "Plus", "more")}</nav>`;
  for (const id in keep) { const el = document.getElementById(id); if (el && !el.value) el.value = keep[id]; }
  if (focusId) { const el = document.getElementById(focusId); if (el && el.matches("input,textarea,select")) el.focus({ preventScroll: true }); }
}
function emptyBox(t, s, btn) { return `<div class="empty"><b>${t}</b>${s}${btn ? `<div style="margin-top:12px">${btn}</div>` : ""}</div>`; }

/* ---------- Calculs ---------- */
function holeGir(h) { return h.score != null && h.putts != null && (h.score - h.putts) <= (h.par || 4) - 2; }
function roundCalc(r) {
  const hs = (r.holesData || []).filter(h => h.score != null);
  const o = { n: hs.length, score: 0, par: 0, putts: 0, puttsN: 0, fwHit: 0, fwPoss: 0, missL: 0, missR: 0, gir: 0, scrOpp: 0, scr: 0, three: 0, short: 0, pen: 0 };
  for (const h of hs) {
    const par = h.par || 4; o.score += h.score; o.par += par;
    if (h.putts != null) { o.putts += h.putts; o.puttsN++; if (h.putts >= 3) o.three++; }
    if (par >= 4 && h.fw) { o.fwPoss++; if (h.fw === "Y") o.fwHit++; else if (h.fw === "L") o.missL++; else if (h.fw === "R") o.missR++; }
    if (holeGir(h)) o.gir++; else if (h.putts != null) { o.scrOpp++; if (h.score <= par) o.scr++; }
    o.short += h.short || 0; o.pen += h.pen || 0;
  }
  return o;
}
function statsOf(rounds) {
  const r = [...rounds].sort(byDateDesc).slice(0, 10); if (!r.length) return null;
  const t = { n: 0, holes: 0, fwHit: 0, fwPoss: 0, missL: 0, missR: 0, gir: 0, scrOpp: 0, scr: 0, putts: 0, puttsN: 0, three: 0, short: 0, pen: 0, toPar: [], score18: [] };
  for (const x of r) {
    const c = roundCalc(x); if (!c.n) continue; t.n++; t.holes += c.n;
    for (const k of ["fwHit", "fwPoss", "missL", "missR", "gir", "scrOpp", "scr", "putts", "puttsN", "three", "short", "pen"]) t[k] += c[k];
    t.toPar.push((c.score - c.par) * 18 / c.n); if (c.n === 18) t.score18.push(c.score);
  }
  if (!t.n) return null;
  const per18 = (v, base) => base ? v * 18 / base : null; const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
  return { n: t.n, fw: t.fwPoss ? t.fwHit / t.fwPoss * 100 : null, gir: per18(t.gir, t.holes), scr: t.scrOpp ? t.scr / t.scrOpp * 100 : null,
    putts: per18(t.putts, t.puttsN), three: per18(t.three, t.puttsN), short: per18(t.short, t.holes), pen: per18(t.pen, t.holes),
    missL: t.missL, missR: t.missR, toPar: avg(t.toPar), score18: avg(t.score18) };
}
function gaps(st) {
  const tg = (S.plan && S.plan.targets) || {};
  return Object.entries(METRICS).map(([k, m]) => { const t = tg[k] ?? m.t; const v = st ? st[k] : null;
    if (v == null) return { k, ...m, t, v: null, g: null };
    return { k, ...m, t, v, g: m.dir === "high" ? (t - v) / t : (v - t) / Math.max(t, 1) }; }).sort((a, b) => (b.g ?? -9) - (a.g ?? -9));
}
const gapCls = g => g == null ? "" : g <= 0 ? "ok" : g < 0.15 ? "warn" : "bad";
const gapCol = g => g == null ? "#c9b48c" : g <= 0 ? "#2f6b45" : g < 0.15 ? "#c9a227" : "#c8372d";
function practiceLog() {
  const a = S.data.sessions.map(s => ({ date: s.date, min: s.duration || 0, domain: s.domain, tags: freeTags(s) }));
  for (const s of S.plan.sessions) { const v = valOf(s.id); if (v && (v.status === "Faite" || v.status === "Partielle")) a.push({ date: s.date, min: v.actualMin ?? s.duration ?? 0, domain: s.domain, tags: sessionTags(s) }); }
  return a;
}
const currentIndex = () => { const h = (S.profile && S.profile.indexHistory) || []; return h.length ? h[h.length - 1] : null; };
const currentPhase = () => { const t = iso(); return (S.plan.phases || []).find(p => p.from <= t && t <= p.to) || null; };
const fmtVal = (m, v) => v == null ? "—" : m.unit === "%" ? pct(v) : n1(v);

/* ---------- Accueil ---------- */
function ring(pIdx, pPlan, label) {
  const C1 = 2 * Math.PI * 36, C2 = 2 * Math.PI * 25;
  return `<svg width="88" height="88" viewBox="0 0 88 88" style="flex:none" role="img" aria-label="Progression de l'index et du plan">
  <circle cx="44" cy="44" r="36" stroke="#f1e8d6" stroke-width="9" fill="none"/><circle cx="44" cy="44" r="36" stroke="#c8372d" stroke-width="9" fill="none" stroke-linecap="round" stroke-dasharray="${C1}" stroke-dashoffset="${C1 * (1 - Math.max(0.02, Math.min(1, pIdx)))}" transform="rotate(-90 44 44)"/>
  <circle cx="44" cy="44" r="25" stroke="#f1e8d6" stroke-width="7" fill="none"/><circle cx="44" cy="44" r="25" stroke="#0f2340" stroke-width="7" fill="none" stroke-linecap="round" stroke-dasharray="${C2}" stroke-dashoffset="${C2 * (1 - Math.max(0.02, Math.min(1, pPlan)))}" transform="rotate(-90 44 44)"/>
  <text x="44" y="49" text-anchor="middle" font-family="Fraunces,Georgia,serif" font-weight="700" font-size="16" fill="#0f2340">${label}</text></svg>`;
}
function vTableau() {
  const plan = S.plan, target = plan.targetIndex ?? -2, ci = currentIndex();
  const h = ((S.profile && S.profile.indexHistory) || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const startIdx = h.length ? h[0].value : null;
  const pIdx = ci && startIdx != null && startIdx !== target ? (startIdx - ci.value) / (startIdx - target) : 0;
  const left = daysBetween(iso(), plan.entryDeadline);
  const past = plan.sessions.filter(s => s.date <= iso()); const doneAll = plan.sessions.filter(s => (valOf(s.id) || {}).status === "Faite").length;
  const pPlan = plan.sessions.length ? doneAll / plan.sessions.length : 0;
  const today = plan.sessions.filter(s => !valOf(s.id)).sort((a, b) => a.date.localeCompare(b.date)).find(s => s.date >= iso()) || plan.sessions.filter(s => !valOf(s.id) && s.date < iso()).pop();
  const late = plan.sessions.filter(s => !valOf(s.id) && s.date < iso()).length;
  const since = iso(new Date(Date.now() - 30 * 864e5)); const mins = practiceLog().filter(p => p.date >= since && p.date <= iso()).reduce((s, p) => s + (p.min || 0), 0);
  const st = statsOf(S.data.rounds); const G = st ? gaps(st).filter(g => g.v != null).slice(0, 3) : [];
  const ph = currentPhase(); const pend = S.data.videos.filter(v => v.analysis && v.analysis.status === "requested").length;
  const doneBlocks = today ? doneOf(today).filter(Boolean).length : 0;
  const body = `<section class="view">
  <div class="ringcard">${ring(pIdx, pPlan, ci ? n1(ci.value) : "—")}
    <div><div class="sm">Index actuel → cible</div><div class="big">${ci ? n1(ci.value) : "—"} → <span class="red">${n1(target)}</span></div>
    <div class="sm">${ci ? `${n1(ci.value - target)} coups à gagner · ` : ""}<b style="color:var(--red)">${n0(left)} jours</b> avant la clôture des inscriptions · plan ${pc(pPlan * 100)} réalisé</div>
    ${canEdit() ? `<button class="btn ghost sm" style="margin-top:6px" data-act="form" data-kind="index">Mettre à jour l'index</button>` : ""}</div></div>
  ${today ? `<a class="hero" href="#/seance/${today.id}"><span class="lb">${today.date === iso() ? "Séance du jour" : today.date < iso() ? "Séance en retard" : "Prochaine séance · " + fmtDs(today.date)} · ${n0(today.duration)} min</span>
    <span class="t">${esc(today.title)}</span><span class="ch"><span>${today.blocks.length} exercice${today.blocks.length > 1 ? "s" : ""}</span>${sessionTags(today).map(t => `<span>${t}</span>`).join("")}${late > 1 ? `<span>${late} séances à valider</span>` : ""}</span>
    ${doneBlocks ? `<span class="pg"><i style="width:${doneBlocks / today.blocks.length * 100}%"></i></span>` : ""}
    <span class="cta">${doneBlocks ? "Continuer la séance" : "Voir la séance"}</span></a>` : `<div class="empty"><b>Toutes les séances du plan sont validées</b>Demande-moi les 4 semaines suivantes dans le projet Coach de Golf.</div>`}
  <div class="sec"><span>Ce qu'il faut travailler</span><a href="#/parties/perf">Détail</a></div>
  <div class="tiles">${G.map(g => `<a class="tile" href="#/parties/perf"><div class="l">${esc(g.short)}</div><div class="v">${fmtVal(g, g.v)}</div><div class="s ${gapCls(g.g)}">${g.g <= 0 ? "au niveau +2" : "objectif " + fmtVal(g, g.t)}</div><div class="tb"><i style="width:${Math.max(8, Math.min(100, g.dir === "high" ? g.v / g.t * 100 : g.t / Math.max(g.v, .01) * 100))}%;background:${gapCol(g.g)}"></i></div></a>`).join("")}
    ${(() => { const due = past.filter(s => s.date >= since), doneN = due.filter(s => ["Faite", "Partielle"].includes((valOf(s.id) || {}).status)).length;
      const upcoming = plan.sessions.filter(s => s.date > iso() && !valOf(s.id)); const nxt = upcoming.sort((a, b) => a.date.localeCompare(b.date))[0];
      const sub = due.length ? `${doneN}/${due.length} séance${due.length > 1 ? "s" : ""} prévue${due.length > 1 ? "s" : ""} faite${doneN > 1 ? "s" : ""}` : `${upcoming.length} programmées · 1re ${nxt ? fmtDs(nxt.date) : "—"}`;
      const cls = !due.length ? "" : doneN === due.length ? "ok" : doneN / due.length >= 0.5 ? "warn" : "bad";
      return `<a class="tile" href="#/plan"><div class="l">Entraînement 30 j</div><div class="v">${n1(mins / 60)} h</div><div class="s ${cls}">${sub}</div><div class="tb"><i style="width:${due.length ? doneN / due.length * 100 : 0}%;background:#0f2340"></i></div></a>`; })()}</div>
  ${!st ? emptyBox("Pas encore de carte saisie", "Saisis ta prochaine partie trou par trou : les tuiles ci-dessus se rempliront avec tes écarts au niveau +2.", canEdit() ? `<a class="btn sm" href="#/partie/new">Saisir une carte</a>` : "") : ""}
  ${pend ? `<p class="note"><a href="#/videos">${pend} vidéo${pend > 1 ? "s" : ""} en attente d'analyse</a></p>` : ""}
  <div class="card"><h2>Le parcours jusqu'au Mid-Am</h2><div class="path">${(plan.phases || []).map(x => { const c = x.to < iso() ? "past" : (x.from <= iso() && iso() <= x.to ? "now" : "");
    return `<div class="ms ${c}"><b>${esc(x.name)}</b>${x.indexTarget != null ? ` · index ${n1(x.indexTarget)}` : ""}${x === plan.phases[plan.phases.length - 2] ? '<span class="flag"></span>' : ""}<div class="s">${c === "now" ? "maintenant · " : ""}${fmtD(x.from)} → ${fmtD(x.to)}</div></div>`; }).join("")}</div></div>
  ${activityChart()}
  <div class="card"><h2>Trajectoire d'index</h2><div class="chart">${indexChart(target, plan.targetDate)}</div></div>
  </section>`;
  return { kicker: fmtDl(iso()), title: "Bonjour Alexandre", body };
}

/* Activité : trous joués, parties de 18 trous, score moyen (12 derniers mois) */
function activityChart() {
  const months = []; const now = new Date(); for (let k = 11; k >= 0; k--) { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); months.push(iso(d).slice(0, 7)); }
  const by = Object.fromEntries(months.map(m => [m, { holes: 0, r18: 0, sc: [], tp: [] }]));
  for (const r of S.data.rounds) { const m = (r.date || "").slice(0, 7); if (!by[m]) continue; const c = roundCalc(r); if (!c.n) continue;
    const o = by[m]; o.holes += c.n; if (c.n === 18) { o.r18++; o.sc.push(c.score); } o.tp.push((c.score - c.par) * 18 / c.n); }
  const tot = months.reduce((a, m) => ({ holes: a.holes + by[m].holes, r18: a.r18 + by[m].r18, sc: a.sc.concat(by[m].sc), tp: a.tp.concat(by[m].tp) }), { holes: 0, r18: 0, sc: [], tp: [] });
  if (!tot.holes) return `<div class="card"><h2>Activité · 12 mois</h2><p class="small muted">Les trous joués, les parties de 18 trous et le score moyen apparaîtront ici dès ta première carte.</p></div>`;
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const W = 360, L = 28, R = 6, cw = (W - L - R) / 12, bw = cw * 0.62;
  const sT = 24, sB = 128, bT = 158, bB = 262, H = 280;   // bande score (écart au par / 18 trous) en haut, trous joués en bas
  const maxH = Math.max(18, ...months.map(m => by[m].holes)); const top = Math.ceil(maxH / 18) * 18;
  const Y = v => bB - v / top * (bB - bT);
  const allTp = months.flatMap(m => by[m].tp);
  const lo = Math.min(-1, Math.floor(Math.min(...allTp))) - 0.5, hi = Math.max(2, Math.ceil(Math.max(...allTp))) + 0.5;
  const YS = v => sT + (v - lo) / (hi - lo) * (sB - sT);   // sous le par en haut
  const cx = i => L + i * cw + cw / 2;
  const sgnS = v => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  let g = `<text x="0" y="10" font-size="9.5" fill="#0f2340" font-weight="700">SCORE PAR RAPPORT AU PAR · RAMENÉ À 18 TROUS</text><text x="0" y="${bT - 10}" font-size="9.5" fill="#0f2340" font-weight="700">TROUS JOUÉS</text>`;
  // zones : sous le par (vert pâle) / au-dessus (rouge pâle)
  g += `<rect x="${L}" y="${sT}" width="${W - L - R}" height="${YS(0) - sT}" fill="#e4efe6" opacity=".6"/><rect x="${L}" y="${YS(0)}" width="${W - L - R}" height="${sB - YS(0)}" fill="#fbe4e1" opacity=".55"/>`;
  const step = hi - lo > 6 ? 2 : 1;
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${YS(v)}" y2="${YS(v)}" stroke="${v === 0 ? "#0f2340" : "#eadfc8"}" stroke-width="${v === 0 ? 1.2 : 1}"/><text x="${L - 4}" y="${YS(v) + 3}" text-anchor="end" font-size="9" fill="${v === 0 ? "#0f2340" : "#7d7462"}" font-weight="${v === 0 ? 700 : 400}">${v === 0 ? "par" : sgnS(v)}</text>`;
  months.forEach((m, i) => { const t = by[m].tp; if (!t.length) return; const mn = Math.min(...t), mx = Math.max(...t), av = avg(t), x = cx(i);
    if (t.length > 1) g += `<line x1="${x}" x2="${x}" y1="${YS(mn)}" y2="${YS(mx)}" stroke="#0f2340" stroke-opacity=".35" stroke-width="5" stroke-linecap="round"/>`;
    const col = av <= 0 ? "#2f6b45" : av < 3 ? "#c9a227" : "#c8372d";
    g += `<circle cx="${x}" cy="${YS(av)}" r="5.5" fill="${col}" stroke="#fff" stroke-width="1.5"/>`;
    const below = YS(av) < sT + 14; g += `<text x="${x}" y="${below ? YS(Math.max(av, mx)) + 15 : YS(Math.min(av, mn)) - 7}" text-anchor="middle" font-size="8.5" fill="${col}" font-weight="700">${sgnS(Math.round(av * 10) / 10)}</text>`; });
  for (let v = 0; v <= top; v += top > 72 ? 36 : 18) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#eadfc8"/><text x="${L - 4}" y="${Y(v) + 3}" text-anchor="end" font-size="9" fill="#7d7462">${v}</text>`;
  months.forEach((m, i) => { const o = by[m], x = cx(i) - bw / 2;
    if (o.holes) { g += `<rect x="${x}" y="${Y(o.holes)}" width="${bw}" height="${bB - Y(o.holes)}" rx="2.5" fill="#c9b48c"/>`;
      if (o.r18) g += `<rect x="${x}" y="${Y(o.r18 * 18)}" width="${bw}" height="${bB - Y(o.r18 * 18)}" rx="2.5" fill="#0f2340"/>`;
      g += `<text x="${cx(i)}" y="${Y(o.holes) - 4}" text-anchor="middle" font-size="9" fill="#0f2340" font-weight="700">${o.holes}</text>`;
      if (o.r18 && bB - Y(o.r18 * 18) > 13) g += `<text x="${cx(i)}" y="${bB - 4}" text-anchor="middle" font-size="8.5" fill="#f3ead8" font-weight="700">${o.r18}×</text>`; }
    g += `<text x="${cx(i)}" y="${H - 4}" text-anchor="middle" font-size="9" fill="#7d7462">${D(m + "-15").toLocaleDateString("fr-FR", { month: "short" }).replace(".", "").slice(0, 4)}</text>`; });
  return `<div class="card"><h2>Activité · 12 mois</h2>
  <div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:10px">
    <div class="kpi"><div class="l">Trous</div><div class="v">${n0(tot.holes)}</div><div class="s">joués</div></div>
    <div class="kpi"><div class="l">Parties 18 t.</div><div class="v">${tot.r18}</div><div class="s">+ ${n0(tot.holes - tot.r18 * 18)} trous</div></div>
    <div class="kpi"><div class="l">Score / par</div><div class="v">${tot.tp.length ? sgn(avg(tot.tp)) : "—"}</div><div class="s">${tot.sc.length ? "moy. 18 t. : " + n1(avg(tot.sc)) : "ramené à 18 t."}</div></div>
  </div>
  <svg viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:auto" role="img" aria-label="Trous joués, parties de 18 trous et score moyen par mois">${g}</svg>
  <div class="row xs muted" style="gap:14px;margin-top:4px"><span><i style="display:inline-block;width:10px;height:10px;background:#c9b48c;border-radius:2px;vertical-align:-1px"></i> trous joués</span><span><i style="display:inline-block;width:10px;height:10px;background:#0f2340;border-radius:2px;vertical-align:-1px"></i> dont parties de 18 trous (n×)</span></div>
  <p class="xs muted" style="margin-top:6px">Score : point = moyenne du mois, trait = meilleure et moins bonne carte. Chaque carte est ramenée à 18 trous (écart au par × 18 ÷ trous joués) : une carte de 9 trous à +2 compte +4. Vert : sous le par · jaune : moins de +3 · rouge : +3 et plus.</p></div>`;
}
function indexChart(target, tDate) {
  const h = ((S.profile && S.profile.indexHistory) || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (!h.length) return `<p class="small muted">Ajoute ton index pour suivre la trajectoire.</p>`;
  const W = 640, H = 220, L = 44, R = 16, T = 14, B = 30;
  const x0 = Math.min(+D(h[0].date), +D(iso()) - 60 * 864e5), x1 = +D(tDate);
  const vals = h.map(p => p.value).concat([target]); const ymin = Math.floor(Math.min(...vals) - 0.5), ymax = Math.ceil(Math.max(...vals) + 0.5);
  const X = d => L + (D(d) - x0) / (x1 - x0) * (W - L - R); const Y = v => T + (v - ymin) / (ymax - ymin) * (H - T - B);
  let g = "";
  for (let v = ymin; v <= ymax; v++) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#eadfc8"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="#7d7462">${v < 0 ? "−" : ""}${Math.abs(v)}</text>`;
  for (let y = new Date(x0).getFullYear(); y <= new Date(x1).getFullYear(); y++) for (const m of [0, 6]) { const d = iso(new Date(y, m, 1)); if (+D(d) >= x0 && +D(d) <= x1) g += `<text x="${X(d)}" y="${H - 10}" text-anchor="middle" font-size="11" fill="#7d7462">${D(d).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })}</text>`; }
  g += `<line x1="${X(h[0].date)}" y1="${Y(h[0].value)}" x2="${X(tDate)}" y2="${Y(target)}" stroke="#c9b48c" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  g += `<line x1="${X(iso())}" x2="${X(iso())}" y1="${T}" y2="${H - B}" stroke="#eadfc8"/>`;
  g += `<path d="M${X(tDate) - 2} ${Y(target) + 2} v-22 l12 5 -12 5" fill="#c8372d" stroke="#c8372d" stroke-width="1.5"/><text x="${X(tDate) - 8}" y="${Y(target) - 6}" text-anchor="end" font-size="11" fill="#c8372d">cible ${n1(target)}</text>`;
  if (h.length > 1) g += `<polyline fill="none" stroke="#0f2340" stroke-width="2.5" points="${h.map(p => X(p.date) + "," + Y(p.value)).join(" ")}"/>`;
  g += h.map((p, i) => `<circle cx="${X(p.date)}" cy="${Y(p.value)}" r="${i === h.length - 1 ? 5 : 3.5}" fill="#0f2340"/>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution de l'index vers la cible">${g}</svg><p class="xs muted" style="margin-top:4px">Haut du graphique = meilleur index. Pointillés : trajectoire vers la cible.</p>`;
}

/* ---------- Plan & séances ---------- */
function statusOf(s) {
  const v = valOf(s.id), t = iso();
  if (v) return { cls: v.status === "Faite" ? "ok" : v.status === "Partielle" ? "warn" : "bad", lab: v.status, v };
  return { cls: s.date < t ? "warn" : s.date === t ? "acc" : "", lab: s.date < t ? "à valider" : s.date === t ? "aujourd'hui" : "prévue", v: null };
}
function vPlan() {
  const p = S.plan, t = iso(), f = S.planFilter;
  let list = [...p.sessions];
  if (f === "todo") list = list.filter(s => !valOf(s.id)); if (f === "done") list = list.filter(s => valOf(s.id));
  if (S.tagFilter) list = list.filter(s => sessionTags(s).includes(S.tagFilter));
  list.sort((a, b) => f === "done" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
  const toVal = p.sessions.filter(s => !valOf(s.id) && s.date <= t).length;
  const weeks = {}; for (const s of list) (weeks[mondayOf(s.date)] = weeks[mondayOf(s.date)] || []).push(s);
  const wk = Object.keys(weeks).sort((a, b) => f === "done" ? b.localeCompare(a) : a.localeCompare(b));
  const body = `<section class="view">
  <div class="chips" role="group" aria-label="Filtre">${[["todo", "À faire"], ["done", "Validées"], ["all", "Toutes"]].map(([k, l]) => `<button data-act="pf" data-f="${k}" aria-pressed="${f === k}">${l}</button>`).join("")}</div>
  ${tagFilter()}
  ${toVal ? `<p class="note">${toVal} séance${toVal > 1 ? "s" : ""} à valider</p>` : ""}
  <div>${wk.length ? wk.map(w => `<div class="week"><div class="wl">Semaine du ${D(w).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</div>${weeks[w].map(cardSession).join("")}</div>`).join("") : `<p class="small muted">Aucune séance dans ce filtre.</p>`}</div>
  <div class="card"><h2>Objectif</h2><p class="small">${esc(p.objective)}</p><p class="xs muted" style="margin-top:6px">Plan du ${fmtD(p.version)} · ${esc(p.note || "")}</p></div>
  <div class="card"><h2>Préconisations</h2>${(p.recos || []).map((r, i) => `<div class="reco"><div class="p">${i + 1}</div><div><div class="row between"><h3>${esc(r.title)}</h3>${r.area ? `<span class="pill">${esc(r.area)}</span>` : ""}</div>
    ${r.why ? `<p class="small muted" style="margin-top:4px">${esc(r.why)}</p>` : ""}${r.how ? `<p class="small" style="margin-top:6px">${esc(r.how)}</p>` : ""}
    ${r.kpi ? `<p class="small" style="margin-top:6px"><span class="muted">Indicateur : </span>${esc(r.kpi)}</p>` : ""}
    ${(r.drills || []).length ? `<p class="small" style="margin-top:6px">${r.drills.map(d => S.drills[d] ? `<a href="#/exercice/${d}">${esc(S.drills[d].name)}</a>` : "").filter(Boolean).join(" · ")}</p>` : ""}</div></div>`).join("")}</div>
  </section>`;
  return { kicker: "Plan d'entraînement", title: "Séances", body };
}
function doneOf(s) { const v = valOf(s.id); let d = v && Array.isArray(v.blocksDone) ? v.blocksDone : lsGet("golf-done-" + s.id, null); if (!Array.isArray(d) || d.length !== s.blocks.length) d = s.blocks.map(() => false); return d; }
function exRows(s) {
  const done = doneOf(s), locked = !!valOf(s.id) || !canEdit();
  return `<div class="exlist">${s.blocks.map((b, i) => { const d = S.drills[b.drill] || { name: b.drill };
    return `<div class="exrow ${done[i] ? "on" : ""}"><button class="chk" data-act="ex-toggle" data-sid="${s.id}" data-i="${i}" aria-pressed="${done[i]}" aria-label="Exercice fait" ${locked ? "disabled" : ""}>${done[i] ? "✓" : ""}</button>
      <a href="#/exercice/${b.drill}"><span class="nm">${esc(d.name)}</span><span class="mt">${b.min} min${(d.tags || []).length ? " · " + d.tags.map(esc).join(", ") : ""}${(d.videos || []).length ? " · ▶ vidéo" : ""}</span></a><a class="go" href="#/exercice/${b.drill}" aria-label="Détail">›</a></div>`; }).join("")}</div>`;
}
function tagFilter() { return `<div class="chips tagchips" role="group" aria-label="Type d'entraînement"><span class="lbl" style="align-self:center;margin-right:2px">Type</span><button data-act="tf" data-f="" aria-pressed="${!S.tagFilter}">Tous</button>${TAGS.map(t => `<button data-act="tf" data-f="${t}" aria-pressed="${S.tagFilter === t}" style="--c:${TAG_COLOR[t]}">${t}</button>`).join("")}</div>`; }
function cardSession(s) {
  const st = statusOf(s), done = doneOf(s), n = done.filter(Boolean).length;
  return `<div class="card ${st.v ? "done" : ""}" style="gap:8px;display:flex;flex-direction:column">
  <a href="#/seance/${s.id}" style="text-decoration:none;color:inherit"><div class="row between"><h3>${esc(s.title)}</h3><span class="pill ${st.cls}">${esc(st.lab)}</span></div>
  <div class="meta"><span>${fmtDs(s.date)}</span><span>·</span><span>${n0(s.duration)} min</span>${tagsHtml(sessionTags(s))}</div><p class="xs muted" style="margin-top:2px">Objectif : ${esc(s.kpi)}</p></a>
  ${exRows(s)}
  ${st.v ? `${st.v.measure || st.v.feedback ? `<p class="small muted">${esc([st.v.measure, st.v.feedback].filter(Boolean).join(" · "))}</p>` : ""}<div class="row"><a class="btn ghost sm" href="#/seance/${s.id}">Notes, vidéos, modifier</a></div>`
    : canEdit() ? `<div class="row between"><a class="small" href="#/seance/${s.id}">Note, vidéo, ressenti ›</a><button class="btn sm" data-act="quick-validate" data-sid="${s.id}">${n && n < s.blocks.length ? `Valider (${n}/${s.blocks.length})` : "Valider la séance"}</button></div>` : ""}
  </div>`;
}
async function quickValidate(s) {
  let done = doneOf(s); const n = done.filter(Boolean).length;
  if (!n) done = done.map(() => true);
  const all = done.every(Boolean);
  const mins = s.blocks.reduce((a, b, i) => a + (done[i] ? b.min : 0), 0);
  try { await Store.set("validations", s.id, { status: all ? "Faite" : "Partielle", blocksDone: done, actualMin: mins, rating: null, measure: "", feedback: "", validatedAt: iso() }); lsSet("golf-done-" + s.id, null); toast(all ? "Séance validée" : "Séance validée (partielle)"); }
  catch (e) { console.error(e); toast("Enregistrement impossible (" + ((e && e.code) || "réseau") + ")."); }
}
function vSeance(p) {
  const s = S.plan.sessions.find(x => x.id === p[1]); if (!s) return emptyBox("Séance introuvable", "Elle a peut-être été retirée du plan.", `<a class="btn ghost sm" href="#/plan">Retour aux séances</a>`);
  const st = statusOf(s), v = st.v || {}, done = doneOf(s), nDone = done.filter(Boolean).length;
  const mins = s.blocks.reduce((a, b, i) => a + (done[i] ? b.min : 0), 0);
  const body = `<section class="view">
  <div class="row between"><span class="pill" style="background:${areaColor(s.domain)}1a;color:${areaColor(s.domain)}">${esc(s.domain)} · ${s.blocks.length} exercice${s.blocks.length > 1 ? "s" : ""}</span><span class="pill ${st.cls}">${esc(st.lab)}</span></div>
  <div class="card hl"><span class="lbl">Critère de réussite</span><p class="small" style="margin-top:3px">${esc(s.kpi)}</p></div>
  <div><h2>Exercices · touche une ligne pour le détail</h2>${exRows(s)}</div>
  ${canEdit() ? `<div class="card"><h2>${st.v ? "Validation" : "Valider la séance"}</h2><form class="stack" data-form="validate" data-id="${s.id}">
    <div class="f"><span class="lbl">Résultat</span><div class="seg" data-seg="status">${["Faite", "Partielle", "Non faite"].map(o => `<button type="button" data-v="${o}" aria-pressed="${(v.status || (nDone && nDone < s.blocks.length ? "Partielle" : "Faite")) === o}">${o}</button>`).join("")}</div></div>
    <div class="f"><span class="lbl">Qualité ressentie</span><div class="seg" data-seg="rating">${[1, 2, 3, 4, 5].map(o => `<button type="button" data-v="${o}" aria-pressed="${v.rating === o}">${o}</button>`).join("")}</div></div>
    <div class="grid"><div class="f"><label for="v-min">Durée réelle (min)</label><input id="v-min" name="actualMin" inputmode="numeric" value="${esc(v.actualMin ?? (nDone ? mins : s.duration))}"></div>
      <div class="f"><label for="v-measure">Mesure obtenue</label><input id="v-measure" name="measure" value="${esc(v.measure || "")}" placeholder="Ex. 8/10 dans la porte"></div>
      <div class="f full"><label for="v-fb">Retour : ce qui a marché, ce qui coince</label><textarea id="v-fb" name="feedback" data-keep>${esc(v.feedback || "")}</textarea></div></div>
    <div class="row"><button class="btn" type="submit">${st.v ? "Mettre à jour" : "Valider la séance"}</button>${st.v ? `<button class="btn ghost sm" type="button" data-act="unvalidate" data-id="${s.id}">Annuler la validation</button>` : ""}</div>
  </form></div>` : ""}
  ${notesBlock("plan:" + s.id)}
  ${videosBlock("plan:" + s.id)}
  </section>`;
  return { back: ["#/plan", "Séances"], title: esc(s.title), body, right: `<span class="xs muted" style="white-space:nowrap">${fmtDs(s.date)}<br>${n0(s.duration)} min</span>` };
}

/* ---------- Vidéos des pros ---------- */
const ytFrame = (id, title) => `<div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${esc(title)}" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>`;
function proVideo(v) { return `<div class="stack" style="gap:6px">${ytFrame(v.yt, v.title)}<div class="small"><b>${esc(v.pro)}</b> · ${esc(v.title)} <a href="https://www.youtube.com/watch?v=${v.yt}" target="_blank" rel="noopener">↗</a></div></div>`; }

/* ---------- Exercice ---------- */
function vExercice(p) {
  const d = S.drills[p[1]]; if (!d) return emptyBox("Exercice introuvable", "", `<a class="btn ghost sm" href="#/plan">Retour aux séances</a>`);
  const used = S.plan.sessions.filter(s => (s.blocks || []).some(b => b.drill === d.id));
  const links = S.data.drillLinks.filter(l => l.drill === d.id);
  const li = a => a && a.length ? `<ul class="plain small">${a.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="small muted">—</p>`;
  const body = `<section class="view">
  <div class="row">${tagsHtml(d.tags)}<span class="pill">Défaut ciblé : ${esc(d.fault)}</span></div>
  <p>${esc(d.objective)}</p>
  <div class="card hl"><span class="lbl">Critère de réussite</span><p class="small" style="margin-top:3px">${esc(d.success)}</p></div>
  <div class="card"><h2>Déroulé</h2><ol class="steps small">${(d.steps || []).map(x => `<li>${esc(x)}</li>`).join("")}</ol></div>
  <div class="two"><div class="card"><h2>Matériel</h2>${li(d.equipment)}</div><div class="card"><h2>Mise en place</h2>${li(d.setup)}</div></div>
  <div class="two"><div class="card"><h2>Consignes clés</h2>${li(d.cues)}</div><div class="card"><h2>Erreurs fréquentes</h2>${li(d.errors)}</div></div>
  <div class="card"><h2>Vidéos et démonstrations</h2><div class="stack">
    ${(d.videos || []).map(proVideo).join("")}
    ${links.map(l => { const y = ytId(l.url); return `<div class="stack">${y ? `<div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${y}" title="${esc(l.label || d.name)}" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" loading="lazy"></iframe></div>` : ""}<div class="row between small"><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label || l.url)}</a>${canEdit() ? `<button class="btn ghost sm" data-act="del-link" data-id="${l._id}">Retirer</button>` : ""}</div></div>`; }).join("")}
    ${(d.refs || []).map(r => `<a class="small" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.label)} ↗</a>`).join("")}
    <a class="demo" href="https://www.youtube.com/results?search_query=${encodeURIComponent(d.yt || d.name)}" target="_blank" rel="noopener">${icon("play", "color:#c8372d;flex:none")}<span>Voir les démonstrations sur YouTube ↗</span></a>
    ${canEdit() ? `<form class="stack" data-form="link" data-drill="${d.id}"><div class="grid"><div class="f full"><label for="lk-url">Ajouter une vidéo (lien YouTube ou autre)</label><input id="lk-url" name="url" data-keep placeholder="https://youtu.be/…"></div><div class="f full"><label for="lk-label">Titre</label><input id="lk-label" name="label" data-keep placeholder="Ex. démo du pro"></div></div><div><button class="btn ghost sm" type="submit">Ajouter la vidéo</button></div></form>` : ""}
  </div></div>
  ${used.length ? `<div class="card"><h2>Séances qui l'utilisent</h2><div class="list">${used.map(s => `<a class="item" href="#/seance/${s.id}"><div class="head"><span>${esc(s.title)}</span><span class="small muted">${fmtDs(s.date)}</span></div></a>`).join("")}</div></div>` : ""}
  </section>`;
  return { back: ["#", "Retour"], title: esc(d.name), body };
}

/* ---------- Notes & vidéos ---------- */
function notesBlock(ref) {
  const notes = S.data.notes.filter(n => n.ref === ref).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const k = ref.replace(/[^\w]/g, "_");
  return `<div class="card"><h2>Notes</h2>
  ${notes.length ? `<div class="list">${notes.map(n => `<div class="item"><div class="head"><span class="small muted">${fmtD(n.date)}</span>${canEdit() ? `<button class="btn ghost sm" data-act="del-note" data-id="${n._id}">Supprimer</button>` : ""}</div>
    ${n.text ? `<p class="pre small">${esc(n.text)}</p>` : ""}
    ${(n.files || []).map(f => /^image\//.test(f.type) ? `<a href="${esc(f.url)}" target="_blank" rel="noopener"><img src="${esc(f.url)}" alt="${esc(f.name)}" style="max-height:220px;border-radius:10px"></a>` : `<a class="small" href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.name)} (${sizeTxt(f.size || 0)}) ↗</a>`).join("")}</div>`).join("")}</div>` : ""}
  ${canEdit() ? `<form class="stack" data-form="note" data-ref="${esc(ref)}" style="margin-top:6px">
    <div class="f"><label for="nt-${k}">Écrire une note</label><textarea id="nt-${k}" name="text" data-keep placeholder="Sensations, chiffres, consignes à retenir…"></textarea></div>
    <div class="f"><label for="nf-${k}">Joindre une photo ou un fichier</label><input id="nf-${k}" name="files" type="file" multiple accept="image/*,application/pdf,.txt,.md,.doc,.docx"></div>
    <div class="progress" hidden><span></span></div>
    <div><button class="btn navy sm" type="submit">Ajouter la note</button></div></form>` : ""}</div>`;
}
function videoItem(v, showRef) {
  const a = v.analysis || {}; let refLink = "";
  if (showRef && v.ref) { const [t, id] = v.ref.split(":"); if (t === "plan") { const s = S.plan.sessions.find(x => x.id === id); refLink = s ? `<a class="small" href="#/seance/${id}">${esc(s.title)}</a>` : ""; } else if (t === "free" && id !== "none") { refLink = `<a class="small" href="#/entrainement/${id}">Entraînement</a>`; } }
  return `<div class="item"><div class="head"><span class="small">${fmtD(v.date)} · ${esc(v.angle || "")}${v.club ? " · " + esc(v.club) : ""}</span>
    ${a.status === "done" ? `<span class="pill ok">analysée</span>` : a.status === "requested" ? `<span class="pill warn">analyse demandée</span>` : ""}</div>
  ${refLink}
  <video class="player" src="${esc(v.url)}" controls preload="metadata" playsinline></video>
  ${v.comment ? `<p class="small pre">${esc(v.comment)}</p>` : ""}
  ${a.status === "done" && a.text ? `<div class="analysis"><p class="xs muted" style="margin-bottom:6px">Analyse de Claude · ${fmtD(a.at)}</p><div class="pre">${esc(a.text)}</div></div>` : ""}
  ${canEdit() ? `<div class="row">${a.status !== "requested" ? `<button class="btn ghost sm" data-act="ask-analysis" data-id="${v._id}">${a.status === "done" ? "Redemander une analyse" : "Demander l'analyse à Claude"}</button>` : ""}<button class="btn ghost sm" data-act="del-video" data-id="${v._id}">Supprimer</button></div>` : ""}</div>`;
}
function videosBlock(ref) {
  const vids = S.data.videos.filter(v => v.ref === ref).sort(byDateDesc); const k = ref.replace(/[^\w]/g, "_");
  return `<div class="card"><h2>Vidéos</h2>
  ${vids.length ? `<div class="list">${vids.map(v => videoItem(v)).join("")}</div>` : ""}
  ${canEdit() ? videoForm(ref, k) : ""}</div>`;
}
function videoForm(ref, k) {
  return `<form class="stack" data-form="video" data-ref="${esc(ref)}" style="margin-top:6px">
    <div class="f"><span class="lbl">Vidéo</span>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <label class="btn ghost sm" for="vf-${k}" style="cursor:pointer">Choisir dans la galerie</label>
        <label class="btn ghost sm" for="vk-${k}" style="cursor:pointer">Filmer</label>
      </div>
      <input id="vf-${k}" name="file" type="file" accept="video/*" hidden onchange="this.form.querySelector('.vname').textContent=this.files[0]?this.files[0].name:'';this.form.fileCam.value=''">
      <input id="vk-${k}" name="fileCam" type="file" accept="video/*" capture="environment" hidden onchange="this.form.querySelector('.vname').textContent=this.files[0]?this.files[0].name:'';this.form.file.value=''">
      <span class="vname xs muted" style="overflow-wrap:anywhere"></span></div>
    <div class="grid">
      <div class="f"><label for="va-${k}">Angle</label><select id="va-${k}" name="angle"><option>Down-the-line</option><option>De face</option><option>Autre</option></select></div>
      <div class="f"><label for="vc-${k}">Club</label><input id="vc-${k}" name="club" data-keep placeholder="Ex. fer 7"></div>
      <div class="f full"><label for="vm-${k}">Ce que tu veux qu'on regarde</label><textarea id="vm-${k}" name="comment" data-keep placeholder="Ex. chemin de club à la transition"></textarea></div>
    </div>
    <label class="row small" style="color:var(--ink)"><input type="checkbox" name="ask" checked style="width:auto"> Demander l'analyse à Claude</label>
    <div class="upl stack" hidden style="gap:4px"><div class="progress"><span></span></div><div class="row between xs muted"><span class="upl-t">Préparation…</span><button type="button" class="btn ghost sm" data-act="upload-cancel">Annuler</button></div><span class="upl-h xs muted"></span></div>
    <div><button class="btn navy sm" type="submit">Envoyer la vidéo</button></div></form>`;
}
function vVideos() {
  const f = S.vidFilter; let l = [...S.data.videos].sort(byDateDesc);
  if (f === "req") l = l.filter(v => v.analysis && v.analysis.status === "requested"); if (f === "done") l = l.filter(v => v.analysis && v.analysis.status === "done");
  const body = `<section class="view"><p class="small muted">Pour une analyse : demande-la ici, puis écris « analyse mes vidéos » dans le projet Coach de Golf. La réponse s'affiche sous la vidéo.</p>
  <div class="chips">${[["all", "Toutes"], ["req", "Analyse demandée"], ["done", "Analysées"]].map(([k, lab]) => `<button data-act="vf" data-f="${k}" aria-pressed="${f === k}">${lab}</button>`).join("")}</div>
  ${l.length ? `<div class="card"><div class="list">${l.map(v => videoItem(v, true)).join("")}</div></div>` : emptyBox("Aucune vidéo", "Filme-toi depuis une séance : la vidéo y reste rattachée.")}
  ${canEdit() ? `<div class="card"><h2>Vidéo hors séance</h2>${videoForm("free:none", "free")}</div>` : ""}</section>`;
  return { back: ["#/plus", "Plus"], title: "Vidéos", body };
}

/* ---------- Plus : entraînements libres, cours, vidéos ---------- */
function vPlus() {
  const pend = S.data.videos.filter(v => v.analysis && v.analysis.status === "requested").length;
  const it = (href, ic, col, t, s) => `<a href="${href}"><span class="ic" style="background:${col}">${icon(ic)}</span><span>${t}<small>${s}</small></span></a>`;
  const body = `<section class="view"><div class="card menu">
    ${it("#/entrainements", "dumb", "#2c5aa0", "Entraînements libres", `${S.data.sessions.length} séance${S.data.sessions.length > 1 ? "s" : ""} hors plan`)}
    ${it("#/cours", "user", "#a0612f", "Cours avec le pro", `${S.data.lessons.length} cours saisi${S.data.lessons.length > 1 ? "s" : ""}`)}
    ${it("#/videos", "video", "#c8372d", "Vidéos et analyses", pend ? `${pend} en attente d'analyse` : `${S.data.videos.length} vidéo${S.data.videos.length > 1 ? "s" : ""}`)}
    ${it("#/parties/perf", "chart", "#0f2340", "Performance détaillée", "Carte par parcours")}
    ${DEMO ? "" : `<button data-act="logout"><span class="ic" style="background:#7d7462">${icon("out")}</span><span>Se déconnecter<small>${esc(S.user.email || "")}</small></span></button>`}
  </div>${domainBars()}</section>`;
  return { kicker: "Suivi", title: "Plus", body };
}
function domainBars() {
  const since = iso(new Date(Date.now() - 60 * 864e5)); const pr = practiceLog().filter(p => p.date >= since && p.date <= iso()); if (!pr.length) return "";
  const m = {}; for (const p of pr) { const ks = p.tags && p.tags.length ? p.tags : ["Autre"]; for (const k of ks) m[k] = (m[k] || 0) + (p.min || 0) / ks.length; }
  const tot = Object.values(m).reduce((a, b) => a + b, 0) || 1;
  return `<div class="card"><h2>Répartition 60 jours · ${n1(tot / 60)} h</h2><div class="hbars">${Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="hbar"><span>${esc(k)}</span><div class="bar"><span style="width:${(v / tot * 100).toFixed(1)}%;background:${TAG_COLOR[k] || "#7d7462"}"></span></div><span class="t">${n0(v / tot * 100)} %</span></div>`).join("")}</div></div>`;
}
function vEntrainements() {
  let l = [...S.data.sessions].sort(byDateDesc); if (S.tagFilter) l = l.filter(s => freeTags(s).includes(S.tagFilter));
  const body = `<section class="view">${canEdit() ? `<button class="btn wide" data-act="form" data-kind="session">+ Entraînement libre</button>` : ""}
  ${tagFilter()}
  ${l.length ? `<div class="card"><div class="list">${l.map(s => `<a class="item" href="#/entrainement/${s._id}"><div class="head"><span class="small muted">${fmtD(s.date)} · ${n0(s.duration)} min${s.rating ? ` · ${s.rating}/5` : ""}</span>${tagsHtml(freeTags(s))}</div><p class="small pre">${esc(s.content)}</p>${s.result ? `<p class="small"><span class="muted">Mesure : </span>${esc(s.result)}</p>` : ""}</a>`).join("")}</div></div>`
    : emptyBox("Aucun entraînement libre", "Les séances hors plan (practice improvisé, parcours d'entraînement) se notent ici.")}</section>`;
  return { back: ["#/plus", "Plus"], title: "Entraînements libres", body };
}
function vEntrainement(p) {
  const s = S.data.sessions.find(x => x._id === p[1]); if (!s) return S.loaded ? emptyBox("Entraînement introuvable", "", `<a class="btn ghost sm" href="#/entrainements">Retour</a>`) : `<p class="muted">Chargement…</p>`;
  const body = `<section class="view">
  <div class="meta"><span>${fmtD(s.date)}</span><span>·</span><span>${n0(s.duration)} min</span>${s.rating ? `<span>· qualité ${s.rating}/5</span>` : ""}${tagsHtml(freeTags(s))}${canEdit() ? `<button class="btn ghost sm" data-act="form" data-kind="session" data-id="${s._id}">Modifier</button>` : ""}</div>
  <div class="card"><p class="pre">${esc(s.content)}</p>${s.result ? `<p class="small" style="margin-top:6px"><span class="muted">Mesure : </span>${esc(s.result)}</p>` : ""}${s.notes ? `<p class="small muted pre" style="margin-top:6px">${esc(s.notes)}</p>` : ""}</div>
  ${notesBlock("free:" + s._id)}${videosBlock("free:" + s._id)}</section>`;
  return { back: ["#/entrainements", "Entraînements libres"], title: esc(freeTags(s).join(" · ") || s.domain || "Entraînement"), body };
}
function vCours() {
  const l = [...S.data.lessons].sort(byDateDesc);
  const body = `<section class="view">${canEdit() ? `<button class="btn wide" data-act="form" data-kind="lesson">+ Cours avec le pro</button>` : ""}
  ${l.length ? l.map(s => `<div class="card stack"><div class="row between"><h3>${esc(s.theme)}</h3><span class="small muted">${fmtD(s.date)}${s.pro ? " · " + esc(s.pro) : ""}</span></div>
  ${s.findings ? `<p class="small pre"><span class="lbl">Constats</span><br>${esc(s.findings)}</p>` : ""}${s.drills ? `<p class="small pre"><span class="lbl">Consignes</span><br>${esc(s.drills)}</p>` : ""}${s.toWork ? `<p class="small pre"><span class="lbl">À travailler</span><br>${esc(s.toWork)}</p>` : ""}
  <div class="row">${s.video ? `<a class="small" href="${esc(s.video)}" target="_blank" rel="noopener">Vidéo ↗</a>` : ""}${canEdit() ? `<button class="btn ghost sm" data-act="form" data-kind="lesson" data-id="${s._id}">Modifier</button>` : ""}</div></div>`).join("")
    : emptyBox("Aucun cours saisi", "Après chaque cours : thème, constats du pro, consignes et ce qui doit être travaillé.")}</section>`;
  return { back: ["#/plus", "Plus"], title: "Cours avec le pro", body };
}

/* ---------- Parties (UX Club-house) ---------- */
function partiesNav(sub) { return `<div class="chips"><a href="#/parties" ${sub !== "perf" ? 'aria-current="page"' : ""}>Cartes</a><a href="#/parties/perf" ${sub === "perf" ? 'aria-current="page"' : ""}>Performance détaillée</a></div>`; }
function vParties(p) {
  if (p[1] === "perf") return vPerf();
  const l = [...S.data.rounds].sort(byDateDesc);
  const body = `<section class="view">${partiesNav()}
  ${canEdit() ? draftCard() : ""}
  ${canEdit() ? (S.draft && !S.draft.id ? `<button class="btn ghost wide" data-act="draft-new">+ Nouvelle carte (abandonne la carte en cours)</button>` : `<a class="btn wide" href="#/partie/new">+ Nouvelle carte</a>`) : ""}
  ${l.length ? l.map(r => { const c = roundCalc(r); return `<a class="card" href="#/partie/${r._id}"><div class="row between"><h3 class="serif" style="font-size:17px">${esc(r.course)}</h3><span class="serif" style="font-size:20px;font-weight:700">${c.score} <span class="small muted">${sgn(c.score - c.par)}</span></span></div>
    <div class="meta"><span>${fmtD(r.date)}</span><span>·</span><span>${esc(r.type || "")}</span><span>·</span><span>${c.n} trous</span></div>
    ${miniCard(r)}
    <div class="meta"><span>${c.puttsN ? c.putts + " putts" : ""}</span><span>FW ${c.fwPoss ? c.fwHit + "/" + c.fwPoss : "—"}</span><span>GIR ${c.gir}/${c.n}</span><span>Scr. ${c.scrOpp ? c.scr + "/" + c.scrOpp : "—"}</span>${c.short ? `<span>${c.short} putt${c.short > 1 ? "s" : ""} &lt; 2 m ratés</span>` : ""}</div></a>`; }).join("")
    : emptyBox("Aucune carte saisie", "Saisis ta prochaine partie trou par trou, sur le parcours ou après.")}
  </section>`;
  return { kicker: "Cartes de score", title: "Parties", body };
}
function miniCard(r) {
  const hs = (r.holesData || []).slice().sort((a, b) => a.n - b.n);
  return `<div class="holestrip"><table><tr><th class="l">Trou</th>${hs.map(h => `<th>${h.n}</th>`).join("")}</tr><tr><td class="l">Score</td>${hs.map(h => `<td>${scoreCell(h.score, h.par || 4, true)}</td>`).join("")}</tr></table></div>`;
}
function scoreCell(score, par, small) {
  if (score == null) return `<span class="muted">·</span>`; const d = score - par; const c = d <= -2 ? "b2" : d === -1 ? "b1" : d === 1 ? "p1" : d >= 2 ? "p2" : "";
  return `<span class="sc ${c}" ${small ? 'style="width:22px;height:22px;font-size:12px"' : ""}>${score}</span>`;
}
function avgCell(avg, par) {
  if (avg == null) return "—"; const d = avg - par; const c = d < -0.05 ? "b1" : d >= 1 ? "p2" : d >= 0.5 ? "p1" : "";
  return `<span class="sc ${c}" style="width:auto;min-width:30px;height:26px;padding:0 3px;font-size:12px">${n1(avg)}</span>`;
}
function scorecardTable(rows, mode) {
  const halves = [rows.filter(r => r.n <= 9), rows.filter(r => r.n > 9)].filter(h => h.length);
  const fwCell = r => mode === "one" ? (r.par < 4 ? `<span class="muted">·</span>` : r.fw === "Y" ? `<span class="dot on"></span>` : r.fw === "L" ? `<span class="miss">G</span>` : r.fw === "R" ? `<span class="miss">D</span>` : "—")
    : (r.fwPoss ? `${pc(r.fwHit / r.fwPoss * 100)}<div class="xs miss">${r.missL ? r.missL + "G " : ""}${r.missR ? r.missR + "D" : ""}</div>` : `<span class="muted">·</span>`);
  const girCell = r => mode === "one" ? (r.score == null ? "—" : `<span class="dot ${r.gir ? "on" : ""}"></span>`) : (r.cnt ? `<span style="display:block;margin:-6px -3px;padding:6px 3px;background:rgba(15,35,64,${(r.gir / r.cnt) * .35})">${pc(r.gir / r.cnt * 100)}</span>` : "—");
  const scrCell = r => mode === "one" ? (r.score == null || r.gir ? `<span class="muted">·</span>` : r.scr ? "✓" : `<span class="miss">✗</span>`) : (r.scrOpp ? `${r.scr}/${r.scrOpp}` : `<span class="muted">·</span>`);
  return halves.map(h => {
    const sum = k => h.reduce((s, r) => s + (r[k] || 0), 0);
    const totScore = mode === "one" ? (h.every(r => r.score != null) ? sum("score") : "—") : n1(sum("avg"));
    return `<div class="tbl-wrap" style="margin-bottom:10px"><table class="scorecard"><thead><tr><th class="rl">${h[0].n <= 9 ? "Aller" : "Retour"}</th>${h.map(r => `<th>${r.n}</th>`).join("")}<th>Tot.</th></tr></thead><tbody>
    <tr><td class="rl">Par</td>${h.map(r => `<td>${r.par}</td>`).join("")}<td class="tot">${sum("par")}</td></tr>
    <tr><td class="rl">${mode === "one" ? "Score" : "Moyenne"}</td>${h.map(r => `<td>${mode === "one" ? scoreCell(r.score, r.par) : avgCell(r.cnt ? r.avg : null, r.par)}</td>`).join("")}<td class="tot">${totScore}</td></tr>
    <tr><td class="rl">Putts</td>${h.map(r => `<td>${mode === "one" ? (r.putts ?? "—") : (r.cnt ? n1(r.puttsAvg) : "—")}</td>`).join("")}<td class="tot">${mode === "one" ? sum("putts") : n1(sum("puttsAvg"))}</td></tr>
    <tr><td class="rl">Fairway</td>${h.map(r => `<td>${fwCell(r)}</td>`).join("")}<td class="tot"></td></tr>
    <tr><td class="rl">GIR</td>${h.map(r => `<td>${girCell(r)}</td>`).join("")}<td class="tot">${mode === "one" ? h.filter(r => r.gir).length : ""}</td></tr>
    <tr><td class="rl">Scrambling</td>${h.map(r => `<td>${scrCell(r)}</td>`).join("")}<td class="tot"></td></tr>
    <tr><td class="rl">&lt; 2 m ratés</td>${h.map(r => `<td>${r.score == null && mode === "one" ? "—" : (r.short ? `<span class="miss">${r.short}</span>` : `<span class="muted">·</span>`)}</td>`).join("")}<td class="tot">${sum("short")}</td></tr>
    </tbody></table></div>`;
  }).join("");
}
function holeRowsOne(r) {
  return (r.holesData || []).slice().sort((a, b) => a.n - b.n).map(h => ({ n: h.n, par: h.par || 4, score: h.score, putts: h.putts, fw: h.fw, gir: holeGir(h), scr: !holeGir(h) && h.score != null && h.score <= (h.par || 4), short: h.short || 0 }));
}
function holeRowsAvg(rounds, pars) {
  const by = {};
  for (const r of rounds) for (const h of r.holesData || []) { if (h.score == null) continue; const o = by[h.n] = by[h.n] || { n: h.n, par: h.par || pars[h.n - 1] || 4, cnt: 0, sc: 0, pt: 0, ptN: 0, fwPoss: 0, fwHit: 0, missL: 0, missR: 0, gir: 0, scrOpp: 0, scr: 0, short: 0 };
    o.cnt++; o.sc += h.score; if (h.putts != null) { o.pt += h.putts; o.ptN++; }
    if (o.par >= 4 && h.fw) { o.fwPoss++; if (h.fw === "Y") o.fwHit++; if (h.fw === "L") o.missL++; if (h.fw === "R") o.missR++; }
    if (holeGir(h)) o.gir++; else if (h.putts != null) { o.scrOpp++; if (h.score <= o.par) o.scr++; } o.short += h.short || 0; }
  return Object.values(by).sort((a, b) => a.n - b.n).map(o => ({ ...o, avg: o.sc / o.cnt, puttsAvg: o.ptN ? o.pt / o.ptN : 0 }));
}
function perfKpis(rounds) {
  const st = statsOf(rounds); if (!st) return "";
  const tm = st.missL + st.missR;
  return `<div class="kpis"><div class="kpi"><div class="l">Score / par</div><div class="v">${sgn(st.toPar)}</div><div class="s">ramené à 18 trous</div></div>
  <div class="kpi"><div class="l">Fairways</div><div class="v">${pct(st.fw)}</div><div class="s">${tm ? `ratés ${pc(st.missL / tm * 100)} G · ${pc(st.missR / tm * 100)} D` : "aucun raté"}</div></div>
  <div class="kpi"><div class="l">GIR /18</div><div class="v">${n1(st.gir)}</div><div class="s">scrambling ${pct(st.scr)}</div></div>
  <div class="kpi"><div class="l">Putts /18</div><div class="v">${n1(st.putts)}</div><div class="s">${n1(st.short)} ratés &lt; 2 m · ${n1(st.three)} 3-putts</div></div></div>`;
}
function synthesis(rows, rounds) {
  const st = statsOf(rounds); if (!st) return "";
  const byPar = {}; for (const r of rows) if (r.cnt) { const b = byPar[r.par] = byPar[r.par] || { d: 0, n: 0 }; b.d += (r.avg - r.par) * r.cnt; b.n += r.cnt; }
  const pars = Object.entries(byPar).map(([p, b]) => ({ p, d: b.d / b.n })).sort((a, b) => b.d - a.d);
  const out = [];
  if (pars.length) { const w = pars[0], bst = pars[pars.length - 1]; out.push(`Les <b>par ${w.p}</b> te coûtent <b>${sgn(w.d)}</b> en moyenne${pars.length > 1 ? `, les <b>par ${bst.p}</b> ${sgn(bst.d)}` : ""}.`); }
  const tm = st.missL + st.missR; if (tm >= 3) { const side = st.missL >= st.missR ? "gauche" : "droite"; out.push(`Quand tu manques le fairway, c'est à <b>${side}</b> ${pc(Math.max(st.missL, st.missR) / tm * 100)} du temps.`); }
  const G = gaps(st).filter(g => g.g != null && g.g > 0);
  if (G.length) out.push(`Plus gros écart avec un joueur +2 : <b>${esc(G[0].label.toLowerCase())}</b> (${fmtVal(G[0], G[0].v)} pour ${fmtVal(G[0], G[0].t)}).`);
  else out.push("Tes statistiques sont au niveau des repères d'un joueur +2.");
  return `<div class="card hl"><span class="lbl">Ce que dit ta carte</span><p class="small" style="margin-top:4px;line-height:1.55">${out.join(" ")}</p></div>`;
}
function vPerf() {
  const rounds = S.data.rounds; const courses = [...new Set(rounds.map(r => r.courseId).filter(Boolean))].map(id => S.data.courses.find(c => c._id === id) || { _id: id, name: (rounds.find(r => r.courseId === id) || {}).course || "Parcours" });
  if (!courses.length) return { kicker: "Cartes de score", title: "Performance détaillée", body: `<section class="view">${partiesNav("perf")}${emptyBox("Pas encore de carte", "La carte détaillée apparaît dès la première partie saisie trou par trou.", canEdit() ? `<a class="btn sm" href="#/partie/new">Saisir une carte</a>` : "")}</section>` };
  if (!S.perf.course || !courses.some(c => c._id === S.perf.course)) S.perf.course = courses[0]._id;
  const course = courses.find(c => c._id === S.perf.course); const cr = rounds.filter(r => r.courseId === course._id).sort(byDateDesc);
  if (S.perf.round !== "all" && !cr.some(r => r._id === S.perf.round)) S.perf.round = "all";
  const one = S.perf.round !== "all" ? cr.find(r => r._id === S.perf.round) : null;
  const rows = one ? holeRowsOne(one) : holeRowsAvg(cr, course.pars || []);
  const costly = !one ? rows.filter(r => r.cnt).map(r => ({ n: r.n, d: r.avg - r.par, r })).sort((a, b) => b.d - a.d).slice(0, 3) : [];
  const body = `<section class="view">${partiesNav("perf")}
  <div class="grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
    <div class="f"><label for="pf-course">Parcours</label><select id="pf-course" data-act-change="perf-course">${courses.map(c => `<option value="${c._id}" ${c._id === course._id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
    <div class="f"><label for="pf-round">Partie</label><select id="pf-round" data-act-change="perf-round"><option value="all">Moyenne · ${cr.length} partie${cr.length > 1 ? "s" : ""}</option>${cr.map(r => `<option value="${r._id}" ${r._id === S.perf.round ? "selected" : ""}>${fmtD(r.date)} · ${roundCalc(r).score}</option>`).join("")}</select></div>
  </div>
  ${perfKpis(one ? [one] : cr)}
  ${scorecardTable(rows, one ? "one" : "avg")}
  <p class="xs muted" style="margin-top:-6px">Cercle rouge : sous le par · carré bleu : au-dessus (double : +1 et plus en moyenne, double bogey sur une partie). Fairway : ● touché, G / D raté. GIR : ● green en régulation.</p>
  ${synthesis(rows, one ? [one] : cr)}
  ${costly.length ? `<div class="card"><h2>Trous les plus coûteux</h2><div class="list">${costly.map(c => `<div class="item"><div class="head"><span><b class="serif">Trou ${c.n}</b> · par ${c.r.par}</span><span class="serif" style="color:var(--red);font-weight:700">${sgn(c.d)}</span></div><p class="small muted">${c.r.fwPoss ? `Fairway ${pc(c.r.fwHit / c.r.fwPoss * 100)} (${c.r.missL} G, ${c.r.missR} D) · ` : ""}GIR ${pc(c.r.gir / c.r.cnt * 100)} · ${n1(c.r.puttsAvg)} putts</p></div>`).join("")}</div></div>` : ""}
  ${one ? `<a class="btn ghost sm" href="#/partie/${one._id}">Ouvrir la carte</a>` : ""}
  </section>`;
  return { kicker: "Cartes de score", title: "Performance détaillée", body };
}
function vPartie(p) {
  if (p[1] === "new" || p[2] === "edit") return vEditor(p);
  const r = S.data.rounds.find(x => x._id === p[1]); if (!r) return S.loaded ? emptyBox("Carte introuvable", "", `<a class="btn ghost sm" href="#/parties">Retour</a>`) : `<p class="muted">Chargement…</p>`;
  const c = roundCalc(r);
  const body = `<section class="view">
  <div class="meta"><span>${fmtD(r.date)}</span><span>·</span><span>${esc(r.type || "")}</span><span>·</span><span>${c.n} trous</span>${r.tee ? `<span>· repère ${esc(r.tee)}</span>` : ""}${r.cr ? `<span>· SSS ${n1(r.cr)} / slope ${r.slope}</span>` : ""}${r.diff != null ? `<span class="pill acc">différentiel ${n1(r.diff)}</span>` : ""}</div>
  ${perfKpis([r])}
  ${scorecardTable(holeRowsOne(r), "one")}
  ${synthesis(holeRowsAvg([r], []), [r])}
  ${r.cost ? `<div class="card"><h2>Où sont partis les coups</h2><p class="pre small">${esc(r.cost)}</p></div>` : ""}
  ${r.notes ? `<div class="card"><h2>Notes</h2><p class="pre small">${esc(r.notes)}</p></div>` : ""}
  ${canEdit() ? `<div class="row"><a class="btn ghost sm" href="#/partie/${r._id}/edit">Modifier</a><button class="btn danger sm" data-act="del-round" data-id="${r._id}">Supprimer</button></div>` : ""}
  </section>`;
  return { back: ["#/parties", "Parties"], title: esc(r.course), body, right: `<span class="serif" style="font-size:26px;font-weight:700;white-space:nowrap">${c.score}<span class="small muted"> ${sgn(c.score - c.par)}</span></span>` };
}

/* ---------- Catalogue des parcours ---------- */
const norm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
function findCourse(id) { for (const c of S.catalog) for (const k of c.courses) if (k.id === id) return { club: c, course: k }; return null; }
function searchCatalog(q) {
  const n = norm(q).replace(/\b(golf|club|de|du|des|la|le|les|g c)\b/g, " ").trim(); if (n.length < 2) return [];
  const words = n.split(/\s+/);
  return S.catalog.filter(c => { const hay = norm([c.name, c.city, ...(c.aliases || []), ...c.courses.map(k => k.name)].join(" ")); return words.every(w => hay.includes(w)); });
}
const myCourses = () => S.data.courses.filter(c => !findCourse(c._id));
const teeLabel = t => `${t.name}${t.gender === "F" ? " (dames)" : ""}`;
function setupPicker() {
  const st = S.setup;
  if (st.club) {
    const c = S.catalog.find(x => x.id === st.club); if (!c) { st.club = null; return setupPicker(); }
    const k = c.courses.find(x => x.id === st.course) || (c.courses.length === 1 ? c.courses[0] : null); if (k) st.course = k.id;
    const t = k && (k.tees.find(x => x.name === st.tee) || null);
    return `<div class="card hl stack" style="gap:10px"><div class="row between"><div><span class="lbl">Club</span><div class="serif" style="font-size:18px;font-weight:700">${esc(c.name)}</div><span class="xs muted">${esc(c.city || "")} · ${c.courses.length} parcours</span></div><button type="button" class="btn ghost sm" data-act="setup-clear">Changer</button></div>
      <div class="f"><span class="lbl">Parcours</span><div class="seg" style="grid-auto-flow:row;grid-template-columns:repeat(${Math.min(c.courses.length + (c.pending || []).length, 3)},minmax(0,1fr))">${c.courses.map(x => `<button type="button" data-act="setup-course" data-v="${x.id}" aria-pressed="${x.id === st.course}">${esc(x.name)}<br><small style="font-weight:500">par ${x.par.reduce((a, b) => a + b, 0)}</small></button>`).join("")}${(c.pending || []).map(x => `<button type="button" data-act="setup-pending" data-v="${esc(c.name + " · " + x)}">${esc(x)}<br><small style="font-weight:500">carte à venir</small></button>`).join("")}</div></div>
      ${k ? `<div class="f"><span class="lbl">Repère de départ</span><div class="pick" style="grid-template-columns:repeat(${Math.min(k.tees.length, 5)},minmax(0,1fr))">${k.tees.map(x => `<button type="button" data-act="setup-tee" data-v="${esc(x.name)}" aria-pressed="${x.name === st.tee}"><b style="font-size:15px">${esc(x.name)}${x.gender === "F" ? " ♀" : ""}</b><small>${x.total || (x.len && x.len.length) ? n0(x.total || x.len.reduce((a, b) => a + b, 0)) + " m" : "&nbsp;"}${x.cr ? `<br>${n1(x.cr)} / ${x.slope}` : ""}</small></button>`).join("")}</div></div>` : ""}
      ${k ? `<p class="xs muted">Carte chargée : par, handicap des trous${t ? ", distances" + (t.cr ? ", SSS et slope (différentiel calculé)" : "") : ""}. <a href="${esc((k.source || "").split(" ")[0])}" target="_blank" rel="noopener">Source</a></p>` : ""}
    </div>`;
  }
  if (st.newName) return `<div class="card hl row between"><div><span class="lbl">Nouveau parcours</span><div class="serif" style="font-size:18px;font-weight:700">${esc(st.newName)}</div><span class="xs muted">Pas encore au catalogue : par 4 par défaut, modifiable trou par trou. Je recherche la carte et l'ajoute.</span></div><button type="button" class="btn ghost sm" data-act="setup-clear">Changer</button></div>`;
  if (st.course && !findCourse(st.course)) { const c = S.data.courses.find(x => x._id === st.course);
    return `<div class="card hl row between"><div><span class="lbl">Parcours</span><div class="serif" style="font-size:18px;font-weight:700">${esc(c ? c.name : st.q)}</div><span class="xs muted">${c && c.pars ? "pars enregistrés lors d'une carte précédente" : "carte demandée à Claude · par 4 par défaut"}</span></div><button type="button" class="btn ghost sm" data-act="setup-clear">Changer</button></div>`; }
  return `<div class="f"><label for="ed-search">Golf ou parcours</label><input id="ed-search" autocomplete="off" placeholder="Ex. Bondues, Golf du Sart…" value="${esc(st.q)}"></div><div id="course-sugg">${suggList(st.q)}</div>`;
}
function suggList(q) {
  const hits = searchCatalog(q); const n = norm(q);
  const mine = n.length >= 2 ? myCourses().filter(c => norm(c.name).includes(n)) : myCourses().slice(0, 5);
  let h = "";
  const ok = hits.filter(c => c.courses.length), pend = hits.filter(c => !c.courses.length);
  h += pend.map(c => `<button type="button" class="q" data-act="setup-pending" data-v="${esc(c.name)}" style="font:inherit;text-align:left;cursor:pointer;width:100%;margin-top:6px"><span class="d" style="background:#c9a227"></span><span><b>${esc(c.name)}</b><br><span class="xs muted">${esc(c.city || "")} · carte à venir : par 4 par défaut</span></span><span class="st">à venir</span></button>`).join("");
  if (ok.length) h += ok.map(c => `<button type="button" class="q" data-act="setup-club" data-v="${c.id}" style="font:inherit;text-align:left;cursor:pointer;width:100%;margin-top:6px"><span class="d" style="background:#2f6b45"></span><span><b>${esc(c.name)}</b><br><span class="xs muted">${esc(c.city || "")} · ${c.courses.map(k => esc(k.name)).join(", ")}${(c.pending || []).length ? " · " + c.pending.map(esc).join(", ") + " (à venir)" : ""}</span></span><span class="st ok">carte ✓</span></button>`).join("");
  if (mine.length) h += mine.map(c => `<button type="button" class="q" data-act="setup-mine" data-v="${c._id}" style="font:inherit;text-align:left;cursor:pointer;width:100%;margin-top:6px"><span class="d" style="background:#c9b48c"></span><span>${esc(c.name)}</span><span class="st">déjà joué</span></button>`).join("");
  if (n.length >= 3 && !hits.length) h += `<button type="button" class="q" data-act="setup-new" style="font:inherit;text-align:left;cursor:pointer;width:100%;margin-top:6px"><span class="d" style="background:#c8372d"></span><span>Ajouter « ${esc(q.trim())} »<br><span class="xs muted">Pas encore dans le catalogue : saisie avec par 4 par défaut, et je recherche la carte.</span></span><span class="st">+</span></button>`;
  if (!h && n.length < 2) h = `<p class="xs muted" style="margin-top:6px">Tape le nom du golf : les parcours et la carte (par, handicap, distances, SSS, slope) se chargent automatiquement.</p>`;
  return h;
}

function draftCard() {
  const d = S.draft; if (!d || d.id) return "";
  const played = d.holes.filter(h => h.score != null); const tp = played.reduce((a, h) => a + h.score - (h.par || 4), 0);
  return `<div class="card hl stack" style="gap:8px"><div class="row between"><div><span class="lbl">Carte en cours</span><div class="serif" style="font-size:17px;font-weight:700">${esc(d.course)}</div><span class="xs muted">${fmtD(d.date)} · ${played.length}/${d.holes.length} trous saisis${played.length ? " · " + (tp === 0 ? "au par" : sgn(tp)) : ""}</span></div></div>
    <div class="row"><a class="btn navy sm" href="#/partie/new">Reprendre</a>${played.length ? `<button class="btn sm" data-act="draft-finish">Terminer et enregistrer</button>` : ""}<button class="btn ghost sm" data-act="draft-discard">Abandonner</button></div></div>`;
}

/* ---------- Saisie de carte (UX Club-house) ---------- */
function saveDraft() { lsSet("golf-draft", S.draft); }
function draftFromRound(r) { return { id: r._id, date: r.date, type: r.type, courseId: r.courseId, catalogId: r.catalogId || null, tee: r.tee || null, cr: r.cr ?? null, slope: r.slope ?? null, course: r.course, holesCount: r.holesCount || (r.holesData || []).length, startHole: r.startHole || 1, holes: (r.holesData || []).map(h => ({ ...h })), cost: r.cost || "", notes: r.notes || "", stage: "holes" }; }
function holeNumbers(start, count) { const a = []; for (let i = 0; i < count; i++) a.push(((start - 1 + i) % 18) + 1); return a; }
const SCORE_NAMES = { "-3": "albatros", "-2": "eagle", "-1": "birdie", "0": "par", "1": "bogey", "2": "double", "3": "triple" };
function vEditor(p) {
  if (!canEdit()) return emptyBox("Lecture seule", "Ton compte ne permet pas de saisir de carte.");
  if (p[2] === "edit") { const r = S.data.rounds.find(x => x._id === p[1]); if (!r) return `<p class="muted">Chargement…</p>`; if (!S.draft || S.draft.id !== r._id) { S.draft = draftFromRound(r); S.hole = 0; saveDraft(); } }
  else if (S.draft && S.draft.id) { S.draft = null; saveDraft(); }
  const d = S.draft;
  if (!d || d.stage === "setup" || !d.stage) {
    const x = d || { date: iso(), type: "Compétition", holesCount: 18, startHole: 1 };
    const body = `<section class="view"><form class="stack card" data-form="setup">
      <div class="grid">
        <div class="f"><label for="ed-date">Date</label><input id="ed-date" name="date" type="date" value="${esc(x.date)}" required></div>
        <div class="f"><label for="ed-type">Type</label><select id="ed-type" name="type">${["Compétition", "Partie qualificative", "Partie amicale", "Entraînement sur le parcours"].map(o => `<option ${x.type === o ? "selected" : ""}>${o}</option>`).join("")}</select></div>
      </div>
      <div id="setup-picker">${setupPicker()}</div>
      <div class="f"><span class="lbl">Nombre de trous</span><div class="seg" data-seg="holesCount">${[7, 9, 12, 15, 18].map(n => `<button type="button" data-v="${n}" aria-pressed="${x.holesCount === n}">${n}</button>`).join("")}</div></div>
      <div class="f" style="max-width:200px"><label for="ed-start">Trou de départ</label><select id="ed-start" name="startHole">${Array.from({ length: 18 }, (_, i) => `<option value="${i + 1}" ${x.startHole === i + 1 ? "selected" : ""}>${i + 1}</option>`).join("")}</select></div>
      <button class="btn" type="submit">Commencer la saisie</button>${d ? `<button class="btn ghost sm" type="button" data-act="draft-discard">Abandonner la saisie</button>` : ""}
    </form></section>`;
    return { back: ["#/parties", "Parties"], title: "Nouvelle carte", body };
  }
  if (d.stage === "finish") {
    const body = `<section class="view">
    ${perfKpis([{ holesData: d.holes, date: d.date }])}
    ${scorecardTable(holeRowsOne({ holesData: d.holes }), "one")}
    <form class="stack card" data-form="finish">
      <div class="f"><label for="ed-cost">Où sont partis les coups</label><textarea id="ed-cost" name="cost" placeholder="Ex. 2 coups perdus au départ du 7 et du 12, chip trop long au 15…">${esc(d.cost || "")}</textarea></div>
      <div class="f"><label for="ed-notes">Notes / mental</label><textarea id="ed-notes" name="notes">${esc(d.notes || "")}</textarea></div>
      ${d.holes.some(h => h.score == null) ? `<p class="small muted">${d.holes.filter(h => h.score != null).length} trous saisis sur ${d.holes.length} : seuls les trous saisis sont enregistrés.</p>` : ""}
      <button class="btn" type="submit">Enregistrer la carte</button><button class="btn ghost sm" type="button" data-act="draft-discard">Abandonner</button>
    </form></section>`;
    return { back: ["#", "Retour aux trous"], title: "Terminer la carte", body, backAct: "ed-holes" };
  }
  const i = Math.min(S.hole, d.holes.length - 1); const h = d.holes[i]; const par = h.par || 4;
  const g = h.score != null && h.putts != null ? holeGir(h) : null; const scr = g === false ? (h.score <= par) : null;
  const tot = d.holes.filter(x => x.score != null); const toPar = tot.reduce((s, x) => s + x.score - (x.par || 4), 0);
  const opts = [par - 2, par - 1, par, par + 1, par + 2]; const custom = h.score != null && !opts.includes(h.score);
  const mini = (k, l) => `<div class="mini"><button type="button" data-act="h-step" data-k="${k}" data-d="-1" aria-label="Moins">−</button><div class="v">${h[k] ?? 0}</div><button type="button" data-act="h-step" data-k="${k}" data-d="1" aria-label="Plus">+</button><div class="l">${l}</div></div>`;
  const body = `<section class="view">
  <div class="holestrip"><table>
    <tr><th class="l">Trou</th>${d.holes.map((x, j) => `<th class="${j === i ? "cur" : ""}" data-act="h-go" data-i="${j}">${x.n}</th>`).join("")}</tr>
    <tr><td class="l">Par</td>${d.holes.map((x, j) => `<td class="${j === i ? "cur" : ""}">${x.par || 4}</td>`).join("")}</tr>
    <tr><td class="l">Score</td>${d.holes.map((x, j) => `<td class="${j === i ? "cur" : ""}">${scoreCell(x.score, x.par || 4, true)}</td>`).join("")}</tr>
  </table></div>
  <div class="row between"><span><span class="serif" style="font-size:22px;font-weight:700">Trou ${h.n}</span>${h.len || h.si ? `<span class="small muted"> · ${h.len ? h.len + " m" : ""}${h.len && h.si ? " · " : ""}${h.si ? "hcp " + h.si : ""}</span>` : ""}</span><span class="small muted">${tot.length ? `${tot.length} trou${tot.length > 1 ? "s" : ""} · ${sgn(toPar) === "—" ? "par" : (toPar === 0 ? "au par" : sgn(toPar))}` : `${i + 1}/${d.holes.length}`}</span></div>
  <div class="f"><span class="lbl">Par</span><div class="seg">${[3, 4, 5].map(v => `<button type="button" data-act="h-set" data-k="par" data-v="${v}" aria-pressed="${par === v}">Par ${v}</button>`).join("")}</div></div>
  <div class="f"><span class="lbl">Score</span><div class="pick">${opts.map(v => `<button type="button" data-act="h-score" data-v="${v}" aria-pressed="${h.score === v}"><b>${v}</b><small>${SCORE_NAMES[v - par] || ""}</small></button>`).join("")}</div>
    <div class="row" style="margin-top:6px"><span class="xs muted">Autre score :</span><button type="button" class="btn ghost sm" data-act="h-step" data-k="score" data-d="1">${custom ? h.score + " · +1" : "+3 et plus"}</button>${custom ? `<button type="button" class="btn ghost sm" data-act="h-step" data-k="score" data-d="-1">−1</button>` : ""}</div></div>
  <div class="f"><span class="lbl">Putts</span><div class="pick">${[0, 1, 2, 3, 4].map(v => `<button type="button" data-act="h-set" data-k="putts" data-v="${v}" aria-pressed="${h.putts === v}"><b>${v}</b></button>`).join("")}</div></div>
  ${par >= 4 ? `<div class="f"><span class="lbl">Fairway</span><div class="seg red">${[["L", "← Gauche"], ["Y", "Touché"], ["R", "Droite →"]].map(([v, l]) => `<button type="button" data-act="h-set" data-k="fw" data-v="${v}" aria-pressed="${h.fw === v}">${l}</button>`).join("")}</div></div>` : `<p class="xs muted">Par 3 : pas de fairway.</p>`}
  <div class="two" style="grid-template-columns:1fr 1fr;gap:8px">${mini("short", "Putts < 2 m ratés")}${mini("pen", "Pénalités")}</div>
  <div class="auto">${g == null ? `<span class="pill">GIR calculé après le score et les putts</span>` : `<span class="pill ${g ? "ok" : ""}">${g ? "Green en régulation" : "Green manqué"}</span>`}${scr == null ? "" : `<span class="pill ${scr ? "ok" : "bad"}">Scrambling ${scr ? "réussi" : "raté"}</span>`}</div>
  <div class="row between"><button class="btn ghost" type="button" data-act="h-go" data-i="${i - 1}" ${i === 0 ? "disabled" : ""}>← Trou ${i ? d.holes[i - 1].n : ""}</button>
    ${i < d.holes.length - 1 ? `<button class="btn navy" type="button" data-act="h-next">Trou ${d.holes[i + 1].n} →</button>` : `<button class="btn" type="button" data-act="h-finish">Terminer la carte</button>`}</div>
  <div class="row" style="justify-content:center">${tot.length ? `<button class="btn ghost sm" type="button" data-act="draft-finish">Terminer ici (${tot.length} trou${tot.length > 1 ? "s" : ""})</button>` : ""}<button class="btn ghost sm" type="button" data-act="draft-discard">Abandonner la carte</button></div>
  <p class="xs muted">Sans saisie, « Trou suivant » enregistre le par et 2 putts. « Terminer ici » n'enregistre que les trous saisis. La carte est conservée sur ce téléphone jusqu'à l'enregistrement.</p>
  </section>`;
  return { back: ["#/parties", "Parties"], title: esc(d.course), body, kicker: fmtD(d.date) };
}
function startDraft(form) {
  const fd = new FormData(form); const hc = Number(form.querySelector('[data-seg="holesCount"] [aria-pressed="true"]')?.dataset.v || 18);
  const st = S.setup; let courseId = null, course = "", pars = [], si = [], len = [], tee = null, cr = null, slope = null, catalogId = null;
  const f = st.course && findCourse(st.course);
  if (f) { const t = f.course.tees.find(x => x.name === st.tee);
    if (!t) { toast("Choisis ton repère de départ."); return; }
    catalogId = courseId = f.course.id; course = `${f.club.name} · ${f.course.name}`; pars = f.course.par; si = t.si || f.course.si || []; len = t.len || []; tee = t.name; cr = f.course.par.length === 18 ? t.cr : null; slope = f.course.par.length === 18 ? t.slope : null; lsSet("golf-tee-" + f.course.id, t.name); }
  else if (st.course) { const c = S.data.courses.find(x => x._id === st.course); courseId = st.course; course = c ? c.name : st.q; pars = (c && c.pars) || []; }
  else if (st.newName) { course = st.newName; }
  else { toast("Choisis un golf dans la liste."); return; }
  const start = Number(fd.get("startHole") || 1);
  S.draft = { date: fd.get("date") || iso(), type: fd.get("type"), courseId, catalogId, course, tee, cr, slope, holesCount: hc, startHole: start,
    holes: holeNumbers(start, hc).map(n => { const L = pars.length || 18, j = (n - 1) % L; return { n, par: pars[j] || 4, si: si[j] || null, len: len[j] || null, score: null, putts: null, fw: null, short: 0, pen: 0 }; }), stage: "holes", cost: "", notes: "" };
  if (st.newName && !S.data.courseRequests.some(r => norm(r.name) === norm(st.newName))) Store.add("courseRequests", { name: st.newName, date: iso(), status: "open" }).catch(() => {});
  S.setup = { q: "", club: null, course: null, tee: null }; S.hole = 0; saveDraft(); render();
}
async function saveRound() {
  const d = S.draft; if (!d) return;
  if (!d.holes.some(h => h.score != null)) { toast("Aucun trou renseigné."); return; }
  d.holes = d.holes.filter(h => h.score != null);
  try {
    let courseId = d.courseId;
    if (!courseId) { const ex = S.data.courses.find(c => c.name.toLowerCase() === d.course.toLowerCase()); courseId = ex ? ex._id : null; }
    if (d.catalogId && !S.data.courses.some(c => c._id === d.catalogId)) { await Store.set("courses", d.catalogId, { name: d.course, pars: findCourse(d.catalogId).course.par, catalogId: d.catalogId }); }
    const c = courseId ? S.data.courses.find(x => x._id === courseId) : null;
    const pars = (c && c.pars ? c.pars.slice() : Array(18).fill(null)); for (const h of d.holes) pars[h.n - 1] = h.par || 4;
    if (courseId) await Store.set("courses", courseId, { name: c ? c.name : d.course, pars }, true);
    else courseId = await Store.add("courses", { name: d.course, pars });
    const calc = roundCalc({ holesData: d.holes });
    const doc = { date: d.date, type: d.type, courseId, course: d.course, holesCount: d.holes.length, startHole: d.startHole, holesData: d.holes, cost: d.cost || "", notes: d.notes || "",
      tee: d.tee || null, cr: d.cr ?? null, slope: d.slope ?? null, catalogId: d.catalogId || null,
      diff: calc.n === 18 && d.cr && d.slope ? Math.round(113 / d.slope * (calc.score - d.cr) * 10) / 10 : null,
      score: calc.score, par: calc.par, putts: calc.putts, fwHit: calc.fwHit, fwPoss: calc.fwPoss, missL: calc.missL, missR: calc.missR, gir: calc.gir, scr: calc.scr, scrOpp: calc.scrOpp, three: calc.three, short: calc.short, pen: calc.pen };
    let id = d.id; if (id) await Store.set("rounds", id, doc); else id = await Store.add("rounds", doc);
    S.draft = null; saveDraft(); toast("Carte enregistrée"); location.hash = "#/partie/" + id;
  } catch (e) { console.error(e); toast(e && e.code === "permission-denied" ? "Enregistrement refusé par Firebase (règles de sécurité). La saisie est conservée : préviens Claude." : "Enregistrement impossible (" + ((e && e.code) || "réseau") + "). La saisie est conservée, réessaie."); }
}

/* ---------- Feuilles : formulaires et menu « + » ---------- */
const FORMS = {
  session: { title: "Entraînement libre", col: "sessions", fields: [
    { k: "date", label: "Date", type: "date", req: 1 }, { k: "duration", label: "Durée (min)", type: "number", req: 1 },
    { k: "tags", label: "Type d'entraînement (un ou plusieurs)", type: "tags", full: 1 },
    { k: "content", label: "Contenu", type: "textarea", full: 1, req: 1 },
    { k: "result", label: "Mesure / résultat", type: "text", full: 1, ph: "Ex. 14/20 putts à 2 m" },
    { k: "rating", label: "Qualité (1 à 5)", type: "select", opts: ["", "1", "2", "3", "4", "5"] },
    { k: "notes", label: "Sensations / remarques", type: "textarea", full: 1 }] },
  lesson: { title: "Cours avec le pro", col: "lessons", fields: [
    { k: "date", label: "Date", type: "date", req: 1 }, { k: "pro", label: "Pro", type: "text" },
    { k: "theme", label: "Thème", type: "text", full: 1, req: 1 },
    { k: "findings", label: "Constats du pro", type: "textarea", full: 1 },
    { k: "drills", label: "Exercices / consignes donnés", type: "textarea", full: 1 },
    { k: "toWork", label: "À travailler d'ici le prochain cours", type: "textarea", full: 1 },
    { k: "rating", label: "Ressenti (1 à 5)", type: "select", opts: ["", "1", "2", "3", "4", "5"] }, { k: "video", label: "Lien vidéo", type: "text" }] },
  index: { title: "Mettre à jour l'index", fields: [{ k: "date", label: "Date", type: "date", req: 1 }, { k: "value", label: "Index (−2,0 = plus 2)", type: "number", req: 1 }] }
};
const NUMERIC = new Set(["duration", "rating", "value"]);
let editing = null;
function openSheet(title, html) { $("#sheet-title").textContent = title; $("#sheet-body").innerHTML = html; $("#sheet").hidden = false; }
function openAddMenu() {
  const it = (act, kind, href, ic, col, t, s) => href ? `<a href="${href}" data-act="close-go"><span class="ic" style="background:${col}">${icon(ic)}</span><span>${t}<small>${s}</small></span></a>` : `<button data-act="${act}" data-kind="${kind}"><span class="ic" style="background:${col}">${icon(ic)}</span><span>${t}<small>${s}</small></span></button>`;
  editing = null;
  openSheet("Ajouter", `<div class="menu">
    ${it(null, null, "#/partie/new", "flag", "#0f2340", S.draft && !S.draft.id ? "Reprendre la carte en cours" : "Nouvelle carte", S.draft && !S.draft.id ? "Terminer ou abandonner depuis Parties" : "Saisie trou par trou")}
    ${it("form", "session", null, "dumb", "#2c5aa0", "Entraînement libre", "Séance hors plan")}
    ${it("form", "lesson", null, "user", "#a0612f", "Cours avec le pro", "Constats, consignes, à travailler")}
    ${it(null, null, "#/videos", "video", "#c8372d", "Vidéo", "Filmer ou envoyer un swing")}
    ${it("form", "index", null, "target", "#2f6b45", "Index", "Nouvelle révision")}</div>`);
}
function openForm(kind, id) {
  const F = FORMS[kind]; editing = { kind, id };
  let cur = id ? (S.data[F.col] || []).find(x => x._id === id) || {} : {};
  if (!cur.date) cur = { ...cur, date: iso() };
  openSheet((id ? "Modifier · " : "") + F.title, `<form id="sheet-form"><div class="grid">${F.fields.map(f => { const v = cur[f.k] ?? ""; const fid = "sf-" + f.k; let inp;
    if (f.type === "tags") { const cur2 = Array.isArray(v) ? v : (cur._id ? freeTags(cur) : []); inp = `<div class="chips tagchips" id="${fid}" data-tags="${f.k}">${TAGS.map(t => `<button type="button" data-act="tag-pick" data-v="${t}" aria-pressed="${cur2.includes(t)}" style="--c:${TAG_COLOR[t]}">${t}</button>`).join("")}</div>`; }
    else if (f.type === "textarea") inp = `<textarea id="${fid}" name="${f.k}" placeholder="${esc(f.ph || "")}">${esc(v)}</textarea>`;
    else if (f.type === "select") inp = `<select id="${fid}" name="${f.k}">${f.opts.map(o => `<option ${String(v) === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
    else inp = `<input id="${fid}" name="${f.k}" type="${f.type === "number" ? "text" : f.type}" ${f.type === "number" ? 'inputmode="decimal"' : ""} value="${esc(v)}" placeholder="${esc(f.ph || "")}">`;
    return `<div class="f ${f.full ? "full" : ""}"><label for="${fid}">${esc(f.label)}${f.req ? " *" : ""}</label>${inp}</div>`; }).join("")}</div>
    <div class="actions"><div>${id ? `<button type="button" class="btn danger sm" data-act="sheet-del">Supprimer</button>` : ""}</div><button type="submit" class="btn">Enregistrer</button></div>
    <p class="small muted" id="sheet-err" style="margin-top:10px" hidden></p></form>`);
  $("#sheet-form").addEventListener("submit", submitSheet);
}
function closeSheet() { $("#sheet").hidden = true; editing = null; }
const sheetErr = m => { const e = $("#sheet-err"); e.textContent = m; e.hidden = false; };
async function submitSheet(e) {
  e.preventDefault(); const { kind, id } = editing; const F = FORMS[kind]; const fd = new FormData(e.target); const data = {};
  for (const f of F.fields) {
    if (f.type === "tags") { data[f.k] = [...e.target.querySelectorAll(`[data-tags="${f.k}"] [aria-pressed="true"]`)].map(b => b.dataset.v); if (!data[f.k].length) return sheetErr("Choisis au moins un type d'entraînement."); continue; }
    const v = String(fd.get(f.k) ?? "").trim(); if (f.req && !v) return sheetErr("Champ obligatoire : " + f.label); data[f.k] = NUMERIC.has(f.k) ? num(v) : v; }
  try {
    if (kind === "index") { const h = ((S.profile && S.profile.indexHistory) || []).filter(x => x.date !== data.date); h.push({ date: data.date, value: data.value }); h.sort((a, b) => a.date.localeCompare(b.date)); await Store.set("profile", "main", { indexHistory: h }, true); }
    else if (id) await Store.set(F.col, id, data, true); else await Store.add(F.col, data);
    closeSheet(); toast("Enregistré");
  } catch (x) { console.error(x); sheetErr("Enregistrement impossible pour le moment."); }
}

/* ---------- Envois de fichiers ---------- */
async function submitNote(form) {
  const ref = form.dataset.ref; const text = form.text.value.trim(); const files = [...(form.files.files || [])];
  if (!text && !files.length) { toast("Écris une note ou joins un fichier."); return; }
  const big = files.find(f => f.size > 20 * 1048576); if (big) { toast(big.name + " dépasse 20 Mo."); return; }
  const btn = form.querySelector("button[type=submit]"); btn.disabled = true; const pg = form.querySelector(".progress"); pg.hidden = false;
  try {
    const out = []; let i = 0;
    for (const f of files) { const r = await Store.upload(`notes/${ref.replace(":", "_")}/${Date.now()}-${safeName(f.name)}`, f, x => pg.firstElementChild.style.width = ((i + x) / files.length * 100) + "%"); out.push({ name: f.name, type: f.type, size: f.size, path: r.path, url: r.url }); i++; }
    await Store.add("notes", { ref, date: iso(), text, files: out }); form.reset(); form.querySelectorAll("[data-keep]").forEach(el => el.value = ""); toast("Note ajoutée");
  } catch (e) { console.error(e); toast(upErr(e)); }
  btn.disabled = false; pg.hidden = true;
}
function upErr(e) { const c = (e && e.code) || "";
  if (c === "storage/unauthorized" || c === "permission-denied") return "Envoi refusé par Firebase (droits). Code : " + c;
  if (c === "storage/canceled") return "Envoi annulé.";
  if (c === "storage/retry-limit-exceeded" || c === "storage/unknown") return "Connexion interrompue pendant l'envoi. Réessaie en Wi-Fi. Code : " + c;
  return "Envoi impossible" + (c ? " · " + c : "") + (e && e.message ? " · " + String(e.message).slice(0, 120) : ""); }
async function submitVideo(form) {
  const f = form.file.files[0] || form.fileCam.files[0]; if (!f) { toast("Choisis une vidéo."); return; }
  if (f.size > 500 * 1048576) { toast("La vidéo dépasse 500 Mo : coupe-la ou exporte-la en 1080p."); return; }
  const btn = form.querySelector("button[type=submit]"); btn.disabled = true; const box = form.querySelector(".upl"), bar = box.querySelector(".progress span"), txt = box.querySelector(".upl-t"), hint = box.querySelector(".upl-h"); box.hidden = false;
  const mo = n => (n / 1048576).toFixed(1).replace(".", ","); let last = Date.now(), lastB = -1;
  txt.textContent = `0 / ${mo(f.size)} Mo · 0 %`; hint.textContent = "Garde l'app ouverte pendant l'envoi.";
  const watch = setInterval(() => { if (Date.now() - last > 20000) hint.textContent = "Connexion lente ou coupée : l'envoi reprend dès que le réseau revient. En Wi-Fi c'est plus rapide."; }, 5000);
  try {
    const d = iso(); const r = await Store.upload(`videos/${d.slice(0, 7)}/${Date.now()}-${safeName(f.name)}`, f, (x, b, t) => { bar.style.width = (x * 100) + "%"; if (b !== lastB) { lastB = b; last = Date.now(); hint.textContent = x >= 1 ? "Enregistrement…" : "Garde l'app ouverte pendant l'envoi."; } txt.textContent = `${mo(b || 0)} / ${mo(t || f.size)} Mo · ${Math.round(x * 100)} %`; });
    await Store.add("videos", { ref: form.dataset.ref, date: d, name: f.name, type: f.type, size: f.size, path: r.path, url: r.url, angle: form.angle.value, club: form.club.value.trim(), comment: form.comment.value.trim(),
      analysis: form.ask.checked ? { status: "requested", requestedAt: d } : null });
    form.reset(); form.querySelectorAll("[data-keep]").forEach(el => el.value = ""); form.querySelector(".vname").textContent = ""; bar.style.width = "0"; toast("Vidéo envoyée");
  } catch (e) { console.error(e); toast(upErr(e)); }
  clearInterval(watch); btn.disabled = false; box.hidden = true;
}

/* ---------- Événements ---------- */
document.addEventListener("click", async e => {
  const seg = e.target.closest(".seg button[data-v]:not([data-act])");
  if (seg) { seg.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === seg))); return; }
  const b = e.target.closest("[data-act]"); if (!b) return;
  const a = b.dataset.act, id = b.dataset.id;
  if (b.tagName === "A" && a !== "close-go") e.preventDefault();
  const d = S.draft;
  switch (a) {
    case "logout": if (!DEMO) firebase.auth().signOut(); break;
    case "back": if (S.draft && S.draft.stage === "finish" && parts()[0] === "partie") { S.draft.stage = "holes"; saveDraft(); render(); break; } if (history.length > 1) history.back(); else location.hash = "#/plan"; break;
    case "close": closeSheet(); break;
    case "close-go": closeSheet(); break;
    case "add-menu": openAddMenu(); break;
    case "upload-cancel": if (S.uploadTask) S.uploadTask.cancel(); break;
    case "ex-toggle": { const s = S.plan.sessions.find(x => x.id === b.dataset.sid); if (!s || valOf(s.id)) break; const d = doneOf(s); d[Number(b.dataset.i)] = !d[Number(b.dataset.i)]; lsSet("golf-done-" + s.id, d); render(); break; }
    case "quick-validate": { const s = S.plan.sessions.find(x => x.id === b.dataset.sid); if (s) { b.disabled = true; await quickValidate(s); } break; }
    case "setup-club": { const c = S.catalog.find(x => x.id === b.dataset.v); S.setup.club = c.id; S.setup.course = c.courses.length === 1 ? c.courses[0].id : null; S.setup.tee = null; if (S.setup.course) defaultTee(); refreshPicker(); break; }
    case "setup-course": S.setup.course = b.dataset.v; S.setup.tee = null; defaultTee(); refreshPicker(); break;
    case "setup-tee": S.setup.tee = b.dataset.v; refreshPicker(); break;
    case "setup-mine": S.setup.course = b.dataset.v; S.setup.club = null; refreshPicker(); break;
    case "setup-pending": S.setup.q = b.dataset.v; S.setup.newName = b.dataset.v; S.setup.course = null; S.setup.club = null; refreshPicker(); break;
    case "setup-new": S.setup.newName = S.setup.q.trim(); S.setup.course = null; S.setup.club = null; refreshPicker(); break;
    case "setup-clear": S.setup = { q: "", club: null, course: null, tee: null }; refreshPicker(); const i = document.getElementById("ed-search"); i && i.focus(); break;

    case "form": openForm(b.dataset.kind, id); break;
    case "sheet-del": if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Confirmer la suppression"; break; }
      try { await Store.del(FORMS[editing.kind].col, editing.id); const k = editing.kind; closeSheet(); toast("Supprimé"); if (k === "session" && location.hash.startsWith("#/entrainement/")) location.hash = "#/entrainements"; } catch (x) { sheetErr("Suppression impossible."); } break;
    case "pf": S.planFilter = b.dataset.f; render(); break;
    case "tf": S.tagFilter = b.dataset.f || null; render(); break;
    case "tag-pick": b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true")); break;
    case "vf": S.vidFilter = b.dataset.f; render(); break;
    case "unvalidate": if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Confirmer"; break; } await Store.del("validations", id); toast("Validation annulée"); break;
    case "del-note": case "del-video": case "del-link": case "del-round": {
      if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Confirmer"; break; }
      const col = { "del-note": "notes", "del-video": "videos", "del-link": "drillLinks", "del-round": "rounds" }[a];
      const doc = S.data[col].find(x => x._id === id);
      try { if (doc && doc.path) await Store.removeFile(doc.path); if (doc && doc.files) for (const f of doc.files) await Store.removeFile(f.path); await Store.del(col, id); toast("Supprimé"); if (a === "del-round") location.hash = "#/parties"; } catch (x) { toast("Suppression impossible."); }
      break; }
    case "ask-analysis": await Store.set("videos", id, { analysis: { status: "requested", requestedAt: iso() } }, true); toast("Analyse demandée"); break;
    case "draft-finish": if (!d) break; if (!d.holes.some(h => h.score != null)) { toast("Aucun trou saisi."); break; } d.stage = "finish"; saveDraft(); if (location.hash !== "#/partie/new") location.hash = "#/partie/new"; else render(); window.scrollTo(0, 0); break;
    case "draft-new": if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Confirmer : abandonner la carte en cours"; break; } S.draft = null; saveDraft(); S.setup = { q: "", club: null, course: null, tee: null }; location.hash = "#/partie/new"; render(); break;
    case "draft-discard": if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Confirmer l'abandon"; break; } S.draft = null; saveDraft(); toast("Carte abandonnée"); if (location.hash !== "#/parties") location.hash = "#/parties"; else render(); break;
    case "h-go": S.hole = Math.max(0, Math.min(d.holes.length - 1, Number(b.dataset.i))); render(); break;
    case "h-score": { const h = d.holes[S.hole]; const v = Number(b.dataset.v); h.score = h.score === v ? null : v; saveDraft(); render(); break; }
    case "h-set": { const h = d.holes[S.hole]; const k = b.dataset.k; let v = b.dataset.v;
      if (k === "par") { v = Number(v); h.par = v; if (v === 3) h.fw = null; } else if (k === "putts") { v = Number(v); h.putts = h.putts === v ? null : v; } else h[k] = h[k] === v ? null : v;
      saveDraft(); render(); break; }
    case "h-step": { const h = d.holes[S.hole]; const k = b.dataset.k; const base = h[k] ?? (k === "score" ? (h.par || 4) + 2 : 0); h[k] = Math.max(k === "score" ? 1 : 0, base + Number(b.dataset.d)); saveDraft(); render(); break; }
    case "h-next": case "h-finish": { const h = d.holes[S.hole]; if (h.score == null) h.score = h.par || 4; if (h.putts == null) h.putts = 2; if (a === "h-next") S.hole++; else d.stage = "finish"; saveDraft(); render(); window.scrollTo(0, 0); break; }
  }
});
function refreshPicker() { const el = document.getElementById("setup-picker"); if (el) el.innerHTML = setupPicker();
  const f = S.setup.course && findCourse(S.setup.course), seg = document.querySelector('[data-seg="holesCount"]');
  if (f && seg && f.course.par.length === 9 && S.setup._nine !== f.course.id) { S.setup._nine = f.course.id; seg.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.v === "9"))); } }
function defaultTee() { const f = findCourse(S.setup.course); if (!f) return; const saved = lsGet("golf-tee-" + f.course.id, null);
  const t = f.course.tees.find(x => x.name === saved) || f.course.tees.find(x => x.name === "Blanc" && x.gender === "M") || f.course.tees.find(x => x.gender === "M") || f.course.tees[0]; S.setup.tee = t ? t.name : null; }
document.addEventListener("input", e => { if (e.target.id === "ed-search") { S.setup.q = e.target.value; S.setup.newName = null; const el = document.getElementById("course-sugg"); if (el) el.innerHTML = suggList(S.setup.q); } });
document.addEventListener("change", e => {
  const el = e.target.closest("[data-act-change]"); if (!el) return;
  if (el.dataset.actChange === "perf-course") { S.perf.course = el.value; S.perf.round = "all"; }
  if (el.dataset.actChange === "perf-round") S.perf.round = el.value;
  render();
});
document.addEventListener("submit", async e => {
  const form = e.target.closest("form[data-form]"); if (!form) return; e.preventDefault();
  const t = form.dataset.form;
  if (t === "setup") return startDraft(form);
  if (t === "finish") { S.draft.cost = form.cost.value; S.draft.notes = form.notes.value; saveDraft(); return saveRound(); }
  if (t === "note") return submitNote(form);
  if (t === "video") return submitVideo(form);
  if (t === "link") { const url = form.url.value.trim(); if (!/^https?:\/\//.test(url)) { toast("Colle un lien complet (https://…)."); return; } await Store.add("drillLinks", { drill: form.dataset.drill, url, label: form.label.value.trim() }); form.reset(); toast("Vidéo ajoutée"); return; }
  if (t === "validate") {
    const st = form.querySelector('[data-seg="status"] [aria-pressed="true"]')?.dataset.v || "Faite";
    const rt = form.querySelector('[data-seg="rating"] [aria-pressed="true"]')?.dataset.v;
    try { await Store.set("validations", form.dataset.id, { status: st, blocksDone: (() => { const s = S.plan.sessions.find(x => x.id === form.dataset.id); return s ? doneOf(s) : null; })(), rating: rt ? Number(rt) : null, actualMin: num(form.actualMin.value), measure: form.measure.value.trim(), feedback: form.feedback.value.trim(), validatedAt: iso() }); lsSet("golf-done-" + form.dataset.id, null); toast("Séance validée"); }
    catch (x) { console.error(x); toast("Enregistrement impossible."); }
  }
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });
boot();
})();
