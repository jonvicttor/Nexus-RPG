import Fastify from 'fastify';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { MonsterImporter } from './utils/MonsterImporter';
import { ClassImporter } from './utils/ClassImporter'; 
import { SpellImporter } from './utils/SpellImporter'; 
import { ItemImporter } from './utils/ItemImporter'; 
import { RaceImporter } from './utils/RaceImporter';
import { LootGenerator } from './utils/LootGenerator'; 
import { RulesImporter } from './utils/RulesImporter';

const fastify = Fastify();
const PORT = Number(process.env.PORT) || 4000;

const io = new Server(fastify.server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 50 * 1024 * 1024 
});

const MAP_LIMIT = 8000; 
const GRID_SIZE = 70;
const COLS = Math.ceil(MAP_LIMIT / GRID_SIZE);
const ROWS = Math.ceil(MAP_LIMIT / GRID_SIZE);
const createInitialFog = (): boolean[][] => Array(ROWS).fill(null).map(() => Array(COLS).fill(false));

const DATA_DIR = path.join(process.cwd(), 'src', 'data'); 

function loadJsonSafely(subPath: string) {
    const fullPath = path.join(DATA_DIR, subPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        try { return JSON.parse(fs.readFileSync(fullPath, 'utf8')); } 
        catch (e) { console.error(`Erro ao parsear ${subPath}`); }
    }
    return null;
}

function loadDirectory(dirName: string, targetKey: string) {
    let combinedData: any[] = [];
    const dirPath = path.join(DATA_DIR, dirName);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        const files = fs.readdirSync(dirPath);
        files.forEach(file => {
            if (file.endsWith('.json')) {
                const data = loadJsonSafely(path.join(dirName, file));
                if (data && data[targetKey]) { combinedData = combinedData.concat(data[targetKey]); }
            }
        });
    }
    return combinedData;
}

function loadBooks() {
    const books: any = {};
    const files = ['book-xdmg.json', 'book-xmm.json', 'book-xphb.json', 'book-xscreen.json'];
    files.forEach(f => {
        const data = loadJsonSafely(f);
        if (data) books[f.replace('.json', '')] = data;
    });
    console.log(`📚 Tomos carregados: ${Object.keys(books).join(', ')}`);
    return books;
}

function loadClassesWithSubclasses() {
    let allClasses: any[] = [];
    let allSubclasses: any[] = [];
    let allFeatures: any[] = []; 
    const dirPath = path.join(DATA_DIR, 'class');
    
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        const files = fs.readdirSync(dirPath);
        files.forEach(file => {
            if (file.endsWith('.json')) {
                const data = loadJsonSafely(path.join('class', file));
                if (data) {
                    if (data.class) allClasses = allClasses.concat(data.class);
                    if (data.subclass) allSubclasses = allSubclasses.concat(data.subclass);
                    if (data.classFeature) allFeatures = allFeatures.concat(data.classFeature);
                }
            }
        });
    }
    
    allClasses.forEach(c => {
        c.subclasses = allSubclasses.filter(sc => sc.className === c.name || sc.class === c.name);
        c.classFeature = allFeatures.filter(f => f.className === c.name || f.class === c.name);
    });

    return allClasses;
}

const RAW_CLASSES = loadClassesWithSubclasses();
const FULL_CLASSES = RAW_CLASSES.length > 0 ? RAW_CLASSES : ClassImporter.loadClasses();
const FULL_BESTIARY = MonsterImporter.loadBestiary();
const FULL_SPELLS = SpellImporter.loadSpells();
const FULL_ITEMS = ItemImporter.loadItems(); 
const FULL_RACES = RaceImporter.loadRaces();
const FULL_BOOKS = loadBooks(); 
const FULL_RULES = RulesImporter.loadRules(); 

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

interface GameState {
  entities: any[]; fogGrid: boolean[][]; currentMap: string; initiativeList: any[];
  activeTurnId: number | null; chatHistory: any[]; customMonsters: any[];     
  availableClasses: any[]; availableSpells: any[]; availableItems: any[]; 
  availableRaces: any[]; availableBackgrounds: any[]; availableFeats: any[];        
  availableRules: { actions: any[], conditions: any[] }; 
  globalBrightness: number; weather: 'none' | 'rain' | 'snow'; currentTrack: string | null; 
}

