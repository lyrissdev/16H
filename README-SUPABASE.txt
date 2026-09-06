16H — PWA + Supabase sync
==========================

Cette version fonctionne toujours localement, mais peut aussi synchroniser
la même timeline entre ton Mac et ton iPhone via Supabase.

1) SUPABASE
-----------
- Crée un projet gratuit sur Supabase.
- Ouvre SQL Editor > New query.
- Colle tout le contenu de supabase-setup.sql puis exécute-le.
- Dans les réglages API du projet, récupère :
  • Project URL
  • Publishable key (sb_publishable_...) ou l'ancienne anon key
- N'utilise JAMAIS la service_role key dans 16H.

2) GITHUB PAGES
---------------
Envoie à la racine de ton repository :
- index.html
- manifest.webmanifest
- service-worker.js
- icon-180.png
- icon-192.png
- icon-512.png

Le fichier supabase-setup.sql peut rester sur ton Mac. Il n'est pas nécessaire
pour faire tourner l'application une fois la base créée.

3) PREMIER APPAREIL
-------------------
- Ouvre 16H.
- Clique Cloud.
- Colle le Project URL + la Publishable key.
- Clique Enregistrer la connexion.
- Entre ton email et un mot de passe.
- Clique Créer le compte.
- Si Supabase exige une confirmation email, confirme-la puis connecte-toi.
- Clique Synchroniser maintenant.

4) DEUXIEME APPAREIL
--------------------
- Ouvre exactement la même URL 16H.
- Cloud > colle le même Project URL + Publishable key.
- Connecte-toi avec le MEME email et le MEME mot de passe.
- Tes blocs et règles apparaissent.

FONCTIONNEMENT
--------------
- Chaque modification est d'abord sauvegardée localement.
- Si Internet + connexion Supabase sont disponibles, elle est synchronisée.
- En hors-ligne, l'app continue de fonctionner.
- Au retour d'Internet ou au retour dans l'app, une synchronisation est relancée.
- Les conflits utilisent une logique "dernière modification gagnante".


V2 CACHE FIX
- Navigation uses network-first caching.
- Future GitHub Pages updates should appear without the old app being stuck in cache.


V3 — PERSISTANCE DE SESSION IPHONE
- Auth Supabase stockée explicitement dans le localStorage de la PWA.
- Clé de stockage stable propre à 16H.
- Migration automatique de la session V2 si elle existe.
- Restauration et refresh au lancement / retour au premier plan.
- Déconnexion limitée à l'appareil courant.


V4 — INTERFACE CLOUD IPHONE
- Quand la session est active, les champs Project URL, clé, email et mot de passe sont masqués.
- Le mot de passe est vidé immédiatement après connexion/création du compte.
- L'écran connecté n'affiche plus que l'état, le compte, Synchroniser, Se déconnecter et Fermer.


V5 — BLOCS ENRICHIS + TYPES
- Bloc : titre, adresse, description, début, fin, couleur.
- Double-clic : fiche de consultation, puis bouton Modifier.
- Types pré-enregistrés et création de nouveaux types.
- Types synchronisés entre Mac et iPhone avec Supabase.
- Timeline recentrée toutes les 15 minutes.
- IMPORTANT : exécuter supabase-migration-v5.sql dans Supabase SQL Editor AVANT de publier cette version.
