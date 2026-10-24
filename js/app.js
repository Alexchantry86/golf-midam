/* Objectif Mid-Am 2028 — app de pilotage golf (GitHub Pages + Firebase). */
(function () {
"use strict";
const APP_VERSION = "1.0.0";
const DEMO = /[?&]demo=1/.test(location.search);

/* ---------- Utilitaires ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const iso = (d = new Date()) => { const z = d.getTimezoneOffset() * 60000; return new Date(d - z).toISOString().slice(0, 10); };
const D = s => new Date(s + "T12:00:00");
const fmtD = s => s ? D(s).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtDs = s => s ? D(s).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) : "—";
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
let tt; function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, 2200); }
async function fetchJSON(p) { const r = await fetch(p + "?v=" + Date.now()); if (!r.ok) throw new Error(p); return r.json(); }

const DOMAINS = ["Long jeu", "Fers", "Wedges", "Petit jeu", "Bunker", "Putting", "Parcours", "Physique / vitesse", "Mental / routine"];
const METRICS = {
  fw: { label: "Fairways touchés", unit: "%", t: 60, dir: "high" },
  gir: { label: "Greens en régulation /18", t: 12, dir: "high" },
  scr: { label: "Scrambling", unit: "%", t: 60, dir: "high" },
  putts: { label: "Putts /18", t: 29.5, dir: "low" },
  three: { label: "3-putts /18", t: 0.5, dir: "low" },
  short: { label: "Putts < 2 m manqués /18", t: 0.5, dir: "low" },
  pen: { label: "Pénalités /18", t: 0.3, dir: "low" }
};

/* ---------- État ---------- */
const S = {
  user: null, role: null, plan: null, drills: {}, drillList: [], profile: null,
  data: { rounds: [], courses: [], lessons: [], sessions: [], validations: [], notes: [], videos: [], drillLinks: [] },
  loaded: false, planFilter: "todo", vidFilter: "all", perf: { course: "", round: "all" }, draft: null, hole: 0, subs: []
};
const canEdit = () => S.role === "admin";
const valOf = id => S.data.validations.find(v => v._id === id) || null;

/* ---------- Accès aux données ---------- */
let Store;
function firebaseStore() {
  const db = firebase.firestore(), st = firebase.storage();
  const TS = () => firebase.firestore.FieldValue.serverTimestamp();
  return {
    listen(col, cb) { return db.collection(col).onSnapshot(s => cb(s.docs.map(d => ({ ...d.data(), _id: d.id }))), e => { console.error(col, e); toast("Lecture impossible : " + col); }); },
    listenDoc(path, cb) { return db.doc(path).onSnapshot(s => cb(s.exists ? s.data() : null), e => console.error(path, e)); },
    async add(col, data) { const r = await db.collection(col).add({ ...clean(data), createdAt: TS(), updatedAt: TS() }); return r.id; },
    async set(col, id, data, merge) { await db.collection(col).doc(id).set({ ...clean(data), updatedAt: TS() }, { merge: !!merge }); },
    async del(col, id) { await db.collection(col).doc(id).delete(); },
    upload(path, file, onProg) {
      const ref = st.ref(path); const task = ref.put(file, { contentType: file.type || "application/octet-stream" });
      return new Promise((res, rej) => task.on("state_changed", s => onProg && onProg(s.bytesTransferred / s.totalBytes), rej, async () => res({ path, url: await ref.getDownloadURL() })));
    },
    async removeFile(path) { try { await st.ref(path).delete(); } catch (e) { console.warn(e); } },
    async userDoc(uid) { const s = await db.doc("users/" + uid).get(); return s.exists ? s.data() : null; }
  };
}
function demoStore() {
  const mem = { rounds: [], courses: [], lessons: [], sessions: [], validations: [], notes: [], videos: [], drillLinks: [], profile: [] };
  const L = {}; let seq = 1;
  const emit = col => (L[col] || []).forEach(cb => cb(mem[col].map(x => ({ ...x }))));
  const api = {
    listen(col, cb) { (L[col] = L[col] || []).push(cb); setTimeout(() => cb(mem[col].map(x => ({ ...x }))), 0); return () => {}; },
    listenDoc(path, cb) { const [c, id] = path.split("/"); api.listen(c, a => cb((a.find(x => x._id === id) || null))); return () => {}; },
    async add(col, data) { const id = "d" + (seq++); mem[col].push({ ...clean(data), _id: id }); emit(col); return id; },
    async set(col, id, data, merge) { const i = mem[col].findIndex(x => x._id === id); const v = { ...(merge && i >= 0 ? mem[col][i] : {}), ...clean(data), _id: id }; if (i >= 0) mem[col][i] = v; else mem[col].push(v); emit(col); },
    async del(col, id) { mem[col] = mem[col].filter(x => x._id !== id); emit(col); },
    async upload(path, file, onProg) { onProg && onProg(1); return { path, url: URL.createObjectURL(file) }; },
    async removeFile() {}
  };
  const pars = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 4, 5];
  mem.courses.push({ _id: "c1", name: "Parcours de démonstration", pars });
  const mk = (date, seed) => ({ date, courseId: "c1", course: "Parcours de démonstration", type: "Compétition", holesCount: 18, startHole: 1,
    holesData: pars.map((p, i) => { const r = (seed * 7 + i * 13) % 10; const score = p + (r < 2 ? -1 : r < 7 ? 0 : r < 9 ? 1 : 2); const putts = r === 8 ? 3 : r < 2 ? 1 : 2;
      return { n: i + 1, par: p, score, putts, fw: p === 3 ? null : (r % 3 === 0 ? "L" : r % 5 === 0 ? "R" : "Y"), short: r === 7 ? 1 : 0, pen: r === 9 ? 1 : 0 }; }), cost: "Exemple de données de démonstration." });
  mem.rounds.push({ ...mk("2026-10-10", 1), _id: "r1" }, { ...mk("2026-10-18", 2), _id: "r2" });
  mem.profile.push({ _id: "main", indexHistory: [{ date: "2026-09-01", value: 1.4 }, { date: "2026-10-24", value: 1.0 }] });
  return api;
}

function startData() {
  if (S.subs.length) return;
  for (const col of ["rounds", "courses", "lessons", "sessions", "validations", "notes", "videos", "drillLinks"]) {
    S.subs.push(Store.listen(col, arr => { S.data[col] = arr; S.loaded = true; render(); }));
  }
  S.subs.push(Store.listenDoc("profile/main", d => { S.profile = d; render(); }));
}

/* ---------- Démarrage ---------- */
async function boot() {
  try {
    const [plan, drills] = await Promise.all([fetchJSON("data/plan.json"), fetchJSON("data/drills.json")]);
    S.plan = plan; S.drillList = drills.drills; drills.drills.forEach(d => S.drills[d.id] = d);
  } catch (e) { $("#app").innerHTML = `<p class="muted" style="padding-top:40px">Impossible de charger le plan. Recharge la page.</p>`; return; }
  try { const d = JSON.parse(localStorage.getItem("golf-draft") || "null"); if (d) S.draft = d; } catch (e) {}
  window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
  if (DEMO) { Store = demoStore(); S.user = { email: "démo" }; S.role = "admin"; startData(); render(); return; }
  if (!window.FIREBASE_CONFIG) { $("#app").innerHTML = shellTop() + `<div class="empty"><b>Configuration Firebase en attente</b>Le fichier js/config.js n'est pas encore renseigné. Aperçu possible avec <a href="?demo=1">le mode démonstration</a>.</div>`; return; }
  firebase.initializeApp(window.FIREBASE_CONFIG);
  Store = firebaseStore();
  firebase.auth().onAuthStateChanged(async u => {
    if (!u) { S.user = null; renderLogin(); return; }
    let ud = null; try { ud = await Store.userDoc(u.uid); } catch (e) { console.error(e); }
    if (!ud || ud.active !== true) { renderDenied(u); return; }
    S.user = u; S.role = ud.role || "lecture"; startData(); render();
  });
}
function shellTop() { return `<header class="top"><div><h1>Objectif Mid-Am 2028</h1><div class="sub">Championnat d'Europe Mid-Amateur · cible index −2,0</div></div></header>`; }
function renderLogin() {
  $("#app").innerHTML = `<div class="login">${shellTop()}<form id="login" class="stack">
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
  $("#app").innerHTML = `<div class="login">${shellTop()}<div class="empty"><b>Compte non autorisé</b>Le compte ${esc(u.email)} n'est pas activé. Crée dans Firestore le document users/${esc(u.uid)} avec role = "admin" et active = true.</div><button class="btn ghost sm" data-act="logout">Se déconnecter</button></div>`;
}

/* ---------- Rendu ---------- */
const TABS = [["tableau", "Tableau de bord"], ["plan", "Plan & séances"], ["entrainements", "Entraînements"], ["cours", "Cours pro"], ["parties", "Parties"], ["videos", "Vidéos"]];
const TAB_OF = { seance: "plan", exercice: "plan", entrainement: "entrainements", partie: "parties" };
function parts() { return (location.hash.replace(/^#\/?/, "") || "tableau").split("/").map(decodeURIComponent); }
function render() {
  if (!S.user) return;
  const p = parts(); const tab = TAB_OF[p[0]] || p[0];
  const keep = {}; document.querySelectorAll("#view [data-keep]").forEach(el => { if (el.value) keep[el.id] = el.value; });
  const focusId = document.activeElement && document.activeElement.id;
  const views = { tableau: vTableau, plan: vPlan, seance: vSeance, exercice: vExercice, entrainements: vEntrainements, entrainement: vEntrainement, cours: vCours, parties: vParties, partie: vPartie, videos: vVideos };
  const v = views[p[0]] || vTableau;
  let body; try { body = v(p); } catch (e) { console.error(e); body = `<div class="empty"><b>Erreur d'affichage</b>${esc(e.message)}</div>`; }
  $("#app").innerHTML = `<header class="top"><div><h1>Objectif Mid-Am 2028</h1><div class="sub">Championnat d'Europe Mid-Amateur · cible index −2,0</div></div>
    <div class="row xs muted"><span>${esc(S.user.email || "")}${DEMO ? " · mode démonstration" : ""}</span>${DEMO ? "" : `<button class="btn ghost sm" data-act="logout">Déconnexion</button>`}</div></header>
    <nav class="tabs">${TABS.map(([k, l]) => `<a href="#/${k}" ${k === tab ? 'aria-current="page"' : ""}>${l}</a>`).join("")}</nav>
    <main id="view">${body}</main><p class="xs muted" style="margin-top:40px">v${APP_VERSION}</p>`;
  for (const id in keep) { const el = document.getElementById(id); if (el && !el.value) el.value = keep[id]; }
  if (focusId) { const el = document.getElementById(focusId); if (el && el.matches("input,textarea,select")) el.focus({ preventScroll: true }); }
}
function emptyBox(t, s, btn) { return `<div class="empty"><b>${t}</b>${s}${btn ? `<div style="margin-top:12px">${btn}</div>` : ""}</div>`; }
const backLink = (href, label) => `<a class="back" href="${href}">← ${label}</a>`;

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
function practiceLog() {
  const a = S.data.sessions.map(s => ({ date: s.date, min: s.duration || 0, domain: s.domain }));
  for (const s of S.plan.sessions) { const v = valOf(s.id); if (v && (v.status === "Faite" || v.status === "Partielle")) a.push({ date: s.date, min: v.actualMin ?? s.duration ?? 0, domain: s.domain }); }
  return a;
}
const currentIndex = () => { const h = (S.profile && S.profile.indexHistory) || []; return h.length ? h[h.length - 1] : null; };
const currentPhase = () => { const t = iso(); return (S.plan.phases || []).find(p => p.from <= t && t <= p.to) || null; };

/* ---------- Tableau de bord ---------- */
function vTableau() {
  const plan = S.plan, target = plan.targetIndex ?? -2, ci = currentIndex();
  const left = daysBetween(iso(), plan.entryDeadline);
  const since = iso(new Date(Date.now() - 30 * 864e5));
  const mins = practiceLog().filter(p => p.date >= since && p.date <= iso()).reduce((s, p) => s + (p.min || 0), 0);
  const due = plan.sessions.filter(s => s.date >= since && s.date <= iso()); const done = due.filter(s => (valOf(s.id) || {}).status === "Faite").length;
  const st = statsOf(S.data.rounds);
  const next = plan.sessions.filter(s => !valOf(s.id) && s.date >= iso()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const toVal = plan.sessions.filter(s => !valOf(s.id) && s.date < iso()).length;
  const lastL = [...S.data.lessons].sort(byDateDesc)[0]; const ph = currentPhase();
  const pend = S.data.videos.filter(v => v.analysis && v.analysis.status === "requested").length;
  return `<section class="view">
  <div class="kpis">
    <div class="kpi"><div class="l">Index actuel</div><div class="v">${ci ? n1(ci.value) : "—"}</div><div class="s">${ci ? "au " + fmtD(ci.date) : "à renseigner"}</div></div>
    <div class="kpi"><div class="l">Écart à la cible ${n1(target)}</div><div class="v">${ci ? n1(ci.value - target) : "—"}</div><div class="s">coups d'index à gagner</div></div>
    <div class="kpi"><div class="l">Clôture des inscriptions</div><div class="v">${n0(left)} j</div><div class="s">estimée ${fmtD(plan.entryDeadline)}</div></div>
    <div class="kpi"><div class="l">Entraînement 30 j</div><div class="v">${n1(mins / 60)} h</div><div class="s">${done}/${due.length} séances du plan faites</div></div>
  </div>
  ${canEdit() ? `<div class="row between"><div class="row"><a class="btn sm" href="#/partie/new">+ Carte</a><button class="btn ghost sm" data-act="form" data-kind="session">+ Entraînement</button><button class="btn ghost sm" data-act="form" data-kind="lesson">+ Cours</button></div><button class="btn ghost sm" data-act="form" data-kind="index">Mettre à jour l'index</button></div>` : ""}
  ${ph ? `<p class="note">Phase en cours : <span style="color:var(--ink)">${esc(ph.name)}</span> · ${esc(ph.focus || "")}</p>` : ""}
  ${toVal || pend ? `<p class="note">${toVal ? `<a href="#/plan">${toVal} séance${toVal > 1 ? "s" : ""} à valider</a>` : ""}${toVal && pend ? " · " : ""}${pend ? `<a href="#/videos">${pend} vidéo${pend > 1 ? "s" : ""} en attente d'analyse</a>` : ""}</p>` : ""}
  <div><h2>Trajectoire d'index</h2><div class="panel chart">${indexChart(target, plan.targetDate)}</div></div>
  <div><h2>Ce qu'il faut améliorer · ${st ? `${st.n} dernière${st.n > 1 ? "s" : ""} carte${st.n > 1 ? "s" : ""}` : "aucune carte"}</h2>
    ${st ? gapTable(gaps(st), st) : emptyBox("Pas encore de carte saisie", "Saisis tes parties trou par trou : score, putts, fairway et côté du raté, putts manqués à moins de 2 m. Le classement des écarts par rapport à un niveau +2 apparaîtra ici.", canEdit() ? `<a class="btn ghost sm" href="#/partie/new">Saisir une carte</a>` : "")}</div>
  <div class="two">
    <div><h2>Prochaines séances</h2>${next.length ? `<div class="list">${next.map(s => `<a class="item" href="#/seance/${s.id}"><div class="head"><h3>${esc(s.title)}</h3><span class="small muted">${fmtDs(s.date)}</span></div><span class="small muted">${esc(s.domain)} · ${n0(s.duration)} min</span></a>`).join("")}</div>` : `<p class="small muted">Aucune séance planifiée à venir.</p>`}</div>
    <div><h2>Dernier cours</h2>${lastL ? `<div class="list"><div class="item"><div class="head"><h3>${esc(lastL.theme)}</h3><span class="small muted">${fmtD(lastL.date)}</span></div>${lastL.toWork ? `<p class="small pre"><span class="muted">À travailler : </span>${esc(lastL.toWork)}</p>` : ""}</div></div>` : `<p class="small muted">Aucun cours saisi.</p>`}</div>
  </div></section>`;
}
function gapTable(G, st) {
  const f = (m, v) => v == null ? "—" : m.unit === "%" ? pct(v) : n1(v);
  const totMiss = st.missL + st.missR;
  return `<div class="tbl-wrap"><table class="t"><thead><tr><th>Statistique</th><th class="n">Toi</th><th class="n">Repère +2</th><th>Statut</th></tr></thead><tbody>
  ${G.map(m => { const c = m.g == null ? "" : m.g <= 0 ? "ok" : m.g < 0.15 ? "warn" : "bad"; const l = m.g == null ? "non mesuré" : m.g <= 0 ? "au niveau" : m.g < 0.15 ? "proche" : "priorité";
    return `<tr><td>${esc(m.label)}</td><td class="n">${f(m, m.v)}</td><td class="n">${f(m, m.t)}</td><td><span class="pill ${c}">${l}</span></td></tr>`; }).join("")}
  </tbody></table></div>
  <p class="small muted" style="margin-top:8px">Score moyen ${sgn(st.toPar)} par 18 trous${st.score18 ? ` (${n1(st.score18)} brut sur les cartes 18 trous)` : ""}. Fairways manqués : ${totMiss ? `${pct(st.missL / totMiss * 100)} à gauche, ${pct(st.missR / totMiss * 100)} à droite` : "aucun relevé"}. Repères = ordres de grandeur d'un joueur +2.</p>`;
}
function indexChart(target, tDate) {
  const h = ((S.profile && S.profile.indexHistory) || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (!h.length) return emptyBox("Aucun index enregistré", "Ajoute ton index actuel puis chaque révision pour suivre l'écart à la trajectoire.", canEdit() ? `<button class="btn ghost sm" data-act="form" data-kind="index">Ajouter mon index</button>` : "");
  const W = 640, H = 230, L = 44, R = 16, T = 14, B = 30;
  const x0 = Math.min(+D(h[0].date), +D(iso()) - 60 * 864e5), x1 = +D(tDate);
  const vals = h.map(p => p.value).concat([target]); const ymin = Math.floor(Math.min(...vals) - 0.5), ymax = Math.ceil(Math.max(...vals) + 0.5);
  const X = d => L + (D(d) - x0) / (x1 - x0) * (W - L - R); const Y = v => T + (v - ymin) / (ymax - ymin) * (H - T - B);
  let g = "";
  for (let v = ymin; v <= ymax; v++) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="IBM Plex Mono,monospace">${v < 0 ? "−" : ""}${Math.abs(v)}</text>`;
  for (let y = new Date(x0).getFullYear(); y <= new Date(x1).getFullYear(); y++) for (const m of [0, 6]) { const d = iso(new Date(y, m, 1)); if (+D(d) >= x0 && +D(d) <= x1) g += `<text x="${X(d)}" y="${H - 10}" text-anchor="middle" font-size="11" fill="var(--muted)">${D(d).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })}</text>`; }
  g += `<line x1="${X(h[0].date)}" y1="${Y(h[0].value)}" x2="${X(tDate)}" y2="${Y(target)}" stroke="var(--muted)" stroke-dasharray="4 4"/>`;
  g += `<line x1="${X(iso())}" x2="${X(iso())}" y1="${T}" y2="${H - B}" stroke="var(--line)"/><text x="${X(iso()) + 4}" y="${T + 10}" font-size="11" fill="var(--muted)">aujourd'hui</text>`;
  g += `<circle cx="${X(tDate)}" cy="${Y(target)}" r="4" fill="var(--bg)" stroke="var(--ink)" stroke-width="1.5"/><text x="${X(tDate) - 8}" y="${Y(target) - 8}" text-anchor="end" font-size="11" fill="var(--ink)">cible ${n1(target)}</text>`;
  if (h.length > 1) g += `<polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${h.map(p => X(p.date) + "," + Y(p.value)).join(" ")}"/>`;
  g += h.map((p, i) => `<circle cx="${X(p.date)}" cy="${Y(p.value)}" r="${i === h.length - 1 ? 4.5 : 3}" fill="var(--accent)"/>`).join("");
  const l = h[h.length - 1]; g += `<text x="${X(l.date) + 8}" y="${Y(l.value) + 4}" font-size="12" fill="var(--accent)" font-family="IBM Plex Mono,monospace">${n1(l.value)}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution de l'index vers la cible">${g}</svg><p class="xs muted" style="margin-top:6px">Haut du graphique = meilleur index. Pointillés : trajectoire linéaire vers la cible.</p>`;
}

/* ---------- Plan ---------- */
function statusOf(s) {
  const v = valOf(s.id), t = iso();
  if (v) return { cls: v.status === "Faite" ? "ok" : v.status === "Partielle" ? "warn" : "bad", lab: v.status, v };
  return { cls: s.date < t ? "warn" : s.date === t ? "acc" : "", lab: s.date < t ? "à valider" : s.date === t ? "aujourd'hui" : "prévue", v: null };
}
function vPlan() {
  const p = S.plan, t = iso(), f = S.planFilter;
  let list = [...p.sessions];
  if (f === "todo") list = list.filter(s => !valOf(s.id)); if (f === "done") list = list.filter(s => valOf(s.id));
  list.sort((a, b) => f === "done" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
  const toVal = p.sessions.filter(s => !valOf(s.id) && s.date <= t).length;
  const weeks = {}; for (const s of list) (weeks[mondayOf(s.date)] = weeks[mondayOf(s.date)] || []).push(s);
  const wk = Object.keys(weeks).sort((a, b) => f === "done" ? b.localeCompare(a) : a.localeCompare(b));
  return `<section class="view">
  <div><h2>Objectif</h2><p>${esc(p.objective)}</p><p class="small muted" style="margin-top:6px">Plan du ${fmtD(p.version)} · ${esc(p.note || "")}</p></div>
  <div><h2>Séances${toVal ? ` · <span style="color:var(--warn)">${toVal} à valider</span>` : ""}</h2>
    <div class="chips" role="group" aria-label="Filtre">${[["todo", "À faire"], ["done", "Validées"], ["all", "Toutes"]].map(([k, l]) => `<button data-act="pf" data-f="${k}" aria-pressed="${f === k}">${l}</button>`).join("")}</div>
    ${wk.length ? wk.map(w => `<div class="week"><div class="wl">Semaine du ${D(w).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</div>${weeks[w].map(cardSession).join("")}</div>`).join("") : `<p class="small muted" style="margin-top:12px">Aucune séance dans ce filtre.</p>`}
  </div>
  <div><h2>Préconisations</h2><div style="border-top:1px solid var(--line)">${(p.recos || []).map((r, i) => `<div class="reco"><div class="p">${String(i + 1).padStart(2, "0")}</div><div><div class="row between"><h3>${esc(r.title)}</h3>${r.area ? `<span class="pill">${esc(r.area)}</span>` : ""}</div>
    ${r.why ? `<p class="small muted" style="margin-top:4px">${esc(r.why)}</p>` : ""}${r.how ? `<p class="small" style="margin-top:6px">${esc(r.how)}</p>` : ""}
    ${r.kpi ? `<p class="small" style="margin-top:6px"><span class="muted">Indicateur : </span>${esc(r.kpi)}</p>` : ""}
    ${(r.drills || []).length ? `<p class="small" style="margin-top:6px">${r.drills.map(d => S.drills[d] ? `<a href="#/exercice/${d}">${esc(S.drills[d].name)}</a>` : "").filter(Boolean).join(" · ")}</p>` : ""}</div></div>`).join("")}</div></div>
  <div><h2>Phases</h2><div class="phases">${(p.phases || []).map(ph => { const c = ph.to < t ? "past" : (ph.from <= t && t <= ph.to ? "now" : "");
    return `<div class="phase ${c}"><div class="row between"><h3>${esc(ph.name)}</h3><span class="small muted mono">${fmtD(ph.from)} → ${fmtD(ph.to)}</span></div>
    <p class="small muted">${esc(ph.focus || "")}${ph.indexTarget != null ? ` · index visé ${n1(ph.indexTarget)}` : ""}</p>
    ${(ph.goals || []).length ? `<ul class="small">${ph.goals.map(g => `<li>${esc(g)}</li>`).join("")}</ul>` : ""}</div>`; }).join("")}</div></div>
  </section>`;
}
function cardSession(s) {
  const st = statusOf(s); const nNotes = S.data.notes.filter(n => n.ref === "plan:" + s.id).length; const nVid = S.data.videos.filter(v => v.ref === "plan:" + s.id).length;
  return `<a class="card ${st.v ? "done" : ""}" href="#/seance/${s.id}"><div class="row between"><h3>${esc(s.title)}</h3><span class="pill ${st.cls}">${esc(st.lab)}</span></div>
  <div class="meta"><span>${fmtDs(s.date)}</span><span>·</span><span>${esc(s.domain)}</span><span>·</span><span class="mono">${n0(s.duration)} min</span>${nNotes ? `<span>· ${nNotes} note${nNotes > 1 ? "s" : ""}</span>` : ""}${nVid ? `<span>· ${nVid} vidéo${nVid > 1 ? "s" : ""}</span>` : ""}</div>
  <p class="small">${(s.blocks || []).map(b => esc((S.drills[b.drill] || {}).name || b.drill)).join(" · ")}</p>
  ${st.v && st.v.feedback ? `<p class="small muted">${esc(st.v.feedback)}</p>` : ""}</a>`;
}
function vSeance(p) {
  const s = S.plan.sessions.find(x => x.id === p[1]); if (!s) return emptyBox("Séance introuvable", "Elle a peut-être été retirée du plan.", `<a class="btn ghost sm" href="#/plan">Retour au plan</a>`);
  const st = statusOf(s), v = st.v || {};
  return `<section class="view">
  ${backLink("#/plan", "Plan & séances")}
  <div class="stack"><div class="row between"><h1 class="page">${esc(s.title)}</h1><span class="pill ${st.cls}">${esc(st.lab)}</span></div>
  <div class="meta"><span>${fmtD(s.date)}</span><span>·</span><span>${esc(s.domain)}</span><span>·</span><span class="mono">${n0(s.duration)} min</span></div>
  <p class="kpi-line"><span class="muted">Critère de réussite : </span>${esc(s.kpi)}</p></div>
  <div><h2>Déroulé · cliquer un exercice pour le détail</h2><div style="border-top:1px solid var(--line)">
  ${(s.blocks || []).map(b => { const d = S.drills[b.drill] || { name: b.drill, objective: "" }; return `<a class="block" href="#/exercice/${b.drill}"><span class="m">${n0(b.min)} min</span><div><h3>${esc(d.name)}</h3><p class="small muted">${esc(d.objective)}</p></div><span class="go">Fiche →</span></a>`; }).join("")}</div></div>
  ${canEdit() ? `<div><h2>Validation</h2><form class="panel stack" data-form="validate" data-id="${s.id}">
    <div class="f"><span class="lbl">Résultat</span><div class="seg" data-seg="status">${["Faite", "Partielle", "Non faite"].map(o => `<button type="button" data-v="${o}" aria-pressed="${(v.status || "Faite") === o}">${o}</button>`).join("")}</div></div>
    <div class="f"><span class="lbl">Qualité ressentie</span><div class="seg" data-seg="rating">${[1, 2, 3, 4, 5].map(o => `<button type="button" data-v="${o}" aria-pressed="${v.rating === o}">${o}</button>`).join("")}</div></div>
    <div class="grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
      <div class="f"><label for="v-min">Durée réelle (min)</label><input id="v-min" name="actualMin" inputmode="numeric" value="${esc(v.actualMin ?? s.duration)}"></div>
      <div class="f"><label for="v-measure">Mesure obtenue</label><input id="v-measure" name="measure" value="${esc(v.measure || "")}" placeholder="Ex. 8/10 dans la porte"></div>
      <div class="f full"><label for="v-fb">Retour : ce qui a marché, ce qui coince</label><textarea id="v-fb" name="feedback">${esc(v.feedback || "")}</textarea></div>
    </div>
    <div class="row"><button class="btn" type="submit">${st.v ? "Mettre à jour la validation" : "Valider la séance"}</button>${st.v ? `<button class="btn ghost sm" type="button" data-act="unvalidate" data-id="${s.id}">Annuler la validation</button>` : ""}</div>
  </form></div>` : ""}
  ${notesBlock("plan:" + s.id)}
  ${videosBlock("plan:" + s.id)}
  </section>`;
}

/* ---------- Exercice ---------- */
function vExercice(p) {
  const d = S.drills[p[1]]; if (!d) return emptyBox("Exercice introuvable", "", `<a class="btn ghost sm" href="#/plan">Retour au plan</a>`);
  const used = S.plan.sessions.filter(s => (s.blocks || []).some(b => b.drill === d.id));
  const links = S.data.drillLinks.filter(l => l.drill === d.id);
  const li = a => a && a.length ? `<ul class="plain small">${a.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="small muted">—</p>`;
  return `<section class="view">
  <a class="back" href="#" data-act="back">← Retour</a>
  <div class="stack"><div class="row between"><h1 class="page">${esc(d.name)}</h1><span class="pill">${esc(d.area)}</span></div>
  <p class="small muted">Défaut ciblé : ${esc(d.fault)}</p><p>${esc(d.objective)}</p></div>
  <div class="two"><div><h2>Matériel</h2>${li(d.equipment)}</div><div><h2>Mise en place</h2>${li(d.setup)}</div></div>
  <div><h2>Déroulé</h2><ol class="steps small">${(d.steps || []).map(x => `<li>${esc(x)}</li>`).join("")}</ol></div>
  <div class="two"><div><h2>Consignes clés</h2>${li(d.cues)}</div><div><h2>Erreurs fréquentes</h2>${li(d.errors)}</div></div>
  <p class="kpi-line"><span class="muted">Critère de réussite : </span>${esc(d.success)}</p>
  <div><h2>Vidéos et démonstrations</h2><div class="stack">
    ${links.map(l => { const y = ytId(l.url); return `<div class="stack">${y ? `<div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${y}" title="${esc(l.label || d.name)}" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" loading="lazy"></iframe></div>` : ""}<div class="row between small"><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label || l.url)}</a>${canEdit() ? `<button class="btn ghost sm" data-act="del-link" data-id="${l._id}">Retirer</button>` : ""}</div></div>`; }).join("")}
    ${(d.refs || []).map(r => `<a class="small" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.label)} ↗</a>`).join("")}
    <a class="small" href="https://www.youtube.com/results?search_query=${encodeURIComponent(d.yt || d.name)}" target="_blank" rel="noopener">Voir les démonstrations sur YouTube ↗</a>
    ${canEdit() ? `<form class="row" data-form="link" data-drill="${d.id}" style="align-items:flex-end"><div class="f" style="flex:2 1 220px"><label for="lk-url">Ajouter une vidéo (lien YouTube ou autre)</label><input id="lk-url" name="url" data-keep placeholder="https://youtu.be/…"></div><div class="f" style="flex:1 1 140px"><label for="lk-label">Titre</label><input id="lk-label" name="label" data-keep placeholder="Ex. démo du pro"></div><button class="btn ghost sm" type="submit">Ajouter</button></form>` : ""}
  </div></div>
  ${used.length ? `<div><h2>Séances qui l'utilisent</h2><div class="list">${used.map(s => `<a class="item" href="#/seance/${s.id}"><div class="head"><span>${esc(s.title)}</span><span class="small muted">${fmtDs(s.date)}</span></div></a>`).join("")}</div></div>` : ""}
  </section>`;
}

/* ---------- Notes & vidéos ---------- */
function notesBlock(ref) {
  const notes = S.data.notes.filter(n => n.ref === ref).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const k = ref.replace(/[^\w]/g, "_");
  return `<div><h2>Notes</h2>
  ${notes.length ? `<div class="list">${notes.map(n => `<div class="item"><div class="head"><span class="small muted">${fmtD(n.date)}</span>${canEdit() ? `<button class="btn ghost sm" data-act="del-note" data-id="${n._id}">Supprimer</button>` : ""}</div>
    ${n.text ? `<p class="pre small">${esc(n.text)}</p>` : ""}
    ${(n.files || []).map(f => /^image\//.test(f.type) ? `<a href="${esc(f.url)}" target="_blank" rel="noopener"><img src="${esc(f.url)}" alt="${esc(f.name)}" style="max-height:220px;border:1px solid var(--line)"></a>` : `<a class="small" href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.name)} (${sizeTxt(f.size || 0)}) ↗</a>`).join("")}</div>`).join("")}</div>` : `<p class="small muted">Aucune note.</p>`}
  ${canEdit() ? `<form class="panel stack" data-form="note" data-ref="${esc(ref)}" style="margin-top:10px">
    <div class="f"><label for="nt-${k}">Écrire une note</label><textarea id="nt-${k}" name="text" data-keep placeholder="Sensations, chiffres, consignes à retenir…"></textarea></div>
    <div class="f"><label for="nf-${k}">Joindre des fichiers (photo de carnet, PDF…)</label><input id="nf-${k}" name="files" type="file" multiple accept="image/*,application/pdf,.txt,.md,.doc,.docx"></div>
    <div class="progress" hidden><span></span></div>
    <div><button class="btn sm" type="submit">Ajouter la note</button></div></form>` : ""}</div>`;
}
function videoItem(v, showRef) {
  const a = v.analysis || {}; let refLink = "";
  if (showRef && v.ref) { const [t, id] = v.ref.split(":"); if (t === "plan") { const s = S.plan.sessions.find(x => x.id === id); refLink = s ? `<a class="small" href="#/seance/${id}">${esc(s.title)}</a>` : ""; } else if (t === "free") { refLink = `<a class="small" href="#/entrainement/${id}">Entraînement</a>`; } }
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
  return `<div><h2>Vidéos</h2>
  ${vids.length ? `<div class="list">${vids.map(v => videoItem(v)).join("")}</div>` : `<p class="small muted">Aucune vidéo.</p>`}
  ${canEdit() ? videoForm(ref, k) : ""}</div>`;
}
function videoForm(ref, k) {
  return `<form class="panel stack" data-form="video" data-ref="${esc(ref)}" style="margin-top:10px">
    <div class="f"><label for="vf-${k}">Uploader une vidéo</label><input id="vf-${k}" name="file" type="file" accept="video/*" required></div>
    <div class="grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
      <div class="f"><label for="va-${k}">Angle</label><select id="va-${k}" name="angle"><option>Down-the-line</option><option>De face</option><option>Autre</option></select></div>
      <div class="f"><label for="vc-${k}">Club</label><input id="vc-${k}" name="club" data-keep placeholder="Ex. fer 7"></div>
      <div class="f full"><label for="vm-${k}">Ce que tu veux qu'on regarde</label><textarea id="vm-${k}" name="comment" data-keep placeholder="Ex. chemin de club à la transition, position de la tête à l'impact"></textarea></div>
    </div>
    <label class="row small" style="color:var(--ink)"><input type="checkbox" name="ask" checked style="width:auto"> Demander l'analyse à Claude</label>
    <div class="progress" hidden><span></span></div>
    <div><button class="btn sm" type="submit">Uploader</button></div></form>`;
}
function vVideos() {
  const f = S.vidFilter; let l = [...S.data.videos].sort(byDateDesc);
  if (f === "req") l = l.filter(v => v.analysis && v.analysis.status === "requested"); if (f === "done") l = l.filter(v => v.analysis && v.analysis.status === "done");
  return `<section class="view"><p class="small muted">Les vidéos se rattachent à une séance du plan ou à un entraînement. Pour une analyse, demande-la ici puis écris-moi « analyse mes vidéos » dans le projet Coach de Golf : je récupère les vidéos en attente, j'analyse et la réponse s'affiche sous la vidéo.</p>
  <div class="chips">${[["all", "Toutes"], ["req", "Analyse demandée"], ["done", "Analysées"]].map(([k, lab]) => `<button data-act="vf" data-f="${k}" aria-pressed="${f === k}">${lab}</button>`).join("")}</div>
  ${l.length ? `<div class="list">${l.map(v => videoItem(v, true)).join("")}</div>` : emptyBox("Aucune vidéo", "Uploade une vidéo depuis une séance du plan ou un entraînement.")}
  ${canEdit() ? `<div><h2>Vidéo hors séance</h2>${videoForm("free:none", "free")}</div>` : ""}</section>`;
}

/* ---------- Entraînements libres ---------- */
function domainBars() {
  const since = iso(new Date(Date.now() - 60 * 864e5)); const pr = practiceLog().filter(p => p.date >= since && p.date <= iso()); if (!pr.length) return "";
  const m = {}; for (const p of pr) { const k = p.domain || "Autre"; m[k] = (m[k] || 0) + (p.min || 0); }
  const tot = Object.values(m).reduce((a, b) => a + b, 0) || 1;
  return `<div><h2>Répartition 60 jours · ${n1(tot / 60)} h</h2><div class="hbars">${Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="hbar"><span>${esc(k)}</span><div class="bar"><span style="width:${(v / tot * 100).toFixed(1)}%"></span></div><span class="t">${n0(v / tot * 100)} %</span></div>`).join("")}</div></div>`;
}
function vEntrainements() {
  const l = [...S.data.sessions].sort(byDateDesc);
  return `<section class="view"><div class="row between"><p class="small muted">Séances libres hors plan. Les séances du plan validées comptent aussi dans la répartition.</p>${canEdit() ? `<button class="btn sm" data-act="form" data-kind="session">+ Entraînement</button>` : ""}</div>
  ${domainBars()}
  <div><h2>Journal</h2>${l.length ? `<div class="list">${l.map(s => `<a class="item" href="#/entrainement/${s._id}"><div class="head"><h3>${esc(s.domain || "")}</h3><span class="small muted">${fmtD(s.date)} · <span class="mono">${n0(s.duration)} min</span>${s.rating ? ` · ${s.rating}/5` : ""}</span></div><p class="small pre">${esc(s.content)}</p>${s.result ? `<p class="small"><span class="muted">Mesure : </span>${esc(s.result)}</p>` : ""}</a>`).join("")}</div>`
    : emptyBox("Journal vide", "Note chaque séance : domaine, durée, contenu et une mesure chiffrée quand c'est possible.", canEdit() ? `<button class="btn ghost sm" data-act="form" data-kind="session">Ajouter une séance</button>` : "")}</div></section>`;
}
function vEntrainement(p) {
  const s = S.data.sessions.find(x => x._id === p[1]); if (!s) return S.loaded ? emptyBox("Entraînement introuvable", "", `<a class="btn ghost sm" href="#/entrainements">Retour</a>`) : `<p class="muted">Chargement…</p>`;
  return `<section class="view">${backLink("#/entrainements", "Entraînements")}
  <div class="stack"><div class="row between"><h1 class="page">${esc(s.domain || "Entraînement")}</h1>${canEdit() ? `<button class="btn ghost sm" data-act="form" data-kind="session" data-id="${s._id}">Modifier</button>` : ""}</div>
  <div class="meta"><span>${fmtD(s.date)}</span><span>·</span><span class="mono">${n0(s.duration)} min</span>${s.rating ? `<span>· qualité ${s.rating}/5</span>` : ""}</div>
  <p class="pre">${esc(s.content)}</p>${s.result ? `<p class="small"><span class="muted">Mesure : </span>${esc(s.result)}</p>` : ""}${s.notes ? `<p class="small muted pre">${esc(s.notes)}</p>` : ""}</div>
  ${notesBlock("free:" + s._id)}${videosBlock("free:" + s._id)}</section>`;
}

/* ---------- Cours ---------- */
function vCours() {
  const l = [...S.data.lessons].sort(byDateDesc);
  return `<section class="view"><div class="row between"><p class="small muted">Constats du pro, consignes, et ce qui doit être travaillé avant le cours suivant.</p>${canEdit() ? `<button class="btn sm" data-act="form" data-kind="lesson">+ Cours</button>` : ""}</div>
  ${l.length ? `<div class="list">${l.map(s => `<div class="item"><div class="head"><h3>${esc(s.theme)}</h3><span class="small muted">${fmtD(s.date)}${s.pro ? " · " + esc(s.pro) : ""}${s.rating ? ` · ${s.rating}/5` : ""}</span></div>
  ${s.findings ? `<p class="small pre"><span class="muted">Constats : </span>${esc(s.findings)}</p>` : ""}${s.drills ? `<p class="small pre"><span class="muted">Consignes : </span>${esc(s.drills)}</p>` : ""}${s.toWork ? `<p class="small pre"><span class="muted">À travailler : </span>${esc(s.toWork)}</p>` : ""}
  <div class="row">${s.video ? `<a class="small" href="${esc(s.video)}" target="_blank" rel="noopener">Vidéo ↗</a>` : ""}${canEdit() ? `<button class="btn ghost sm" data-act="form" data-kind="lesson" data-id="${s._id}">Modifier</button>` : ""}</div></div>`).join("")}</div>`
    : emptyBox("Aucun cours saisi", "Après chaque cours, saisis le thème, les constats du pro et les consignes.", canEdit() ? `<button class="btn ghost sm" data-act="form" data-kind="lesson">Saisir un cours</button>` : "")}</section>`;
}

/* ---------- Parties ---------- */
function partiesNav(sub) { return `<div class="chips"><a href="#/parties" ${sub !== "perf" ? 'aria-current="page"' : ""}>Cartes</a><a href="#/parties/perf" ${sub === "perf" ? 'aria-current="page"' : ""}>Performance détaillée</a></div>`; }
function vParties(p) {
  if (p[1] === "perf") return vPerf();
  const l = [...S.data.rounds].sort(byDateDesc);
  return `<section class="view">${partiesNav()}
  <div class="row between"><p class="small muted">Saisie trou par trou : 7, 9, 12, 15 ou 18 trous. GIR et scrambling sont calculés automatiquement.</p>${canEdit() ? `<a class="btn sm" href="#/partie/new">+ Nouvelle carte</a>` : ""}</div>
  ${S.draft && canEdit() ? `<p class="note">Une saisie est en cours (${esc(S.draft.course || "")}, ${fmtD(S.draft.date)}). <a href="#/partie/new">Reprendre</a></p>` : ""}
  ${l.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>Date</th><th>Parcours</th><th class="n">Trous</th><th class="n">Score</th><th class="n">Putts</th><th class="n">FW</th><th class="n">GIR</th><th class="n">Scr.</th><th class="n">&lt; 2 m</th></tr></thead><tbody>
  ${l.map(r => { const c = roundCalc(r); return `<tr><td style="white-space:nowrap"><a href="#/partie/${r._id}">${fmtD(r.date)}</a></td><td>${esc(r.course)}<div class="xs muted">${esc(r.type || "")}</div></td><td class="n">${c.n}</td><td class="n">${c.n ? c.score : "—"} <span class="muted">${c.n ? sgn(c.score - c.par) : ""}</span></td><td class="n">${c.puttsN ? c.putts : "—"}</td><td class="n">${c.fwPoss ? `${c.fwHit}/${c.fwPoss}` : "—"}</td><td class="n">${c.gir}/${c.n}</td><td class="n">${c.scrOpp ? `${c.scr}/${c.scrOpp}` : "—"}</td><td class="n">${c.short}</td></tr>`; }).join("")}
  </tbody></table></div>` : emptyBox("Aucune carte saisie", "Saisis ta prochaine partie trou par trou, sur le parcours ou après.", canEdit() ? `<a class="btn ghost sm" href="#/partie/new">Saisir une carte</a>` : "")}
  </section>`;
}
function scoreCell(score, par) {
  if (score == null) return "—"; const d = score - par; const c = d <= -2 ? "b2" : d === -1 ? "b1" : d === 1 ? "p1" : d >= 2 ? "p2" : "";
  return `<span class="sc ${c}">${score}</span>`;
}
function scorecardTable(rows, mode) {
  // rows: [{n, par, score|avg, putts, fw, gir, scr, short}] ; mode "one" | "avg"
  const halves = [rows.filter(r => r.n <= 9), rows.filter(r => r.n > 9)].filter(h => h.length);
  const fwCell = r => mode === "one" ? (r.par < 4 ? `<span class="muted">·</span>` : r.fw === "Y" ? "✓" : r.fw === "L" ? `<span class="miss-l">← G</span>` : r.fw === "R" ? `<span class="miss-r">D →</span>` : "—")
    : (r.fwPoss ? `${pc(r.fwHit / r.fwPoss * 100)}<div class="xs muted">${r.missL ? r.missL + "G " : ""}${r.missR ? r.missR + "D" : ""}</div>` : `<span class="muted">·</span>`);
  const girCell = r => mode === "one" ? (r.score == null ? "—" : `<span class="dot ${r.gir ? "on" : ""}" title="${r.gir ? "GIR" : "Green manqué"}"></span>`) : (r.cnt ? pc(r.gir / r.cnt * 100) : "—");
  const scrCell = r => mode === "one" ? (r.score == null || r.gir ? `<span class="muted">·</span>` : r.scr ? "✓" : "✗") : (r.scrOpp ? `${r.scr}/${r.scrOpp}` : `<span class="muted">·</span>`);
  return halves.map((h, i) => {
    const sum = k => h.reduce((s, r) => s + (r[k] || 0), 0);
    const totScore = mode === "one" ? (h.every(r => r.score != null) ? sum("score") : "—") : n1(sum("avg"));
    return `<div class="tbl-wrap" style="margin-bottom:10px"><table class="scorecard"><thead><tr><th class="rl">${i === 0 && h[0].n <= 9 ? "Aller" : "Retour"}</th>${h.map(r => `<th>${r.n}</th>`).join("")}<th>Tot.</th></tr></thead><tbody>
    <tr><td class="rl">Par</td>${h.map(r => `<td>${r.par}</td>`).join("")}<td class="tot">${sum("par")}</td></tr>
    <tr><td class="rl">${mode === "one" ? "Score" : "Score moyen"}</td>${h.map(r => `<td>${mode === "one" ? scoreCell(r.score, r.par) : (r.cnt ? `${n1(r.avg)}<div class="xs muted">${sgn(r.avg - r.par)}</div>` : "—")}</td>`).join("")}<td class="tot">${totScore}</td></tr>
    <tr><td class="rl">Putts</td>${h.map(r => `<td>${mode === "one" ? (r.putts ?? "—") : (r.cnt ? n1(r.puttsAvg) : "—")}</td>`).join("")}<td class="tot">${mode === "one" ? sum("putts") : n1(sum("puttsAvg"))}</td></tr>
    <tr><td class="rl">Fairway</td>${h.map(r => `<td>${fwCell(r)}</td>`).join("")}<td class="tot"></td></tr>
    <tr><td class="rl">GIR</td>${h.map(r => `<td>${girCell(r)}</td>`).join("")}<td class="tot">${mode === "one" ? h.filter(r => r.gir).length : ""}</td></tr>
    <tr><td class="rl">Scrambling</td>${h.map(r => `<td>${scrCell(r)}</td>`).join("")}<td class="tot"></td></tr>
    <tr><td class="rl">Putts &lt; 2 m manqués</td>${h.map(r => `<td>${mode === "one" ? (r.score == null ? "—" : r.short || "·") : (r.short || "·")}</td>`).join("")}<td class="tot">${sum("short")}</td></tr>
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
function perfSummary(rounds) {
  const st = statsOf(rounds); if (!st) return "";
  const tm = st.missL + st.missR;
  return `<div class="kpis"><div class="kpi"><div class="l">Score / par (18 trous)</div><div class="v">${sgn(st.toPar)}</div><div class="s">${st.n} carte${st.n > 1 ? "s" : ""}</div></div>
  <div class="kpi"><div class="l">Fairways</div><div class="v">${pct(st.fw)}</div><div class="s">${tm ? `ratés ${pct(st.missL / tm * 100)} G · ${pct(st.missR / tm * 100)} D` : "aucun raté"}</div></div>
  <div class="kpi"><div class="l">GIR /18 · Scrambling</div><div class="v">${n1(st.gir)}</div><div class="s">scrambling ${pct(st.scr)}</div></div>
  <div class="kpi"><div class="l">Putts /18</div><div class="v">${n1(st.putts)}</div><div class="s">${n1(st.short)} manqués &lt; 2 m · ${n1(st.three)} 3-putts</div></div></div>`;
}
function vPerf() {
  const rounds = S.data.rounds; const courses = [...new Set(rounds.map(r => r.courseId).filter(Boolean))].map(id => S.data.courses.find(c => c._id === id) || { _id: id, name: (rounds.find(r => r.courseId === id) || {}).course || "Parcours" });
  if (!courses.length) return `<section class="view">${partiesNav("perf")}${emptyBox("Pas encore de carte", "La carte détaillée apparaît dès la première partie saisie trou par trou.", canEdit() ? `<a class="btn ghost sm" href="#/partie/new">Saisir une carte</a>` : "")}</section>`;
  if (!S.perf.course || !courses.some(c => c._id === S.perf.course)) S.perf.course = courses[0]._id;
  const course = courses.find(c => c._id === S.perf.course); const cr = rounds.filter(r => r.courseId === course._id).sort(byDateDesc);
  if (S.perf.round !== "all" && !cr.some(r => r._id === S.perf.round)) S.perf.round = "all";
  const one = S.perf.round !== "all" ? cr.find(r => r._id === S.perf.round) : null;
  const rows = one ? holeRowsOne(one) : holeRowsAvg(cr, course.pars || []);
  const costly = !one ? rows.filter(r => r.cnt).map(r => ({ n: r.n, d: r.avg - r.par, r })).sort((a, b) => b.d - a.d).slice(0, 3) : [];
  return `<section class="view">${partiesNav("perf")}
  <div class="row" style="align-items:flex-end">
    <div class="f" style="flex:1 1 200px"><label for="pf-course">Parcours</label><select id="pf-course" data-act-change="perf-course">${courses.map(c => `<option value="${c._id}" ${c._id === course._id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
    <div class="f" style="flex:1 1 200px"><label for="pf-round">Partie</label><select id="pf-round" data-act-change="perf-round"><option value="all">Toutes (${cr.length}) · moyennes</option>${cr.map(r => `<option value="${r._id}" ${r._id === S.perf.round ? "selected" : ""}>${fmtD(r.date)} · ${roundCalc(r).score} (${roundCalc(r).n} t.)</option>`).join("")}</select></div>
  </div>
  ${perfSummary(one ? [one] : cr)}
  <div><h2>${one ? `Carte du ${fmtD(one.date)}` : "Carte moyenne par trou"}</h2>${scorecardTable(rows, one ? "one" : "avg")}
  <p class="xs muted">${one ? "Cercle : birdie (double cercle : eagle) · carré : bogey (double carré : double bogey ou plus). Point plein : green en régulation." : "Score moyen et écart au par par trou ; fairways : % touchés et ratés gauche (G) / droite (D) ; scrambling : réussis / occasions."}</p></div>
  ${costly.length ? `<div><h2>Trous les plus coûteux</h2><div class="list">${costly.map(c => `<div class="item"><div class="head"><span>Trou ${c.n} · par ${c.r.par}</span><span class="mono">${sgn(c.d)} en moyenne</span></div><p class="small muted">${c.r.fwPoss ? `Fairway ${pct(c.r.fwHit / c.r.fwPoss * 100)} (${c.r.missL} G, ${c.r.missR} D) · ` : ""}GIR ${pct(c.r.gir / c.r.cnt * 100)} · ${n1(c.r.puttsAvg)} putts</p></div>`).join("")}</div></div>` : ""}
  ${one ? `<div class="row"><a class="btn ghost sm" href="#/partie/${one._id}">Ouvrir la carte</a></div>` : ""}
  </section>`;
}
function vPartie(p) {
  if (p[1] === "new" || p[2] === "edit") return vEditor(p);
  const r = S.data.rounds.find(x => x._id === p[1]); if (!r) return S.loaded ? emptyBox("Carte introuvable", "", `<a class="btn ghost sm" href="#/parties">Retour</a>`) : `<p class="muted">Chargement…</p>`;
  const c = roundCalc(r);
  return `<section class="view">${backLink("#/parties", "Parties")}
  <div class="stack"><div class="row between"><h1 class="page">${esc(r.course)}</h1><span class="mono">${c.score} <span class="muted">(${sgn(c.score - c.par)})</span></span></div>
  <div class="meta"><span>${fmtD(r.date)}</span><span>·</span><span>${esc(r.type || "")}</span><span>·</span><span>${c.n} trous</span></div></div>
  ${perfSummary([r])}
  <div><h2>Carte</h2>${scorecardTable(holeRowsOne(r), "one")}</div>
  ${r.cost ? `<div><h2>Où sont partis les coups</h2><p class="pre">${esc(r.cost)}</p></div>` : ""}
  ${r.notes ? `<div><h2>Notes</h2><p class="pre">${esc(r.notes)}</p></div>` : ""}
  ${canEdit() ? `<div class="row"><a class="btn ghost sm" href="#/partie/${r._id}/edit">Modifier</a><button class="btn danger sm" data-act="del-round" data-id="${r._id}">Supprimer</button></div>` : ""}
  </section>`;
}

/* ---------- Saisie de carte ---------- */
function saveDraft() { try { if (S.draft) localStorage.setItem("golf-draft", JSON.stringify(S.draft)); else localStorage.removeItem("golf-draft"); } catch (e) {} }
function draftFromRound(r) { return { id: r._id, date: r.date, type: r.type, courseId: r.courseId, course: r.course, holesCount: r.holesCount || (r.holesData || []).length, startHole: r.startHole || 1, holes: (r.holesData || []).map(h => ({ ...h })), cost: r.cost || "", notes: r.notes || "", stage: "holes" }; }
function holeNumbers(start, count) { const a = []; for (let i = 0; i < count; i++) a.push(((start - 1 + i) % 18) + 1); return a; }
function vEditor(p) {
  if (!canEdit()) return emptyBox("Lecture seule", "Ton compte ne permet pas de saisir de carte.");
  if (p[2] === "edit") { const r = S.data.rounds.find(x => x._id === p[1]); if (!r) return `<p class="muted">Chargement…</p>`; if (!S.draft || S.draft.id !== r._id) { S.draft = draftFromRound(r); S.hole = 0; saveDraft(); } }
  else if (S.draft && S.draft.id) { S.draft = null; saveDraft(); }
  const d = S.draft;
  if (!d || d.stage === "setup" || !d.stage) {
    const x = d || { date: iso(), type: "Compétition", holesCount: 18, startHole: 1 };
    return `<section class="view">${backLink("#/parties", "Parties")}<h1 class="page">Nouvelle carte</h1>
    <form class="stack" data-form="setup">
      <div class="grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
        <div class="f"><label for="ed-date">Date</label><input id="ed-date" name="date" type="date" value="${esc(x.date)}" required></div>
        <div class="f"><label for="ed-type">Type</label><select id="ed-type" name="type">${["Compétition", "Partie qualificative", "Partie amicale", "Entraînement sur le parcours"].map(o => `<option ${x.type === o ? "selected" : ""}>${o}</option>`).join("")}</select></div>
        <div class="f full"><label for="ed-course">Parcours</label><select id="ed-course" name="courseId"><option value="">Nouveau parcours…</option>${S.data.courses.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => `<option value="${c._id}" ${x.courseId === c._id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
        <div class="f full"><label for="ed-cname">Nom du nouveau parcours</label><input id="ed-cname" name="courseName" placeholder="Ex. Golf du Sart" value=""></div>
      </div>
      <div class="f"><span class="lbl">Nombre de trous</span><div class="seg" data-seg="holesCount">${[7, 9, 12, 15, 18].map(n => `<button type="button" data-v="${n}" aria-pressed="${x.holesCount === n}">${n}</button>`).join("")}</div></div>
      <div class="f" style="max-width:200px"><label for="ed-start">Trou de départ</label><select id="ed-start" name="startHole">${Array.from({ length: 18 }, (_, i) => `<option value="${i + 1}" ${x.startHole === i + 1 ? "selected" : ""}>${i + 1}</option>`).join("")}</select></div>
      <div class="row"><button class="btn" type="submit">Commencer la saisie</button>${d ? `<button class="btn ghost sm" type="button" data-act="draft-discard">Abandonner la saisie</button>` : ""}</div>
    </form></section>`;
  }
  if (d.stage === "finish") {
    const c = roundCalc({ holesData: d.holes });
    return `<section class="view"><a class="back" href="#" data-act="ed-stage" data-v="holes">← Retour aux trous</a><h1 class="page">Terminer la carte</h1>
    ${perfSummary([{ holesData: d.holes, date: d.date }])}
    ${scorecardTable(holeRowsOne({ holesData: d.holes }), "one")}
    <form class="stack" data-form="finish">
      <div class="f"><label for="ed-cost">Où sont partis les coups</label><textarea id="ed-cost" name="cost" placeholder="Ex. 2 coups perdus au départ du 7 et du 12, chip trop long au 15…">${esc(d.cost || "")}</textarea></div>
      <div class="f"><label for="ed-notes">Notes / mental</label><textarea id="ed-notes" name="notes">${esc(d.notes || "")}</textarea></div>
      <p class="small muted">${c.n}/${d.holes.length} trous renseignés.</p>
      <div class="row"><button class="btn" type="submit">Enregistrer la carte</button><button class="btn ghost sm" type="button" data-act="draft-discard">Abandonner</button></div>
    </form></section>`;
  }
  const i = Math.min(S.hole, d.holes.length - 1); const h = d.holes[i]; const par = h.par || 4;
  const g = h.score != null && h.putts != null ? holeGir(h) : null;
  const scr = g === false ? (h.score <= par) : null;
  const stepper = (k, val, ph) => `<div class="stepper"><button type="button" data-act="h-step" data-k="${k}" data-d="-1" aria-label="Moins">−</button><output class="${val == null ? "muted" : ""}">${val ?? ph}</output><button type="button" data-act="h-step" data-k="${k}" data-d="1" aria-label="Plus">+</button></div>`;
  return `<section class="view">
  <div class="row between"><a class="back" href="#/parties">← Parties</a><span class="small muted">${esc(d.course)} · ${fmtD(d.date)}</span></div>
  <div class="holestrip">${d.holes.map((x, j) => `<button type="button" data-act="h-go" data-i="${j}" class="${x.score != null ? "filled" : ""}" aria-current="${j === i}">${x.n}</button>`).join("")}</div>
  <div class="hole-card">
    <div class="hole-title"><span class="h">Trou ${h.n}</span><span class="small muted">${i + 1}/${d.holes.length}</span></div>
    <div class="f"><span class="lbl">Par</span><div class="seg">${[3, 4, 5].map(v => `<button type="button" data-act="h-set" data-k="par" data-v="${v}" aria-pressed="${par === v}">Par ${v}</button>`).join("")}</div></div>
    <div class="two" style="gap:14px"><div class="f"><span class="lbl">Score</span>${stepper("score", h.score, par)}</div><div class="f"><span class="lbl">Putts</span>${stepper("putts", h.putts, 2)}</div></div>
    ${par >= 4 ? `<div class="f"><span class="lbl">Fairway</span><div class="seg">${[["L", "← Gauche"], ["Y", "Touché"], ["R", "Droite →"]].map(([v, l]) => `<button type="button" data-act="h-set" data-k="fw" data-v="${v}" aria-pressed="${h.fw === v}">${l}</button>`).join("")}</div></div>` : `<p class="small muted">Par 3 : pas de fairway.</p>`}
    <div class="two" style="gap:14px"><div class="f"><span class="lbl">Putts &lt; 2 m manqués</span>${stepper("short", h.short, 0)}</div><div class="f"><span class="lbl">Pénalités</span>${stepper("pen", h.pen, 0)}</div></div>
    <div class="auto">${g == null ? `<span class="pill">GIR : à calculer</span>` : `<span class="pill ${g ? "ok" : ""}">GIR ${g ? "oui" : "non"}</span>`}${scr == null ? "" : `<span class="pill ${scr ? "ok" : "bad"}">Scrambling ${scr ? "réussi" : "raté"}</span>`}${h.score != null ? `<span class="pill">${sgn(h.score - par) === "—" ? "" : (h.score - par === 0 ? "Par" : sgn(h.score - par))}</span>` : ""}</div>
    <div class="row between"><button class="btn ghost" type="button" data-act="h-go" data-i="${i - 1}" ${i === 0 ? "disabled" : ""}>← Précédent</button>
    ${i < d.holes.length - 1 ? `<button class="btn" type="button" data-act="h-next">Trou suivant →</button>` : `<button class="btn" type="button" data-act="h-finish">Terminer</button>`}</div>
  </div>
  <p class="xs muted">« Trou suivant » enregistre le score au par et 2 putts s'ils n'ont pas été modifiés. La saisie est conservée sur ce téléphone jusqu'à l'enregistrement.</p>
  </section>`;
}
function startDraft(form) {
  const fd = new FormData(form); const hc = Number(form.querySelector('[data-seg="holesCount"] [aria-pressed="true"]')?.dataset.v || 18);
  let courseId = fd.get("courseId"); let course = ""; let pars = [];
  if (courseId) { const c = S.data.courses.find(x => x._id === courseId); course = c ? c.name : ""; pars = (c && c.pars) || []; }
  else { course = String(fd.get("courseName") || "").trim(); if (!course) { toast("Indique le nom du parcours."); return; } }
  const start = Number(fd.get("startHole") || 1);
  S.draft = { date: fd.get("date") || iso(), type: fd.get("type"), courseId: courseId || null, course, holesCount: hc, startHole: start,
    holes: holeNumbers(start, hc).map(n => ({ n, par: pars[n - 1] || 4, score: null, putts: null, fw: null, short: 0, pen: 0 })), stage: "holes", cost: "", notes: "" };
  S.hole = 0; saveDraft(); render();
}
async function saveRound() {
  const d = S.draft; if (!d) return;
  const filled = d.holes.filter(h => h.score != null); if (!filled.length) { toast("Aucun trou renseigné."); return; }
  try {
    let courseId = d.courseId;
    if (!courseId) { const ex = S.data.courses.find(c => c.name.toLowerCase() === d.course.toLowerCase()); courseId = ex ? ex._id : null; }
    const c = courseId ? S.data.courses.find(x => x._id === courseId) : null;
    const pars = (c && c.pars ? c.pars.slice() : Array(18).fill(null)); for (const h of d.holes) pars[h.n - 1] = h.par || 4;
    if (courseId) await Store.set("courses", courseId, { name: c ? c.name : d.course, pars }, true);
    else courseId = await Store.add("courses", { name: d.course, pars });
    const calc = roundCalc({ holesData: d.holes });
    const doc = { date: d.date, type: d.type, courseId, course: d.course, holesCount: d.holes.length, startHole: d.startHole, holesData: d.holes, cost: d.cost || "", notes: d.notes || "",
      score: calc.score, par: calc.par, putts: calc.putts, fwHit: calc.fwHit, fwPoss: calc.fwPoss, missL: calc.missL, missR: calc.missR, gir: calc.gir, scr: calc.scr, scrOpp: calc.scrOpp, three: calc.three, short: calc.short, pen: calc.pen };
    let id = d.id; if (id) await Store.set("rounds", id, doc); else id = await Store.add("rounds", doc);
    S.draft = null; saveDraft(); toast("Carte enregistrée"); location.hash = "#/partie/" + id;
  } catch (e) { console.error(e); toast("Enregistrement impossible. La saisie est conservée, réessaie."); }
}

/* ---------- Formulaires en feuille ---------- */
const FORMS = {
  session: { title: "Entraînement", col: "sessions", fields: [
    { k: "date", label: "Date", type: "date", req: 1 }, { k: "duration", label: "Durée (min)", type: "number", req: 1 },
    { k: "domain", label: "Domaine", type: "select", opts: DOMAINS, full: 1 },
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
function openForm(kind, id) {
  const F = FORMS[kind]; editing = { kind, id };
  let cur = id ? (S.data[F.col] || []).find(x => x._id === id) || {} : {};
  if (!cur.date) cur = { ...cur, date: iso() };
  $("#sheet-title").textContent = (id ? "Modifier · " : "") + F.title;
  $("#sheet-body").innerHTML = `<form id="sheet-form"><div class="grid">${F.fields.map(f => { const v = cur[f.k] ?? ""; const fid = "sf-" + f.k; let inp;
    if (f.type === "textarea") inp = `<textarea id="${fid}" name="${f.k}" placeholder="${esc(f.ph || "")}">${esc(v)}</textarea>`;
    else if (f.type === "select") inp = `<select id="${fid}" name="${f.k}">${f.opts.map(o => `<option ${String(v) === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
    else inp = `<input id="${fid}" name="${f.k}" type="${f.type === "number" ? "text" : f.type}" ${f.type === "number" ? 'inputmode="decimal"' : ""} value="${esc(v)}" placeholder="${esc(f.ph || "")}">`;
    return `<div class="f ${f.full ? "full" : ""}"><label for="${fid}">${esc(f.label)}${f.req ? " *" : ""}</label>${inp}</div>`; }).join("")}</div>
    <div class="actions"><div>${id ? `<button type="button" class="btn danger sm" data-act="sheet-del">Supprimer</button>` : ""}</div><button type="submit" class="btn">Enregistrer</button></div>
    <p class="small muted" id="sheet-err" style="margin-top:10px" hidden></p></form>`;
  $("#sheet").hidden = false;
  $("#sheet-form").addEventListener("submit", submitSheet);
}
function closeSheet() { $("#sheet").hidden = true; editing = null; }
const sheetErr = m => { const e = $("#sheet-err"); e.textContent = m; e.hidden = false; };
async function submitSheet(e) {
  e.preventDefault(); const { kind, id } = editing; const F = FORMS[kind]; const fd = new FormData(e.target); const data = {};
  for (const f of F.fields) { const v = String(fd.get(f.k) ?? "").trim(); if (f.req && !v) return sheetErr("Champ obligatoire : " + f.label); data[f.k] = NUMERIC.has(f.k) ? num(v) : v; }
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
  } catch (e) { console.error(e); toast("Envoi impossible. Vérifie la connexion."); }
  btn.disabled = false; pg.hidden = true;
}
async function submitVideo(form) {
  const f = form.file.files[0]; if (!f) { toast("Choisis une vidéo."); return; }
  if (f.size > 500 * 1048576) { toast("La vidéo dépasse 500 Mo : coupe-la ou exporte-la en 1080p."); return; }
  const btn = form.querySelector("button[type=submit]"); btn.disabled = true; const pg = form.querySelector(".progress"); pg.hidden = false;
  try {
    const d = iso(); const r = await Store.upload(`videos/${d.slice(0, 7)}/${Date.now()}-${safeName(f.name)}`, f, x => pg.firstElementChild.style.width = (x * 100) + "%");
    await Store.add("videos", { ref: form.dataset.ref, date: d, name: f.name, type: f.type, size: f.size, path: r.path, url: r.url, angle: form.angle.value, club: form.club.value.trim(), comment: form.comment.value.trim(),
      analysis: form.ask.checked ? { status: "requested", requestedAt: d } : null });
    form.reset(); form.querySelectorAll("[data-keep]").forEach(el => el.value = ""); toast("Vidéo envoyée");
  } catch (e) { console.error(e); toast("Envoi impossible. Vérifie la connexion."); }
  btn.disabled = false; pg.hidden = true;
}

/* ---------- Événements ---------- */
document.addEventListener("click", async e => {
  const seg = e.target.closest(".seg button[data-v]:not([data-act])");
  if (seg) { seg.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === seg))); return; }
  const b = e.target.closest("[data-act]"); if (!b) return;
  const a = b.dataset.act, id = b.dataset.id;
  if (b.tagName === "A") e.preventDefault();
  const d = S.draft;
  switch (a) {
    case "logout": if (!DEMO) firebase.auth().signOut(); break;
    case "back": if (history.length > 1) history.back(); else location.hash = "#/plan"; break;
    case "close": closeSheet(); break;
    case "form": openForm(b.dataset.kind, id); break;
    case "sheet-del": if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Confirmer la suppression"; break; }
      try { await Store.del(FORMS[editing.kind].col, editing.id); const k = editing.kind; closeSheet(); toast("Supprimé"); if (k === "session" && location.hash.startsWith("#/entrainement/")) location.hash = "#/entrainements"; } catch (x) { sheetErr("Suppression impossible."); } break;
    case "pf": S.planFilter = b.dataset.f; render(); break;
    case "vf": S.vidFilter = b.dataset.f; render(); break;
    case "unvalidate": if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Confirmer"; break; } await Store.del("validations", id); toast("Validation annulée"); break;
    case "del-note": case "del-video": case "del-link": case "del-round": {
      if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Confirmer"; break; }
      const col = { "del-note": "notes", "del-video": "videos", "del-link": "drillLinks", "del-round": "rounds" }[a];
      const doc = S.data[col].find(x => x._id === id);
      try { if (doc && doc.path) await Store.removeFile(doc.path); if (doc && doc.files) for (const f of doc.files) await Store.removeFile(f.path); await Store.del(col, id); toast("Supprimé"); if (a === "del-round") location.hash = "#/parties"; } catch (x) { toast("Suppression impossible."); }
      break; }
    case "ask-analysis": await Store.set("videos", id, { analysis: { status: "requested", requestedAt: iso() } }, true); toast("Analyse demandée"); break;
    case "draft-discard": if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Confirmer l'abandon"; break; } S.draft = null; saveDraft(); location.hash = "#/parties"; render(); break;
    case "ed-stage": d.stage = b.dataset.v; saveDraft(); render(); break;
    case "h-go": S.hole = Math.max(0, Math.min(d.holes.length - 1, Number(b.dataset.i))); render(); break;
    case "h-set": { const h = d.holes[S.hole]; const k = b.dataset.k; let v = b.dataset.v; if (k === "par") { v = Number(v); h.par = v; if (v === 3) h.fw = null; } else h[k] = h[k] === v ? null : v; saveDraft(); render(); break; }
    case "h-step": { const h = d.holes[S.hole]; const k = b.dataset.k; const base = h[k] ?? (k === "score" ? (h.par || 4) : k === "putts" ? 2 : 0); h[k] = Math.max(k === "score" ? 1 : 0, base + Number(b.dataset.d)); saveDraft(); render(); break; }
    case "h-next": case "h-finish": { const h = d.holes[S.hole]; if (h.score == null) h.score = h.par || 4; if (h.putts == null) h.putts = 2; if (a === "h-next") S.hole++; else d.stage = "finish"; saveDraft(); render(); window.scrollTo(0, 0); break; }
  }
});
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
    try { await Store.set("validations", form.dataset.id, { status: st, rating: rt ? Number(rt) : null, actualMin: num(form.actualMin.value), measure: form.measure.value.trim(), feedback: form.feedback.value.trim(), validatedAt: iso() }); toast("Séance validée"); }
    catch (x) { console.error(x); toast("Enregistrement impossible."); }
  }
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });
boot();
})();
