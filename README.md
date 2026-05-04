# 🖥️ Server War — Bataille de Serveurs

Jeu de stratégie PvP en réseau local. Deux joueurs s'affrontent pour capturer des serveurs fictifs. Inspiré de l'univers hacker des années 90 et des jeux comme Uplink / Hacknet.

## 🎮 Comment jouer

Chaque joueur se connecte depuis son navigateur sur le même réseau Wi-Fi. La partie démarre automatiquement dès que les deux joueurs sont connectés.

**Objectif :** contrôler le plus de serveurs possible avant la fin du temps imparti (90 secondes).

### Stratégie
1. **DDoS** un serveur ennemi pour faire tomber ses HP
2. Quand les HP passent **sous 40**, lancez une **CAPTURE**
3. Utilisez le **BOUCLIER** pour bloquer les attaques adverses
4. **REDÉMARREZ** vos serveurs capturés pour restaurer leur HP

### Contrôles

| Action | Joueur 1 | Joueur 2 |
|--------|----------|----------|
| Sélectionner | `W` / `S` | `↑` / `↓` |
| DDoS | `A` | `←` |
| Capturer | `D` | `→` |
| Bouclier | `R` | `,` |
| Redémarrer | `F` | `.` |

---

## 🚀 Installation & Lancement

### Prérequis
- [Node.js](https://nodejs.org/) v16 ou supérieur

### Étapes

```bash
# 1. Cloner le dépôt
git clone https://github.com/VOTRE_USERNAME/server-war.git
cd server-war

# 2. Installer les dépendances
npm install

# 3. Lancer le serveur
npm start
```

Le terminal affichera l'URL réseau à partager :

```
🎮 SERVER WAR — en ligne sur le port 3000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Accès local :     http://localhost:3000
Accès réseau :    http://192.168.1.XX:3000   ← partager cette URL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Jouer en réseau local (LAN)

1. **Joueur 1** lance `npm start` sur sa machine
2. **Joueur 1** ouvre `http://localhost:3000`
3. **Joueur 2** ouvre l'URL réseau affichée (ex: `http://192.168.1.42:3000`) sur son propre ordinateur
4. La partie démarre automatiquement !

> ⚠️ Les deux machines doivent être sur le **même réseau Wi-Fi**.

---

## 📁 Structure du projet

```
server-war/
├── server.js          # Serveur Node.js + WebSocket (logique de jeu)
├── package.json
├── README.md
└── public/
    └── index.html     # Interface client (HTML/CSS/JS)
```

## 🛠️ Technologies

- **Node.js** — serveur HTTP natif
- **ws** — WebSockets pour la communication temps réel
- **HTML/CSS/JS** vanilla — zéro framework côté client

---

*Jeu de stratégie fictif — aucun vrai système informatique n'est impliqué.*
