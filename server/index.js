// Owner: Layan. Express + Socket.IO server. Event names must match EVENTS.md.
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const app = express();
const http = createServer(app);
const io = new Server(http, { cors: { origin: process.env.CLIENT_ORIGIN || '*' } });

app.get('/health', (_req, res) => res.json({ ok: true }));

io.on('connection', (socket) => {
  // TODO(Layan): room:create, room:join, game:start, answer:submit ... (see EVENTS.md)
});

const port = process.env.PORT || 3001;
http.listen(port, () => console.log(`Qaffelha server on :${port}`));
