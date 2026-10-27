// Coach en direct : répond aux questions posées sous les vidéos (collection messages), en quelques secondes.
// La clé Anthropic est un secret Google (Secret Manager) : elle n'est ni dans le dépôt ni dans l'app.
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const MODEL = "claude-sonnet-5-5";
const DRILLS_URL = "https://alexchantry86.github.io/golf-midam/data/drills.json";

const SYSTEM = `Tu es le coach de golf d'Alexandre Chantry (index 1, objectif −2 pour jouer le Championnat d'Europe Mid-Amateur).
Tu réponds à ses questions sur l'analyse d'une de ses vidéos de swing, dans son application.
Règles :
- Français, tutoiement, ton direct et précis. Pas de formules de politesse, pas de titres, pas de gras ni de listes à puces sauf si une courte liste d'étapes aide vraiment.
- 3 à 8 phrases en général. Va à l'essentiel.
- Préfère les repères concrets et physiques (« recule la poche arrière gauche », « tee planté à 10 cm à l'intérieur du pied gauche ») aux degrés et aux notions abstraites.
- Explique le mécanisme quand il le demande (pourquoi ça se produit), il aime comprendre.
- Appuie-toi sur l'analyse publiée et sur les images fournies. Ne prétends pas voir ce que tu ne vois pas ; dis ce qu'un angle ne permet pas de mesurer (de face : déplacement de la tête le long de la ligne de jeu ; dans l'axe : rotation exacte du bassin).
- Quand c'est utile, renvoie vers un exercice de son catalogue par son nom exact.
Défauts déjà confirmés sur son swing : rotation des hanches insuffisante → compensation du haut du corps → chemin de club par l'extérieur → relâchement bloqué ; tête qui avance à la transition ; bras gauche qui se plie après l'impact (aile de poulet).
Si la question sort du golf, réponds brièvement et ramène-le à son entraînement.`;

let drillsCache = null;
async function drills() {
  if (drillsCache) return drillsCache;
  try { const r = await fetch(DRILLS_URL); drillsCache = (await r.json()).drills || []; } catch (e) { logger.warn("drills", e); drillsCache = []; }
  return drillsCache;
}

function analysisText(a) {
  if (!a) return "Aucune analyse publiée.";
  const L = [];
  if (a.angle) L.push(`Angle : ${a.angle}`);
  if (a.summary) L.push(`Synthèse : ${a.summary}`);
  (a.frames || []).forEach((f, i) => L.push(`Image ${i + 1} « ${f.label} » : ${f.note || ""}`));
  if ((a.good || []).length) L.push("Ce qui va bien :\n" + a.good.map(g => "- " + g).join("\n"));
  if ((a.fix || []).length) L.push("À corriger :\n" + a.fix.map((f, i) => `${i + 1}. ${f.title} — ${f.what || ""} ${f.why ? "Pourquoi : " + f.why : ""}`).join("\n"));
  if ((a.drills || []).length) L.push("Exercices conseillés : " + a.drills.map(d => `${d.id} (${d.cue || ""})`).join(" ; "));
  if (a.next) L.push(`Prochaine vidéo : ${a.next}`);
  if (!L.length && a.text) L.push(a.text);
  return L.join("\n");
}

export const coachReply = onDocumentCreated(
  { document: "messages/{id}", region: "europe-west9", secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 120, memory: "256MiB", maxInstances: 3 },
  async event => {
    const snap = event.data; if (!snap) return;
    const q = snap.data();
    if (q.role !== "user" || q.status === "answered" || !String(q.ref || "").startsWith("video:")) return;
    const vid = q.ref.slice(6);
    await snap.ref.set({ status: "thinking" }, { merge: true });
    try {
      const vs = await db.collection("videos").doc(vid).get();
      const v = vs.exists ? vs.data() : {};
      const a = v.analysis && v.analysis.status === "done" ? v.analysis : null;
      const thread = (await db.collection("messages").where("ref", "==", q.ref).get()).docs
        .map(d => ({ id: d.id, ...d.data() })).filter(m => m.id !== snap.id).sort((x, y) => String(x.at).localeCompare(String(y.at))).slice(-12);
      const cat = await drills();
      const used = new Set((a && a.drills || []).map(d => d.id));
      const drillInfo = cat.filter(d => used.has(d.id)).map(d => `${d.name} [${d.id}] : ${d.objective || ""} Étapes : ${(d.steps || []).join(" / ")} Repères : ${(d.cues || []).join(" / ")}`).join("\n");
      const catalogue = cat.map(d => `${d.name} [${d.id}]`).join(" ; ");

      const ctx = `Vidéo du ${v.date || "?"} · angle déclaré : ${v.angle || "?"}${v.club ? " · club : " + v.club : ""}${v.comment ? "\nCe qu'il voulait qu'on regarde : " + v.comment : ""}

ANALYSE PUBLIÉE
${analysisText(a)}

EXERCICES CONSEILLÉS (détail)
${drillInfo || "—"}

CATALOGUE D'EXERCICES DISPONIBLES
${catalogue}`;

      const images = (a && a.frames || []).filter(f => f.url).slice(0, 5).flatMap((f, i) => [
        { type: "text", text: `Image ${i + 1} : ${f.label}` },
        { type: "image", source: { type: "url", url: f.url } }]);

      const messages = [{ role: "user", content: [...images, { type: "text", text: ctx }] }, { role: "assistant", content: "J'ai l'analyse et les images en tête. Quelle est ta question ?" }];
      for (const m of thread) {
        const role = m.role === "coach" ? "assistant" : "user";
        const last = messages[messages.length - 1];
        if (last.role === role) last.content = (typeof last.content === "string" ? last.content : "") + "\n\n" + m.text;
        else messages.push({ role, content: m.text });
      }
      const last = messages[messages.length - 1];
      if (last.role === "user") last.content = (typeof last.content === "string" ? last.content : "") + "\n\n" + q.text;
      else messages.push({ role: "user", content: q.text });

      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_API_KEY.value(), "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: MODEL, max_tokens: 900, system: SYSTEM, messages })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(`API ${r.status} : ${JSON.stringify(j).slice(0, 300)}`);
      const text = (j.content || []).filter(c => c.type === "text").map(c => c.text).join("\n").trim();
      if (!text) throw new Error("réponse vide");
      await db.collection("messages").add({ ref: q.ref, role: "coach", text, at: new Date().toISOString(), replyTo: snap.id, model: MODEL, createdAt: FieldValue.serverTimestamp() });
      await snap.ref.set({ status: "answered" }, { merge: true });
    } catch (e) {
      logger.error("coachReply", e);
      await snap.ref.set({ status: "error", error: String(e.message || e).slice(0, 300) }, { merge: true });
    }
  });
