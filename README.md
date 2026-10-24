# Objectif Mid-Am 2028

App de pilotage de la préparation au Championnat d'Europe Mid-Amateur : plan et séances à valider, fiches d'exercices,
entraînements, cours avec le pro, cartes trou par trou, performance détaillée par parcours, notes et vidéos.

- Site : GitHub Pages, `https://alexchantry86.github.io/golf-midam/` (aperçu sans compte : `?demo=1`)
- Comptes et données : Firebase Authentication + Firestore ; vidéos et pièces jointes : Firebase Storage (offre Blaze)
- Sécurité : `firestore.rules` et `storage.rules`, déployées par l'Action « Déployer les règles Firebase »

## Organisation
```
index.html, css/, js/app.js   le site
js/config.js                  configuration Firebase (publique)
data/plan.json                objectif, phases, préconisations, séances du plan (modifié par Claude)
data/drills.json              fiches d'exercices (modifié par Claude)
firestore.rules, storage.rules, firebase.json
.github/workflows/deploy-rules.yml
```
Les validations, notes, vidéos, cartes, cours et entraînements sont dans Firestore, jamais dans ce dépôt.

## Mise en route (une fois)
1. Firebase : projet `golf-midam`, offre Blaze. Authentication : E-mail/Mot de passe activé, inscription désactivée,
   domaine autorisé `alexchantry86.github.io`. Firestore (europe-west9). Storage activé.
2. Firestore → collection `users` → document dont l'ID est ton UID : `role` = `admin`, `active` = `true`.
   Un pro en lecture seule : même chose avec `role` = `lecture`.
3. Compte de service `claude-deploy` (rôles Administrateur Firebase + Administrateur des objets Storage) → clé JSON →
   secret `FIREBASE_SERVICE_ACCOUNT` dans ce dépôt et dans `golf-midam-data`.
4. Settings → Pages → Deploy from a branch → `main` / `(root)`.
5. Lancer une fois Actions → « Déployer les règles Firebase » → Run workflow. Si Storage demande d'autoriser
   les règles inter-services (lecture de `users` depuis Storage), accepter dans la console Storage → Règles.

## Mises à jour
Claude pousse sur `main` ; Pages republie en 1 à 2 minutes ; les règles se déploient seules si elles changent.
Version affichée en bas de page (`APP_VERSION` dans `js/app.js`) ; incrémenter aussi `?v=` dans `index.html`.
