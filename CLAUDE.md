# Consignes pour Claude — golf-midam

- Déploiement : push sur `main` (GitHub Pages). Jamais de clé ni de mot de passe dans le dépôt.
- Avant chaque push : `node --check js/app.js`, JSON valides, vérification en mode `?demo=1` (playwright), pas de débordement horizontal à 390 px.
- Incrémenter `APP_VERSION` (js/app.js) et les `?v=` d'index.html à chaque livraison.
- Plan et séances : `data/plan.json` (identifiants de séance stables : les validations Firestore y sont rattachées).
  Exercices : `data/drills.json` ; toute séance ne référence que des `drill` existants.
- Données et vidéos : pas d'accès réseau direct à Firebase depuis la session. Passer par le dépôt privé
  `Alexchantry86/golf-midam-data` : pousser `requests/<date>.json` → l'Action exporte `export/data.json` et
  `export/videos/<id>/` ; pousser `analyses/<id>.md` → l'analyse s'affiche sous la vidéo.
- Style : palette gris/noir, IBM Plex, pas de gras inutile. Texte en français, tutoiement.
