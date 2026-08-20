import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "socket.io";

const PORT = process.env.PORT || 3001;

const app = express();
const server = http.createServer(app);

// Em produção, o servidor também entrega o site (a pasta client/dist)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(dist));
app.get("*", (req, res) => {
  res.sendFile(path.join(dist, "index.html"));
});

const io = new Server(server, {
  cors: { origin: "*" },
});

// Map: socketId -> { id, name }
const users = new Map();
// Map: serverId -> { id, name, ownerId, channels, members:Set }
const servers = new Map();
// Map: channelId -> Set(socketId)  (quem está em cada canal de voz)
const voiceRooms = new Map();

function makeId() {
  return crypto.randomUUID();
}

function serverView(s) {
  return {
    id: s.id,
    name: s.name,
    ownerId: s.ownerId,
    channels: s.channels.map((c) => ({ id: c.id, name: c.name, type: c.type })),
    members: [...s.members]
      .map((uid) => users.get(uid))
      .filter(Boolean)
      .map((u) => ({ id: u.id, name: u.name })),
  };
}

function emitServers() {
  io.emit("servers:update", [...servers.values()].map(serverView));
}

function voiceMembersFor(channelId) {
  const ids = voiceRooms.get(channelId) || new Set();
  return [...ids]
    .map((sid) => users.get(sid))
    .filter(Boolean)
    .map((u) => ({ id: u.id, name: u.name }));
}

function removeFromVoiceRooms(socketId) {
  for (const [channelId, ids] of voiceRooms) {
    if (ids.has(socketId)) {
      ids.delete(socketId);
      io.to(channelId).emit("server:voice-member-left", { channelId, id: socketId });
    }
  }
}

