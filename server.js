const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/public/index.html' : '/public' + req.url;
  filePath = path.join(__dirname, filePath);
  const ext = path.extname(filePath);
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

const SERVERS_DEF = [
  { name: 'nginx-01', icon: '[W]' }, { name: 'db-master', icon: '[D]' },
  { name: 'auth-srv', icon: '[A]' }, { name: 'cdn-node', icon: '[C]' },
  { name: 'api-gate', icon: '[G]' }, { name: 'redis-06', icon: '[R]' },
  { name: 'k8s-pod', icon: '[K]' }, { name: 'firewall', icon: '[F]' },
  { name: 'vpn-hub', icon: '[V]' }, { name: 'dns-root', icon: '[X]' },
];

let gameState = null;
let clients = {};
let playerSlots = { p1: null, p2: null };
let gameInterval = null;

function initGame() {
  gameState = {
    servers: SERVERS_DEF.map(s => ({
      ...s, hp: 100, maxHp: 100, owner: 'neutral', capturing: null, capProgress: 0
    })),
    cooldowns: { p1: { ddos: 0, cap: 0, shield: 0, reboot: 0 }, p2: { ddos: 0, cap: 0, shield: 0, reboot: 0 } },
    shields: { p1: false, p2: false },
    selected: { p1: 0, p2: 5 },
    timer: 90,
    phase: 'playing',
    log: [],
    scores: { p1: 0, p2: 0 },
  };
}

function addLog(msg, cls = 'evn') {
  if (!gameState) return;
  const d = new Date();
  const ts = d.toTimeString().slice(3, 8);
  gameState.log.unshift({ ts, msg, cls });
  if (gameState.log.length > 40) gameState.log.pop();
}

function calcScores() {
  const s = gameState.servers;
  return {
    p1: s.filter(x => x.owner === 'p1').length * 10,
    p2: s.filter(x => x.owner === 'p2').length * 10,
  };
}

function gameTick() {
  if (!gameState || gameState.phase !== 'playing') return;
  gameState.timer--;

  gameState.servers.forEach((s, i) => {
    if (s.owner !== 'neutral') s.hp = Math.min(s.maxHp, s.hp + 2);
    if (s.capturing) {
      s.capProgress += 8;
      if (s.capProgress >= 100) {
        s.owner = s.capturing;
        s.capturing = null; s.capProgress = 0; s.hp = 60;
        addLog(`CAPTURE ! ${s.name} appartient à ${s.owner === 'p1' ? 'JOUEUR 1' : 'JOUEUR 2'} !`, 'evcap');
      }
    }
  });

  ['p1', 'p2'].forEach(p => {
    Object.keys(gameState.cooldowns[p]).forEach(k => {
      if (gameState.cooldowns[p][k] > 0) gameState.cooldowns[p][k]--;
    });
    if (gameState.shields[p]) gameState.shields[p] = false;
  });

  gameState.scores = calcScores();

  if (gameState.timer <= 0) {
    gameState.phase = 'ended';
    clearInterval(gameInterval);
    gameInterval = null;
    addLog('PARTIE TERMINÉE !', 'evcap');
  }

  broadcast({ type: 'state', state: gameState });
}

