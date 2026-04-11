import Fastify from 'fastify';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { MonsterImporter, NexusMonster } from './utils/MonsterImporter'; 
import { ClassImporter } from './utils/ClassImporter'; 
import { SpellImporter } from './utils/SpellImporter'; 
import { ItemImporter } from './utils/ItemImporter'; 
import { RaceImporter } from './utils/RaceImporter';
import { LootGenerator } from './utils/LootGenerator'; 

const fastify = Fastify();

// CONFIGURAÇÃO DE PORTA PARA O RENDER (Obrigatório)
const PORT = Number(process.env.PORT) || 4000;

const io = new Server(fastify.server, {
  cors: { 
    origin: "*", 
    methods: ["GET", "POST"] 
  },
  maxHttpBufferSize: 50 * 1024 * 1024 
});

// --- 1. CONFIGURAÇÃO DO MAPA E IMPORTAÇÃO DO LIVRO ---
const MAP_LIMIT = 8000; 
const GRID_SIZE = 70;
const COLS = Math.ceil(MAP_LIMIT / GRID_SIZE);
const ROWS = Math.ceil(MAP_LIMIT / GRID_SIZE);

const createInitialFog = (): boolean[][] => Array(ROWS).fill(null).map(() => Array(COLS).fill(false));

// ============================================================================
// 📚 LEITOR ARCANO DE PASTAS E ARQUIVOS JSON (5eTools)
// ============================================================================
const DATA_DIR = path.join(process.cwd(), 'data'); // Pasta onde ficam os JSONs

function loadJsonSafely(subPath: string) {
    const fullPath = path.join(DATA_DIR, subPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        try {
            return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        } catch (e) {
            console.error(`❌ Erro ao ler o grimório ${subPath}:`, e);
        }
    }
    return null;
}

function loadDirectory(dirName: string, targetKey: string) {
    let combinedData: any[] = [];
    const dirPath = path.join(DATA_DIR, dirName);
    
    // Varre todos os arquivos dentro da subpasta especificada
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        const files = fs.readdirSync(dirPath);
        files.forEach(file => {
            if (file.endsWith('.json')) {
                const data = loadJsonSafely(path.join(dirName, file));
                if (data && data[targetKey]) {
                    combinedData = combinedData.concat(data[targetKey]);
                }
            }
        });
    }
    return combinedData;
}

// 👉 LENDO AS PASTAS NOVAS (Subpastas organizadas pelo Mestre)
const RAW_CLASSES = loadDirectory('class', 'class');
const FULL_CLASSES = RAW_CLASSES.length > 0 ? RAW_CLASSES : ClassImporter.loadClasses();

const RAW_BESTIARY = loadDirectory('bestiary', 'monster');
const FULL_BESTIARY = RAW_BESTIARY.length > 0 ? RAW_BESTIARY : MonsterImporter.loadBestiary();

const RAW_SPELLS = loadDirectory('spells', 'spell');
const FULL_SPELLS = RAW_SPELLS.length > 0 ? RAW_SPELLS : SpellImporter.loadSpells();

const RAW_ITEMS = loadDirectory('items', 'item');
const FULL_ITEMS = RAW_ITEMS.length > 0 ? RAW_ITEMS : ItemImporter.loadItems();

// 👉 RAÇAS, ANTECEDENTES E TALENTOS (Tenta na pasta primeiro, depois tenta arquivo solto na raiz /data)
let RAW_RACES = loadDirectory('races', 'race');
if (RAW_RACES.length === 0) {
    const rData = loadJsonSafely('races.json');
    if (rData && rData.race) RAW_RACES = rData.race;
}
const FULL_RACES = RAW_RACES.length > 0 ? RAW_RACES : RaceImporter.loadRaces();

let RAW_BACKGROUNDS = loadDirectory('backgrounds', 'background');
if (RAW_BACKGROUNDS.length === 0) {
    const bgData = loadJsonSafely('backgrounds.json');
    if (bgData && bgData.background) RAW_BACKGROUNDS = bgData.background;
}
const FULL_BACKGROUNDS = RAW_BACKGROUNDS;

