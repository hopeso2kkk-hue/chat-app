import http from "node:http";
import path from "node:path";
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

  // 2) Mensagem de um usuário para outro
  socket.on("message:send", ({ to, text }) => {
    const from = socket.data.user;
    if (!from) return;

    const recipient = users.get(to);
    if (!recipient) return;

    const message = {
      from: from.id,
      to,
      text,
      time: Date.now(),
    };

    // Entrega para o destinatário
    io.to(to).emit("message:receive", message);
    console.log(`DM de ${from.name} -> ${recipient.name}: ${text}`);
  });

  // 3) Ao sair, remove da lista e avisa todos
  socket.on("disconnect", () => {
    const user = socket.data.user;
    if (user) {
      users.delete(socket.id);
      io.emit("users:update", [...users.values()]);
      console.log(`${user.name} saiu. Online: ${users.size}`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