io.on("connection", (socket) => {
  console.log("Cliente conectado:", socket.id);

  // 1) Usuário escolhe um nome e fica "online"
  socket.on("user:login", (name) => {
    const user = { id: socket.id, name };
    users.set(socket.id, user);
    socket.data.user = user;

    // Avise o próprio usuário que o login funcionou
    socket.emit("user:login-ok", user);

    // Avise todos (inclusive ele) quem está online agora
    io.emit("users:update", [...users.values()]);
    console.log(`${name} entrou. Online: ${users.size}`);
  });

  // 2) Mensagem de um usuário para outro (texto ou áudio)
  socket.on("message:send", ({ to, text, audio, type }) => {
    const from = socket.data.user;
    if (!from) return;

    const recipient = users.get(to);
    if (!recipient) return;

    const message = {
      from: from.id,
      to,
      type: type || "text",
      text: text || null,
      audio: audio || null,
      time: Date.now(),
    };

    // Entrega para o destinatário
    io.to(to).emit("message:receive", message);
    console.log(`DM de ${from.name} -> ${recipient.name}: [${message.type}]`);
  });

  // 3) Chamadas (WebRTC signaling) - o servidor só repassa o sinal
  socket.on("call:offer", ({ to, offer }) => {
    io.to(to).emit("call:offer", { from: socket.id, offer });
    console.log(`Chamada de ${socket.data.user?.name} para ${to}`);
  });
  socket.on("call:answer", ({ to, answer }) => {
    io.to(to).emit("call:answer", { answer });
  });
  socket.on("call:ice", ({ to, candidate }) => {
    io.to(to).emit("call:ice", { candidate });
  });
  socket.on("call:renegotiate", ({ to, offer }) => {
    io.to(to).emit("call:renegotiate", { from: socket.id, offer });
  });
  socket.on("call:renegotiate-answer", ({ to, answer }) => {
    io.to(to).emit("call:renegotiate-answer", { answer });
  });
  socket.on("call:end", ({ to }) => {
    io.to(to).emit("call:end");
  });
  socket.on("call:decline", ({ to }) => {
    io.to(to).emit("call:decline");
  });

  // 5) Servidores (grupos estilo Discord)
  socket.on("server:create", (name) => {
    const user = socket.data.user;
    const trimmed = typeof name === "string" ? name.trim().slice(0, 30) : "";
    if (!user || !trimmed) return;

    const s = {
      id: makeId(),
      name: trimmed,
      ownerId: user.id,
      channels: [
        { id: makeId(), name: "geral", type: "text" },
        { id: makeId(), name: "Voz Geral", type: "voice" },
      ],
      members: new Set([user.id]),
    };
    servers.set(s.id, s);
    socket.join(s.id);
    emitServers();
    socket.emit("server:created", serverView(s));
    console.log(`Servidor "${s.name}" criado por ${user.name}`);
  });

  socket.on("server:join", (serverId) => {
    const user = socket.data.user;
    const s = servers.get(serverId);
    if (!user || !s) return;
    s.members.add(user.id);
    socket.join(serverId);
    io.to(serverId).emit("server:members-update", { serverId, members: serverView(s).members });
    emitServers();
  });

  socket.on("server:leave", (serverId) => {
    const user = socket.data.user;
    const s = servers.get(serverId);
    if (!user || !s) return;
    s.members.delete(user.id);
    socket.leave(serverId);
    removeFromVoiceRooms(socket.id);
    io.to(serverId).emit("server:members-update", { serverId, members: serverView(s).members });
    emitServers();
  });

  // 6) Mensagem em canal de texto do servidor
  socket.on("server:message", ({ serverId, channelId, text }) => {
    const from = socket.data.user;
    const s = servers.get(serverId);
    if (!from || !s || !s.members.has(from.id)) return;
    const channel = s.channels.find((c) => c.id === channelId);
    if (!channel || channel.type !== "text") return;

    const msg = {
      from: from.id,
      serverId,
      channelId,
      text: String(text || "").slice(0, 1000),
      time: Date.now(),
    };
    io.to(serverId).emit("server:message", msg);
    console.log(`#${s.name}/${channel.name}: ${from.name} -> ${msg.text}`);
  });

  // 7) Canais de voz do servidor (WebRTC mesh - o servidor só repassa o sinal)
  socket.on("server:voice-join", ({ serverId, channelId }) => {
    const from = socket.data.user;
    const s = servers.get(serverId);
    if (!from || !s || !s.members.has(from.id)) return;
    const channel = s.channels.find((c) => c.id === channelId);
    if (!channel || channel.type !== "voice") return;

    removeFromVoiceRooms(socket.id);
    const ids = voiceRooms.get(channelId) || new Set();
    ids.add(socket.id);
    voiceRooms.set(channelId, ids);
    socket.join(channelId);

    socket.emit("server:voice-members", { channelId, members: voiceMembersFor(channelId) });
    socket
      .to(channelId)
      .emit("server:voice-member-joined", { channelId, member: { id: from.id, name: from.name } });
    console.log(`${from.name} entrou no canal de voz ${s.name}/${channel.name}`);
  });

  socket.on("server:voice-leave", ({ channelId }) => {
    const ids = voiceRooms.get(channelId);
    if (ids) ids.delete(socket.id);
    socket.leave(channelId);
    socket.to(channelId).emit("server:voice-member-left", { channelId, id: socket.id });
  });

  socket.on("server:voice-offer", ({ channelId, to, offer }) => {
    io.to(to).emit("server:voice-offer", { channelId, from: socket.id, offer });
  });
  socket.on("server:voice-answer", ({ channelId, to, answer }) => {
    io.to(to).emit("server:voice-answer", { channelId, from: socket.id, answer });
  });
  socket.on("server:voice-ice", ({ channelId, to, candidate }) => {
    io.to(to).emit("server:voice-ice", { channelId, from: socket.id, candidate });
  });

  // 8) Ao sair, remove da lista, dos servidores e dos canais de voz
  socket.on("disconnect", () => {
    const user = socket.data.user;
    if (user) {
      users.delete(socket.id);
      removeFromVoiceRooms(socket.id);
      for (const s of servers.values()) {
        if (s.members.delete(socket.id)) {
          io.to(s.id).emit("server:members-update", { serverId: s.id, members: serverView(s).members });
        }
      }
      emitServers();
      io.emit("users:update", [...users.values()]);
      console.log(`${user.name} saiu. Online: ${users.size}`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
