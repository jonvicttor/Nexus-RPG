import React, { useState, useEffect, useRef, useCallback } from 'react';
import socket from './services/socket';
import { Howl } from 'howler';
import GameMap from './components/GameMap'; 
import SidebarDM, { InitiativeItem } from './components/SidebarDM';
import SidebarPlayer from './components/SidebarPlayer';
import LoginScreen from './components/LoginScreen'; 
import Lobby from './components/Lobby'; 
import { ChatMessage } from './components/Chat';
import EditEntityModal from './components/EditEntityModal';
import UniversalDiceRoller, { RollBonus } from './components/UniversalDiceRoller'; 
import { getLevelFromXP } from './utils/gameRules';
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
  resistances?: string[]; 
  vulnerabilities?: string[];
  immunities?: string[];
  dmNotes?: string;
  customActions?: any[]; 
  details?: {
    background?: string; alignment?: string; faith?: string; lifestyle?: string; personalityTraits?: string;
    ideals?: string; bonds?: string; flaws?: string; backgroundDesc?: string;
    physical?: { age?: string; gender?: string; height?: string; weight?: string; eyes?: string; skin?: string; hair?: string; };
    [key: string]: any;
  };
}

export interface MonsterPreset {
  name: string; hp: number; ac: number; image: string; tokenImage?: string; size?: number;
  resistances?: string[]; vulnerabilities?: string[]; immunities?: string[];
}

export interface MapPing {
  id: string; x: number; y: number; color: string;
}

export interface QueuedRoll {
  title: string; subtitle: string; mod: number; dc: number; entityId: number | null; targetName: string;
  isDamage?: boolean; damageExpression?: string; isCustomNoDamage?: boolean; damageType?: string; 
}

export interface FogRoom {
  id: string; name: string; cells: { x: number, y: number }[];
}

export interface Wall {
  id: string; x1: number; y1: number; x2: number; y2: number;
}

