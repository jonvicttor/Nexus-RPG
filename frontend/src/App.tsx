import React, { useState, useEffect, useRef, useCallback } from 'react';
import socket from './services/socket';
import { Howl, Howler } from 'howler';
import GameMap from './components/GameMap'; 
import SidebarDM, { InitiativeItem } from './components/SidebarDM';
import SidebarPlayer from './components/SidebarPlayer';
import LoginScreen from './components/LoginScreen'; 
import Lobby from './components/Lobby'; 
import { ChatMessage } from './components/Chat';
import EditEntityModal from './components/EditEntityModal';
import MonsterCreatorModal from './components/MonsterCreatorModal';
import BaldursDiceRoller, { RollBonus } from './components/BaldursDiceRoller'; 
import { getLevelFromXP } from './utils/gameRules';
import ContextMenu from './components/ContextMenu'; 
import MobilePlayerSheet from './components/MobilePlayerSheet'; 
import CharacterSheetFloating from './components/CharacterSheetFloating'; 
import LootGeneratorModal from './components/LootGeneratorModal';

const GRID_SIZE = 70; 
const CANVAS_WIDTH = 1920; 
const CANVAS_HEIGHT = 1080; 

// --- INTERFACES ---
export interface Item {
  id: string; name: string; description: string; image: string; type: 'weapon' | 'armor' | 'potion' | 'misc' | 'magic';
  quantity: number; weight?: number; value?: string; rarity?: string; isEquipped?: boolean;
  stats?: { damage?: string; armorClass?: number; ac?: number; properties?: string[]; isTreasure?: boolean; coins?: { gp: number, sp: number, cp: number }; };
}

export interface Entity {
  id: number; name: string; hp: number; maxHp: number; ac: number; x: number; y: number;
  rotation?: number; mirrored?: boolean; conditions: string[]; color: string; type: 'player' | 'enemy' | 'loot'; 
  image?: string; tokenImage?: string; visionRadius?: number; 
  stats?: { str: number; dex: number; con: number; int: number; wis: number; cha: number; };
  classType?: string; size?: number; xp?: number; level?: number; inventory?: Item[]; race?: string; visible?: boolean; 
  proficiencies?: Record<string, number>; deathSaves?: { successes: number, failures: number }; inspiration?: boolean; 
  spellSlots?: Record<number, { max: number, used: number }>; spells?: { id: string, name: string, level: number }[];
  coins?: { cp: number, sp: number, ep: number, gp: number, pp: number };
}

export interface MonsterPreset {
  name: string; hp: number; ac: number; image: string; tokenImage?: string; size?: number;
}

export interface MapPing {
  id: string; x: number; y: number; color: string;
}

export interface QueuedRoll {
  title: string;
  subtitle: string;
  mod: number;
  dc: number;
  entityId: number | null;
  targetName: string;
  isDamage?: boolean;         
  damageExpression?: string;  
  isCustomNoDamage?: boolean; // 👉 NOVO: Sinaliza que a rolagem usa dados 3D genéricos mas NÃO TIRA VIDA
}

const InitiativeModal = ({ entity, onClose, onConfirm }: { entity: Entity, onClose: () => void, onConfirm: (val: number) => void }) => {
  const [manualValue, setManualValue] = useState('');
  const dexMod = entity.stats ? Math.floor((entity.stats.dex - 10) / 2) : 0;
  const modString = dexMod >= 0 ? `+${dexMod}` : `${dexMod}`;
  const handleAutoRoll = () => { const d20 = Math.floor(Math.random() * 20) + 1; onConfirm(d20 + dexMod); };
  const handleManualSubmit = (e: React.FormEvent) => { e.preventDefault(); const val = parseInt(manualValue); if (!isNaN(val)) onConfirm(val); };
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-yellow-600/50 p-6 rounded-lg shadow-2xl w-80 animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex flex-col items-center mb-4">
          <div className="w-16 h-16 rounded-full border-2 border-yellow-500 overflow-hidden mb-2 shadow-lg bg-black flex justify-center items-center">
             {entity.tokenImage || entity.image ? <img src={entity.tokenImage || entity.image} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full bg-gray-700" />}
          </div>
          <h3 className="text-yellow-500 font-bold text-lg uppercase tracking-widest text-center">{entity.name}</h3>
          <p className="text-gray-400 text-xs font-mono">Mod. Destreza: <span className="text-white">{modString}</span></p>
        </div>
        <button onClick={handleAutoRoll} className="w-full bg-yellow-700 hover:bg-yellow-600 text-white font-bold py-3 rounded mb-4 shadow-lg border border-yellow-500/30 flex justify-center items-center gap-2 transition-all active:scale-95"><span>🎲</span> Rolar (1d20 {modString})</button>
        <div className="relative flex items-center gap-2 mb-4"><div className="flex-grow h-px bg-white/10"></div><span className="text-xs text-gray-500 uppercase">Ou Manual</span><div className="flex-grow h-px bg-white/10"></div></div>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input type="number" placeholder="Valor" className="flex-1 bg-black/50 border border-white/20 rounded p-2 text-center text-white outline-none focus:border-yellow-500" value={manualValue} onChange={e => setManualValue(e.target.value)} autoFocus />
          <button type="submit" className="bg-gray-800 hover:bg-gray-700 text-white px-4 rounded border border-white/10">OK</button>
        </form>
      </div>
    </div>
  );
};