let RAW_FEATS = loadDirectory('feats', 'feat');
if (RAW_FEATS.length === 0) {
    const featsData = loadJsonSafely('feats.json');
    if (featsData && featsData.feat) RAW_FEATS = featsData.feat;
}
const FULL_FEATS = RAW_FEATS;


// --- 2. ESTADO INICIAL ---
interface GameState {
  entities: any[];
  fogGrid: boolean[][];
  currentMap: string;
  initiativeList: any[];
  activeTurnId: number | null;
  chatHistory: any[];
  customMonsters: any[];    
  availableClasses: any[]; 
  availableSpells: any[]; 
  availableItems: any[]; 
  availableRaces: any[]; 
  availableBackgrounds: any[]; 
  availableFeats: any[];       
  globalBrightness: number; 
  weather: 'none' | 'rain' | 'snow';
  currentTrack: string | null; 
}

const getSaveFilePath = (roomId: string) => {
    const safeRoomId = roomId.replace(/[^a-z0-9-]/gi, '_');
    return path.join(process.cwd(), `savegame_${safeRoomId}.json`);
};

let roomsState: Record<string, GameState> = {}; 

const getRoomState = (roomId: string): GameState => {
    if (!roomsState[roomId]) {
        roomsState[roomId] = {
            entities: [], 
            fogGrid: createInitialFog(), 
            currentMap: '/maps/floresta.jpg',
            initiativeList: [],
            activeTurnId: null,
            chatHistory: [],
            customMonsters: FULL_BESTIARY,
            availableClasses: FULL_CLASSES, 
            availableSpells: FULL_SPELLS, 
            availableItems: FULL_ITEMS, 
            availableRaces: FULL_RACES, 
            availableBackgrounds: FULL_BACKGROUNDS,
            availableFeats: FULL_FEATS,
            globalBrightness: 1,
            weather: 'none',
            currentTrack: null
        };
        
        const saveFile = getSaveFilePath(roomId);
        if (fs.existsSync(saveFile)) {
             try {
                const rawData = fs.readFileSync(saveFile, 'utf-8');
                const loadedData = JSON.parse(rawData);
                
                const savedCustomMonsters = loadedData.customMonsters || [];
                const mergedMonsters = [...FULL_BESTIARY, ...savedCustomMonsters.filter((sm: any) => !FULL_BESTIARY.some(bm => bm.name === sm.name))];

                roomsState[roomId] = { 
                    ...roomsState[roomId], 
                    ...loadedData,
                    customMonsters: mergedMonsters, 
                    availableClasses: FULL_CLASSES, 
                    availableSpells: FULL_SPELLS, 
                    availableItems: FULL_ITEMS, 
                    availableRaces: FULL_RACES, 
                    availableBackgrounds: FULL_BACKGROUNDS,
                    availableFeats: FULL_FEATS,
                    weather: loadedData.weather || 'none',
                    currentTrack: loadedData.currentTrack || null
                };
                console.log(`✅ SAVE CARREGADO COM SUCESSO PARA A SALA: ${roomId}`);
              } catch (e) {
                console.error(`❌ ERRO AO LER SAVE PARA A SALA ${roomId}:`, e);
              }
        } else {
            console.log(`📝 NOVA MESA CRIADA. Nenhum save anterior para a sala: ${roomId}`);
        }
    }
    return roomsState[roomId];
};

// 👉 FUNÇÃO DE AUTO-SAVE PARA MANTER A MESA LIMPA
const autoSaveRoom = (roomId: string) => {
    const roomState = getRoomState(roomId);
    const saveFile = getSaveFilePath(roomId);
    try {
        fs.writeFileSync(saveFile, JSON.stringify(roomState, null, 2));
    } catch (err) {
        console.error(`❌ ERRO AO AUTO-SALVAR A SALA ${roomId}:`, err);
    }
};

