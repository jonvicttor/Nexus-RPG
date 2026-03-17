import Fastify from 'fastify';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';

const fastify = Fastify();

// CONFIGURAÇÃO DE PORTA PARA O RENDER (Obrigatório)
const PORT = Number(process.env.PORT) || 4000;

const io = new Server(fastify.server, {
  cors: { 
    origin: "*", 
    methods: ["GET", "POST"] 
  },
  maxHttpBufferSize: 50 * 1024 * 1024 // 50MB para mapas grandes
});

// --- 1. CONFIGURAÇÃO DO MAPA ---
const MAP_LIMIT = 8000; 
const GRID_SIZE = 70;
const COLS = Math.ceil(MAP_LIMIT / GRID_SIZE);
const ROWS = Math.ceil(MAP_LIMIT / GRID_SIZE);

const createInitialFog = () => Array(ROWS).fill(null).map(() => Array(COLS).fill(false));

// --- 2. ESTADO INICIAL ---
interface GameState {
  entities: any[];
  fogGrid: boolean[][];
  currentMap: string;
  initiativeList: any[];
  activeTurnId: number | null;
  chatHistory: any[];
  customMonsters: any[];    
  globalBrightness: number; 
  weather: 'none' | 'rain' | 'snow';
}

const DATA_FILE = path.join(process.cwd(), 'savegame_v2.json');

let currentGameState: GameState = {
  entities: [], 
  fogGrid: createInitialFog(), 
  currentMap: '/maps/floresta.jpg',
  initiativeList: [],
  activeTurnId: null,
  chatHistory: [],
  customMonsters: [], 
  globalBrightness: 1,
  weather: 'none'
};

// --- 3. CARREGAR SAVE ---
if (fs.existsSync(DATA_FILE)) {
  try {
    const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
    const loadedData = JSON.parse(rawData);
    
    currentGameState = { 
        ...currentGameState, 
        ...loadedData,
        customMonsters: loadedData.customMonsters || [],
        weather: loadedData.weather || 'none'
    };
    console.log('✅ SAVE CARREGADO COM SUCESSO.');
  } catch (e) {
    console.error('❌ ERRO AO LER SAVE:', e);
  }
}

