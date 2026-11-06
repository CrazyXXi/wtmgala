# Le WTM Gala – billetterie

## Lancer en développement (2 terminaux)
```
cd app && npm install
npm run api     # API + base SQLite (server/data.db), port 8787
npm run dev     # site, port 5173 (proxy /api → 8787)
```
Sans configuration d'e-mail, le code de connexion s'affiche dans le terminal de l'API **et** dans la fenêtre de connexion (mode dev uniquement).

## Envoi réel des e-mails (code de connexion + confirmation de commande)
Créez un compte sur https://resend.com, vérifiez votre domaine d'envoi, créez une clé API, puis lancez l'API avec :
```
RESEND_API_KEY=re_xxx MAIL_FROM="WTM Gala <billets@votre-domaine.com>" SECRET=<chaîne aléatoire longue> NODE_ENV=production node server/index.mjs
```
En production le code n'est jamais renvoyé au navigateur. `app/` doit être construit (`npm run build`), le serveur sert alors `app/dist`.

## Règles garanties par le serveur
- un seul compte par e-mail (contrainte UNIQUE insensible à la casse) ;
- chaque commande et chaque billet appartiennent au compte connecté ; « Mes billets » ne renvoie que ceux du compte ;
- prix, stock et QR (signé HMAC) calculés côté serveur ; code à 6 chiffres haché, valable 10 min, 5 essais, 6 demandes/heure/e-mail.

Le paiement reste simulé (à brancher : FedaPay / KkiaPay).
