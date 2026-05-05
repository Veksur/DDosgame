const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  let fp = req.url === '/' ? '/public/index.html' : '/public' + req.url;
  fp = path.join(__dirname, fp);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('404'); return; }
    const ext = path.extname(fp);
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

const SERVERS_DEF = [
  { name: 'nginx-01', icon: '[W]' }, { name: 'db-master', icon: '[D]' },
  { name: 'auth-srv',  icon: '[A]' }, { name: 'cdn-node',  icon: '[C]' },
  { name: 'api-gate',  icon: '[G]' }, { name: 'redis-06',  icon: '[R]' },
  { name: 'k8s-pod',   icon: '[K]' }, { name: 'firewall',  icon: '[F]' },
  { name: 'vpn-hub',   icon: '[V]' }, { name: 'dns-root',  icon: '[X]' },
];

const lobbies = {};

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

function initGame(lobby) {
  lobby.state = {
    servers: SERVERS_DEF.map(s => ({ ...s, hp: 100, maxHp: 100, owner: 'neutral', capturing: null, capProgress: 0 })),
    cooldowns: { p1: { ddos: 0, cap: 0, shield: 0, reboot: 0 }, p2: { ddos: 0, cap: 0, shield: 0, reboot: 0 } },
    shields:  { p1: false, p2: false },
    selected: { p1: 0, p2: 5 },
    timer: 90,
    phase: 'playing',
    log: [],
    scores: { p1: 0, p2: 0 },
  };
}

function addLog(lobby, msg, cls = 'evn') {
  const d = new Date();
  const ts = d.toTimeString().slice(3, 8);
  lobby.state.log.unshift({ ts, msg, cls });
  if (lobby.state.log.length > 40) lobby.state.log.pop();
}

function calcScores(state) {
  return {
    p1: state.servers.filter(s => s.owner === 'p1').length * 10,
    p2: state.servers.filter(s => s.owner === 'p2').length * 10,
  };
}

function broadcast(lobby, msg) {
  const data = JSON.stringify(msg);
  Object.values(lobby.clients).forEach(ws => { try { ws.send(data); } catch(e){} });
}

function gameTick(lobby) {
  const st = lobby.state;
  if (!st || st.phase !== 'playing') return;
  st.timer--;

  st.servers.forEach(s => {
    if (s.owner !== 'neutral') s.hp = Math.min(s.maxHp, s.hp + 2);
    if (s.capturing) {
      s.capProgress += 8;
      if (s.capProgress >= 100) {
        s.owner = s.capturing; s.capturing = null; s.capProgress = 0; s.hp = 60;
        addLog(lobby, `CAPTURE ! ${s.name} → ${s.owner === 'p1' ? 'JOUEUR 1' : 'JOUEUR 2'} !`, 'evcap');
      }
    }
  });

  ['p1','p2'].forEach(p => {
    Object.keys(st.cooldowns[p]).forEach(k => { if (st.cooldowns[p][k] > 0) st.cooldowns[p][k]--; });
    if (st.shields[p]) st.shields[p] = false;
  });

  st.scores = calcScores(st);

  if (st.timer <= 0) {
    st.phase = 'ended';
    clearInterval(lobby.interval);
    lobby.interval = null;
    addLog(lobby, 'PARTIE TERMINÉE !', 'evcap');
  }

  broadcast(lobby, { type: 'state', state: st });
}