const DamageOverlay = ({ data, onComplete }: { data: any, onComplete: () => void }) => {
    const [currentRolls, setCurrentRolls] = useState<number[]>(data.rolls?.map(() => 1) || []);
    const [locked, setLocked] = useState(!data.rolls); 

    useEffect(() => {
        if (!data.rolls) {
            const impact = new Howl({ src: ['/sfx/sword.mp3'], volume: 0.6 });
            impact.play();
            setTimeout(onComplete, 2000);
            return;
        }
        
        let ticks = 0;
        const audio = new Howl({ src: ['/sfx/dado.mp3'], volume: 0.5, rate: 1.5 });
        audio.play();

        const interval = setInterval(() => {
            ticks++;
            setCurrentRolls(data.rolls.map(() => Math.floor(Math.random() * data.sides) + 1));
            
            if (ticks > 15) {
                clearInterval(interval);
                setCurrentRolls(data.rolls);
                setLocked(true);
                const impact = new Howl({ src: ['/sfx/sword.mp3'], volume: 0.6 });
                impact.play();
                setTimeout(onComplete, 2500);
            }
        }, 60);

        return () => { clearInterval(interval); audio.unload(); };
    }, [data, onComplete]);

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.2)_0%,transparent_70%)] pointer-events-none"></div>
            
            <div className="flex flex-col items-center gap-6 relative z-10">
                <h2 className="text-red-500 font-black tracking-[0.3em] uppercase text-xl drop-shadow-[0_0_10px_rgba(220,38,38,0.8)]">
                    {locked ? 'Impacto!' : 'Calculando Dano...'}
                </h2>
                
                <div className="text-white text-lg bg-black/60 px-6 py-2 rounded-full border border-red-500/30 flex items-center gap-2 shadow-lg">
                    🎯 Alvo: <span className="font-bold text-red-400">{data.targetName}</span>
                </div>

                {data.rolls && (
                    <div className="flex gap-4 items-center">
                        {currentRolls.map((val, idx) => (
                            <div key={idx} className={`w-16 h-16 flex items-center justify-center text-3xl font-black rounded-xl border-2 transition-all ${locked ? 'bg-red-900 border-red-500 text-white shadow-[0_0_30px_rgba(220,38,38,0.8)] scale-110' : 'bg-gray-900 border-gray-600 text-gray-400'}`}>
                                {val}
                            </div>
                        ))}
                        {data.mod !== 0 && (
                            <div className="text-4xl text-gray-500 font-thin mx-2">{data.mod > 0 ? '+' : ''}{data.mod}</div>
                        )}
                    </div>
                )}

                {locked && (
                    <div className="animate-in zoom-in spin-in-12 duration-300 flex flex-col items-center mt-6">
                        <span className="text-[10rem] leading-none font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-red-500 to-red-950 drop-shadow-[0_10px_20px_rgba(220,38,38,0.8)]" style={{ fontFamily: '"Cinzel Decorative", serif' }}>
                            {data.total}
                        </span>
                        <span className="text-red-500/50 font-bold tracking-widest mt-4 uppercase">Pontos de Vida Perdidos</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const createInitialFog = () => {
    const MAP_LIMIT = 8000; 
    const COLS = Math.ceil(MAP_LIMIT / GRID_SIZE);
    const ROWS = Math.ceil(MAP_LIMIT / GRID_SIZE);
    return Array(ROWS).fill(null).map(() => Array(COLS).fill(false));
};

const SFX_LIBRARY: Record<string, Howl> = {
  dado: new Howl({ src: ['/sfx/dado.mp3'], volume: 0.5, html5: true }),
  levelup: new Howl({ src: ['/sfx/levelup.mp3'], volume: 0.6, html5: true }),
  sword: new Howl({ src: ['/sfx/sword.mp3'], volume: 0.5, html5: true }),
  magic: new Howl({ src: ['/sfx/magic.mp3'], volume: 0.5, html5: true }),
  explosion: new Howl({ src: ['/sfx/explosion.mp3'], volume: 0.5, html5: true }),
  roar: new Howl({ src: ['/sfx/roar.mp3'], volume: 0.5, html5: true }),
  ping: new Howl({ src: ['/sfx/danger-ping.mp3'], volume: 0.6, html5: true }), 
  notificacao: new Howl({ src: ['/sfx/notificacao.mp3'], volume: 0.7, html5: true }), 
  campfire: new Howl({ src: ['/sfx/campfire.mp3'], volume: 0.8, html5: true }) 
};

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false); 
  const [role, setRole] = useState<'DM' | 'PLAYER'>('PLAYER'); 
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState<string>('');
  const [gamePhase, setGamePhase] = useState<'LOBBY' | 'GAME'>('LOBBY');

  const [entities, setEntities] = useState<Entity[]>([]);
  const [fogGrid, setFogGrid] = useState<boolean[][]>(createInitialFog());
  const [isFogMode, setIsFogMode] = useState(false);
  const [fogTool, setFogTool] = useState<'reveal' | 'hide'>('reveal'); 
  const [fogShape, setFogShape] = useState<'brush' | 'rect' | 'line'>('brush'); 

  const [currentMap, setCurrentMap] = useState('/maps/floresta.jpg');
  const [initiativeList, setInitiativeList] = useState<InitiativeItem[]>([]);
  const [activeTurnId, setActiveTurnId] = useState<number | null>(null);
  const [targetEntityIds, setTargetEntityIds] = useState<number[]>([]);
  const [attackerId, setAttackerId] = useState<number | null>(null);
  const [activeAoE, setActiveAoE] = useState<'circle' | 'cone' | 'cube' | null>(null);
  const [aoeColor, setAoEColor] = useState<string>('#ef4444'); 
  const [initModalEntity, setInitModalEntity] = useState<Entity | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [statusSelectionId, setStatusSelectionId] = useState<number | null>(null);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);

  const [activeCharacterSheetId, setActiveCharacterSheetId] = useState<number | null>(null);

  const [customMonsters, setCustomMonsters] = useState<MonsterPreset[]>([]); 
  
  const [availableClasses, setAvailableClasses] = useState<any[]>([]); 
  const [availableSpells, setAvailableSpells] = useState<any[]>([]); 
  const [availableItems, setAvailableItems] = useState<any[]>([]); 
  const [availableRaces, setAvailableRaces] = useState<any[]>([]); 
  const [availableConditions, setAvailableConditions] = useState<any[]>([]); 

  const [focusEntity, setFocusEntity] = useState<Entity | null>(null);       
  const [globalBrightness, setGlobalBrightness] = useState(1);             

  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [mapScale, setMapScale] = useState(1);
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  const [showAllyCreator, setShowAllyCreator] = useState(false);
  const [showEnemyCreator, setShowEnemyCreator] = useState(false);
  const [showBgDice, setShowBgDice] = useState(false);
  const [showLootGenerator, setShowLootGenerator] = useState(false); 
  
  const [privateChatTarget, setPrivateChatTarget] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [damageOverlayData, setDamageOverlayData] = useState<any>(null);

  const [rollQueue, setRollQueue] = useState<QueuedRoll[]>([]);

  const [diceContext, setDiceContext] = useState({
      title: 'Teste Geral',
      subtitle: 'Sorte',
      dc: 15,
      mod: 0,   
      prof: 0,  
      bonuses: [] as RollBonus[], 
      rollType: 'normal' as 'normal' | 'advantage' | 'disadvantage',
      entityId: null as number | null,
      targetName: '',
      isDamage: false,
      damageExpression: '1d20',
      isCustomNoDamage: false
  });

  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [audioVolume, setAudioVolume] = useState(0.5);
  const activeMusicRef = useRef<Howl | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entity: Entity } | null>(null);
  const [pings, setPings] = useState<MapPing[]>([]);
  const [toastMsg, setToastMsg] = useState<{text: string, id: number, sender?: string} | null>(null);

  const ignoreNextDiceSound = useRef(false);

  useEffect(() => {
      if (rollQueue.length > 0 && !showBgDice) {
          const nextRoll = rollQueue[0];
          setDiceContext({
              title: nextRoll.title,
              subtitle: nextRoll.subtitle,
              dc: nextRoll.dc,
              mod: nextRoll.mod,
              prof: 0,
              bonuses: [],
              rollType: 'normal',
              entityId: nextRoll.entityId,
              targetName: nextRoll.targetName,
              isDamage: nextRoll.isDamage || false,
              damageExpression: nextRoll.damageExpression || '1d20',
              isCustomNoDamage: nextRoll.isCustomNoDamage || false // 👉 NOVO: Adicionado à context state
          });
          setShowBgDice(true);
      }
  }, [rollQueue, showBgDice]);

  useEffect(() => {
    const handleCompendiumSync = (data: any) => {
        if (data.availableClasses) setAvailableClasses(data.availableClasses);
        if (data.availableRaces) setAvailableRaces(data.availableRaces);
    };

    socket.on('compendiumSync', handleCompendiumSync);
    socket.emit('requestCompendium');
    
    const handleConnect = () => socket.emit('requestCompendium');
    socket.on('connect', handleConnect);

    return () => { 
        socket.off('compendiumSync', handleCompendiumSync); 
        socket.off('connect', handleConnect);
    };
  }, []);

  const getCenterGridPosition = useCallback(() => {
    const centerPixelX = (CANVAS_WIDTH / 2) - mapOffset.x;
    const centerPixelY = (CANVAS_HEIGHT / 2) - mapOffset.y;
    return { 
        x: Math.max(0, Math.floor(centerPixelX / (GRID_SIZE * mapScale))), 
        y: Math.max(0, Math.floor(centerPixelY / (GRID_SIZE * mapScale))) 
    };
  }, [mapOffset, mapScale]);

  useEffect(() => {
    if (toastMsg && !toastMsg.sender) {
        const timer = setTimeout(() => { setToastMsg(null); }, 4500); 
        return () => clearTimeout(timer);
    }
    if (toastMsg && toastMsg.sender) {
        const timer = setTimeout(() => setToastMsg(null), 10000);
        return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  useEffect(() => {
    const handleResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
      if (privateChatTarget && chatEndRef.current) {
          chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
  }, [chatMessages, privateChatTarget]);

  useEffect(() => {
      const handleOpenDraft = (e: Event) => {
          const customEvent = e as CustomEvent<string>;
          const match = customEvent.detail.match(/^\/w\s+"?([^"]+)"?\s*/i);
          if (match) setPrivateChatTarget(match[1].trim());
      };
      window.addEventListener('openChatWithDraft', handleOpenDraft);
      return () => window.removeEventListener('openChatWithDraft', handleOpenDraft);
  }, []);

  const handlePlayMusic = useCallback((trackId: string, emit: boolean = true) => {
      if (activeMusicRef.current) { activeMusicRef.current.stop(); activeMusicRef.current.unload(); }
      const trackPath = `/music/${trackId}.mp3`;
      const sound = new Howl({ src: [trackPath], html5: true, loop: true, volume: audioVolume });
      sound.play();
      activeMusicRef.current = sound;
      setCurrentTrack(trackId);
      if (emit) socket.emit('playMusic', { trackId, roomId });
  }, [audioVolume, roomId]);

  const handleStopMusic = useCallback((emit: boolean = true) => {
      if (activeMusicRef.current) { activeMusicRef.current.stop(); activeMusicRef.current.unload(); activeMusicRef.current = null; }
      setCurrentTrack(null);
      if (emit) socket.emit('stopMusic', { roomId });
  }, [roomId]);

  const handlePlaySFX = useCallback((sfxId: string, emit: boolean = true) => {
      const sound = SFX_LIBRARY[sfxId];
      if (sound) { sound.volume(audioVolume); sound.play(); }
      if (emit) socket.emit('playSFX', { sfxId, roomId });
  }, [audioVolume, roomId]);

  const playSound = useCallback((type: 'dado' | 'levelup' | 'magic' | 'notificacao' | 'campfire') => { 
    handlePlaySFX(type, false); 
  }, [handlePlaySFX]);

  const addLog = useCallback((messageData: Omit<ChatMessage, 'id' | 'timestamp'>, shouldEmit: boolean = true) => {
    const newMessage: ChatMessage = { id: Date.now().toString() + Math.random(), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), ...messageData };
    setChatMessages(prev => [...prev, newMessage]);
    if (shouldEmit) socket.emit('sendMessage', { roomId, message: newMessage });
  }, [roomId]);

  const createEntity = useCallback((type: 'enemy' | 'player' | 'loot', name: string, x: number, y: number, customStats?: Partial<Entity> & { tokenImage?: string }) => { 
      const newId = Date.now() + Math.floor(Math.random() * 1000); 
      const newEntity: Entity = { 
          id: newId, name, hp: customStats?.hp || 10, maxHp: customStats?.maxHp || customStats?.hp || 10, ac: customStats?.ac || 10, 
          x, y, rotation: 0, mirrored: false, conditions: [], color: type === 'enemy' ? '#ef4444' : '#3b82f6', type, 
          image: customStats?.image || (type === 'enemy' ? "/tokens/lobo.png" : "/tokens/aliado.png"), 
          tokenImage: customStats?.tokenImage || customStats?.image || (type === 'enemy' ? "/tokens/lobo.png" : "/tokens/aliado.png"),
          visionRadius: 9, stats: customStats?.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, classType: customStats?.classType || "NPC", 
          size: customStats?.size || 2, xp: customStats?.xp || 0, level: customStats?.level || 1, inventory: customStats?.inventory || [], 
          race: customStats?.race || 'Humano', visible: true, proficiencies: customStats?.proficiencies || {}, 
          deathSaves: customStats?.deathSaves || { successes: 0, failures: 0 }, inspiration: customStats?.inspiration || false, 
          spellSlots: customStats?.spellSlots || {}, spells: customStats?.spells || [], coins: customStats?.coins || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 } 
      }; 
      setEntities(prev => [...prev, newEntity]); 
      socket.emit('createEntity', { entity: newEntity, roomId }); 
  }, [roomId]);

  useEffect(() => {
    if (!isLoggedIn || !roomId) return;
    socket.emit('joinRoom', roomId);
  }, [isLoggedIn, roomId]);

  useEffect(() => {
    if (!isLoggedIn) return;

    socket.on('gameStateSync', (gameState: any) => {
      if (gameState.entities) setEntities(gameState.entities);
      if (gameState.fogGrid) setFogGrid(gameState.fogGrid);
      if (gameState.currentMap) setCurrentMap(gameState.currentMap);
      if (gameState.initiativeList) setInitiativeList(gameState.initiativeList);
      if (gameState.activeTurnId) setActiveTurnId(gameState.activeTurnId);
      if (gameState.chatHistory) setChatMessages(gameState.chatHistory);
      if (gameState.customMonsters) setCustomMonsters(gameState.customMonsters);
      if (gameState.globalBrightness !== undefined) setGlobalBrightness(gameState.globalBrightness);
      if (gameState.currentTrack) handlePlayMusic(gameState.currentTrack, false);
      
      if (gameState.availableClasses) setAvailableClasses(gameState.availableClasses);
      if (gameState.availableSpells) setAvailableSpells(gameState.availableSpells);
      if (gameState.availableItems) setAvailableItems(gameState.availableItems);
      if (gameState.availableRaces) setAvailableRaces(gameState.availableRaces);
      if (gameState.availableConditions) setAvailableConditions(gameState.availableConditions); 
    });

    socket.on('notification', (data: any) => { 
        setToastMsg({ text: data.message, id: Date.now() });
    });

    socket.on('gameStarted', () => {
        setGamePhase('GAME');
        addLog({ text: "A aventura começou! O Mestre abriu os portões.", type: 'info', sender: 'Sistema' });
    });

    socket.on('newDiceResult', () => {
        if (!ignoreNextDiceSound.current) {
            playSound('dado');
        }
    });
    
    socket.on('chatMessage', (data: any) => {
        const msg = data.message;
        
        if (msg.isWhisper) {
            const myName = role === 'DM' ? 'MESTRE' : playerName;
            const isSender = msg.sender.toLowerCase() === myName.toLowerCase();
            const isTarget = msg.whisperTarget?.toLowerCase() === myName.toLowerCase() || (role === 'DM' && msg.whisperTarget?.toLowerCase() === 'mestre');
            const amIDM = role === 'DM'; 
            
            if (!isSender && !isTarget && !amIDM) return; 

            if (isTarget && !isSender) {
                setToastMsg({ text: `🤫 Mensagem de ${msg.sender}. Clique aqui para ler!`, id: Date.now(), sender: msg.sender });
                playSound('notificacao'); 
            }
        }

        setChatMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
        });
    });

    socket.on('playMusic', (data: any) => handlePlayMusic(data.trackId, false));
    socket.on('stopMusic', () => handleStopMusic(false));
    socket.on('playSFX', (data: any) => handlePlaySFX(data.sfxId, false));
    socket.on('entityPositionUpdated', (data: any) => setEntities(prev => prev.map(ent => ent.id === data.entityId ? { ...ent, x: data.x, y: data.y } : ent)));
    socket.on('entityStatusUpdated', (data: any) => setEntities(prev => prev.map(ent => ent.id === data.entityId ? { ...ent, ...data.updates } : ent)));
    socket.on('entityCreated', (data: any) => setEntities(prev => { if (prev.find(e => e.id === data.entity.id)) return prev; return [...prev, data.entity]; }));
    
    socket.on('entityDeleted', (data: any) => { 
        setEntities(prev => {
            const deletedEnt = prev.find(e => e.id === data.entityId);
            
            if (role === 'PLAYER' && deletedEnt && deletedEnt.name.toLowerCase() === playerName.toLowerCase() && deletedEnt.type === 'player') {
                localStorage.removeItem('nexus_last_char'); 
                setToastMsg({ text: "Sua ficha foi removida da mesa pelo Mestre.", id: Date.now() });
                
                setTimeout(() => {
                    window.location.reload();
                }, 3000);
            }
            return prev.filter(ent => ent.id !== data.entityId);
        }); 
        
        setStatusSelectionId(prev => prev === data.entityId ? null : prev); 
        setAttackerId(prev => prev === data.entityId ? null : prev); 
    });

    socket.on('mapChanged', (data: any) => { setCurrentMap(data.mapUrl); setFogGrid(data.fogGrid); });
    socket.on('fogUpdated', (data: any) => { setFogGrid(prev => { if (!prev || !prev[data.y]) return prev; const newGrid = prev.map(row => [...row]); newGrid[data.y][data.x] = data.shouldReveal; return newGrid; }); });
    socket.on('fogGridSynced', (data: any) => setFogGrid(data.grid));
    socket.on('initiativeUpdated', (data: any) => { setInitiativeList(data.list); setActiveTurnId(data.activeTurnId); });
    socket.on('triggerAudio', (data: any) => { if (data.trackId === 'suspense') handlePlayMusic('suspense', false); });
    socket.on('mapStateUpdated', (data: any) => { if (role === 'PLAYER') { setMapOffset(data.offset); setMapScale(data.scale); } });
    socket.on('globalBrightnessUpdated', (data: any) => { setGlobalBrightness(data.brightness); });

    socket.on('dmRequestRoll', (data: any) => {
        if (role === 'PLAYER') {
            setEntities(currentEntities => {
                const myChar = currentEntities.find(e => e.name === playerName && e.id === data.targetId);
                const isMyChar = myChar || currentEntities.some(e => e.id === data.targetId && e.type === 'player' && e.name === playerName);
                
                if (isMyChar) {
                    const charName = myChar ? myChar.name : playerName;
                    const charId = myChar ? myChar.id : data.targetId;
                    
                    setRollQueue(prev => [...prev, {
                        title: data.skillName,
                        subtitle: `Exigido pelo Mestre`,
                        mod: data.mod,
                        dc: data.dc,
                        entityId: charId,
                        targetName: charName,
                        isDamage: data.isDamage || false,
                        damageExpression: data.damageExpression || '1d20',
                        isCustomNoDamage: data.isCustomNoDamage || false // 👉 NOVO: Transfere do Socket
                    }]);
                    playSound('notificacao');
                    addLog({ text: `⚠️ O Mestre exigiu uma rolagem de **${data.skillName}** de você!`, type: 'info', sender: 'Sistema' }, false);
                }
                return currentEntities;
            });
        }
    });

    socket.on('mapPinged', (data: { ping: MapPing }) => { setPings(prev => [...prev, data.ping]); handlePlaySFX('ping', false); setTimeout(() => { setPings(prev => prev.filter(p => p.id !== data.ping.id)); }, 2500); });

    return () => {
      socket.off('gameStateSync'); socket.off('notification'); socket.off('newDiceResult'); socket.off('chatMessage'); 
      socket.off('entityPositionUpdated'); socket.off('entityStatusUpdated'); socket.off('entityCreated'); socket.off('entityDeleted'); 
      socket.off('mapChanged'); socket.off('fogUpdated'); socket.off('fogGridSynced'); socket.off('initiativeUpdated'); 
      socket.off('triggerAudio'); socket.off('mapStateUpdated'); socket.off('globalBrightnessUpdated'); socket.off('dmRequestRoll');
      socket.off('playMusic'); socket.off('stopMusic'); socket.off('playSFX'); socket.off('mapPinged'); 
      socket.off('gameStarted');
    };
  }, [isLoggedIn, addLog, role, playerName, handlePlayMusic, handleStopMusic, handlePlaySFX, playSound]); 

  useEffect(() => {
      const handleLootGenerated = (data: any) => {
          const pos = getCenterGridPosition();
          data.loot.forEach((item: any, index: number) => {
              createEntity('loot', `Saque: ${item.name}`, pos.x + (index % 3), pos.y + Math.floor(index / 3), {
                  inventory: [{ ...item, id: Date.now().toString() + index, quantity: 1, isEquipped: false }],
                  image: item.image || '/tokens/loot.png', 
                  classType: 'Item',
                  size: 0.8
              });
          });
          addLog({ text: `💰 O Mestre materializou ${data.loot.length} tesouro(s) no mapa!`, type: 'info', sender: 'Sistema' });
          setShowLootGenerator(false);
          handlePlaySFX('dado', true);
      };

      socket.on('randomLootGenerated', handleLootGenerated);
      return () => { socket.off('randomLootGenerated', handleLootGenerated); };
  }, [getCenterGridPosition, createEntity, addLog, handlePlaySFX]);

  const handleResetView = () => {
      setMapOffset({ x: 0, y: 0 }); setMapScale(1);
      if (role === 'DM') { socket.emit('syncMapState', { roomId, offset: { x: 0, y: 0 }, scale: 1 }); addLog({ text: "🎥 O Mestre recentralizou a câmera de todos.", type: 'info', sender: 'Sistema' }); } 
      else { addLog({ text: "🎥 Câmera recentralizada.", type: 'info', sender: 'Sistema' }); }
  };
  const handleMapSync = (offset: {x: number, y: number}, scale: number) => { setMapOffset(offset); setMapScale(scale); if (role === 'DM') socket.emit('syncMapState', { roomId, offset, scale }); };
  
  const handleDmRequestRoll = (targetId: number, skillName: string, mod: number, dc: number) => { 
      const target = entities.find(e => e.id === targetId); 
      addLog({ text: `Mestre solicitou um teste de **${skillName}** para **${target ? target.name : 'Alvo'}**.`, type: 'info', sender: 'Sistema' }); 
      socket.emit('dmRequestRoll', { roomId, targetId, skillName, mod, dc }); 
  };

  const handleRequestInitiative = (targetIds: number[]) => {
      const dmQueue: QueuedRoll[] = [];
      let playerPushed = false;

      targetIds.forEach(id => {
          const ent = entities.find(e => e.id === id);
          if (!ent) return;
          const dexMod = ent.stats ? Math.floor((ent.stats.dex - 10) / 2) : 0;
          
          if (ent.type === 'player') {
              socket.emit('dmRequestRoll', { roomId, targetId: id, skillName: 'Iniciativa', mod: dexMod, dc: 0 });
              playerPushed = true;
          } else {
              dmQueue.push({
                  title: 'Iniciativa',
                  subtitle: `Teste para ${ent.name}`,
                  mod: dexMod,
                  dc: 0,
                  entityId: id,
                  targetName: ent.name
              });
          }
      });

      if (playerPushed) {
          addLog({ text: `⚔️ O Mestre exigiu que os aventureiros selecionados rolem suas Iniciativas!`, type: 'info', sender: 'Sistema' });
      }

      if (dmQueue.length > 0) {
          setRollQueue(prev => [...prev, ...dmQueue]);
      }
      setTargetEntityIds([]);
  };

  // 👉 NOVO: Função que o DM chama para exigir rolagem customizada 3D
  const handleRequestCustomRoll = (targetIds: number[], expression: string, title: string) => {
      // Se não selecionar ninguém, o próprio Mestre rola o dado
      if (targetIds.length === 0) {
           setRollQueue(prev => [...prev, {
               title: title, subtitle: 'Rolagem Customizada', dc: 0, mod: 0, entityId: null, targetName: 'Mestre', 
               isDamage: true, damageExpression: expression, isCustomNoDamage: true 
           }]);
           return;
      }
      
      let playerPushed = false;
      const dmQueue: QueuedRoll[] = [];

      targetIds.forEach(id => {
           const ent = entities.find(e => e.id === id);
           if (!ent) return;
           if (ent.type === 'player') {
               socket.emit('dmRequestRoll', { roomId, targetId: id, skillName: title, mod: 0, dc: 0, isDamage: true, damageExpression: expression, isCustomNoDamage: true });
               playerPushed = true;
           } else {
               dmQueue.push({
                   title: title, subtitle: `Rolagem para ${ent.name}`, dc: 0, mod: 0, entityId: id, targetName: ent.name, 
                   isDamage: true, damageExpression: expression, isCustomNoDamage: true
               });
           }
      });

      if (playerPushed) {
           addLog({ text: `⚔️ O Mestre exigiu uma rolagem de **${expression}** (${title})!`, type: 'info', sender: 'Sistema' });
      }

      if (dmQueue.length > 0) {
          setRollQueue(prev => [...prev, ...dmQueue]);
      }
      setTargetEntityIds([]);
  };
  
  const handleAttributeRoll = (charName: string, attrName: string, mod: number) => { 
      setRollQueue(prev => [...prev, { title: attrName, subtitle: `Teste de Perícia (${charName})`, dc: 15, mod, entityId: null, targetName: charName }]);
  };

  const handleApplyDamageFromChat = (targetId: number, damageExpression: string) => {
        const target = entities.find(e => e.id === targetId);
        if (!target) return;

        const rollMatch = damageExpression.match(/^(\d+)d(\d+)(\+(\d+))?$/i);

        if (rollMatch) {
            setRollQueue(prev => [...prev, {
                title: `Dano em ${target.name}`,
                subtitle: damageExpression,
                dc: 0,
                mod: 0, 
                entityId: targetId,
                targetName: target.name,
                isDamage: true,
                damageExpression: damageExpression
            }]);
        } else { 
            const totalDano = parseInt(damageExpression) || 0; 
            if (totalDano > 0) {
                handleUpdateHP(targetId, -totalDano); 
                addLog({ text: `⚔️ **DANO APLICADO:** ${totalDano} de Dano Fixo no ${target.name}!`, type: 'damage', sender: 'Sistema' });
                setDamageOverlayData({ rolls: null, mod: 0, total: totalDano, targetName: target.name });
            }
        }
  };

  // 👉 LÓGICA ATUALIZADA: Suporte a Dados Customizados Sem Dano
  const handleDiceComplete = (total: number, isSuccess: boolean, isCritical: boolean, isSecret: boolean, finalRolls?: number[], finalMod?: number) => {
      const senderName = role === 'DM' ? 'Mestre' : playerName;

      // --- LÓGICA DE DADOS GENÉRICOS (isDamage ativa os dados coloridos/formatos diferentes) ---
      if (diceContext.isDamage) {
          const rollString = finalRolls ? `[${finalRolls.join(', ')}]` : '';
          const modStr = finalMod ? (finalMod > 0 ? `+${finalMod}` : (finalMod < 0 ? finalMod : '')) : '';

          if (!diceContext.isCustomNoDamage && diceContext.entityId) {
              // É DANO REAL (Tira HP e mostra o Sangue)
              handleUpdateHP(diceContext.entityId, -total);
              addLog({ text: `⚔️ **DANO APLICADO:** Rolou ${diceContext.damageExpression} ${rollString}${modStr} = **${total} de Dano** no ${diceContext.targetName}!`, type: 'damage', sender: 'Sistema' });
              
              setDamageOverlayData({ rolls: null, sides: 1, mod: finalMod, total: total, targetName: diceContext.targetName });
              setTimeout(() => {
                  setShowBgDice(false);
                  setRollQueue(prev => prev.slice(1));
              }, 2000);
          } else {
              // É SÓ UMA ROLAGEM CUSTOMIZADA 3D (ex: 1d100, não tira vida, apenas posta no chat)
              const publicText = `🎲 **${senderName}** rolou ${diceContext.title} (${diceContext.damageExpression}):\n🎯 Resultado: ${rollString}${modStr} = **${total}**`;
              
              if (isSecret) {
                  addLog({ text: `👁️ (Secreto) ` + publicText, type: 'roll', sender: senderName, isSecret: true, secretContent: `👁️ (Secreto) ` + publicText } as any);
              } else {
                  addLog({ text: publicText, type: 'roll', sender: senderName } as any);
                  socket.emit('rollDice', { sides: 20, result: total, roomId, user: senderName });
              }
              
              setTimeout(() => {
                  setShowBgDice(false);
                  setRollQueue(prev => prev.slice(1));
              }, 2000);
          }
          return;
      }

      // --- LÓGICA NORMAL (ATAQUES / TESTES / INICIATIVA) COM O D20 PADRÃO ---
      let resultMsg = isCritical ? (total >= 20 ? "CRÍTICO! ⚔️" : "FALHA CRÍTICA! 💀") : (isSuccess ? "SUCESSO! ✅" : "FALHA ❌");
      let isAttackHit = false; 
      let targetIdForDamage: number | null = null; 
      let targetInfoMsg = "";
      let damageExpression = "";

      const isAttack = diceContext.title.toLowerCase().includes("ataque");

      if (isAttack) {
          const attacker = role === 'DM' && attackerId ? entities.find(e => e.id === attackerId) : entities.find(e => e.name === playerName);
          const weaponName = diceContext.title.replace(/Ataque:\s*/i, '').trim();
          const weapon = attacker?.inventory?.find(i => i.name.toLowerCase() === weaponName.toLowerCase());

          let baseDmg = weapon?.stats?.damage || '1d4';
          let dmgMod = 0;
          
          if (attacker && attacker.stats) {
              const strMod = Math.floor((attacker.stats.str - 10) / 2);
              const dexMod = Math.floor((attacker.stats.dex - 10) / 2);
              const isFinesseOrRanged = weapon?.stats?.properties?.some(p => p.toLowerCase().includes('finesse') || p.toLowerCase().includes('distância') || p.toLowerCase().includes('ranged')) || weaponName.toLowerCase().includes('arco') || weaponName.toLowerCase().includes('besta') || weaponName.toLowerCase().includes('adaga') || weaponName.toLowerCase().includes('rapieira');
              dmgMod = isFinesseOrRanged ? Math.max(strMod, dexMod) : strMod;
          }

          const dmgMatch = baseDmg.match(/^(\d+)d(\d+)/i);
          if (dmgMatch) {
              const count = parseInt(dmgMatch[1]);
              const sides = parseInt(dmgMatch[2]);
              const rollsCount = (isCritical && total >= 20) ? count * 2 : count;
              
              damageExpression = `${rollsCount}d${sides}${dmgMod !== 0 ? (dmgMod > 0 ? '+'+dmgMod : dmgMod) : ''}`;
          }

          if (targetEntityIds.length > 0) {
              const target = entities.find(e => e.id === targetEntityIds[0]);
              if (target) {
                  if (total >= target.ac || (isCritical && total >= 20)) { 
                      resultMsg = `**ACERTOU!** ⚔️`; 
                      isAttackHit = true; 
                      targetIdForDamage = target.id;
                      targetInfoMsg = `\n🎯 *${target.name}* recebeu o golpe!`;
                      
                      socket.emit('triggerCombatAnimation', { roomId, attackerName: senderName, targetId: target.id, attackType: 'fisico' });
                      handlePlaySFX('sword', true);
                  } else { 
                      resultMsg = `**ERROU!** 🛡️`; 
                      targetInfoMsg = `\n💨 *${target.name}* defendeu o ataque.`; 
                      handlePlaySFX('dado', true);
                  }
              }
          } else {
              resultMsg = `**Ataque Rolado** ⚔️`;
              targetInfoMsg = `\n*(Nenhum alvo selecionado)*`;
              handlePlaySFX('sword', true);
          }
      }

      if (diceContext.title === 'Iniciativa' && diceContext.entityId) {
          const entName = diceContext.targetName || senderName;
          const newItem = { id: diceContext.entityId, name: entName, value: total };
          
          setInitiativeList(prev => {
               const filtered = prev.filter(i => i.id !== newItem.id);
               const newList = [...filtered, newItem].sort((a,b) => b.value - a.value);
               socket.emit('updateInitiative', { list: newList, activeTurnId, roomId });
               return newList;
          });
      }

      const publicText = `🎲 **${senderName}** rolou ${diceContext.title}:\n🎯 Resultado: **${total}** - ${resultMsg}${targetInfoMsg}`;

      if (isSecret) {
          const secretText = `👁️ (Secreto) ` + publicText;
          addLog({ text: role === 'DM' ? secretText : `🎲 **${senderName}** rolou dados misteriosamente...`, type: 'roll', sender: senderName, isSecret: true, secretContent: secretText, targetId: targetIdForDamage, isHit: isAttackHit, damage: damageExpression } as any);
      } else {
          addLog({ text: publicText, type: 'roll', sender: senderName, targetId: targetIdForDamage, isHit: isAttackHit, damage: damageExpression } as any);
          ignoreNextDiceSound.current = true;
          setTimeout(() => { ignoreNextDiceSound.current = false; }, 2000);
          socket.emit('rollDice', { sides: 20, result: total, roomId, user: senderName });
      }

      setTimeout(() => {
          setShowBgDice(false);
          setRollQueue(prev => prev.slice(1));
      }, 2000);
  };

  const openDiceRoller = () => { setRollQueue(prev => [...prev, { title: 'Rolagem Livre', subtitle: 'Sorte', dc: 10, mod: 0, entityId: null, targetName: '' }]); };
  const handleDMRoll = (title: string, subtitle: string, mod: number, rollType: 'normal' | 'advantage' | 'disadvantage' = 'normal') => { 
      setRollQueue(prev => [...prev, { title, subtitle, dc: 10, mod, entityId: null, targetName: '' }]); 
  };

  const handleAddXP = (id: number, amount: number) => {
    const entity = entities.find(e => e.id === id); if (!entity || entity.type !== 'player') return;
    const oldXP = entity.xp || 0; const newXP = oldXP + amount; const oldLevel = entity.level || 1; const calculatedLevel = getLevelFromXP(newXP);
    setEntities(prev => prev.map(ent => ent.id === id ? { ...ent, xp: newXP } : ent)); socket.emit('updateEntityStatus', { entityId: id, updates: { xp: newXP }, roomId });
    addLog({ text: `${entity.name} ganhou ${amount} XP!`, type: 'info', sender: 'Sistema' });
    if (calculatedLevel > oldLevel) { addLog({ text: `✨ ${entity.name} está pronto para subir de nível!`, type: 'info', sender: 'Sistema' }); playSound('levelup'); }
  };

  const handleUpdateHP = (id: number, change: number) => {
    const entity = entities.find(e => e.id === id); if (!entity) return;
    const newHp = Math.min(entity.maxHp, Math.max(0, entity.hp + change));
    if (entity.hp > 0 && newHp <= 0) addLog({ text: `☠️ **${entity.name} caiu inconsciente!**`, type: 'damage', sender: 'Sistema' });
    setEntities(prev => prev.map(ent => ent.id === id ? { ...ent, hp: newHp } : ent)); socket.emit('updateEntityStatus', { entityId: id, updates: { hp: newHp }, roomId });
  };

  const handleLongRest = () => {
      setEntities(prev => {
          const updatedEntities = prev.map(ent => {
              if (ent.type !== 'player') return ent; 

              let updates: Partial<Entity> = { hp: ent.maxHp };

              if (ent.spellSlots) {
                  const restoredSlots: Record<number, { max: number, used: number }> = {};
                  Object.entries(ent.spellSlots).forEach(([level, slotData]) => {
                      restoredSlots[parseInt(level)] = { max: slotData.max, used: 0 };
                  });
                  updates.spellSlots = restoredSlots;
              }

              socket.emit('updateEntityStatus', { entityId: ent.id, updates, roomId });
              return { ...ent, ...updates };
          });
          return updatedEntities;
      });

      handlePlaySFX('campfire', true);
      addLog({ text: "🏕️ **O grupo montou acampamento.** Vocês recuperaram todo o HP e seus espaços de magia através de um longo descanso.", type: 'info', sender: 'Mestre' });
  };

  const handleSendMessage = (text: string) => {
      const senderName = role === 'DM' ? 'MESTRE' : playerName;
      
      const spellMatch = text.match(/conjurou (\*\*o truque\*\* )?\*\*([^*]+)\*\*/i);
      if (spellMatch) {
          if (targetEntityIds.length > 0) {
              socket.emit('triggerCombatAnimation', { roomId, attackerName: senderName, targetId: targetEntityIds[0], attackType: 'magia' });
          }
          handlePlaySFX('magic', true);
      }

      const whisperMatch = text.match(/^\/w\s+"([^"]+)"\s+(.+)$/i) || text.match(/^\/w\s+([^\s]+)\s+(.+)$/i);
      if (whisperMatch) {
          const whisperTarget = whisperMatch[1]; const whisperText = whisperMatch[2];
          addLog({ text: whisperText, type: 'chat', sender: senderName, isWhisper: true, whisperTarget: whisperTarget });
          return;
      }
      const rollMatch = text.match(/^\/r\s+(\d+)d(\d+)(\+(\d+))?$/i);
      if (rollMatch) {
        const count = parseInt(rollMatch[1]); const sides = parseInt(rollMatch[2]); const mod = rollMatch[4] ? parseInt(rollMatch[4]) : 0; let sum = 0; let rolls = [];
        for(let i=0; i<count; i++) { const val = Math.floor(Math.random() * sides) + 1; rolls.push(val); sum += val; }
        const total = sum + mod; const rollString = `[${rolls.join(', ')}]` + (mod > 0 ? ` + ${mod}` : '');
        addLog({ text: `🎲 Rolou ${count}d${sides}${mod ? '+'+mod : ''}: ${rollString} = **${total}**`, type: 'roll', sender: senderName });
        handlePlaySFX('dado', true);
      } else { addLog({ text: text, type: 'chat', sender: senderName }); }
  };

  const handleGiveItem = (targetId: number, item: any) => {
      setEntities(prev => prev.map(ent => {
          if (ent.id !== targetId) return ent;
          const newInventory = [...(ent.inventory || []), item]; socket.emit('updateEntityStatus', { entityId: targetId, updates: { inventory: newInventory }, roomId });
          addLog({ text: `🎁 ${ent.name} recebeu ${item.quantity}x ${item.name}!`, type: 'info', sender: 'Sistema' }); return { ...ent, inventory: newInventory };
      }));
  };

  const handleDropLootOnMap = (item: Item, sourceId: number, x: number, y: number) => {
      setEntities(prev => prev.map(ent => {
          if (ent.id !== sourceId) return ent;
          const newInv = (ent.inventory || []).filter(i => i.id !== item.id); socket.emit('updateEntityStatus', { entityId: sourceId, updates: { inventory: newInv }, roomId }); return { ...ent, inventory: newInv };
      }));
      const lootEntity: Entity = { 
          id: Date.now(), name: item.name, hp: 1, maxHp: 1, ac: 0, x: x, y: y, 
          type: 'loot', color: '#fbbf24', image: item.image, size: 0.6, conditions: [], 
          stats: { str:0, dex:0, con:0, int:0, wis:0, cha:0 }, 
          visible: true, inventory: [item], level: 0, classType: 'Item' 
      };
      setEntities(prev => [...prev, lootEntity]); 
      socket.emit('createEntity', { entity: lootEntity, roomId }); 
      addLog({ text: `🎒 ${item.name} foi jogado no chão!`, type: 'info', sender: 'Sistema' }); 
      handlePlaySFX('dado', true); 
  };

  const handleGiveItemToToken = (item: Item, sourceId: number, targetId: number) => {
      if (sourceId === targetId) return; 
      const sourceEntity = entities.find(e => e.id === sourceId); const targetEntity = entities.find(e => e.id === targetId); if (!sourceEntity || !targetEntity) return;
      const sourceInv = (sourceEntity.inventory || []).filter(i => i.id !== item.id); const targetInv = [...(targetEntity.inventory || []), { ...item, isEquipped: false }]; 
      setEntities(prev => prev.map(ent => { if (ent.id === sourceId) return { ...ent, inventory: sourceInv }; if (ent.id === targetId) return { ...ent, inventory: targetInv }; return ent; }));
      socket.emit('updateEntityStatus', { entityId: sourceId, updates: { inventory: sourceInv }, roomId }); socket.emit('updateEntityStatus', { entityId: targetId, updates: { inventory: targetInv }, roomId });
      addLog({ text: `🤝 **${sourceEntity.name}** deu **${item.name}** para **${targetEntity.name}**.`, type: 'info', sender: 'Sistema' }); handlePlaySFX('dado', true);
  };

  const handlePickUpLoot = (lootEntity: Entity) => {
      let receiver: Entity | undefined;
      if (role === 'PLAYER') { 
          receiver = entities.find(e => e.name === playerName && e.type === 'player'); 
      } else { 
          if (targetEntityIds.length > 0) receiver = entities.find(e => e.id === targetEntityIds[0]); 
      }
      
      if (!receiver) { 
          setToastMsg({ text: role === 'DM' ? "Selecione um token (Alvo vermelho) para entregar o item." : "Você não tem um personagem para pegar isso.", id: Date.now() }); 
          return; 
      }

      const item = lootEntity.inventory && lootEntity.inventory[0]; 
      if (!item) { 
          handleDeleteEntity(lootEntity.id); 
          return; 
      }

      let updates: Partial<Entity> = {};
      let logMsg = '';

      if (item.stats?.isTreasure && item.stats.coins) {
          const currentCoins = receiver.coins || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
          const incCoins = item.stats.coins;
          
          updates.coins = {
              cp: currentCoins.cp + (incCoins.cp || 0),
              sp: currentCoins.sp + (incCoins.sp || 0),
              ep: currentCoins.ep || 0,
              gp: currentCoins.gp + (incCoins.gp || 0),
              pp: currentCoins.pp || 0
          };
          
          const coinStrs = [];
          if (incCoins.gp > 0) coinStrs.push(`${incCoins.gp} PO`);
          if (incCoins.sp > 0) coinStrs.push(`${incCoins.sp} PP`);
          if (incCoins.cp > 0) coinStrs.push(`${incCoins.cp} PC`);
          
          logMsg = `💰 **${receiver.name}** recolheu **${item.name}** (${coinStrs.join(', ')}).`;
      } else {
          updates.inventory = [...(receiver.inventory || []), item];
          logMsg = `🎒 **${receiver.name}** pegou **${item.name}** do chão.`;
      }

      setEntities(prev => prev.map(ent => ent.id === receiver!.id ? { ...ent, ...updates } : ent)); 
      socket.emit('updateEntityStatus', { entityId: receiver.id, updates, roomId });
      
      handleDeleteEntity(lootEntity.id); 
      setStatusSelectionId(null); 
      addLog({ text: logMsg, type: 'info', sender: 'Sistema' }); 
      handlePlaySFX('dado', true); 
  };

  const handleContextMenuAction = (action: string, entity: Entity) => {
      switch (action) {
          case 'VIEW_STATUS': 
              setStatusSelectionId(entity.id); 
              break;
          case 'VIEW_SHEET': 
              if (role === 'DM') {
                  setActiveCharacterSheetId(entity.id);
              }
              else setStatusSelectionId(entity.id); 
              break;
          case 'WHISPER': setPrivateChatTarget(entity.name); break;
          case 'SET_ATTACKER': setAttackerId(entity.id); break;
          case 'SET_TARGET': handleSetTarget(entity.id, true); break;
          case 'TOGGLE_VISIBILITY': handleToggleVisibility(entity.id); break;
          case 'HEAL_FULL': handleUpdateHP(entity.id, entity.maxHp); break;
          case 'TOGGLE_DEAD': if (entity.hp > 0) handleUpdateHP(entity.id, -entity.hp); else handleUpdateHP(entity.id, 1); break;
      }
      setContextMenu(null);
  };

  const handlePingMap = (x: number, y: number) => {
      const myColor = role === 'DM' ? '#ef4444' : '#3b82f6'; const newPing: MapPing = { id: Date.now().toString() + Math.random(), x, y, color: myColor };
      setPings(prev => [...prev, newPing]); socket.emit('pingMap', { ping: newPing, roomId }); handlePlaySFX('ping', true); setTimeout(() => { setPings(prev => prev.filter(p => p.id !== newPing.id)); }, 2500);
  };

  const handleUpdatePosition = (id: number, newX: number, newY: number) => {
    let shouldSyncFog = false; let newFogGrid = [...fogGrid.map(row => [...row])];
    setEntities(prev => {
        return prev.map(ent => {
            if (ent.id === id) {
                const updatedEnt = { ...ent, x: newX, y: newY };
                if (updatedEnt.type === 'player' && updatedEnt.visionRadius && updatedEnt.visionRadius > 0) {
                     const radius = updatedEnt.visionRadius; const startY = Math.max(0, Math.floor(newY - radius)); const endY = Math.min(newFogGrid.length - 1, Math.ceil(newY + radius)); const startX = Math.max(0, Math.floor(newX - radius)); const endX = Math.min(newFogGrid[0].length - 1, Math.ceil(newX + radius));
                     for (let y = startY; y <= endY; y++) { for (let x = startX; x <= endX; x++) { const distance = Math.sqrt(Math.pow(x - newX, 2) + Math.pow(y - newY, 2)); if (distance <= radius && newFogGrid[y][x] === false) { newFogGrid[y][x] = true; shouldSyncFog = true; } } }
                }
                return updatedEnt;
            }
            return ent;
        });
    });
    socket.emit('updateEntityPosition', { entityId: id, x: newX, y: newY, roomId });
    if (shouldSyncFog) { setFogGrid(newFogGrid); socket.emit('syncFogGrid', { grid: newFogGrid, roomId }); }
  };

  const handleRotateToken = (id: number, angle: number) => { setEntities(prev => prev.map(ent => ent.id === id ? { ...ent, rotation: angle } : ent)); socket.emit('updateEntityStatus', { entityId: id, updates: { rotation: angle }, roomId }); };
  const handleResizeToken = (id: number, size: number) => { setEntities(prev => prev.map(ent => { if (ent.id !== id) return ent; const newVisible = ent.visible === undefined ? false : !ent.visible; if (role === 'DM') addLog({ text: newVisible ? `👁️ ${ent.name} revelou-se!` : `👻 ${ent.name} desapareceu nas sombras.`, type: 'info', sender: 'Sistema' }, false); socket.emit('updateEntityStatus', { entityId: id, updates: { visible: newVisible }, roomId }); return { ...ent, visible: newVisible }; })); };
  const handleFlipToken = (id: number) => { const ent = entities.find(e => e.id === id); if (!ent) return; const newMirrored = !ent.mirrored; setEntities(prev => prev.map(e => e.id === id ? { ...e, mirrored: newMirrored } : e)); socket.emit('updateEntityStatus', { entityId: id, updates: { mirrored: newMirrored }, roomId }); };
  const handleToggleCondition = (id: number, condition: string) => { setEntities(prev => prev.map(ent => { if (ent.id !== id) return ent; const hasCondition = ent.conditions.includes(condition); const newConditions = hasCondition ? ent.conditions.filter(c => c !== condition) : [...ent.conditions, condition]; if (!hasCondition) addLog({ text: `${ent.name} recebeu condição: ${condition}`, type: 'info', sender: 'Sistema' }); socket.emit('updateEntityStatus', { entityId: id, updates: { conditions: newConditions }, roomId }); return { ...ent, conditions: newConditions }; })); };
  const handleToggleVisibility = (id: number) => { setEntities(prev => prev.map(ent => { if (ent.id !== id) return ent; const newVisible = ent.visible === undefined ? false : !ent.visible; if (role === 'DM') addLog({ text: newVisible ? `👁️ ${ent.name} revelou-se!` : `👻 ${ent.name} desapareceu nas sombras.`, type: 'info', sender: 'Sistema' }, false); socket.emit('updateEntityStatus', { entityId: id, updates: { visible: newVisible }, roomId }); return { ...ent, visible: newVisible }; })); };
  const handleEditEntity = (id: number, updates: Partial<Entity>) => { setEntities(prev => prev.map(ent => ent.id === id ? { ...ent, ...updates } : ent)); socket.emit('updateEntityStatus', { entityId: id, updates, roomId }); };
  const handleDeleteEntity = (id: number) => { setEntities(prev => prev.filter(ent => ent.id !== id)); socket.emit('deleteEntity', { entityId: id, roomId }); if (attackerId === id) setAttackerId(null); };
  
  const handleMapDrop = (type: string, x: number, y: number) => { 
      const entityType = type as 'enemy' | 'player'; 
      const nextNum = entities.filter(e => e.type === entityType).length + 1; 
      createEntity(entityType, entityType === 'enemy' ? `Monstro ${nextNum}` : `Aliado ${nextNum}`, x, y); 
  };

  const handleFogUpdate = (x: number, y: number, shouldReveal: boolean) => { if (role !== 'DM') return; setFogGrid(prev => { const newGrid = prev.map(row => [...row]); if (newGrid[y]) newGrid[y][x] = shouldReveal; return newGrid; }); socket.emit('updateFog', { x, y, shouldReveal, roomId }); };
  const handleFogBulkUpdate = (cells: {x: number, y: number}[], shouldReveal: boolean) => { if (role !== 'DM') return; setFogGrid(prev => { const newGrid = prev.map(row => [...row]); cells.forEach(cell => { if (newGrid[cell.y] && newGrid[cell.y][cell.x] !== undefined) { newGrid[cell.y][cell.x] = shouldReveal; } }); socket.emit('syncFogGrid', { grid: newGrid, roomId }); return newGrid; }); };
  const handleResetFog = () => { const newGrid = createInitialFog(); setFogGrid(newGrid); socket.emit('syncFogGrid', { grid: newGrid, roomId }); };
  const handleRevealAll = () => { const newGrid = fogGrid.map(row => row.map(() => true)); setFogGrid(newGrid); socket.emit('syncFogGrid', { grid: newGrid, roomId }); };
  const handleSyncFog = () => { socket.emit('syncFogGrid', { grid: fogGrid, roomId }); };
  const handleChangeMap = (mapUrl: string) => { setCurrentMap(mapUrl); setFogGrid(createInitialFog()); socket.emit('changeMap', { mapUrl, roomId }); };
  const handleSaveGame = () => { socket.emit('saveGame', { roomId, entities, fogGrid, currentMap, initiativeList, activeTurnId, chatMessages, customMonsters, globalBrightness, currentTrack }); addLog({ text: "O Mestre salvou o estado da mesa no servidor.", type: 'info', sender: 'Sistema' }); };
  const handleSaveMonsterPreset = (preset: MonsterPreset) => { setCustomMonsters(prev => [...prev, preset]); addLog({ text: `Novo monstro salvo na lista: ${preset.name}`, type: 'info', sender: 'Sistema' }); };
  const handleUpdateGlobalBrightness = (val: number) => { setGlobalBrightness(val); socket.emit('updateGlobalBrightness', { brightness: val, roomId }); };

  const handleAddToInitiative = (entity: Entity) => { if (initiativeList.find(i => i.id === entity.id)) return; setInitModalEntity(entity); };
  
  const handleSubmitInitiative = (val: number) => { 
      if (!initModalEntity) return; 
      const newItem = { id: initModalEntity.id, name: initModalEntity.name, value: val }; 
      const newList = [...initiativeList, newItem].sort((a, b) => b.value - a.value); 
      setInitiativeList(newList); 
      const newActive = activeTurnId === null ? initModalEntity.id : activeTurnId; 
      setActiveTurnId(newActive); 
      
      if (activeTurnId === null && newList.length > 0) {
          setAttackerId(newList[0].id);
      }
      
      socket.emit('updateInitiative', { list: newList, activeTurnId: newActive, roomId }); 
      addLog({ text: `${initModalEntity.name} rolou Iniciativa: ${val}`, type: 'info', sender: 'Sistema' }); 
      handlePlaySFX('dado', true); 
      setInitModalEntity(null); 
  };
  const handleRemoveFromInitiative = (id: number) => { const newList = initiativeList.filter(i => i.id !== id); setInitiativeList(newList); socket.emit('updateInitiative', { list: newList, activeTurnId, roomId }); };
  
  const handleNextTurn = () => { 
      if (initiativeList.length === 0) return; 
      const nextId = initiativeList[(initiativeList.findIndex(i => i.id === activeTurnId) + 1) % initiativeList.length].id; 
      
      setActiveTurnId(nextId); 
      setAttackerId(nextId);
      setTargetEntityIds([]); 
      
      socket.emit('updateInitiative', { list: initiativeList, activeTurnId: nextId, roomId }); 
      const nextEntity = initiativeList.find(i => i.id === nextId); 
      if(nextEntity) addLog({ text: `Turno de: ${nextEntity.name}`, type: 'info', sender: 'Sistema' }); 
  };
  
  const handleClearInitiative = () => { 
      setInitiativeList([]); 
      setActiveTurnId(null); 
      setAttackerId(null);
      setTargetEntityIds([]);
      socket.emit('updateInitiative', { list: [], activeTurnId: null, roomId }); 
  };

  const handleSortInitiative = () => { const newList = [...initiativeList].sort((a, b) => b.value - a.value); setInitiativeList(newList); socket.emit('updateInitiative', { list: newList, activeTurnId, roomId }); };
  
  const handleSetTarget = (id: number | number[] | null, multiSelect: boolean = false) => { 
      if (id === null) { if (!multiSelect) setTargetEntityIds([]); return; } 
      if (Array.isArray(id)) { setTargetEntityIds(multiSelect ? Array.from(new Set([...targetEntityIds, ...id])) : id); return; } 
      setTargetEntityIds(multiSelect ? (targetEntityIds.includes(id) ? targetEntityIds.filter(tid => tid !== id) : [...targetEntityIds, id]) : [id]); 
  };
  
  const handleSetAttacker = (id: number | null) => { if (role !== 'DM') return; setAttackerId(id); };

  const handleLogin = (selectedRole: 'DM' | 'PLAYER', name: string, charData?: any) => { 
      const sessionRoomId = charData?.roomId || 'mesa-do-victor';
      setRoomId(sessionRoomId);

      setRole(selectedRole); 
      setPlayerName(name); 
      setIsLoggedIn(true); 
      setGamePhase('LOBBY'); 
      socket.emit('joinRoom', sessionRoomId); 
      
      if (selectedRole === 'PLAYER' && charData) { 
          setTimeout(() => { 
              setEntities(prev => { 
                  const existing = prev.find(e => e.name.toLowerCase() === name.toLowerCase() && e.type === 'player');
                  
                  if (!existing) { 
                      const newEntity: Entity = { id: charData.id || Date.now(), name, hp: charData.hp, maxHp: charData.maxHp, ac: charData.ac, x: 8, y: 6, rotation: charData.rotation || 0, mirrored: charData.mirrored || false, conditions: charData.conditions || [], color: '#3b82f6', type: 'player', image: charData.image, tokenImage: charData.tokenImage || charData.image, stats: charData.stats, classType: charData.classType, visionRadius: charData.visionRadius || 9, size: charData.size || 2, xp: charData.xp || 0, level: charData.level || 1, inventory: charData.inventory || [], race: charData.race || 'Humano', visible: charData.visible !== false, proficiencies: charData.proficiencies || {}, deathSaves: charData.deathSaves || { successes: 0, failures: 0 }, inspiration: charData.inspiration || false, spellSlots: charData.spellSlots || {}, spells: charData.spells || [], coins: charData.coins || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 } }; 
                      socket.emit('createEntity', { entity: newEntity, roomId: sessionRoomId }); 
                      return [...prev, newEntity]; 
                  } else {
                      if (charData.id && charData.id !== existing.id) {
                          charData.id = existing.id;
                          localStorage.setItem('nexus_last_char', JSON.stringify(charData));
                      }
                  }
                  return prev; 
              }); 
          }, 1500); 
      } 
  };
  
  const handleStartGame = () => { 
      socket.emit('startGame', { roomId }); 
  };

  const selectedStatusEntity = statusSelectionId ? entities.find(e => e.id === statusSelectionId) : null;
  let modalPosition = { top: 0, left: 0 };
  
  if (selectedStatusEntity) { 
      const canvasOffsetX = (windowSize.w - CANVAS_WIDTH) / 2; 
      const canvasOffsetY = (windowSize.h - CANVAS_HEIGHT) / 2; 
      const tokenPixelX = (selectedStatusEntity.x * GRID_SIZE * mapScale) + mapOffset.x + canvasOffsetX; 
      const tokenPixelY = (selectedStatusEntity.y * GRID_SIZE * mapScale) + mapOffset.y + canvasOffsetY; 
      
      const SIDEBAR_WIDTH = 420; 
      const MODAL_WIDTH = 260;
      const MODAL_HEIGHT = 320;

      modalPosition.left = tokenPixelX + ((selectedStatusEntity.size || 1) * GRID_SIZE * mapScale) + 20;
      modalPosition.top = tokenPixelY;

      if (modalPosition.left + MODAL_WIDTH > windowSize.w - SIDEBAR_WIDTH) {
          modalPosition.left = tokenPixelX - MODAL_WIDTH - 20;
      }

      if (modalPosition.left < 10) modalPosition.left = 10;
      if (modalPosition.top + MODAL_HEIGHT > windowSize.h - 20) {
          modalPosition.top = windowSize.h - MODAL_HEIGHT - 20;
      }
      if (modalPosition.top < 20) modalPosition.top = 20;
  }

  const handleSaveNewAlly = (id: number, data: Partial<Entity>) => { 
      const nextNum = entities.filter(e => e.type === 'player').length + 1; 
      const finalName = data.name || `Aliado ${nextNum}`; 
      const pos = getCenterGridPosition();
      createEntity('player', finalName, pos.x, pos.y, { ...data, name: finalName, size: data.size || 2 }); 
      setShowAllyCreator(false); 
  };
  const handleSaveNewEnemy = (data: Partial<Entity>) => { 
      const nextNum = entities.filter(e => e.type === 'enemy').length + 1; 
      const pos = getCenterGridPosition();
      createEntity('enemy', data.name || `Monstro ${nextNum}`, pos.x, pos.y, data); 
      setShowEnemyCreator(false); 
  };

  const handlePlayerDropItem = (itemId: string) => {
      const myEntity = entities.find(e => e.name === playerName && e.type === 'player');
      if (!myEntity) return;
      const itemToDrop = myEntity.inventory?.find(i => i.id === itemId);
      if (!itemToDrop) return;
      handleDropLootOnMap(itemToDrop, myEntity.id, myEntity.x, myEntity.y);
  };

  const handleAddEntity = (type: 'enemy' | 'player', name: string, customStats?: MonsterPreset) => { 
      const pos = getCenterGridPosition();
      createEntity(type, name, pos.x, pos.y, customStats as Partial<Entity>); 
  };

  if (!isLoggedIn) return <LoginScreen onLogin={handleLogin} availableClasses={availableClasses} availableRaces={availableRaces} />;
  
  if (gamePhase === 'LOBBY') return <Lobby availableCharacters={entities.filter(e => e.type === 'player')} onStartGame={handleStartGame} myPlayerName={playerName} roomCode={roomId} />;

  const isMobilePlayer = role === 'PLAYER' && windowSize.w <= 1024;
  const myCharacter = isMobilePlayer ? entities.find(e => e.name === playerName && e.type === 'player') : null;

  const myName = role === 'DM' ? 'MESTRE' : playerName;
  const publicChatMessages = chatMessages.filter(msg => !msg.isWhisper);
  const privateMessages = chatMessages.filter(msg => {
      if (!msg.isWhisper || !privateChatTarget) return false;
      const sender = msg.sender.toLowerCase();
      const target = msg.whisperTarget?.toLowerCase() || '';
      const me = myName.toLowerCase();
      const partner = privateChatTarget.toLowerCase();
      
      const targetIsMe = target === me || (role === 'DM' && target === 'mestre');
      const targetIsPartner = target === partner || (role === 'DM' && partner === 'mestre');

      return (sender === me && targetIsPartner) || (sender === partner && targetIsMe);
  });

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-rpgBg" onClick={() => { if (Howler.ctx && Howler.ctx.state !== 'running') Howler.ctx.resume(); }}>
      
      {toastMsg && (
        <div 
           onClick={() => { if (toastMsg.sender) setPrivateChatTarget(toastMsg.sender); setToastMsg(null); }}
           className={`fixed top-5 left-1/2 -translate-x-1/2 z-[400] bg-gray-900 border px-6 py-3 rounded-xl animate-in slide-in-from-top-5 fade-in duration-300 flex items-center gap-3 ${toastMsg.sender ? 'border-pink-500/50 text-pink-50 shadow-[0_0_20px_rgba(236,72,153,0.4)] cursor-pointer hover:bg-gray-800' : 'border-cyan-500/50 text-cyan-50 shadow-[0_0_20px_rgba(6,182,212,0.4)]'}`}
        >
            <span className="text-xl">🔔</span><span className="font-bold tracking-wider">{toastMsg.text}</span>
        </div>
      )}

      {damageOverlayData && (
          <DamageOverlay data={damageOverlayData} onComplete={() => setDamageOverlayData(null)} />
      )}

      {privateChatTarget && (
          <div className="fixed bottom-4 right-[450px] z-[300] w-80 bg-gray-900 border border-pink-500/50 rounded-t-xl rounded-bl-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
              <div className="bg-gradient-to-r from-pink-900 to-purple-900 p-2 flex justify-between items-center border-b border-pink-500/30 shadow-md">
                  <span className="text-pink-100 font-bold text-xs uppercase tracking-widest flex items-center gap-2">🤫 {privateChatTarget}</span>
                  <button onClick={() => setPrivateChatTarget(null)} className="text-pink-300 hover:text-white transition-colors text-lg">✕</button>
              </div>
              <div className="h-64 overflow-y-auto p-3 flex flex-col gap-2 bg-[#111] custom-scrollbar">
                  {privateMessages.length === 0 && (<p className="text-gray-600 text-xs italic text-center mt-4">Início da conversa secreta...</p>)}
                  {privateMessages.map(msg => (
                      <div key={msg.id} className={`p-2 rounded max-w-[85%] text-xs shadow-md ${msg.sender.toLowerCase() === myName.toLowerCase() ? 'bg-pink-900/40 text-pink-100 self-end border border-pink-700/50 rounded-tr-none' : 'bg-gray-800 text-gray-200 self-start border border-gray-600 rounded-tl-none'}`}>
                          <span className="font-bold opacity-50 text-[9px] block mb-1">{msg.sender}</span>
                          <span dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>') }} />
                      </div>
                  ))}
                  <div ref={chatEndRef} />
              </div>
              <form onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.currentTarget.elements.namedItem('msg') as HTMLInputElement;
                  if(input.value.trim()){
                      const targetName = privateChatTarget.includes(' ') ? `"${privateChatTarget}"` : privateChatTarget;
                      handleSendMessage(`/w ${targetName} ${input.value}`);
                      input.value = '';
                  }
              }} className="p-2 bg-gray-900 border-t border-pink-500/30 flex gap-2">
                  <input name="msg" autoFocus type="text" placeholder="Sussurro secreto..." className="flex-1 bg-black/50 border border-pink-500/30 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-pink-400 transition-colors" />
                  <button type="submit" className="bg-pink-700 hover:bg-pink-600 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors shadow">Enviar</button>
              </form>
          </div>
      )}

      {initModalEntity && (<InitiativeModal entity={initModalEntity} onClose={() => setInitModalEntity(null)} onConfirm={handleSubmitInitiative} />)}
      
      {editingEntity && (<EditEntityModal entity={editingEntity} onSave={(id, updates) => { handleEditEntity(id, updates); setEditingEntity(null); }} onClose={() => setEditingEntity(null)} availableClasses={availableClasses} availableRaces={availableRaces} />)}
      
      {activeCharacterSheetId && entities.find(e => e.id === activeCharacterSheetId) && (
          <CharacterSheetFloating 
              character={entities.find(e => e.id === activeCharacterSheetId)!} 
              onClose={() => setActiveCharacterSheetId(null)} 
              onRollAttribute={handleAttributeRoll}
              onUpdateHP={handleUpdateHP}
              onUpdateCharacter={handleEditEntity}
              availableSpells={availableSpells}
              onDropItem={(itemId) => {
                  const char = entities.find(e => e.id === activeCharacterSheetId);
                  if (char) {
                      const item = char.inventory?.find(i => i.id === itemId);
                      if (item) handleDropLootOnMap(item, char.id, char.x, char.y);
                  }
              }}
              onCastSpell={(spell) => {
                  const prefix = spell.level === 0 ? "o truque " : `a magia de nível ${spell.level} `;
                  handleSendMessage(`conjurou **${prefix}** **${spell.name}**`);
              }}
          />
      )}
      
      <BaldursDiceRoller 
        isOpen={showBgDice} 
        onClose={() => setShowBgDice(false)} 
        title={diceContext.title} 
        subtitle={diceContext.subtitle} 
        difficultyClass={diceContext.dc} 
        baseModifier={diceContext.mod || 0} 
        proficiency={diceContext.prof || 0} 
        rollType={diceContext.rollType || 'normal'} 
        extraBonuses={diceContext.bonuses}
        isDamage={diceContext.isDamage}
        damageExpression={diceContext.damageExpression}
        onComplete={handleDiceComplete} 
      />

      {isMobilePlayer && myCharacter ? (
          <MobilePlayerSheet 
              character={myCharacter} 
              onUpdateHP={handleUpdateHP} 
              onRollAttribute={handleAttributeRoll} 
              onOpenDiceRoller={openDiceRoller} 
              onUpdateCharacter={handleEditEntity} 
              chatMessages={publicChatMessages}
              onSendMessage={handleSendMessage}
              onApplyDamageFromChat={handleApplyDamageFromChat}
              onDropItem={handlePlayerDropItem} 
              availableSpells={availableSpells} 
          />
      ) : (
          <>
            {selectedStatusEntity && (
                <div 
                    className="fixed z-[500] bg-gradient-to-b from-slate-900/98 to-black border border-amber-500/40 p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] text-amber-50 w-64 backdrop-blur-2xl animate-in fade-in zoom-in duration-200 font-sans pointer-events-auto" 
                    style={{ top: modalPosition.top, left: modalPosition.left }}
                >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
                    <div className="flex justify-between items-center mb-3 relative z-10">
                        <h3 className="text-[10px] font-black tracking-[0.2em] text-amber-500 uppercase flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            {selectedStatusEntity.type === 'loot' || selectedStatusEntity.classType === 'Item' ? 'Tesouro' : 'Status'}
                        </h3>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setStatusSelectionId(null);
                            }} 
                            className="w-6 h-6 flex items-center justify-center rounded-full bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all border border-white/10"
                        >
                            ✕
                        </button>
                    </div>
                    
                    {selectedStatusEntity.type === 'loot' || selectedStatusEntity.classType === 'Item' ? (
                        <div className="flex flex-col items-center gap-4 relative z-10">
                            <div className="w-24 h-24 relative flex items-center justify-center group">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(217,119,6,0.3)_0%,transparent_70%)] group-hover:scale-110 transition-transform duration-500"></div>
                                {selectedStatusEntity.image ? (
                                    <img src={selectedStatusEntity.image} alt="Item" className="w-16 h-16 object-contain relative z-10 drop-shadow-[0_5px_10px_rgba(0,0,0,0.5)]" />
                                ) : (
                                    <span className="text-4xl relative z-10">🎁</span>
                                )}
                            </div>
                            <h2 className="text-sm font-black text-amber-100 text-center uppercase tracking-tight">{selectedStatusEntity.name}</h2>
                            <button onClick={() => handlePickUpLoot(selectedStatusEntity)} className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-black font-black uppercase text-[10px] rounded-lg transition-all active:scale-95 border border-amber-400/50 shadow-lg">
                                Recolher Saque
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="flex gap-3 mb-4 items-center">
                                <div onClick={() => {
                                    if (role === 'DM' || (role === 'PLAYER' && selectedStatusEntity.name === playerName)) {
                                        setActiveCharacterSheetId(selectedStatusEntity.id);
                                    }
                                }} className={`w-14 h-14 rounded-lg border-2 border-cyan-400/50 overflow-hidden shrink-0 relative ${(role === 'DM' || (role === 'PLAYER' && selectedStatusEntity.name === playerName)) ? 'cursor-pointer hover:border-cyan-400' : ''}`}>
                                    {selectedStatusEntity.image ? <img src={selectedStatusEntity.tokenImage || selectedStatusEntity.image} alt={selectedStatusEntity.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-cyan-900" />}
                                </div>
                                <div className="overflow-hidden">
                                    <div className="text-white font-bold text-sm truncate uppercase tracking-tighter">{selectedStatusEntity.name}</div>
                                    <div className="text-cyan-400 text-[10px] font-black uppercase">{selectedStatusEntity.classType || 'N/A'}</div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-[9px] font-black mb-1 uppercase tracking-widest text-cyan-500">
                                        <span>Integridade</span>
                                        <span>{selectedStatusEntity.hp}/{selectedStatusEntity.maxHp}</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-950 rounded-full border border-white/5 overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-cyan-600 to-blue-500 transition-all duration-500" style={{ width: `${(selectedStatusEntity.hp / selectedStatusEntity.maxHp) * 100}%` }}></div>
                                    </div>
                                </div>
                                {selectedStatusEntity.stats && (
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {Object.entries(selectedStatusEntity.stats).map(([stat, value]) => {
                                            const mod = Math.floor((Number(value) - 10) / 2);
                                            return (
                                                <div key={stat} className="bg-white/5 border border-white/5 rounded p-1 text-center">
                                                    <div className="text-[8px] text-gray-500 uppercase font-bold">{stat}</div>
                                                    <div className="text-xs font-black text-white">{mod >= 0 ? `+${mod}` : mod}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
            
            {showAllyCreator && (<EditEntityModal entity={{ id: 0, name: '', hp: 20, maxHp: 20, ac: 12, x:0, y:0, type: 'player', color: '', conditions: [], mirrored: false, size: 2, inventory: [] }} onSave={(id, updates) => handleSaveNewAlly(id, updates)} onClose={() => setShowAllyCreator(false)} availableClasses={availableClasses} availableRaces={availableRaces} />)}
            {showEnemyCreator && (<MonsterCreatorModal onSave={handleSaveNewEnemy} onSavePreset={handleSaveMonsterPreset} onClose={() => setShowEnemyCreator(false)} />)}
            {contextMenu && (<ContextMenu x={contextMenu.x} y={contextMenu.y} entity={contextMenu.entity} role={role} onClose={() => setContextMenu(null)} onAction={handleContextMenuAction} />)}
            
            <main className="relative flex-grow h-full overflow-hidden bg-black text-white">
                <div className="absolute top-4 left-4 z-[150] pointer-events-none opacity-50"><span className={`text-[10px] font-bold px-2 py-1 rounded border ${role === 'DM' ? 'bg-red-900 border-red-500' : 'bg-blue-900 border-blue-500'}`}>{role === 'DM' ? 'Mestre Supremo' : `Jogador: ${playerName}`}</span></div>
                <GameMap 
                    mapUrl={currentMap} gridSize={GRID_SIZE} entities={entities} role={role} fogGrid={fogGrid} isFogMode={isFogMode} fogTool={fogTool} activeTurnId={activeTurnId}
                    onFogUpdate={handleFogUpdate} onFogBulkUpdate={handleFogBulkUpdate} fogShape={fogShape}
                    onMoveToken={handleUpdatePosition} onAddToken={handleMapDrop} onRotateToken={handleRotateToken}
                    onResizeToken={handleResizeToken} 
                    targetEntityIds={targetEntityIds} attackerId={attackerId} onSetTarget={handleSetTarget}
                    onSetAttacker={handleSetAttacker} onFlipToken={handleFlipToken} activeAoE={activeAoE} onAoEComplete={() => setActiveAoE(null)} aoeColor={aoeColor} 
                    externalOffset={mapOffset} externalScale={mapScale} onMapChange={handleMapSync} focusEntity={focusEntity} globalBrightness={globalBrightness}
                    onDropItem={handleDropLootOnMap} onGiveItemToToken={handleGiveItemToToken} 
                    pings={pings} onPing={handlePingMap}
                    onSelectEntity={(entity) => { if (entity.classType === 'Item' || entity.type === 'loot') setStatusSelectionId(entity.id); }} 
                    onTokenDoubleClick={(entity) => { 
                        if (entity.classType === 'Item' || entity.type === 'loot') {
                            setStatusSelectionId(entity.id); 
                        } else {
                            if (role === 'DM' || (role === 'PLAYER' && entity.name === playerName)) {
                                setActiveCharacterSheetId(entity.id);
                            }
                        }
                    }} 
                    onContextMenu={(e, entity) => { 
                        e.preventDefault();
                        if (entity.classType === 'Item' || entity.type === 'loot') setStatusSelectionId(entity.id); 
                        else setContextMenu({ x: e.clientX, y: e.clientY, entity }); 
                    }} 
                />
                <div className="fixed bottom-6 right-[450px] z-[130] pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <button onClick={openDiceRoller} className="group relative flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-900 to-purple-900 rounded-full border-2 border-yellow-500 shadow-[0_0_20px_rgba(168,85,247,0.6)] hover:scale-110 transition-all duration-300" title="Rolar Dado (Estilo BG3)"><span className="text-3xl filter drop-shadow-md group-hover:rotate-12 transition-transform">🎲</span><div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full text-[10px] flex items-center justify-center border border-white font-bold animate-pulse">!</div></button>
                </div>
            </main>
            <aside className="w-auto flex-shrink-0 border-l border-rpgAccent/20 bg-rpgPanel shadow-2xl z-[140]">
                {role === 'DM' 
                ? <SidebarDM 
                    entities={entities} onUpdateHP={handleUpdateHP} onAddEntity={handleAddEntity} onDeleteEntity={handleDeleteEntity} onEditEntity={handleEditEntity} 
                    isFogMode={isFogMode} onToggleFogMode={() => setIsFogMode(!isFogMode)} fogTool={fogTool} onSetFogTool={setFogTool} 
                    fogShape={fogShape} onSetFogShape={setFogShape}
                    onSyncFog={handleSyncFog} onResetFog={handleResetFog} onRevealAll={handleRevealAll} onSaveGame={handleSaveGame} onChangeMap={handleChangeMap} 
                    initiativeList={initiativeList} activeTurnId={activeTurnId} onAddToInitiative={handleAddToInitiative} onRemoveFromInitiative={handleRemoveFromInitiative} onNextTurn={handleNextTurn} onClearInitiative={handleClearInitiative} onSortInitiative={handleSortInitiative} targetEntityIds={targetEntityIds} attackerId={attackerId} onSetTarget={handleSetTarget} onToggleCondition={handleToggleCondition} onSetAttacker={handleSetAttacker} activeAoE={activeAoE} onSetAoE={setActiveAoE} chatMessages={publicChatMessages} onSendMessage={handleSendMessage} aoeColor={aoeColor} onSetAoEColor={setAoEColor} onOpenCreator={(type) => { if (type === 'player') setShowAllyCreator(true); if (type === 'enemy') setShowEnemyCreator(true); }} onAddXP={handleAddXP} customMonsters={customMonsters} globalBrightness={globalBrightness} onSetGlobalBrightness={handleUpdateGlobalBrightness} onRequestRoll={handleDmRequestRoll} onToggleVisibility={handleToggleVisibility} currentTrack={currentTrack} onPlayMusic={handlePlayMusic} onStopMusic={handleStopMusic} onPlaySFX={handlePlaySFX} audioVolume={audioVolume} onSetAudioVolume={setAudioVolume} onResetView={handleResetView} onGiveItem={handleGiveItem} onApplyDamageFromChat={handleApplyDamageFromChat} onDMRoll={handleDMRoll} 
                    onLongRest={handleLongRest} 
                    
                    availableItems={availableItems} 
                    availableConditions={availableConditions}
                    onOpenLootGenerator={() => setShowLootGenerator(true)}
                    onRequestInitiative={handleRequestInitiative}
                    onRequestCustomRoll={handleRequestCustomRoll} // 👉 NOVO: Passado para a Sidebar
                    /> 
                : <SidebarPlayer entities={entities} myCharacterName={playerName} myCharacterId={entities.find(e => e.name === playerName)?.id || 0} initiativeList={initiativeList} activeTurnId={activeTurnId} chatMessages={publicChatMessages} onSendMessage={handleSendMessage} onRollAttribute={handleAttributeRoll} onUpdateCharacter={handleEditEntity} onSelectEntity={(entity) => { setFocusEntity(entity); setTimeout(() => setFocusEntity(null), 100); }} onApplyDamageFromChat={handleApplyDamageFromChat} />
                }
            </aside>
          </>
      )}

      {showLootGenerator && (
          <LootGeneratorModal 
              onClose={() => setShowLootGenerator(false)}
              onGenerate={(options: any) => socket.emit('requestRandomLoot', { ...options, roomId })}
          />
      )}
    </div>
  );
}

export default App;