function doAction(player, action) {
  if (!gameState || gameState.phase !== 'playing') return;
  const me = player;
  const enemy = me === 'p1' ? 'p2' : 'p1';
  const sel = gameState.selected[me];
  const s = gameState.servers[sel];
  const cd = gameState.cooldowns[me];

  if (action === 'select_up') {
    gameState.selected[me] = (sel - 1 + 10) % 10;
  } else if (action === 'select_down') {
    gameState.selected[me] = (sel + 1) % 10;
  } else if (action === 'ddos') {
    if (cd.ddos > 0 || s.owner === me) return;
    const blocked = gameState.shields[enemy] && s.owner === enemy;
    const dmg = blocked ? 0 : Math.floor(15 + Math.random() * 20);
    s.hp = Math.max(0, s.hp - dmg);
    cd.ddos = 3;
    if (blocked) addLog(`${me === 'p1' ? 'J1' : 'J2'} DDoS → ${s.name} [BOUCLIER ACTIF !]`, me === 'p1' ? 'ev1' : 'ev2');
    else addLog(`${me === 'p1' ? 'J1' : 'J2'} DDoS → ${s.name} (−${dmg} HP)`, me === 'p1' ? 'ev1' : 'ev2');
    if (s.hp <= 0 && s.owner !== me) { s.hp = 0; s.owner = 'neutral'; s.capturing = null; addLog(`${s.name} hors ligne — neutre !`, 'evn'); }
  } else if (action === 'cap') {
    if (cd.cap > 0 || s.owner === me) return;
    if (s.hp > 40) { addLog(`${me === 'p1' ? 'J1' : 'J2'} : HP trop élevé pour capturer (< 40 requis)`, 'evn'); return; }
    s.capturing = me; s.capProgress = 0; cd.cap = 8;
    addLog(`${me === 'p1' ? 'J1' : 'J2'} capture ${s.name}...`, me === 'p1' ? 'ev1' : 'ev2');
  } else if (action === 'shield') {
    if (cd.shield > 0) return;
    gameState.shields[me] = true; cd.shield = 10;
    addLog(`${me === 'p1' ? 'J1' : 'J2'} bouclier activé !`, me === 'p1' ? 'ev1' : 'ev2');
  } else if (action === 'reboot') {
    if (cd.reboot > 0 || s.owner !== me) return;
    s.hp = s.maxHp; s.capturing = null; s.capProgress = 0; cd.reboot = 12;
    addLog(`${me === 'p1' ? 'J1' : 'J2'} redémarre ${s.name} (HP restauré)`, me === 'p1' ? 'ev1' : 'ev2');
  }

  gameState.scores = calcScores();
  broadcast({ type: 'state', state: gameState });
}

function broadcast(msg) {
  const data = JSON.stringify(msg);
  Object.values(clients).forEach(ws => { try { ws.send(data); } catch (e) {} });
}

function assignPlayer(ws, id) {
  if (!playerSlots.p1) { playerSlots.p1 = id; ws.send(JSON.stringify({ type: 'assign', player: 'p1' })); return 'p1'; }
  if (!playerSlots.p2) { playerSlots.p2 = id; ws.send(JSON.stringify({ type: 'assign', player: 'p2' })); return 'p2'; }
  ws.send(JSON.stringify({ type: 'assign', player: 'spectator' })); return 'spectator';
}

let clientId = 0;
wss.on('connection', ws => {
  const id = ++clientId;
  clients[id] = ws;
  const player = assignPlayer(ws, id);
  ws.player = player;

  if (gameState) ws.send(JSON.stringify({ type: 'state', state: gameState }));

  const ready = playerSlots.p1 && playerSlots.p2;
  if (ready && (!gameState || gameState.phase === 'ended')) {
    initGame();
    addLog('Les deux joueurs connectés — BATAILLE !', 'evcap');
    gameInterval = setInterval(gameTick, 1000);
    broadcast({ type: 'state', state: gameState });
  }

  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'action' && ws.player !== 'spectator') {
        doAction(ws.player, msg.action);
      } else if (msg.type === 'restart' && gameState && gameState.phase === 'ended') {
        initGame();
        addLog('Nouvelle partie — EN GARDE !', 'evcap');
        gameInterval = setInterval(gameTick, 1000);
        broadcast({ type: 'state', state: gameState });
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    delete clients[id];
    if (playerSlots.p1 === id) playerSlots.p1 = null;
    if (playerSlots.p2 === id) playerSlots.p2 = null;
    if (gameState && gameState.phase === 'playing') {
      gameState.phase = 'ended';
      if (gameInterval) { clearInterval(gameInterval); gameInterval = null; }
      addLog('Un joueur s\'est déconnecté — partie annulée.', 'evn');
      broadcast({ type: 'state', state: gameState });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const nets = os.networkInterfaces();
  console.log(`\n🎮 SERVER WAR — en ligne sur le port ${PORT}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Accès local :     http://localhost:' + PORT);
  Object.values(nets).flat().filter(n => n.family === 'IPv4' && !n.internal).forEach(n => {
    console.log(`Accès réseau :    http://${n.address}:${PORT}`);
  });
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Partagez l\'URL réseau avec votre ami !\n');
});