// --- 4. EVENTOS DO SOCKET ---
io.on('connection', (socket) => {
  console.log('🔌 Nova conexão:', socket.id);

  // 👉 Envia os compêndios do Builder 
  socket.emit('compendiumSync', { 
      availableClasses: FULL_CLASSES, 
      availableRaces: FULL_RACES,
      availableBackgrounds: FULL_BACKGROUNDS,
      availableFeats: FULL_FEATS
  });

  socket.on('requestCompendium', () => {
      socket.emit('compendiumSync', { 
          availableClasses: FULL_CLASSES, 
          availableRaces: FULL_RACES,
          availableBackgrounds: FULL_BACKGROUNDS,
          availableFeats: FULL_FEATS
      });
  });

  socket.on('joinRoom', (roomId: string) => {
    socket.join(roomId);
    const roomState = getRoomState(roomId);
    socket.emit('gameStateSync', roomState);
    console.log(`👤 Usuário entrou na sala: ${roomId}`);
  });

  socket.on('checkExistingCharacter', (data: any) => {
    console.log(`🔎 Verificando existência de: ${data.name} na sala ${data.roomId}`);
    const roomState = getRoomState(data.roomId);
    const existingChar = roomState.entities.find(
      (e: any) => e.type === 'player' && e.name.toLowerCase() === data.name.toLowerCase()
    );
    if (existingChar) {
      socket.emit('characterFound', existingChar);
    } else {
      socket.emit('characterNotFound');
    }
  });

  socket.on('startGame', (data: any) => {
      io.in(data.roomId).emit('gameStarted');
  });

  socket.on('updateWeather', (data: any) => {
      const roomState = getRoomState(data.roomId);
      roomState.weather = data.weather;
      io.in(data.roomId).emit('weatherUpdated', { weather: data.weather });
  });

  socket.on('triggerCombatAnimation', (data: any) => {
      io.in(data.roomId).emit('triggerCombatAnimation', data);
  });

  socket.on('pingMap', (data: any) => {
      socket.to(data.roomId).emit('mapPinged', data);
  });

  socket.on('changeMap', (data: any) => {
    const roomState = getRoomState(data.roomId);
    const newFog = createInitialFog();
    roomState.currentMap = data.mapUrl;
    roomState.fogGrid = newFog;
    io.in(data.roomId).emit('mapChanged', { mapUrl: data.mapUrl, fogGrid: newFog });
  });

  socket.on('saveGame', (data: any) => {
    const roomState = getRoomState(data.roomId);
    roomsState[data.roomId] = {
        ...roomState,
        entities: data.entities,
        fogGrid: data.fogGrid,
        currentMap: data.currentMap,
        initiativeList: data.initiativeList,
        activeTurnId: data.activeTurnId,
        chatHistory: data.chatMessages || [],
        customMonsters: (data.customMonsters || []).filter((cm: any) => !FULL_BESTIARY.some((bm) => bm.name === cm.name)),
        globalBrightness: data.globalBrightness,
        weather: data.weather || roomState.weather,
        currentTrack: data.currentTrack || roomState.currentTrack
    };

    const saveFile = getSaveFilePath(data.roomId);
    try {
        fs.writeFileSync(saveFile, JSON.stringify(roomsState[data.roomId], null, 2));
        io.in(data.roomId).emit('notification', { message: 'Mundo salvo com sucesso!' });
        console.log(`💾 Mesa ${data.roomId} guardada nos registos.`);
    } catch (err) {
        console.error(`❌ ERRO AO GRAVAR ARQUIVO PARA ${data.roomId}:`, err);
        io.in(data.roomId).emit('notification', { message: 'Erro ao salvar o mundo!' });
    }
  });

  socket.on('updateEntityPosition', (data: any) => {
    const roomState = getRoomState(data.roomId);
    const ent = roomState.entities.find((e: any) => e.id === data.entityId);
    if (ent) { ent.x = data.x; ent.y = data.y; }
    socket.to(data.roomId).emit('entityPositionUpdated', data);
  });

  socket.on('updateEntityStatus', (data: any) => {
    const roomState = getRoomState(data.roomId);
    const index = roomState.entities.findIndex((e: any) => e.id === data.entityId);
    if (index !== -1) {
      roomState.entities[index] = { ...roomState.entities[index], ...data.updates };
    }
    socket.to(data.roomId).emit('entityStatusUpdated', data);
  });

  socket.on('createEntity', (data: any) => {
    const roomState = getRoomState(data.roomId);
    const exists = roomState.entities.find((e: any) => e.id === data.entity.id);
    if (!exists) {
        roomState.entities.push(data.entity);
        socket.to(data.roomId).emit('entityCreated', data);
        autoSaveRoom(data.roomId); 
    }
  });

  socket.on('deleteEntity', (data: any) => {
    const roomState = getRoomState(data.roomId);
    roomState.entities = roomState.entities.filter((e: any) => e.id !== data.entityId);
    socket.to(data.roomId).emit('entityDeleted', data);
    autoSaveRoom(data.roomId); 
  });

  socket.on('updateGlobalBrightness', (data: any) => {
      const roomState = getRoomState(data.roomId);
      roomState.globalBrightness = data.brightness;
      io.in(data.roomId).emit('globalBrightnessUpdated', { brightness: data.brightness });
  });

  socket.on('updateFog', (data: any) => {
    const roomState = getRoomState(data.roomId);
    if (roomState.fogGrid[data.y]) {
      roomState.fogGrid[data.y][data.x] = data.shouldReveal;
    }
    socket.to(data.roomId).emit('fogUpdated', data);
  });

  socket.on('syncFogGrid', (data: any) => {
    const roomState = getRoomState(data.roomId);
    roomState.fogGrid = data.grid;
    socket.to(data.roomId).emit('fogGridSynced', data);
  });

  socket.on('syncMapState', (data: any) => {
    socket.to(data.roomId).emit('mapStateUpdated', {
      offset: data.offset,
      scale: data.scale
    });
  });

  socket.on('updateInitiative', (data: any) => {
    const roomState = getRoomState(data.roomId);
    roomState.initiativeList = data.list;
    roomState.activeTurnId = data.activeTurnId;
    socket.to(data.roomId).emit('initiativeUpdated', data);
  });

  socket.on('playSFX', (data: any) => {
      socket.to(data.roomId).emit('playSFX', { sfxId: data.sfxId });
  });

  socket.on('playMusic', (data: any) => {
      const roomState = getRoomState(data.roomId);
      roomState.currentTrack = data.trackId; 
      socket.to(data.roomId).emit('playMusic', { trackId: data.trackId });
  });

  socket.on('stopMusic', (data: any) => {
      const roomState = getRoomState(data.roomId);
      roomState.currentTrack = null;
      socket.to(data.roomId).emit('stopMusic');
  });

  socket.on('sendMessage', (data: any) => {
    const roomState = getRoomState(data.roomId);
    roomState.chatHistory.push(data.message);
    if (roomState.chatHistory.length > 50) roomState.chatHistory.shift();
    io.in(data.roomId).emit('chatMessage', data);
  });

  socket.on('sendLobbyMessage', (msgData: any) => {
    socket.to(msgData.roomId).emit('receiveLobbyMessage', msgData);
  });

  socket.on('rollDice', (data: any) => { 
    io.in(data.roomId).emit('newDiceResult', data); 
  });

  socket.on('triggerAudio', (data: any) => { 
    io.to(data.roomId).emit('triggerAudio', data); 
  });

  socket.on('dmRequestRoll', (data: any) => {
    io.in(data.roomId).emit('dmRequestRoll', data);
  });

  socket.on('requestRandomLoot', (data: { rarity: string, type: string, count: number, roomId: string }) => {
      const roomState = getRoomState(data.roomId);
      
      const loot = LootGenerator.generate(roomState.availableItems, {
          rarity: data.rarity,
          type: data.type,
          count: data.count
      });
      
      io.in(data.roomId).emit('randomLootGenerated', { loot });
  });

});

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) { 
    console.error(err); 
    process.exit(1); 
  }
  console.log(`⚔️ NEXUS BACKEND ONLINE - PORTA ${PORT}`);
});