// --- 4. EVENTOS DO SOCKET ---
io.on('connection', (socket) => {
  console.log('🔌 Nova conexão:', socket.id);

  // Sincroniza ao entrar
  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    socket.emit('gameStateSync', currentGameState);
    console.log(`👤 Usuário entrou na sala: ${roomId}`);
  });

  // FIX: VERIFICAÇÃO DE PERSONAGEM (Isso evita o carregamento infinito)
  socket.on('checkExistingCharacter', (data) => {
    console.log(`🔎 Verificando existência de: ${data.name}`);
    const existingChar = currentGameState.entities.find(
      (e: any) => e.type === 'player' && e.name.toLowerCase() === data.name.toLowerCase()
    );
    if (existingChar) {
      socket.emit('characterFound', existingChar);
    } else {
      socket.emit('characterNotFound');
    }
  });

  // CLIMA E ANIMAÇÕES
  socket.on('updateWeather', (data) => {
      currentGameState.weather = data.weather;
      io.in(data.roomId).emit('weatherUpdated', { weather: data.weather });
  });

  socket.on('triggerCombatAnimation', (data) => {
      io.in(data.roomId).emit('triggerCombatAnimation', data);
  });

  socket.on('pingMap', (data) => {
      socket.to(data.roomId).emit('mapPinged', data);
  });

  // MAPA E SAVE
  socket.on('changeMap', (data) => {
    const newFog = createInitialFog();
    currentGameState.currentMap = data.mapUrl;
    currentGameState.fogGrid = newFog;
    io.in(data.roomId).emit('mapChanged', { mapUrl: data.mapUrl, fogGrid: newFog });
  });

  socket.on('saveGame', (data) => {
    currentGameState = {
        ...currentGameState,
        entities: data.entities,
        fogGrid: data.fogGrid,
        currentMap: data.currentMap,
        initiativeList: data.initiativeList,
        activeTurnId: data.activeTurnId,
        chatHistory: data.chatMessages || [],
        customMonsters: data.customMonsters || [],
        globalBrightness: data.globalBrightness,
        weather: data.weather || currentGameState.weather
    };

    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(currentGameState, null, 2));
      io.in(data.roomId).emit('notification', { message: 'Mundo salvo com sucesso!' });
    } catch (err) {
      console.error("❌ ERRO AO GRAVAR ARQUIVO:", err);
    }
  });

  // ENTIDADES E POSIÇÃO
  socket.on('updateEntityPosition', (data) => {
    const ent = currentGameState.entities.find((e: any) => e.id === data.entityId);
    if (ent) { ent.x = data.x; ent.y = data.y; }
    socket.to(data.roomId).emit('entityPositionUpdated', data);
  });

  socket.on('updateEntityStatus', (data) => {
    const index = currentGameState.entities.findIndex((e: any) => e.id === data.entityId);
    if (index !== -1) {
      currentGameState.entities[index] = { ...currentGameState.entities[index], ...data.updates };
    }
    socket.to(data.roomId).emit('entityStatusUpdated', data);
  });

  socket.on('createEntity', (data) => {
    const exists = currentGameState.entities.find((e: any) => e.id === data.entity.id);
    if (!exists) {
        currentGameState.entities.push(data.entity);
        socket.to(data.roomId).emit('entityCreated', data);
    }
  });

  socket.on('deleteEntity', (data) => {
    currentGameState.entities = currentGameState.entities.filter((e: any) => e.id !== data.entityId);
    socket.to(data.roomId).emit('entityDeleted', data);
  });

  // BRILHO, NEBLINA E INICIATIVA
  socket.on('updateGlobalBrightness', (data) => {
      currentGameState.globalBrightness = data.brightness;
      io.in(data.roomId).emit('globalBrightnessUpdated', { brightness: data.brightness });
  });

  socket.on('updateFog', (data) => {
    if (currentGameState.fogGrid[data.y]) {
      currentGameState.fogGrid[data.y][data.x] = data.shouldReveal;
    }
    socket.to(data.roomId).emit('fogUpdated', data);
  });

  // 👇 --- EVENTOS DE SINCRONIZAÇÃO ADICIONADOS AQUI --- 👇

  socket.on('syncFogGrid', (data) => {
    currentGameState.fogGrid = data.grid;
    socket.to(data.roomId).emit('fogGridSynced', data);
  });

  socket.on('syncMapState', (data) => {
    socket.to(data.roomId).emit('mapStateUpdated', {
      offset: data.offset,
      scale: data.scale
    });
  });

  // 👆 ------------------------------------------------ 👆

  socket.on('updateInitiative', (data) => {
    currentGameState.initiativeList = data.list;
    currentGameState.activeTurnId = data.activeTurnId;
    socket.to(data.roomId).emit('initiativeUpdated', data);
  });

  // CHAT, DADOS E ÁUDIO
  socket.on('sendMessage', (data) => {
    currentGameState.chatHistory.push(data.message);
    if (currentGameState.chatHistory.length > 50) currentGameState.chatHistory.shift();
    io.in(data.roomId).emit('chatMessage', data);
  });

  socket.on('rollDice', (data) => { 
    io.in(data.roomId).emit('newDiceResult', data); 
  });

  socket.on('triggerAudio', (data) => { 
    io.to(data.roomId).emit('triggerAudio', data); 
  });

  socket.on('dmRequestRoll', (data) => {
    io.in(data.roomId).emit('dmRequestRoll', data);
  });
});

// ESCUTAR NA PORTA DO AMBIENTE E HOST 0.0.0.0
fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) { 
    console.error(err); 
    process.exit(1); 
  }
  console.log(`⚔️ NEXUS BACKEND ONLINE - PORTA ${PORT}`);
});