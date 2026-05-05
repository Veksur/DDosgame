# 🖥️ Server War — Bataille de Serveurs

Jeu de stratégie PvP en ligne avec système de **lobby par code**. Deux joueurs s'affrontent pour capturer des serveurs fictifs, de n'importe où dans le monde.

---

## 🚀 Déploiement sur Railway (gratuit, 5 minutes)

### Étape 1 — Mettre le projet sur GitHub
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/TON_USERNAME/server-war.git
git push -u origin main
```

### Étape 2 — Déployer sur Railway
1. Aller sur **[railway.app](https://railway.app)** → Se connecter avec GitHub
2. **New Project** → **Deploy from GitHub repo** → Sélectionner `server-war`
3. Railway détecte automatiquement Node.js et lance `npm start`
4. Aller dans **Settings** → **Networking** → **Generate Domain**
5. Votre jeu est en ligne sur `https://server-war-XXX.up.railway.app` 🎉

> Railway offre 5$ de crédit gratuit par mois — largement suffisant pour ce projet.

---

## 🎮 Comment jouer

1. **Joueur 1** ouvre le site → clique **Créer un lobby** → reçoit un code (ex: `K7PQR`)
2. **Joueur 2** ouvre le même site → entre le code → la partie démarre !

### Objectif
Capturer le maximum de serveurs en 90 secondes.

### Stratégie
- **DDoS** un serveur ennemi pour faire baisser ses HP
- Quand les HP passent **sous 40**, lancez une **CAPTURE**
- **BOUCLIER** pour bloquer les attaques adverses
- **REDÉMARRER** pour restaurer les HP d'un serveur allié

### Contrôles

| Action | Joueur 1 | Joueur 2 |
|--------|----------|----------|
| Sélectionner | `W` / `S` | `↑` / `↓` |
| DDoS | `A` | `←` |
| Capturer | `D` | `→` |
| Bouclier | `R` | `,` |
| Redémarrer | `F` | `.` |

> Chaque joueur utilise ses propres touches — jouable sur deux ordinateurs séparés.

---

## 🛠️ Lancer en local

```bash
npm install
npm start
# → http://localhost:3000
```

---

## 📁 Structure

```
server-war/
├── server.js        # Serveur Node.js + WebSocket + gestion des lobbies
├── package.json
├── README.md
└── public/
    └── index.html   # Interface client complète
```

*Jeu de stratégie fictif — aucun vrai système informatique impliqué.*