const getSaveFilePath = (roomId: string) => path.join(process.cwd(), `savegame_${roomId.replace(/[^a-z0-9-]/gi, '_')}.json`);

let roomsState: Record<string, GameState> = {}; 

const getRoomState = (roomId: string): GameState => {
    if (!roomsState[roomId]) {
        roomsState[roomId] = {
            entities: [], fogGrid: createInitialFog(), currentMap: '/maps/floresta.jpg',
            initiativeList: [], activeTurnId: null, chatHistory: [], customMonsters: FULL_BESTIARY,
            availableClasses: FULL_CLASSES, availableSpells: FULL_SPELLS, availableItems: FULL_ITEMS, 
            availableRaces: FULL_RACES, availableBackgrounds: FULL_BACKGROUNDS, availableFeats: FULL_FEATS,
            availableRules: FULL_RULES,
            globalBrightness: 1, weather: 'none', currentTrack: null
        };
        
        const saveFile = getSaveFilePath(roomId);
        if (fs.existsSync(saveFile)) {
             try {
                const rawData = fs.readFileSync(saveFile, 'utf-8');
                const loadedData = JSON.parse(rawData);
                const savedCustomMonsters = loadedData.customMonsters || [];
                const mergedMonsters = [...FULL_BESTIARY, ...savedCustomMonsters.filter((sm: any) => !FULL_BESTIARY.some(bm => bm.name === sm.name))];

                roomsState[roomId] = { 
                    ...roomsState[roomId], ...loadedData, customMonsters: mergedMonsters, 
                    availableClasses: FULL_CLASSES, availableSpells: FULL_SPELLS, availableItems: FULL_ITEMS, 
                    availableRaces: FULL_RACES, availableBackgrounds: FULL_BACKGROUNDS, availableFeats: FULL_FEATS,
                    availableRules: FULL_RULES,
                    weather: loadedData.weather || 'none', currentTrack: loadedData.currentTrack || null
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

const autoSaveRoom = (roomId: string) => {
    try { fs.writeFileSync(getSaveFilePath(roomId), JSON.stringify(getRoomState(roomId), null, 2)); } 
    catch (err) {}
};

io.on('connection', (socket) => {
  console.log('🔌 Nova conexão:', socket.id);

  const syncCompendium = () => {
    socket.emit('compendiumSync', { 
        availableClasses: FULL_CLASSES, 
        availableRaces: FULL_RACES, 
        availableBackgrounds: FULL_BACKGROUNDS, 
        availableFeats: FULL_FEATS, 
        availableSpells: FULL_SPELLS,
        availableRules: FULL_RULES 
    });
  };

  syncCompendium();
  
  socket.on('requestCompendium', () => { syncCompendium(); });

  socket.on('requestBooks', () => {
      socket.emit('receiveBooks', FULL_BOOKS);
  });

  socket.on('joinRoom', (roomId: string) => { socket.join(roomId); socket.emit('gameStateSync', getRoomState(roomId)); });
  socket.on('checkExistingCharacter', (data: any) => {
    const existingChar = getRoomState(data.roomId).entities.find((e: any) => e.type === 'player' && e.name.toLowerCase() === data.name.toLowerCase());
    existingChar ? socket.emit('characterFound', existingChar) : socket.emit('characterNotFound');
  });

  socket.on('startGame', (data: any) => io.in(data.roomId).emit('gameStarted'));
  socket.on('updateWeather', (data: any) => { getRoomState(data.roomId).weather = data.weather; io.in(data.roomId).emit('weatherUpdated', { weather: data.weather }); });
  socket.on('triggerCombatAnimation', (data: any) => io.in(data.roomId).emit('triggerCombatAnimation', data));
  socket.on('pingMap', (data: any) => socket.to(data.roomId).emit('mapPinged', data));

  socket.on('changeMap', (data: any) => {
    const roomState = getRoomState(data.roomId);
    const newFog = createInitialFog();
    roomState.currentMap = data.mapUrl; roomState.fogGrid = newFog;
    io.in(data.roomId).emit('mapChanged', { mapUrl: data.mapUrl, fogGrid: newFog });
  });

  socket.on('saveGame', (data: any) => {
    const roomState = getRoomState(data.roomId);
    roomsState[data.roomId] = {
        ...roomState, entities: data.entities, fogGrid: data.fogGrid, currentMap: data.currentMap,
        initiativeList: data.initiativeList, activeTurnId: data.activeTurnId, chatHistory: data.chatMessages || [],
        customMonsters: (data.customMonsters || []).filter((cm: any) => !FULL_BESTIARY.some((bm) => bm.name === cm.name)),
        globalBrightness: data.globalBrightness, weather: data.weather || roomState.weather, currentTrack: data.currentTrack || roomState.currentTrack
    };
    try {
        fs.writeFileSync(getSaveFilePath(data.roomId), JSON.stringify(roomsState[data.roomId], null, 2));
        io.in(data.roomId).emit('notification', { message: 'Mundo salvo com sucesso!' });
    } catch (err) {}
  });

  socket.on('updateEntityPosition', (data: any) => {
    const ent = getRoomState(data.roomId).entities.find((e: any) => e.id === data.entityId);
    if (ent) { ent.x = data.x; ent.y = data.y; }
    socket.to(data.roomId).emit('entityPositionUpdated', data);
  });

  socket.on('updateEntityStatus', (data: any) => {
    const roomState = getRoomState(data.roomId);
    const index = roomState.entities.findIndex((e: any) => e.id === data.entityId);
    if (index !== -1) roomState.entities[index] = { ...roomState.entities[index], ...data.updates };
    socket.to(data.roomId).emit('entityStatusUpdated', data);
  });

  socket.on('createEntity', (data: any) => {
    const roomState = getRoomState(data.roomId);
    if (!roomState.entities.find((e: any) => e.id === data.entity.id)) {
        roomState.entities.push(data.entity); socket.to(data.roomId).emit('entityCreated', data); autoSaveRoom(data.roomId); 
    }
  });

  socket.on('deleteEntity', (data: any) => {
    getRoomState(data.roomId).entities = getRoomState(data.roomId).entities.filter((e: any) => e.id !== data.entityId);
    socket.to(data.roomId).emit('entityDeleted', data); autoSaveRoom(data.roomId); 
  });

  socket.on('updateGlobalBrightness', (data: any) => {
      getRoomState(data.roomId).globalBrightness = data.brightness; io.in(data.roomId).emit('globalBrightnessUpdated', { brightness: data.brightness });
  });

  socket.on('updateFog', (data: any) => {
    const roomState = getRoomState(data.roomId);
    if (roomState.fogGrid[data.y]) roomState.fogGrid[data.y][data.x] = data.shouldReveal;
    socket.to(data.roomId).emit('fogUpdated', data);
  });

  socket.on('syncFogGrid', (data: any) => { getRoomState(data.roomId).fogGrid = data.grid; socket.to(data.roomId).emit('fogGridSynced', data); });
  socket.on('syncMapState', (data: any) => socket.to(data.roomId).emit('mapStateUpdated', { offset: data.offset, scale: data.scale }));

  socket.on('updateInitiative', (data: any) => {
    getRoomState(data.roomId).initiativeList = data.list; getRoomState(data.roomId).activeTurnId = data.activeTurnId;
    socket.to(data.roomId).emit('initiativeUpdated', data);
  });

  socket.on('playSFX', (data: any) => socket.to(data.roomId).emit('playSFX', { sfxId: data.sfxId }));
  socket.on('playMusic', (data: any) => { getRoomState(data.roomId).currentTrack = data.trackId; socket.to(data.roomId).emit('playMusic', { trackId: data.trackId }); });
  socket.on('stopMusic', (data: any) => { getRoomState(data.roomId).currentTrack = null; socket.to(data.roomId).emit('stopMusic'); });
  
  socket.on('sendMessage', (data: any) => {
    const roomState = getRoomState(data.roomId); roomState.chatHistory.push(data.message);
    if (roomState.chatHistory.length > 50) roomState.chatHistory.shift();
    io.in(data.roomId).emit('chatMessage', data);
  });

  socket.on('sendLobbyMessage', (msgData: any) => socket.to(msgData.roomId).emit('receiveLobbyMessage', msgData));
  socket.on('rollDice', (data: any) => io.in(data.roomId).emit('newDiceResult', data));
  socket.on('triggerAudio', (data: any) => io.to(data.roomId).emit('triggerAudio', data));
  socket.on('dmRequestRoll', (data: any) => io.in(data.roomId).emit('dmRequestRoll', data));
  
  socket.on('requestRandomLoot', (data: { rarity: string, type: string, count: number, roomId: string }) => {
      const loot = LootGenerator.generate(getRoomState(data.roomId).availableItems, { rarity: data.rarity, type: data.type, count: data.count });
      io.in(data.roomId).emit('randomLootGenerated', { loot });
  });

  // 👉 MAGIA NOVA: FASE 1 - INICIAR COMBATE
  socket.on('start_combat', (data: { roomId: string, combatants: number[] }) => {
      const room = getRoomState(data.roomId);
      const npcs: any[] = [];
      
      data.combatants.forEach(id => {
          const ent = room.entities.find((e: any) => e.id === id);
          if (!ent) return;
          
          const dexMod = ent.stats ? Math.floor((ent.stats.dex - 10) / 2) : 0;
          
          if (ent.type === 'player') {
              // Manda a notificação silenciosa pro R3F abrir a rolagem pro jogador
              io.in(data.roomId).emit('dmRequestRoll', {
                  roomId: data.roomId,
                  targetId: id,
                  skillName: 'Iniciativa',
                  mod: dexMod,
                  dc: 0
              });
          } else {
              // Rola os NPCs automaticamente para não tomar tempo do DM
              const roll = Math.floor(Math.random() * 20) + 1 + dexMod;
              npcs.push({ id: ent.id, name: ent.name, value: roll });
          }
      });

      room.initiativeList = [...npcs].sort((a, b) => b.value - a.value);
      room.activeTurnId = room.initiativeList.length > 0 ? room.initiativeList[0].id : null;
      
      io.in(data.roomId).emit('initiativeUpdated', { 
          list: room.initiativeList, 
          activeTurnId: room.activeTurnId 
      });

      // Emite o evento cinematográfico para escurecer as telas
      io.in(data.roomId).emit('combat_started');

      const chatMsg = {
          id: Date.now().toString(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `⚔️ **O COMBATE COMEÇOU!**\nOs monstros rolaram a iniciativa. Aventureiros, os dados chamam!`,
          type: 'info',
          sender: 'Sistema'
      };
      room.chatHistory.push(chatMsg);
      io.in(data.roomId).emit('chatMessage', { roomId: data.roomId, message: chatMsg });
  });

  // 👉 MAGIA NOVA: FASE 6 - AVANÇAR TURNO
  socket.on('next_turn', (data: { roomId: string }) => {
      const room = getRoomState(data.roomId);
      if (!room.initiativeList || room.initiativeList.length === 0) return;
      
      const currentIndex = room.initiativeList.findIndex((i: any) => i.id === room.activeTurnId);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % room.initiativeList.length;
      const nextEntity = room.initiativeList[nextIndex];
      
      room.activeTurnId = nextEntity.id;
      
      io.in(data.roomId).emit('initiativeUpdated', {
          list: room.initiativeList,
          activeTurnId: nextEntity.id
      });

      const chatMsg = {
          id: Date.now().toString(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `⏳ Início de Turno: **${nextEntity.name}**`,
          type: 'info',
          sender: 'Sistema'
      };
      room.chatHistory.push(chatMsg);
      io.in(data.roomId).emit('chatMessage', { roomId: data.roomId, message: chatMsg });
      autoSaveRoom(data.roomId);
  });

  socket.on('request_attack', (data: { roomId: string, atacanteId: number, alvoId: number, nomeAtaque: string, rolagemAtaque: number, rolagemDano: number, tipoDano: string }) => {
      const roomState = getRoomState(data.roomId);
      const atacante = roomState.entities.find(e => e.id === data.atacanteId);
      const alvo = roomState.entities.find(e => e.id === data.alvoId);
      
      if (!atacante || !alvo) return;

      const chatMsg = {
          id: Date.now().toString(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `⚔️ **${atacante.name}** ataca **${alvo.name}** com **${data.nomeAtaque}**!\n🎲 **Ataque:** ${data.rolagemAtaque} | 💥 **Dano Proposto:** ${data.rolagemDano} (${data.tipoDano})`,
          type: 'roll',
          sender: atacante.name
      };
      
      roomState.chatHistory.push(chatMsg);
      if (roomState.chatHistory.length > 50) roomState.chatHistory.shift();
      io.in(data.roomId).emit('chatMessage', { roomId: data.roomId, message: chatMsg });

      socket.to(data.roomId).emit('combatIntent', {
          id: Date.now().toString(),
          atacante: atacante.name,
          atacanteId: atacante.id,
          alvo: alvo.name,
          alvoId: alvo.id,
          nomeAtaque: data.nomeAtaque,
          rolagemAtaque: data.rolagemAtaque,
          rolagemDano: data.rolagemDano,
          tipoDano: data.tipoDano,
          alvoAc: alvo.ac 
      });
  });

  socket.on('resolve_damage', (data: { roomId: string, alvoId: number, danoFinal: number, resolucaoMsg: string }) => {
      const roomState = getRoomState(data.roomId);
      const alvo = roomState.entities.find(e => e.id === data.alvoId);
      
      if (!alvo) return;

      if (data.danoFinal > 0) {
          let remainingDamage = data.danoFinal;
          let newTemp = alvo.details?.tempHp || 0;
          let currentHp = alvo.hp;

          if (newTemp > 0) {
              if (newTemp >= remainingDamage) {
                  newTemp -= remainingDamage;
                  remainingDamage = 0;
              } else {
                  remainingDamage -= newTemp;
                  newTemp = 0;
              }
          }
          currentHp = Math.max(0, currentHp - remainingDamage);
          alvo.hp = currentHp;
          if(!alvo.details) alvo.details = {};
          alvo.details.tempHp = newTemp;

          io.in(data.roomId).emit('entityStatusUpdated', { 
              entityId: alvo.id, 
              updates: { hp: currentHp, details: alvo.details } 
          });
          
          io.in(data.roomId).emit('triggerCombatAnimation', { 
              targetId: alvo.id, 
              attackType: 'impact' 
          });

          if (currentHp <= 0) {
             const deathMsg = { id: Date.now().toString(), timestamp: new Date().toLocaleTimeString(), text: `☠️ **${alvo.name} caiu inconsciente!**`, type: 'damage', sender: 'Sistema' };
             roomState.chatHistory.push(deathMsg);
             io.in(data.roomId).emit('chatMessage', { roomId: data.roomId, message: deathMsg });
          }
      }

      const vereditoMsg = {
          id: Date.now().toString(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: data.resolucaoMsg,
          type: 'info',
          sender: 'Mestre'
      };
      roomState.chatHistory.push(vereditoMsg);
      if (roomState.chatHistory.length > 50) roomState.chatHistory.shift();
      io.in(data.roomId).emit('chatMessage', { roomId: data.roomId, message: vereditoMsg });
      
      autoSaveRoom(data.roomId);
  });

  // 👉 MAGIA NOVA: FASE 4 - PEDIDO DE TESTE DO JOGADOR
  socket.on('player_request_roll', (data: { roomId: string, playerId: number, playerName: string, skillName: string, mod: number }) => {
      // Envia o card de pedido apenas para a sala (onde o Mestre vai interceptar)
      io.in(data.roomId).emit('player_roll_requested', data);
  });

});

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(`⚔️ NEXUS BACKEND ONLINE - PORTA ${PORT}`);
});