// Owner: Danah. One shared connection. Event names come from EVENTS.md.
import { io } from 'socket.io-client';

export const socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001');