const getLineIntersection = (p0x: number, p0y: number, p1x: number, p1y: number, p2x: number, p2y: number, p3x: number, p3y: number) => {
    const s1x = p1x - p0x; const s1y = p1y - p0y;
    const s2x = p3x - p2x; const s2y = p3y - p2y;
    const denom = -s2x * s1y + s1x * s2y;
    if (denom === 0) return null; 
    const s = (-s1y * (p0x - p2x) + s1x * (p0y - p2y)) / denom;
    const t = ( s2x * (p0y - p2y) - s2y * (p0x - p2x)) / denom;
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
        return { x: p0x + (t * s1x), y: p0y + (t * s1y) };
    }
    return null;
};

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
                <div className="text-white text-lg bg-black/60 px-6 py-2 rounded-full border border-red-500/30 flex flex-col items-center gap-1 shadow-lg">
                    <span>🎯 Alvo: <span className="font-bold text-red-400">{data.targetName}</span></span>
                    {data.damageType && (
                        <span className={`text-[10px] uppercase font-bold tracking-widest bg-white/10 px-2 py-0.5 rounded shadow-inner ${data.damageModifier === 'immune' ? 'text-gray-400 line-through' : data.damageModifier === 'resistant' ? 'text-blue-400' : data.damageModifier === 'vulnerable' ? 'text-red-400 animate-pulse' : 'text-amber-400'}`}>
                            {data.damageModifier === 'immune' ? 'Imune a ' : data.damageModifier === 'resistant' ? 'Resistente a ' : data.damageModifier === 'vulnerable' ? 'Vulnerável a ' : 'Elemento: '}{data.damageType}
                        </span>
                    )}
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
                        <span className={`text-[10rem] leading-none font-black text-transparent bg-clip-text drop-shadow-[0_10px_20px_rgba(220,38,38,0.8)] ${data.damageModifier === 'immune' ? 'bg-gradient-to-b from-gray-400 to-gray-600' : data.damageModifier === 'resistant' ? 'bg-gradient-to-b from-blue-300 to-blue-600' : 'bg-gradient-to-b from-white via-red-500 to-red-950'}`} style={{ fontFamily: '"Cinzel Decorative", serif' }}>
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
  
  const [walls, setWalls] = useState<Wall[]>([]); 
  
  const [isFogMode, setIsFogMode] = useState(false);
  const [fogTool, setFogTool] = useState<string>('reveal'); 
  const [fogShape, setFogShape] = useState<'brush' | 'rect' | 'line'>('brush'); 
  const [fogRooms, setFogRooms] = useState<FogRoom[]>([]);
  const [pendingRoomCells, setPendingRoomCells] = useState<{x: number, y: number}[] | null>(null);

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

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, entity: Entity } | null>(null);
  const [activeCharacterSheetId, setActiveCharacterSheetId] = useState<number | null>(null);

  const [customMonsters, setCustomMonsters] = useState<MonsterPreset[]>([]); 
  const [availableClasses, setAvailableClasses] = useState<any[]>([]); 
  const [availableSpells, setAvailableSpells] = useState<any[]>([]); 
  const [availableItems, setAvailableItems] = useState<any[]>([]); 
  const [availableRaces, setAvailableRaces] = useState<any[]>([]); 
  const [availableConditions, setAvailableConditions] = useState<any[]>([]); 

  const [globalBrightness, setGlobalBrightness] = useState(1);              

  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [mapScale, setMapScale] = useState(1);
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  const [showBgDice, setShowBgDice] = useState(false);
  const [showLootGenerator, setShowLootGenerator] = useState(false); 
  
  const [privateChatTarget, setPrivateChatTarget] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [damageOverlayData, setDamageOverlayData] = useState<any>(null);

  const [rollQueue, setRollQueue] = useState<QueuedRoll[]>([]);
  const [diceRollId, setDiceRollId] = useState(0);

  const [diceContext, setDiceContext] = useState({
      title: 'Teste Geral', subtitle: 'Sorte', dc: 15, mod: 0, prof: 0, bonuses: [] as RollBonus[], 
      rollType: 'normal' as 'normal' | 'advantage' | 'disadvantage', entityId: null as number | null,
      targetName: '', isDamage: false, damageExpression: '1d20', isCustomNoDamage: false, damageType: 'Físico' 
  });

  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [audioVolume, setAudioVolume] = useState(0.5);
  const activeMusicRef = useRef<Howl | null>(null);

  const [pings, setPings] = useState<MapPing[]>([]);
  const [toastMsg, setToastMsg] = useState<{text: string, id: number, sender?: string} | null>(null);

  const ignoreNextDiceSound = useRef(false);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
              setTargetEntityIds([]);
              setAttackerId(null);
              setStatusSelectionId(null);
              setActiveAoE(null);
              setActiveCharacterSheetId(null);
              setContextMenu(null);
              setPendingRoomCells(null);
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
      const closeMenu = () => setContextMenu(null);
      window.addEventListener('click', closeMenu);
      return () => window.removeEventListener('click', closeMenu);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, entity: Entity) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, entity });
  }, []);

  useEffect(() => {
      if (rollQueue.length > 0 && !showBgDice) {
          const nextRoll = rollQueue[0];
          setDiceContext({
              title: nextRoll.title, subtitle: nextRoll.subtitle, dc: nextRoll.dc, mod: nextRoll.mod, prof: 0,
              bonuses: [], rollType: 'normal', entityId: nextRoll.entityId, targetName: nextRoll.targetName,
              isDamage: nextRoll.isDamage || false, damageExpression: nextRoll.damageExpression || '1d20',
              isCustomNoDamage: nextRoll.isCustomNoDamage || false, damageType: nextRoll.damageType || 'Físico' 
          });
          setDiceRollId(prev => prev + 1); 
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
    return () => { socket.off('compendiumSync', handleCompendiumSync); socket.off('connect', handleConnect); };
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
    if (toastMsg && !toastMsg.sender) { const timer = setTimeout(() => { setToastMsg(null); }, 4500); return () => clearTimeout(timer); }
    if (toastMsg && toastMsg.sender) { const timer = setTimeout(() => setToastMsg(null), 10000); return () => clearTimeout(timer); }
  }, [toastMsg]);

  useEffect(() => {
    const handleResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
      if (privateChatTarget && chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
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
          spellSlots: customStats?.spellSlots || {}, spells: customStats?.spells || [], coins: customStats?.coins || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
          resistances: customStats?.resistances || [], vulnerabilities: customStats?.vulnerabilities || [], immunities: customStats?.immunities || [],
          dmNotes: customStats?.dmNotes || '', details: customStats?.details || {}
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
      
      if (gameState.walls) setWalls(gameState.walls);
      
      if (gameState.currentMap) setCurrentMap(gameState.currentMap);
      if (gameState.initiativeList) setInitiativeList(gameState.initiativeList);
      if (gameState.activeTurnId) setActiveTurnId(gameState.activeTurnId);
      if (gameState.chatHistory) setChatMessages(gameState.chatHistory);
      if (gameState.customMonsters) setCustomMonsters(gameState.customMonsters);
      if (gameState.globalBrightness !== undefined) setGlobalBrightness(gameState.globalBrightness);
      if (gameState.currentTrack) handlePlayMusic(gameState.currentTrack, false);
      if (gameState.fogRooms) setFogRooms(gameState.fogRooms);
      
      if (gameState.availableClasses) setAvailableClasses(gameState.availableClasses);
      if (gameState.availableSpells) setAvailableSpells(gameState.availableSpells);
      if (gameState.availableItems) setAvailableItems(gameState.availableItems);
      if (gameState.availableRaces) setAvailableRaces(gameState.availableRaces);
      if (gameState.availableConditions) setAvailableConditions(gameState.availableConditions); 
    });

    socket.on('fogGridSynced', (data: any) => { 
        setFogGrid(data.grid); 
        if (data.walls !== undefined) {
            setWalls(data.walls);
        }
    });

    socket.on('wallsUpdated', (data: any) => { if(data.walls) setWalls(data.walls); });
    socket.on('fogRoomsUpdated', (data: any) => { if(data.rooms) setFogRooms(data.rooms); });
    socket.on('notification', (data: any) => { setToastMsg({ text: data.message, id: Date.now() }); });
    socket.on('gameStarted', () => { setGamePhase('GAME'); addLog({ text: "A aventura começou! O Mestre abriu os portões.", type: 'info', sender: 'Sistema' }); });
    socket.on('newDiceResult', () => { if (!ignoreNextDiceSound.current) { playSound('dado'); } });
    
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
        setChatMessages(prev => { if (prev.some(m => m.id === msg.id)) return prev; return [...prev, msg]; });
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
                setTimeout(() => { window.location.reload(); }, 3000);
            }
            return prev.filter(ent => ent.id !== data.entityId);
        }); 
        setStatusSelectionId(prev => prev === data.entityId ? null : prev); 
        setAttackerId(prev => prev === data.entityId ? null : prev); 
    });

    socket.on('mapChanged', (data: any) => { setCurrentMap(data.mapUrl); setFogGrid(data.fogGrid); setWalls([]); });
    socket.on('fogUpdated', (data: any) => { setFogGrid(prev => { if (!prev || !prev[data.y]) return prev; const newGrid = prev.map(row => [...row]); newGrid[data.y][data.x] = data.shouldReveal; return newGrid; }); });
    
    socket.on('initiativeUpdated', (data: any) => { setInitiativeList(data.list); setActiveTurnId(data.activeTurnId); });
    socket.on('triggerAudio', (data: any) => { if (data.trackId === 'suspense') handlePlayMusic('suspense', false); });
    socket.on('mapStateUpdated', (data: any) => { if (role === 'PLAYER') { setMapOffset(data.offset); setMapScale(data.scale); } });
    socket.on('globalBrightnessUpdated', (data: any) => { setGlobalBrightness(data.brightness); });

    socket.on('dmRequestRoll', (data: any) => {
        if (role === 'PLAYER') {
            setEntities(currentEntities => {
                const myChar = currentEntities.find(e => e.name.toLowerCase() === playerName.toLowerCase() && e.id === data.targetId);
                const isMyChar = myChar || currentEntities.some(e => e.id === data.targetId && e.type === 'player' && e.name.toLowerCase() === playerName.toLowerCase());
                if (isMyChar) {
                    const charName = myChar ? myChar.name : playerName;
                    const charId = myChar ? myChar.id : data.targetId;
                    setRollQueue(prev => [...prev, {
                        title: data.skillName, subtitle: `Exigido pelo Mestre`, mod: data.mod, dc: data.dc, entityId: charId,
                        targetName: charName, isDamage: data.isDamage || false, damageExpression: data.damageExpression || '1d20',
                        isCustomNoDamage: data.isCustomNoDamage || false
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
      socket.off('gameStarted'); socket.off('fogRoomsUpdated'); socket.off('wallsUpdated');
    };
  }, [isLoggedIn, addLog, role, playerName, handlePlayMusic, handleStopMusic, handlePlaySFX, playSound]); 

  useEffect(() => {
      const handleLootGenerated = (data: any) => {
          const pos = getCenterGridPosition();
          data.loot.forEach((item: any, index: number) => {
              createEntity('loot', `Saque: ${item.name}`, pos.x + (index % 3), pos.y + Math.floor(index / 3), {
                  inventory: [{ ...item, id: Date.now().toString() + index, quantity: 1, isEquipped: false }],
                  image: item.image || '/tokens/loot.png', classType: 'Item', size: 0.8
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
              dmQueue.push({ title: 'Iniciativa', subtitle: `Teste para ${ent.name}`, mod: dexMod, dc: 0, entityId: id, targetName: ent.name });
          }
      });
      if (playerPushed) addLog({ text: `⚔️ O Mestre exigiu que os aventureiros selecionados rolem suas Iniciativas!`, type: 'info', sender: 'Sistema' });
      if (dmQueue.length > 0) setRollQueue(prev => [...prev, ...dmQueue]);
      setTargetEntityIds([]);
  };

  const handleRequestCustomRoll = (targetIds: number[], expression: string, title: string) => {
      if (targetIds.length === 0) {
           setRollQueue(prev => [...prev, { title: title, subtitle: 'Rolagem Customizada', dc: 0, mod: 0, entityId: null, targetName: 'Mestre', isDamage: true, damageExpression: expression, isCustomNoDamage: true }]);
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
               dmQueue.push({ title: title, subtitle: `Rolagem para ${ent.name}`, dc: 0, mod: 0, entityId: id, targetName: ent.name, isDamage: true, damageExpression: expression, isCustomNoDamage: true });
           }
      });
      if (playerPushed) addLog({ text: `⚔️ O Mestre exigiu uma rolagem de **${expression}** (${title})!`, type: 'info', sender: 'Sistema' });
      if (dmQueue.length > 0) setRollQueue(prev => [...prev, ...dmQueue]);
      setTargetEntityIds([]);
  };
  
  const handleAttributeRoll = (charName: string, attrName: string, mod: number, damageExpr?: string, damageType?: string) => { 
      setRollQueue(prev => [...prev, { title: attrName, subtitle: `Ação de Combate`, dc: 10, mod, entityId: null, targetName: charName, damageExpression: damageExpr, damageType: damageType || 'Físico' }]);
  };

  const handleApplyDamageFromChat = (targetId: number, damageExpression: string) => {
        const target = entities.find(e => e.id === targetId);
        if (!target) return;
        const rollMatch = damageExpression.match(/^(\d+)d(\d+)(\+(\d+))?$/i);
        if (rollMatch) {
            setRollQueue(prev => [...prev, { title: `Dano em ${target.name}`, subtitle: damageExpression, dc: 0, mod: 0, entityId: targetId, targetName: target.name, isDamage: true, damageExpression: damageExpression }]);
        } else { 
            const totalDano = parseInt(damageExpression) || 0; 
            if (totalDano > 0) {
                handleUpdateHP(targetId, -totalDano); 
                addLog({ text: `⚔️ **DANO APLICADO:** ${totalDano} de Dano Fixo no ${target.name}!`, type: 'damage', sender: 'Sistema' });
                setDamageOverlayData({ rolls: null, mod: 0, total: totalDano, targetName: target.name });
            }
        }
  };

  const handleDiceComplete = (total: number, isSuccess: boolean, isCritical: boolean, isSecret: boolean, finalRolls?: number[], finalMod?: number) => {
      const senderName = role === 'DM' ? 'Mestre' : playerName;

      if (diceContext.isDamage) {
          const rollString = finalRolls ? `[${finalRolls.join(', ')}]` : '';
          const modStr = finalMod ? (finalMod > 0 ? `+${finalMod}` : (finalMod < 0 ? finalMod : '')) : '';

          if (!diceContext.isCustomNoDamage && diceContext.entityId) {
              const target = entities.find(e => e.id === diceContext.entityId);
              let finalDamage = total;
              let dmgModifierInfo = 'normal';

              if (target && diceContext.damageType) {
                  const dType = diceContext.damageType.toLowerCase();
                  const targetDataStr = JSON.stringify(target).toLowerCase();
                  if (target.immunities?.some(i => i.toLowerCase().includes(dType)) || targetDataStr.includes(`imune a ${dType}`) || targetDataStr.includes(`imunidade a ${dType}`)) {
                      finalDamage = 0; dmgModifierInfo = 'immune';
                  } else if (target.vulnerabilities?.some(v => v.toLowerCase().includes(dType)) || targetDataStr.includes(`vulnerável a ${dType}`) || targetDataStr.includes(`vulnerabilidade a ${dType}`)) {
                      finalDamage = total * 2; dmgModifierInfo = 'vulnerable';
                  } else if (target.resistances?.some(r => r.toLowerCase().includes(dType)) || targetDataStr.includes(`resistente a ${dType}`) || targetDataStr.includes(`resistência a ${dType}`)) {
                      finalDamage = Math.floor(total / 2); dmgModifierInfo = 'resistant';
                  }
              }

              if (finalDamage > 0) handleUpdateHP(diceContext.entityId, -finalDamage);

              let narrativeText = `⚔️ **DANO APLICADO:** Rolou ${diceContext.damageExpression} ${rollString}${modStr} = **${total} de Dano ${diceContext.damageType}** no ${diceContext.targetName}!`;
              if (dmgModifierInfo === 'immune') narrativeText = `🛡️ **IMUNIDADE:** ${diceContext.targetName} é imune a ${diceContext.damageType}! Sofreu 0 de dano.`;
              if (dmgModifierInfo === 'resistant') narrativeText = `🛡️ **RESISTÊNCIA:** ${diceContext.targetName} resistiu ao dano ${diceContext.damageType}! Sofreu apenas **${finalDamage}** de dano.`;
              if (dmgModifierInfo === 'vulnerable') narrativeText = `🩸 **VULNERABILIDADE:** ${diceContext.targetName} é vulnerável a ${diceContext.damageType}! Sofreu cruéis **${finalDamage}** de dano!`;

              addLog({ text: narrativeText, type: 'damage', sender: 'Sistema' });
              setDamageOverlayData({ rolls: null, sides: 1, mod: finalMod, total: finalDamage, targetName: diceContext.targetName, damageType: diceContext.damageType, damageModifier: dmgModifierInfo });
              
              setRollQueue(prev => prev.slice(1));
          } else {
              const publicText = `🎲 **${senderName}** rolou ${diceContext.title} (${diceContext.damageExpression}):\n🎯 Resultado: ${rollString}${modStr} = **${total}**`;
              if (isSecret) addLog({ text: `👁️ (Secreto) ` + publicText, type: 'roll', sender: senderName, isSecret: true, secretContent: `👁️ (Secreto) ` + publicText } as any);
              else { addLog({ text: publicText, type: 'roll', sender: senderName } as any); socket.emit('rollDice', { sides: 20, result: total, roomId, user: senderName }); }
              
              setRollQueue(prev => prev.slice(1));
          }
          return;
      }

      let resultMsg = isCritical ? (total >= 20 ? "CRÍTICO! ⚔️" : "FALHA CRÍTICA! 💀") : (isSuccess ? "SUCESSO! ✅" : "FALHA ❌");
      let isAttackHit = false; let targetIdForDamage: number | null = null; let targetInfoMsg = "";
      let finalDamageExpression = diceContext.damageExpression || ""; let finalDamageType = diceContext.damageType || "Físico";
      const isAttack = diceContext.title.toLowerCase().includes("ataque");

      if (isAttack) {
          const attacker = role === 'DM' && attackerId ? entities.find(e => e.id === attackerId) : entities.find(e => e.name.toLowerCase() === playerName.toLowerCase());
          const weaponName = diceContext.title.replace(/Ataque:\s*/i, '').trim();
          const weapon = attacker?.inventory?.find(i => i.name.toLowerCase() === weaponName.toLowerCase());

          if (weapon && !finalDamageExpression) {
              let baseDmg = weapon.stats?.damage || '1d4'; let dmgMod = 0;
              if (attacker && attacker.stats) {
                  const strMod = Math.floor((attacker.stats.str - 10) / 2); const dexMod = Math.floor((attacker.stats.dex - 10) / 2);
                  const isFinesseOrRanged = weapon.stats?.properties?.some(p => p.toLowerCase().includes('finesse') || p.toLowerCase().includes('distância') || p.toLowerCase().includes('ranged')) || weaponName.toLowerCase().includes('arco') || weaponName.toLowerCase().includes('besta') || weaponName.toLowerCase().includes('adaga') || weaponName.toLowerCase().includes('rapieira');
                  dmgMod = isFinesseOrRanged ? Math.max(strMod, dexMod) : strMod;
              }
              const dmgMatch = baseDmg.match(/^(\d+)d(\d+)/i);
              if (dmgMatch) {
                  const count = parseInt(dmgMatch[1]); const sides = parseInt(dmgMatch[2]);
                  const rollsCount = (isCritical && total >= 20) ? count * 2 : count;
                  finalDamageExpression = `${rollsCount}d${sides}${dmgMod !== 0 ? (dmgMod > 0 ? '+'+dmgMod : dmgMod) : ''}`;
              }
          } else if (isCritical && total >= 20 && finalDamageExpression) {
               const dmgMatch = finalDamageExpression.match(/^(\d+)d(\d+)(.*)/i);
               if(dmgMatch) finalDamageExpression = `${parseInt(dmgMatch[1]) * 2}d${dmgMatch[2]}${dmgMatch[3]}`;
          }

          if (targetEntityIds.length > 0) {
              const target = entities.find(e => e.id === targetEntityIds[0]);
              if (target) {
                  if (total >= target.ac || (isCritical && total >= 20)) { 
                      resultMsg = `**ACERTOU!** ⚔️`; isAttackHit = true; targetIdForDamage = target.id; targetInfoMsg = `\n🎯 *${target.name}* recebeu o golpe!`;
                      socket.emit('triggerCombatAnimation', { roomId, attackerName: senderName, targetId: target.id, attackType: diceContext.title.includes('Mágico') ? 'magia' : 'fisico' });
                      handlePlaySFX('sword', true);
                  } else { 
                      resultMsg = `**ERROU!** 🛡️`; targetInfoMsg = `\n💨 *${target.name}* defendeu.`; handlePlaySFX('dado', true);
                  }
              }
          } else {
              resultMsg = `**Ataque Rolado** ⚔️`; targetInfoMsg = `\n*(⚠️ Selecione um alvo para o Dano Automático funcionar!)*`; handlePlaySFX('sword', true);
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
          addLog({ text: role === 'DM' ? secretText : `🎲 **${senderName}** rolou dados misteriosamente...`, type: 'roll', sender: senderName, isSecret: true, secretContent: secretText, targetId: targetIdForDamage, isHit: isAttackHit, damage: finalDamageExpression } as any);
      } else {
          addLog({ text: publicText, type: 'roll', sender: senderName, targetId: targetIdForDamage, isHit: isAttackHit, damage: finalDamageExpression } as any);
          ignoreNextDiceSound.current = true;
          setTimeout(() => { ignoreNextDiceSound.current = false; }, 2000);
          socket.emit('rollDice', { sides: 20, result: total, roomId, user: senderName });
      }

      setRollQueue(prev => prev.slice(1));
      
      if (isAttackHit && finalDamageExpression && targetIdForDamage) {
          const target = entities.find(e => e.id === targetIdForDamage);
          setRollQueue(prev => [...prev, {
              title: `Dano: ${diceContext.title}`, subtitle: `Em ${target?.name || 'Alvo'}`, dc: 0, mod: 0, entityId: targetIdForDamage, targetName: target?.name || 'Alvo',
              isDamage: true, damageExpression: finalDamageExpression, damageType: finalDamageType
          }]);
      }
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
                  Object.entries(ent.spellSlots).forEach(([level, slotData]) => { restoredSlots[parseInt(level)] = { max: slotData.max, used: 0 }; });
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
          if (targetEntityIds.length > 0) socket.emit('triggerCombatAnimation', { roomId, attackerName: senderName, targetId: targetEntityIds[0], attackType: 'magia' });
          handlePlaySFX('magic', true);
      }
      const whisperMatch = text.match(/^\/w\s+"([^"]+)"\s+(.+)$/i) || text.match(/^\/w\s+([^\s]+)\s+(.+)$/i);
      if (whisperMatch) {
          const whisperTarget = whisperMatch[1]; const whisperText = whisperMatch[2];
          addLog({ text: whisperText, type: 'chat', sender: senderName, isWhisper: true, whisperTarget: whisperTarget }); return;
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
          id: Date.now(), name: item.name, hp: 1, maxHp: 1, ac: 0, x: x, y: y, type: 'loot', color: '#fbbf24', image: item.image, size: 0.6, conditions: [], stats: { str:0, dex:0, con:0, int:0, wis:0, cha:0 }, visible: true, inventory: [item], level: 0, classType: 'Item' 
      };
      setEntities(prev => [...prev, lootEntity]); socket.emit('createEntity', { entity: lootEntity, roomId }); 
      addLog({ text: `🎒 ${item.name} foi jogado no chão!`, type: 'info', sender: 'Sistema' }); handlePlaySFX('dado', true); 
  };

  const handleGiveItemToToken = (item: Item, sourceId: number, targetId: number) => {
      if (sourceId === targetId) return; 
      const sourceEntity = entities.find(e => e.id === sourceId); const targetEntity = entities.find(e => e.id === targetId); if (!sourceEntity || !targetEntity) return;
      const sourceInv = (sourceEntity.inventory || []).filter(i => i.id !== item.id); const targetInv = [...(targetEntity.inventory || []), { ...item, isEquipped: false }]; 
      setEntities(prev => prev.map(ent => { if (ent.id === sourceId) return { ...ent, inventory: sourceInv }; if (ent.id === targetId) return { ...ent, inventory: targetInv }; return ent; }));
      socket.emit('updateEntityStatus', { entityId: sourceId, updates: { inventory: sourceInv }, roomId }); socket.emit('updateEntityStatus', { entityId: targetId, updates: { inventory: targetInv }, roomId });
      addLog({ text: `🤝 **${sourceEntity.name}** deu **${item.name}** para **${targetEntity.name}**.`, type: 'info', sender: 'Sistema' }); handlePlaySFX('dado', true);
  };

  const handlePlayerDropItem = (itemId: string) => {
      const myEntity = entities.find(e => e.name.toLowerCase() === playerName.toLowerCase() && e.type === 'player');
      if (!myEntity) return;
      const itemToDrop = myEntity.inventory?.find(i => i.id === itemId);
      if (!itemToDrop) return;
      handleDropLootOnMap(itemToDrop, myEntity.id, myEntity.x, myEntity.y);
  };

  const handlePickUpLoot = (lootEntity: Entity) => {
      let receiver: Entity | undefined;
      if (role === 'PLAYER') { receiver = entities.find(e => e.name.toLowerCase() === playerName.toLowerCase() && e.type === 'player'); } 
      else { if (targetEntityIds.length > 0) receiver = entities.find(e => e.id === targetEntityIds[0]); }
      
      if (!receiver) { setToastMsg({ text: role === 'DM' ? "Selecione um token (Alvo vermelho) para entregar o item." : "Você não tem um personagem para pegar isso.", id: Date.now() }); return; }

      const item = lootEntity.inventory && lootEntity.inventory[0]; 
      if (!item) { handleDeleteEntity(lootEntity.id); return; }

      let updates: Partial<Entity> = {}; let logMsg = '';

      if (item.stats?.isTreasure && item.stats.coins) {
          const currentCoins = receiver.coins || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
          const incCoins = item.stats.coins;
          updates.coins = { cp: currentCoins.cp + (incCoins.cp || 0), sp: currentCoins.sp + (incCoins.sp || 0), ep: currentCoins.ep || 0, gp: currentCoins.gp + (incCoins.gp || 0), pp: currentCoins.pp || 0 };
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
      handleDeleteEntity(lootEntity.id); setStatusSelectionId(null); 
      addLog({ text: logMsg, type: 'info', sender: 'Sistema' }); handlePlaySFX('dado', true); 
  };

  const handleAddEntity = (type: 'enemy' | 'player', name: string, customStats?: MonsterPreset) => { 
      const pos = getCenterGridPosition();
      createEntity(type, name, pos.x, pos.y, customStats as Partial<Entity>); 
  };

  const handlePingMap = (x: number, y: number) => {
      const myColor = role === 'DM' ? '#ef4444' : '#3b82f6'; const newPing: MapPing = { id: Date.now().toString() + Math.random(), x, y, color: myColor };
      setPings(prev => [...prev, newPing]); socket.emit('pingMap', { ping: newPing, roomId }); handlePlaySFX('ping', true); setTimeout(() => { setPings(prev => prev.filter(p => p.id !== newPing.id)); }, 2500);
  };

  const handleUpdatePosition = (id: number, newX: number, newY: number) => {
    if (!fogGrid || fogGrid.length === 0 || !fogGrid[0]) {
        setEntities(prev => prev.map(ent => ent.id === id ? { ...ent, x: newX, y: newY } : ent));
        socket.emit('updateEntityPosition', { entityId: id, x: newX, y: newY, roomId });
        return;
    }

    let shouldSyncFog = false; 
    let newFogGrid = fogGrid.map(row => [...row]);
    
    const targetEnt = entities.find(e => e.id === id);
    
    if (targetEnt && targetEnt.type === 'player' && targetEnt.visionRadius && targetEnt.visionRadius > 0) {
        const radius = targetEnt.visionRadius; 
        
        const sX = newX + (targetEnt.size || 1) / 2;
        const sY = newY + (targetEnt.size || 1) / 2;
        
        const tokenAngleRad = ((targetEnt.rotation || 0) + 90) * (Math.PI / 180);

        const minX = Math.max(0, Math.floor(sX - radius)); 
        const maxX = Math.min(newFogGrid[0].length - 1, Math.ceil(sX + radius)); 
        const minY = Math.max(0, Math.floor(sY - radius)); 
        const maxY = Math.min(newFogGrid.length - 1, Math.ceil(sY + radius));
        
        const perimeter: {x: number, y: number}[] = [];
        for (let x = minX; x <= maxX; x++) { perimeter.push({x, y: minY}); perimeter.push({x, y: maxY}); }
        for (let y = minY + 1; y < maxY; y++) { perimeter.push({x: minX, y}); perimeter.push({x: maxX, y}); }

        perimeter.forEach(target => {
            const tX = target.x + 0.5;
            const tY = target.y + 0.5;
            
            const rayAngle = Math.atan2(tY - sY, tX - sX);
            let angleDiff = rayAngle - tokenAngleRad;
            
            while (angleDiff <= -Math.PI) angleDiff += Math.PI * 2;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            
            if (Math.abs(angleDiff) > (Math.PI / 2) + 0.05) return; 

            let closestInt = { x: tX, y: tY, dist: radius };
            
            walls.forEach(wall => {
                const int = getLineIntersection(sX, sY, tX, tY, wall.x1, wall.y1, wall.x2, wall.y2);
                if (int) {
                    const dist = Math.hypot(int.x - sX, int.y - sY);
                    if (dist < closestInt.dist) {
                        closestInt = { x: int.x, y: int.y, dist };
                    }
                }
            });

            let x0 = Math.floor(sX); let y0 = Math.floor(sY);
            let x1 = Math.floor(closestInt.x); let y1 = Math.floor(closestInt.y);
            let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
            let sx = (x0 < x1) ? 1 : -1, sy = (y0 < y1) ? 1 : -1;
            let err = dx - dy;

            let loopSafeguard = 0;
            while (loopSafeguard++ < 150) { 
                if (y0 >= 0 && y0 < newFogGrid.length && x0 >= 0 && x0 < newFogGrid[0].length) {
                    if (newFogGrid[y0][x0] === false) {
                        newFogGrid[y0][x0] = true;
                        shouldSyncFog = true;
                    }
                } else { break; }

                if (x0 === x1 && y0 === y1) break;
                let e2 = 2 * err;
                if (e2 > -dy) { err -= dy; x0 += sx; }
                if (e2 < dx) { err += dx; y0 += sy; }
            }
        });
    }

    setEntities(prev => prev.map(ent => ent.id === id ? { ...ent, x: newX, y: newY } : ent));
    socket.emit('updateEntityPosition', { entityId: id, x: newX, y: newY, roomId });
    
    if (shouldSyncFog) { 
        setFogGrid(newFogGrid); 
        socket.emit('syncFogGrid', { grid: newFogGrid, roomId, walls }); 
    }
  };

  const handleRotateToken = (id: number, angle: number) => { setEntities(prev => prev.map(ent => ent.id === id ? { ...ent, rotation: angle } : ent)); socket.emit('updateEntityStatus', { entityId: id, updates: { rotation: angle }, roomId }); };
  const handleResizeToken = (id: number, size: number) => { 
      setEntities(prev => prev.map(ent => { 
          if (ent.id !== id) return ent; 
          socket.emit('updateEntityStatus', { entityId: id, updates: { size: size }, roomId }); 
          return { ...ent, size: size }; 
      })); 
  }; 
  const handleFlipToken = (id: number) => { const ent = entities.find(e => e.id === id); if (!ent) return; const newMirrored = !ent.mirrored; setEntities(prev => prev.map(e => e.id === id ? { ...e, mirrored: newMirrored } : e)); socket.emit('updateEntityStatus', { entityId: id, updates: { mirrored: newMirrored }, roomId }); };
  const handleToggleCondition = (id: number, condition: string) => { setEntities(prev => prev.map(ent => { if (ent.id !== id) return ent; const hasCondition = ent.conditions.includes(condition); const newConditions = hasCondition ? ent.conditions.filter(c => c !== condition) : [...ent.conditions, condition]; if (!hasCondition) addLog({ text: `${ent.name} recebeu condição: ${condition}`, type: 'info', sender: 'Sistema' }); socket.emit('updateEntityStatus', { entityId: id, updates: { conditions: newConditions }, roomId }); return { ...ent, conditions: newConditions }; })); };
  const handleToggleVisibility = (id: number) => { setEntities(prev => prev.map(ent => { if (ent.id !== id) return ent; const newVisible = ent.visible === undefined ? false : !ent.visible; if (role === 'DM') addLog({ text: newVisible ? `👁️ ${ent.name} revelou-se!` : `👻 ${ent.name} desapareceu nas sombras.`, type: 'info', sender: 'Sistema' }, false); socket.emit('updateEntityStatus', { entityId: id, updates: { visible: newVisible }, roomId }); return { ...ent, visible: newVisible }; })); };
  const handleEditEntity = (id: number, updates: Partial<Entity>) => { setEntities(prev => prev.map(ent => ent.id === id ? { ...ent, ...updates } : ent)); socket.emit('updateEntityStatus', { entityId: id, updates, roomId }); };
  const handleDeleteEntity = (id: number) => { setEntities(prev => prev.filter(ent => ent.id !== id)); socket.emit('deleteEntity', { entityId: id, roomId }); if (attackerId === id) setAttackerId(null); };
  
  const handleMapDrop = (type: string, x: number, y: number) => { 
      if (String(type) === 'loot') return;
      const entityType = type as 'enemy' | 'player'; 
      const nextNum = entities.filter(e => String(e.type) === String(entityType)).length + 1; 
      createEntity(entityType, entityType === 'enemy' ? `Monstro ${nextNum}` : `Aliado ${nextNum}`, x, y); 
  };

  const handleFogUpdate = (x: number, y: number, shouldReveal: boolean) => { if (role !== 'DM') return; setFogGrid(prev => { const newGrid = prev.map(row => [...row]); if (newGrid[y]) newGrid[y][x] = shouldReveal; return newGrid; }); socket.emit('updateFog', { x, y, shouldReveal, roomId }); };
  const handleFogBulkUpdate = (cells: {x: number, y: number}[], shouldReveal: boolean) => { if (role !== 'DM') return; setFogGrid(prev => { const newGrid = prev.map(row => [...row]); cells.forEach(cell => { if (newGrid[cell.y] && newGrid[cell.y][cell.x] !== undefined) { newGrid[cell.y][cell.x] = shouldReveal; } }); socket.emit('syncFogGrid', { grid: newGrid, roomId }); return newGrid; }); };

  const handleAddWall = (wall: Wall) => {
      const newWalls = [...walls, wall];
      setWalls(newWalls);
      socket.emit('updateWalls', { roomId, walls: newWalls }); 
      socket.emit('syncFogGrid', { grid: fogGrid, roomId, walls: newWalls }); 
  };

  const handleDeleteWall = (wallId: string) => {
      const newWalls = walls.filter(w => w.id !== wallId);
      setWalls(newWalls);
      socket.emit('updateWalls', { roomId, walls: newWalls });
      socket.emit('syncFogGrid', { grid: fogGrid, roomId, walls: newWalls });
  };

  const handleResetFog = () => { const newGrid = createInitialFog(); setFogGrid(newGrid); socket.emit('syncFogGrid', { grid: newGrid, roomId }); };
  const handleRevealAll = () => { const newGrid = fogGrid.map(row => row.map(() => true)); setFogGrid(newGrid); socket.emit('syncFogGrid', { grid: newGrid, roomId }); };
  const handleSyncFog = () => { socket.emit('syncFogGrid', { grid: fogGrid, roomId }); };
  const handleChangeMap = (mapUrl: string) => { setCurrentMap(mapUrl); setFogGrid(createInitialFog()); setWalls([]); socket.emit('changeMap', { mapUrl, roomId }); };
  
  const handleSaveGame = () => { 
      socket.emit('saveGame', { roomId, entities, fogGrid, walls, fogRooms, currentMap, initiativeList, activeTurnId, chatMessages, customMonsters, globalBrightness, currentTrack }); 
      addLog({ text: "O Mestre salvou o estado da mesa no servidor.", type: 'info', sender: 'Sistema' }); 
  };
  
  const handleUpdateGlobalBrightness = (val: number) => { setGlobalBrightness(val); socket.emit('updateGlobalBrightness', { brightness: val, roomId }); };

  const handleAddFogRoom = (name: string, cells: {x: number, y: number}[]) => {
      const newRoom: FogRoom = { id: Date.now().toString(), name, cells };
      const updatedRooms = [...fogRooms, newRoom];
      setFogRooms(updatedRooms);
      socket.emit('updateFogRooms', { roomId, rooms: updatedRooms });
  };

  const handleDeleteFogRoom = (roomIdToDel: string) => {
      const updatedRooms = fogRooms.filter(r => r.id !== roomIdToDel);
      setFogRooms(updatedRooms);
      socket.emit('updateFogRooms', { roomId, rooms: updatedRooms }); 
  };

  const handleToggleFogRoom = (roomIdToToggle: string, reveal: boolean) => {
      const room = fogRooms.find(r => r.id === roomIdToToggle);
      if (room) {
          handleFogBulkUpdate(room.cells, reveal);
      }
  };

  const handleAddToInitiative = (entity: Entity) => { if (initiativeList.find(i => i.id === entity.id)) return; setInitModalEntity(entity); };
  
  const handleSubmitInitiative = (val: number) => { 
      if (!initModalEntity) return; 
      const newItem = { id: initModalEntity.id, name: initModalEntity.name, value: val }; 
      const newList = [...initiativeList, newItem].sort((a, b) => b.value - a.value); 
      setInitiativeList(newList); 
      const newActive = activeTurnId === null ? initModalEntity.id : activeTurnId; 
      setActiveTurnId(newActive); 
      if (activeTurnId === null && newList.length > 0) setAttackerId(newList[0].id);
      socket.emit('updateInitiative', { list: newList, activeTurnId: newActive, roomId }); 
      addLog({ text: `${initModalEntity.name} rolou Iniciativa: ${val}`, type: 'info', sender: 'Sistema' }); 
      handlePlaySFX('dado', true); 
      setInitModalEntity(null); 
  };
  const handleRemoveFromInitiative = (id: number) => { const newList = initiativeList.filter(i => i.id !== id); setInitiativeList(newList); socket.emit('updateInitiative', { list: newList, activeTurnId, roomId }); };
  
  const handleNextTurn = () => { 
      if (initiativeList.length === 0) return; 
      const nextId = initiativeList[(initiativeList.findIndex(i => i.id === activeTurnId) + 1) % initiativeList.length].id; 
      setActiveTurnId(nextId); setAttackerId(nextId); setTargetEntityIds([]); 
      socket.emit('updateInitiative', { list: initiativeList, activeTurnId: nextId, roomId }); 
      const nextEntity = initiativeList.find(i => i.id === nextId); 
      if(nextEntity) addLog({ text: `Turno de: ${nextEntity.name}`, type: 'info', sender: 'Sistema' }); 
  };
  
  const handleClearInitiative = () => { 
      setInitiativeList([]); setActiveTurnId(null); setAttackerId(null); setTargetEntityIds([]);
      socket.emit('updateInitiative', { list: [], activeTurnId: null, roomId }); 
  };

  const handleSortInitiative = () => { const newList = [...initiativeList].sort((a, b) => b.value - a.value); setInitiativeList(newList); socket.emit('updateInitiative', { list: newList, activeTurnId, roomId }); };
  
  const handleSetTarget = (id: number | number[] | null, multiSelect: boolean = false) => { 
      if (id === null) { if (!multiSelect) setTargetEntityIds([]); return; } 
      if (Array.isArray(id)) { setTargetEntityIds(multiSelect ? Array.from(new Set([...targetEntityIds, ...id])) : id); return; } 
      setTargetEntityIds(multiSelect ? (targetEntityIds.includes(id) ? targetEntityIds.filter(tid => tid !== id) : [...targetEntityIds, id]) : [id]); 
  };
  const handleSetAttacker = (id: number | null) => { setAttackerId(id); };

  const handleLogin = (selectedRole: 'DM' | 'PLAYER', name: string, charData?: any) => { 
      const sessionRoomId = charData?.roomId || 'mesa-do-victor';
      setRoomId(sessionRoomId);
      setRole(selectedRole); setPlayerName(name); setIsLoggedIn(true); setGamePhase('LOBBY'); 
      socket.emit('joinRoom', sessionRoomId); 
      
      if (selectedRole === 'PLAYER' && charData) { 
          setTimeout(() => { 
              setEntities(prev => { 
                  const existing = prev.find(e => e.name.toLowerCase() === name.toLowerCase() && e.type === 'player');
                  if (!existing) { 
                      const newEntity: Entity = { id: charData.id || Date.now(), name, hp: charData.hp, maxHp: charData.maxHp, ac: charData.ac, x: 8, y: 6, rotation: charData.rotation || 0, mirrored: charData.mirrored || false, conditions: charData.conditions || [], color: '#3b82f6', type: 'player', image: charData.image, tokenImage: charData.tokenImage || charData.image, stats: charData.stats, classType: charData.classType, visionRadius: charData.visionRadius || 9, size: charData.size || 2, xp: charData.xp || 0, level: charData.level || 1, inventory: charData.inventory || [], race: charData.race || 'Humano', visible: charData.visible !== false, proficiencies: charData.proficiencies || {}, deathSaves: charData.deathSaves || { successes: 0, failures: 0 }, inspiration: charData.inspiration || false, spellSlots: charData.spellSlots || {}, spells: charData.spells || [], coins: charData.coins || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, details: charData.details || {} }; 
                      socket.emit('createEntity', { entity: newEntity, roomId: sessionRoomId }); return [...prev, newEntity]; 
                  } else {
                      if (charData.id && charData.id !== existing.id) { charData.id = existing.id; localStorage.setItem('nexus_last_char', JSON.stringify(charData)); }
                  }
                  return prev; 
              }); 
          }, 1500); 
      } 
  };
  
  const handleStartGame = () => { socket.emit('startGame', { roomId }); };

  const selectedStatusEntity = statusSelectionId ? entities.find(e => e.id === statusSelectionId) : null;
  let modalPosition = { top: 0, left: 0 };
  
  if (selectedStatusEntity) { 
      const canvasOffsetX = (windowSize.w - CANVAS_WIDTH) / 2; const canvasOffsetY = (windowSize.h - CANVAS_HEIGHT) / 2; 
      const tokenPixelX = (selectedStatusEntity.x * GRID_SIZE * mapScale) + mapOffset.x + canvasOffsetX; 
      const tokenPixelY = (selectedStatusEntity.y * GRID_SIZE * mapScale) + mapOffset.y + canvasOffsetY; 
      
      const SIDEBAR_WIDTH = 420; const MODAL_WIDTH = 260; const MODAL_HEIGHT = 320;
      modalPosition.left = tokenPixelX + ((selectedStatusEntity.size || 1) * GRID_SIZE * mapScale) + 20;
      modalPosition.top = tokenPixelY;

      if (modalPosition.left + MODAL_WIDTH > windowSize.w - SIDEBAR_WIDTH) modalPosition.left = tokenPixelX - MODAL_WIDTH - 20;
      if (modalPosition.left < 10) modalPosition.left = 10;
      if (modalPosition.top + MODAL_HEIGHT > windowSize.h - 20) modalPosition.top = windowSize.h - MODAL_HEIGHT - 20;
      if (modalPosition.top < 20) modalPosition.top = 20;
  }

  if (!isLoggedIn) return <LoginScreen onLogin={handleLogin} availableClasses={availableClasses} availableRaces={availableRaces} />;
  if (gamePhase === 'LOBBY') return <Lobby availableCharacters={entities.filter(e => e.type === 'player')} onStartGame={handleStartGame} myPlayerName={playerName} roomCode={roomId} />;

  const isMobilePlayer = role === 'PLAYER' && windowSize.w <= 1024;
  const myCharacter = isMobilePlayer ? entities.find(e => e.name.toLowerCase() === playerName.toLowerCase() && e.type === 'player') : null;

  const myName = role === 'DM' ? 'MESTRE' : playerName;
  const publicChatMessages = chatMessages.filter(msg => !msg.isWhisper);
  const privateMessages = chatMessages.filter(msg => {
      if (!msg.isWhisper || !privateChatTarget) return false;
      const sender = msg.sender.toLowerCase(); const target = msg.whisperTarget?.toLowerCase() || '';
      const me = myName.toLowerCase(); const partner = privateChatTarget.toLowerCase();
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

      {pendingRoomCells && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
              <form onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.currentTarget.elements.namedItem('roomName') as HTMLInputElement;
                  handleAddFogRoom(input.value || 'Novo Cômodo', pendingRoomCells);
                  setPendingRoomCells(null);
                  setFogTool('reveal'); 
              }} className="bg-gray-900 border border-cyan-500/50 p-6 rounded-xl shadow-2xl w-80">
                  <h3 className="text-cyan-400 font-black tracking-widest uppercase mb-4 text-sm text-center">Criar Zona de Neblina</h3>
                  <p className="text-xs text-gray-400 mb-4 text-center">A área foi demarcada. Dê um nome para este cômodo para facilitar a revelação na Sidebar.</p>
                  
                  <input name="roomName" autoFocus placeholder="Ex: Sala do Trono, Corredor..." className="w-full mb-6 p-3 bg-black/50 border border-white/10 rounded text-white outline-none focus:border-cyan-500 transition-colors" required />
                  
                  <div className="flex justify-between gap-3">
                      <button type="button" onClick={() => { setPendingRoomCells(null); setFogTool('reveal'); }} className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 py-2 rounded font-bold transition-colors">Cancelar</button>
                      <button type="submit" className="flex-1 bg-cyan-700 hover:bg-cyan-600 text-white py-2 rounded font-bold transition-colors shadow-[0_0_15px_rgba(6,182,212,0.4)]">Criar Sala</button>
                  </div>
              </form>
          </div>
      )}

      {damageOverlayData && ( <DamageOverlay data={damageOverlayData} onComplete={() => setDamageOverlayData(null)} /> )}

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
      
      <UniversalDiceRoller 
        isOpen={showBgDice} rollId={diceRollId} onClose={() => setShowBgDice(false)} title={diceContext.title} subtitle={diceContext.subtitle} 
        difficultyClass={diceContext.dc} baseModifier={diceContext.mod || 0} proficiency={diceContext.prof || 0} rollType={diceContext.rollType || 'normal'} 
        extraBonuses={diceContext.bonuses} isDamage={diceContext.isDamage} damageExpression={diceContext.damageExpression} onComplete={handleDiceComplete} 
      />

      {isMobilePlayer && myCharacter ? (
          <MobilePlayerSheet 
              character={myCharacter} onUpdateHP={handleUpdateHP} onRollAttribute={handleAttributeRoll} onOpenDiceRoller={openDiceRoller} 
              onUpdateCharacter={handleEditEntity} chatMessages={publicChatMessages} onSendMessage={handleSendMessage}
              onApplyDamageFromChat={handleApplyDamageFromChat} onDropItem={handlePlayerDropItem} availableSpells={availableSpells} 
          />
      ) : (
          <>
            {selectedStatusEntity && (
                <div className="fixed z-[500] bg-gradient-to-b from-slate-900/98 to-black border border-amber-500/40 p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] text-amber-50 w-64 backdrop-blur-2xl animate-in fade-in zoom-in duration-200 font-sans pointer-events-auto" style={{ top: modalPosition.top, left: modalPosition.left }}>
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
                    <div className="flex justify-between items-center mb-3 relative z-10">
                        <h3 className="text-[10px] font-black tracking-[0.2em] text-amber-500 uppercase flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            {selectedStatusEntity.type === 'loot' || selectedStatusEntity.classType === 'Item' ? 'Tesouro' : 'Status'}
                        </h3>
                        <button onClick={(e) => { e.stopPropagation(); setStatusSelectionId(null); }} className="w-6 h-6 flex items-center justify-center rounded-full bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all border border-white/10">✕</button>
                    </div>
                    
                    {selectedStatusEntity.type === 'loot' || selectedStatusEntity.classType === 'Item' ? (
                        <div className="flex flex-col items-center gap-4 relative z-10">
                            <div className="w-24 h-24 relative flex items-center justify-center group">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(217,119,6,0.3)_0%,transparent_70%)] group-hover:scale-110 transition-transform duration-500"></div>
                                {selectedStatusEntity.image ? (
                                    <img src={selectedStatusEntity.image} alt="Item" className="w-16 h-16 object-contain relative z-10 drop-shadow-[0_5px_10px_rgba(0,0,0,0.5)]" />
                                ) : ( <span className="text-4xl relative z-10">🎁</span> )}
                            </div>
                            <h2 className="text-sm font-black text-amber-100 text-center uppercase tracking-tight">{selectedStatusEntity.name}</h2>
                            <button onClick={() => handlePickUpLoot(selectedStatusEntity)} className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-black font-black uppercase text-[10px] rounded-lg transition-all active:scale-95 border border-amber-400/50 shadow-lg">Recolher Saque</button>
                        </div>
                    ) : (
                        <>
                            <div className="flex gap-3 mb-4 items-center">
                                <div onClick={() => { if (role === 'DM' || (role === 'PLAYER' && selectedStatusEntity.name === playerName)) { setActiveCharacterSheetId(selectedStatusEntity.id); } }} className={`w-14 h-14 rounded-lg border-2 border-cyan-400/50 overflow-hidden shrink-0 relative ${(role === 'DM' || (role === 'PLAYER' && selectedStatusEntity.name === playerName)) ? 'cursor-pointer hover:border-cyan-400' : ''}`}>
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
                                        <span>Integridade</span><span>{selectedStatusEntity.hp}/{selectedStatusEntity.maxHp}</span>
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
                            {role === 'DM' && (
                                <div className="mt-3 border-t border-white/10 pt-3">
                                    <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-1 block">👁️ Anotações Secretas</span>
                                    <textarea className="w-full bg-black/60 border border-purple-500/30 rounded p-2 text-xs text-purple-100 placeholder-purple-900/50 outline-none focus:border-purple-500 resize-none custom-scrollbar" rows={3} placeholder="Somente o Mestre pode ler e editar isso..." defaultValue={selectedStatusEntity.dmNotes || ''} onBlur={(e) => handleEditEntity(selectedStatusEntity.id, { dmNotes: e.target.value })} />
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
            
            <main className="relative flex-grow h-full overflow-hidden bg-black text-white">
                <div className="absolute top-4 left-4 z-[150] pointer-events-none opacity-50"><span className={`text-[10px] font-bold px-2 py-1 rounded border ${role === 'DM' ? 'bg-red-900 border-red-500' : 'bg-blue-900 border-blue-500'}`}>{role === 'DM' ? 'Mestre Supremo' : `Jogador: ${playerName}`}</span></div>
                <GameMap 
                    mapUrl={currentMap} gridSize={GRID_SIZE} entities={entities} role={role} fogGrid={fogGrid} isFogMode={isFogMode} fogTool={fogTool} activeTurnId={activeTurnId}
                    onFogUpdate={handleFogUpdate} onFogBulkUpdate={handleFogBulkUpdate} fogShape={fogShape}
                    onMoveToken={handleUpdatePosition} onAddToken={handleMapDrop} onRotateToken={handleRotateToken}
                    onResizeToken={handleResizeToken} 
                    targetEntityIds={targetEntityIds} attackerId={attackerId} onSetTarget={handleSetTarget}
                    onSetAttacker={handleSetAttacker} onFlipToken={handleFlipToken} activeAoE={activeAoE} onAoEComplete={() => setActiveAoE(null)} aoeColor={aoeColor} 
                    externalOffset={mapOffset} externalScale={mapScale} onMapChange={handleMapSync} globalBrightness={globalBrightness}
                    onDropItem={handleDropLootOnMap} onGiveItemToToken={handleGiveItemToToken} 
                    pings={pings} onPing={handlePingMap}
                    
                    myCharacterId={entities.find(e => e.name.toLowerCase() === playerName.toLowerCase() && e.type === 'player')?.id}
                    
                    onContextMenu={handleContextMenu}
                    fogRooms={fogRooms}
                    onAddFogRoomRequest={(cells) => setPendingRoomCells(cells)}

                    walls={walls}
                    onAddWall={handleAddWall}
                    onDeleteWall={handleDeleteWall}

                    onSelectEntity={(entity: any) => { 
                        if (entity.classType === 'Item' || String(entity.type) === 'loot') { setStatusSelectionId(entity.id); } 
                        else { handleSetAttacker(entity.id); }
                    }} 
                    onTokenDoubleClick={(entity: any) => { 
                        if (entity.classType === 'Item' || String(entity.type) === 'loot') { setStatusSelectionId(entity.id); } 
                        else { handleSetTarget(entity.id, false); }
                    }} 
                />
                
                {role === 'PLAYER' && (
                  <div className="fixed bottom-6 right-[450px] z-[130] pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <button onClick={openDiceRoller} className="group relative flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-900 to-purple-900 rounded-full border-2 border-yellow-500 shadow-[0_0_20px_rgba(168,85,247,0.6)] hover:scale-110 transition-all duration-300" title="Rolar Dado">
                        <span className="text-3xl filter drop-shadow-md group-hover:rotate-12 transition-transform">🎲</span>
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full text-[10px] flex items-center justify-center border border-white font-bold animate-pulse">!</div>
                      </button>
                  </div>
                )}
            </main>

            {role === 'PLAYER' && (
            <aside className="w-auto h-full flex flex-col flex-shrink-0 border-l border-rpgAccent/20 bg-rpgPanel shadow-2xl z-[140]">
                <SidebarPlayer 
                    entities={entities} myCharacterName={playerName} myCharacterId={entities.find(e => e.name.toLowerCase() === playerName.toLowerCase() && e.type === 'player')?.id || 0} 
                    initiativeList={initiativeList} activeTurnId={activeTurnId} chatMessages={publicChatMessages} 
                    onSendMessage={handleSendMessage} onRollAttribute={handleAttributeRoll} onUpdateCharacter={handleEditEntity} 
                    onSelectEntity={(entity: any) => { setActiveCharacterSheetId(entity.id); }} 
                    onApplyDamageFromChat={handleApplyDamageFromChat} availableSpells={availableSpells} 
                /> 
            </aside>
            )}

            {role === 'DM' && (
               <SidebarDM 
                  entities={entities} onUpdateHP={handleUpdateHP} onAddEntity={handleAddEntity} onDeleteEntity={handleDeleteEntity} onEditEntity={handleEditEntity} 
                  isFogMode={isFogMode} onToggleFogMode={() => setIsFogMode(!isFogMode)} fogTool={fogTool} onSetFogTool={setFogTool} 
                  fogShape={fogShape} onSetFogShape={setFogShape}
                  onSyncFog={handleSyncFog} onResetFog={handleResetFog} onRevealAll={handleRevealAll} onSaveGame={handleSaveGame} onChangeMap={handleChangeMap} 
                  initiativeList={initiativeList} activeTurnId={activeTurnId} onAddToInitiative={handleAddToInitiative} onRemoveFromInitiative={handleRemoveFromInitiative} onNextTurn={handleNextTurn} onClearInitiative={handleClearInitiative} onSortInitiative={handleSortInitiative} targetEntityIds={targetEntityIds} attackerId={attackerId} onSetTarget={handleSetTarget} onToggleCondition={handleToggleCondition} onSetAttacker={handleSetAttacker} activeAoE={activeAoE} onSetAoE={setActiveAoE} chatMessages={publicChatMessages} onSendMessage={handleSendMessage} aoeColor={aoeColor} onSetAoEColor={setAoEColor} onOpenCreator={(type) => { }} onAddXP={handleAddXP} customMonsters={customMonsters} globalBrightness={globalBrightness} onSetGlobalBrightness={handleUpdateGlobalBrightness} onRequestRoll={handleDmRequestRoll} onToggleVisibility={handleToggleVisibility} currentTrack={currentTrack} onPlayMusic={handlePlayMusic} onStopMusic={handleStopMusic} onPlaySFX={handlePlaySFX} audioVolume={audioVolume} onSetAudioVolume={setAudioVolume} onResetView={handleResetView} onGiveItem={handleGiveItem} onApplyDamageFromChat={handleApplyDamageFromChat} onDMRoll={handleDMRoll} 
                  onLongRest={handleLongRest} 
                  availableItems={availableItems} 
                  availableConditions={availableConditions}
                  onOpenLootGenerator={() => setShowLootGenerator(true)}
                  onRequestInitiative={handleRequestInitiative}
                  onRequestCustomRoll={handleRequestCustomRoll}
                  fogRooms={fogRooms}
                  onToggleFogRoom={handleToggleFogRoom}
                  onDeleteFogRoom={handleDeleteFogRoom}
                  /> 
            )}
          </>
      )}

      {contextMenu && (
          <div
              className="fixed z-[1000] bg-gray-900 border border-cyan-500/30 rounded-lg shadow-2xl py-2 w-56 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={(e) => e.stopPropagation()}
          >
              <div className="px-3 py-1 mb-1 border-b border-white/10 text-[10px] font-black text-cyan-400 uppercase tracking-widest truncate">
                  {contextMenu.entity.name}
              </div>
              
              {role === 'DM' && (
                  <>
                      <button className="w-full text-left px-4 py-2 hover:bg-white/10 text-sm text-gray-200 transition-colors flex items-center gap-2" onClick={() => { setEditingEntity(contextMenu.entity); setContextMenu(null); }}>
                          ✏️ Editar Entidade
                      </button>
                      <button className="w-full text-left px-4 py-2 hover:bg-white/10 text-sm text-gray-200 transition-colors flex items-center gap-2" onClick={() => { handleToggleVisibility(contextMenu.entity.id); setContextMenu(null); }}>
                          {contextMenu.entity.visible === false ? '👁️ Revelar aos Jogadores' : '👻 Esconder nas Sombras'}
                      </button>
                      <button className="w-full text-left px-4 py-2 hover:bg-white/10 text-sm text-gray-200 transition-colors flex items-center gap-2" onClick={() => { handleFlipToken(contextMenu.entity.id); setContextMenu(null); }}>
                          🔄 Espelhar Token
                      </button>
                      <button className="w-full text-left px-4 py-2 hover:bg-white/10 text-sm text-gray-200 transition-colors flex items-center gap-2" onClick={() => { handleRequestInitiative([contextMenu.entity.id]); setContextMenu(null); }}>
                          ⚡ Pedir Iniciativa
                      </button>
                      <div className="my-1 border-t border-white/10"></div>
                      <button className="w-full text-left px-4 py-2 hover:bg-red-500/20 text-sm text-red-400 transition-colors flex items-center gap-2" onClick={() => { handleDeleteEntity(contextMenu.entity.id); setContextMenu(null); }}>
                          💀 Remover do Mapa
                      </button>
                  </>
              )}
              {role === 'PLAYER' && contextMenu.entity.type === 'player' && contextMenu.entity.name.toLowerCase() === playerName.toLowerCase() && (
                  <button className="w-full text-left px-4 py-2 hover:bg-white/10 text-sm text-gray-200 transition-colors flex items-center gap-2" onClick={() => { setEditingEntity(contextMenu.entity); setContextMenu(null); }}>
                      ✏️ Editar Personagem
                  </button>
              )}
          </div>
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