# Consignes pour Claude — golf-midam

- Déploiement : push sur `main` (GitHub Pages). Jamais de clé ni de mot de passe dans le dépôt.
- Avant chaque push : `node --check js/app.js`, JSON valides, vérification en mode `?demo=1` (playwright), pas de débordement horizontal à 390 px.
- Incrémenter `APP_VERSION` (js/app.js) et les `?v=` d'index.html à chaque livraison.
- Plan et séances : `data/plan.json` (identifiants de séance stables : les validations Firestore y sont rattachées).
  Exercices : `data/drills.json` ; toute séance ne référence que des `drill` existants.
- Données et vidéos : pas d'accès réseau direct à Firebase depuis la session. Passer par le dépôt privé
  `Alexchantry86/golf-midam-data` : pousser `requests/<date>.json` → l'Action exporte `export/data.json` et
  `export/videos/<id>/` ; pousser `analyses/<id>.json` (summary, frames[{label,file,note}], good[], fix[{title,what,why}], drills[{id,cue}], next, text)
  + images `analyses/<id>/<file>.jpg` → section « L'œil du coach » sous la vidéo (`analyses/<id>.md` reste accepté en texte simple).
  Questions sous les vidéos : collection `messages` (ref `video:<id>`, role user/coach, status open/answered), visible dans l'export ;
  Réponse en direct : Cloud Function `functions/index.js` (coachReply, europe-west9, secret ANTHROPIC_API_KEY dans Secret Manager,
  posé par l'Action « Déployer le coach en direct » depuis le secret GitHub du même nom). Secours : y répondre en poussant `answers/<idVideo>.json` = [{"reply_to": idMessage, "text": "…"}].
- Style : palette gris/noir, IBM Plex, pas de gras inutile. Texte en français, tutoiement.
- Parcours : `data/courses.json` (club → parcours → par, si, repères avec longueurs en m, cr/slope ou null, source).
  Vérifier par total, 18 SI distincts, longueurs = totaux publiés. Parcours absents saisis par Alexandre →
  collection Firestore `courseRequests` (visible dans l'export du dépôt data) : les rechercher, les ajouter au
  catalogue, puis passer la demande à `status: "done"` via l'export/Action.
