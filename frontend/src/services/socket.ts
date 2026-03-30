import { io } from 'socket.io-client';

// Se o site detectar que está rodando no seu PC, usa localhost.
// Se estiver na Vercel (onde seu amigo vai acessar), usa o link do Render.
const SOCKET_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:4000' 
    : 'https://nexus-rpg-dl3i.onrender.com';

const socket = io(SOCKET_URL, {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

export default socket;