function doAction(lobby, player, action) {
  const st = lobby.state;
  if (!st || st.phase !== 'playing') return;
  const enemy = player === 'p1' ? 'p2' : 'p1';
  const sel = st.selected[player];
  const s = st.servers[sel];
  const cd = st.cooldowns[player];
  const pLabel = player === 'p1' ? 'J1' : 'J2';

  if (action === 'select_up')   { st.selected[player] = (sel - 1 + 10) % 10; }
  else if (action === 'select_down') { st.selected[player] = (sel + 1) % 10; }
  else if (action === 'ddos') {
    if (cd.ddos > 0 || s.owner === player) return;
    const blocked = st.shields[enemy] && s.owner === enemy;
    const dmg = blocked ? 0 : Math.floor(15 + Math.random() * 20);
    s.hp = Math.max(0, s.hp - dmg);
    cd.ddos = 3;
    addLog(lobby, blocked
      ? `${pLabel} DDoS → ${s.name} [BOUCLIER BLOQUÉ !]`
      : `${pLabel} DDoS → ${s.name} (−${dmg} HP)`,
      player === 'p1' ? 'ev1' : 'ev2');
    if (s.hp <= 0 && s.owner !== player) {
      s.hp = 0; s.owner = 'neutral'; s.capturing = null;
      addLog(lobby, `${s.name} hors ligne — neutre !`, 'evn');
    }
  } else if (action === 'cap') {
    if (cd.cap > 0 || s.owner === player) return;
    if (s.hp > 40) { addLog(lobby, `${pLabel} : HP trop élevé (< 40 requis)`, 'evn'); return; }
    s.capturing = player; s.capProgress = 0; cd.cap = 8;
    addLog(lobby, `${pLabel} commence la capture de ${s.name}...`, player === 'p1' ? 'ev1' : 'ev2');
  } else if (action === 'shield') {
    if (cd.shield > 0) return;
    st.shields[player] = true; cd.shield = 10;
    addLog(lobby, `${pLabel} bouclier activé !`, player === 'p1' ? 'ev1' : 'ev2');
  } else if (action === 'reboot') {
    if (cd.reboot > 0 || s.owner !== player) return;
    s.hp = s.maxHp; s.capturing = null; s.capProgress = 0; cd.reboot = 12;
    addLog(lobby, `${pLabel} redémarre ${s.name} (HP restauré)`, player === 'p1' ? 'ev1' : 'ev2');
  }

  st.scores = calcScores(st);
  broadcast(lobby, { type: 'state', state: st });
}

wss.on('connection', ws => {
  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw);

      if (msg.type === 'create') {
        let code;
        do { code = genCode(); } while (lobbies[code]);
        lobbies[code] = { code, clients: {}, players: { p1: null, p2: null }, state: null, interval: null, nextId: 1 };
        const id = lobbies[code].nextId++;
        lobbies[code].clients[id] = ws;
        lobbies[code].players.p1 = id;
        ws.lobbyCode = code; ws.clientId = id; ws.player = 'p1';
        ws.send(JSON.stringify({ type: 'lobby_created', code, player: 'p1' }));
      }

      else if (msg.type === 'join') {
        const code = (msg.code || '').toUpperCase().trim();
        const lobby = lobbies[code];
        if (!lobby) { ws.send(JSON.stringify({ type: 'error', msg: 'Code invalide ou lobby introuvable.' })); return; }
        if (lobby.players.p2) { ws.send(JSON.stringify({ type: 'error', msg: 'Lobby complet !' })); return; }
        const id = lobby.nextId++;
        lobby.clients[id] = ws;
        lobby.players.p2 = id;
        ws.lobbyCode = code; ws.clientId = id; ws.player = 'p2';
        ws.send(JSON.stringify({ type: 'joined', code, player: 'p2' }));
        initGame(lobby);
        addLog(lobby, 'Les deux joueurs connectés — BATAILLE !', 'evcap');
        lobby.interval = setInterval(() => gameTick(lobby), 1000);
        broadcast(lobby, { type: 'state', state: lobby.state });
      }

      else if (msg.type === 'action') {
        const lobby = lobbies[ws.lobbyCode];
        if (!lobby || !ws.player) return;
        doAction(lobby, ws.player, msg.action);
      }

      else if (msg.type === 'restart') {
        const lobby = lobbies[ws.lobbyCode];
        if (!lobby || !lobby.state || lobby.state.phase !== 'ended') return;
        initGame(lobby);
        addLog(lobby, 'Nouvelle partie — EN GARDE !', 'evcap');
        lobby.interval = setInterval(() => gameTick(lobby), 1000);
        broadcast(lobby, { type: 'state', state: lobby.state });
      }

    } catch(e) { console.error(e); }
  });

  ws.on('close', () => {
    const lobby = lobbies[ws.lobbyCode];
    if (!lobby) return;
    delete lobby.clients[ws.clientId];
    if (lobby.players.p1 === ws.clientId) lobby.players.p1 = null;
    if (lobby.players.p2 === ws.clientId) lobby.players.p2 = null;
    if (lobby.state && lobby.state.phase === 'playing') {
      lobby.state.phase = 'ended';
      if (lobby.interval) { clearInterval(lobby.interval); lobby.interval = null; }
      addLog(lobby, 'Un joueur s\'est déconnecté.', 'evn');
      broadcast(lobby, { type: 'state', state: lobby.state });
    }
    if (!lobby.players.p1 && !lobby.players.p2) delete lobbies[ws.lobbyCode];
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎮  SERVER WAR  —  http://localhost:${PORT}\n`);
});
