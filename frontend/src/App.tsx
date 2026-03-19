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

const ROOM_ID = 'mesa-do-victor'; 
const GRID_SIZE = 70; 
const CANVAS_WIDTH = 1920; 
const CANVAS_HEIGHT = 1080; 

// --- INTERFACES ---
export interface Item {
  id: string;
  name: string;
  description: string;
  image: string;
  type: 'weapon' | 'armor' | 'potion' | 'misc';
  quantity: number;
  weight?: number;
  value?: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  isEquipped?: boolean;
  stats?: {
    damage?: string;
    armorClass?: number;
    ac?: number; 
    properties?: string[];
  };
}

export interface Entity {
  id: number;
  name: string;
  hp: number;
  maxHp: number;
  ac: number;
  x: number;
  y: number;
  rotation?: number; 
  mirrored?: boolean;
  conditions: string[]; 
  color: string;
  type: 'player' | 'enemy';
  image?: string;
  visionRadius?: number; 
  stats?: {
    str: number; dex: number; con: number; int: number; wis: number; cha: number;
  };
  classType?: string;
  size?: number; 
  xp?: number;
  level?: number;
  inventory?: Item[]; 
  race?: string; 
  visible?: boolean; 
  proficiencies?: Record<string, number>; 
  deathSaves?: { successes: number, failures: number }; 
  inspiration?: boolean; 
  spellSlots?: Record<number, { max: number, used: number }>;
  spells?: { id: string, name: string, level: number }[];
  coins?: { cp: number, sp: number, ep: number, gp: number, pp: number };
}

export interface MonsterPreset {
  name: string;
  hp: number;
  ac: number;
  image: string;
  size?: number;
}

export interface MapPing {
  id: string;
  x: number;
  y: number;
  color: string;
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
          <div className="w-16 h-16 rounded-full border-2 border-yellow-500 overflow-hidden mb-2 shadow-lg">
             {entity.image ? <img src={entity.image} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full bg-gray-700" />}
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
};

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false); 
  const [role, setRole] = useState<'DM' | 'PLAYER'>('PLAYER'); 
  const [playerName, setPlayerName] = useState('');
  
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

  const [customMonsters, setCustomMonsters] = useState<MonsterPreset[]>([]); 
  const [focusEntity, setFocusEntity] = useState<Entity | null>(null);       
  const [globalBrightness, setGlobalBrightness] = useState(1);              

  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [mapScale, setMapScale] = useState(1);
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  const [showAllyCreator, setShowAllyCreator] = useState(false);
  const [showEnemyCreator, setShowEnemyCreator] = useState(false);
  const [showBgDice, setShowBgDice] = useState(false);
  
  // --- O NOVO ESTADO DA JANELA SECRETA ---
  const [privateChatTarget, setPrivateChatTarget] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [diceContext, setDiceContext] = useState({
      title: 'Teste Geral',
      subtitle: 'Sorte',
      dc: 15,
      mod: 0,   
      prof: 0,  
      bonuses: [] as RollBonus[], 
      rollType: 'normal' as 'normal' | 'advantage' | 'disadvantage'
  });

  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [audioVolume, setAudioVolume] = useState(0.5);
  const activeMusicRef = useRef<Howl | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entity: Entity } | null>(null);
  const [pings, setPings] = useState<MapPing[]>([]);
  
  // A NOTIFICAÇÃO AGORA GUARDA O REMETENTE (SENDER)
  const [toastMsg, setToastMsg] = useState<{text: string, id: number, sender?: string} | null>(null);

  const ignoreNextDiceSound = useRef(false);

  useEffect(() => {
    if (toastMsg && !toastMsg.sender) { // Se não for clicável, some em 4.5s
        const timer = setTimeout(() => {
            setToastMsg(null);
        }, 4500); 
        return () => clearTimeout(timer);
    }
    // Se for clicável (sussurro), fica até a pessoa clicar (ou sumir após 10 seg)
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

  // Faz a janela secreta rolar para o fundo sempre que uma nova mensagem entra
  useEffect(() => {
      if (privateChatTarget && chatEndRef.current) {
          chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
  }, [chatMessages, privateChatTarget]);

  // AQUI APANHAMOS O CLIQUE DE "SUSSURRAR" DO SIDEBARDM E ABRIMOS A JANELA AQUI!
  useEffect(() => {
      const handleOpenDraft = (e: Event) => {
          const customEvent = e as CustomEvent<string>;
          // O comando é "/w Nome"
          const match = customEvent.detail.match(/^\/w\s+"?([^"]+)"?\s*/i);
          if (match) {
              setPrivateChatTarget(match[1].trim());
          }
      };
      window.addEventListener('openChatWithDraft', handleOpenDraft);
      return () => window.removeEventListener('openChatWithDraft', handleOpenDraft);
  }, []);

  const handlePlayMusic = useCallback((trackId: string, emit: boolean = true) => {
      if (activeMusicRef.current) {
          activeMusicRef.current.stop();
          activeMusicRef.current.unload();
      }
      const trackPath = `/music/${trackId}.mp3`;
      const sound = new Howl({ src: [trackPath], html5: true, loop: true, volume: audioVolume });
      sound.play();
      activeMusicRef.current = sound;
      setCurrentTrack(trackId);
      if (emit) socket.emit('playMusic', { trackId, roomId: ROOM_ID });
  }, [audioVolume]);

  const handleStopMusic = useCallback((emit: boolean = true) => {
      if (activeMusicRef.current) { activeMusicRef.current.stop(); activeMusicRef.current.unload(); activeMusicRef.current = null; }
      setCurrentTrack(null);
      if (emit) socket.emit('stopMusic', { roomId: ROOM_ID });
  }, []);

  const handlePlaySFX = useCallback((sfxId: string, emit: boolean = true) => {
      const sound = SFX_LIBRARY[sfxId];
      if (sound) { sound.volume(audioVolume); sound.play(); }
      if (emit) socket.emit('playSFX', { sfxId, roomId: ROOM_ID });
  }, [audioVolume]);

  const playSound = useCallback((type: 'dado' | 'levelup' | 'magic' | 'notificacao') => { 
    handlePlaySFX(type, false); 
  }, [handlePlaySFX]);

  useEffect(() => {
      if (activeMusicRef.current) activeMusicRef.current.volume(audioVolume);
      Howler.volume(audioVolume);
  }, [audioVolume]);

  const addLog = useCallback((messageData: Omit<ChatMessage, 'id' | 'timestamp'>, shouldEmit: boolean = true) => {
    const newMessage: ChatMessage = { id: Date.now().toString() + Math.random(), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), ...messageData };
    setChatMessages(prev => [...prev, newMessage]);
    if (shouldEmit) socket.emit('sendMessage', { roomId: ROOM_ID, message: newMessage });
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    socket.emit('joinRoom', ROOM_ID);
    const handleConnect = () => { socket.emit('joinRoom', ROOM_ID); };
    socket.on('connect', handleConnect);
    return () => { socket.off('connect', handleConnect); };
  }, [isLoggedIn]);

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
    });

    socket.on('notification', (data: any) => { 
        setToastMsg({ text: data.message, id: Date.now() });
    });

    socket.on('newDiceResult', () => {
        if (!ignoreNextDiceSound.current) {
            playSound('dado');
        }
    });
    
    socket.on('chatMessage', (data: any) => {
        const msg = data.message;
        
        if (msg.isWhisper) {
            const myName = role === 'DM' ? 'Mestre' : playerName;
            const isSender = msg.sender.toLowerCase() === myName.toLowerCase();
            const isTarget = msg.whisperTarget?.toLowerCase() === myName.toLowerCase();
            const amIDM = role === 'DM'; 
            
            if (!isSender && !isTarget && !amIDM) return; 

            // Notifica o alvo COM BOTÃO CLICÁVEL PARA ABRIR A JANELA
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
        setEntities(prev => prev.filter(ent => ent.id !== data.entityId));
        setStatusSelectionId(prev => prev === data.entityId ? null : prev);
    });

    socket.on('mapChanged', (data: any) => { setCurrentMap(data.mapUrl); setFogGrid(data.fogGrid); });
    
    socket.on('fogUpdated', (data: any) => {
      setFogGrid(prev => {
        if (!prev || !prev[data.y]) return prev;
        const newGrid = prev.map(row => [...row]);
        newGrid[data.y][data.x] = data.shouldReveal;
        return newGrid;
      });
    });

    socket.on('fogGridSynced', (data: any) => setFogGrid(data.grid));
    socket.on('initiativeUpdated', (data: any) => { setInitiativeList(data.list); setActiveTurnId(data.activeTurnId); });
    socket.on('triggerAudio', (data: any) => { if (data.trackId === 'suspense') handlePlayMusic('suspense', false); });
    
    socket.on('mapStateUpdated', (data: any) => {
      if (role === 'PLAYER') { setMapOffset(data.offset); setMapScale(data.scale); }
    });

    socket.on('globalBrightnessUpdated', (data: any) => { setGlobalBrightness(data.brightness); });

    socket.on('dmRequestRoll', (data: any) => {
        if (role === 'PLAYER') {
            setEntities(currentEntities => {
                const myChar = currentEntities.find(e => e.name === playerName && e.id === data.targetId);
                const isMyChar = myChar || currentEntities.some(e => e.id === data.targetId && e.type === 'player' && e.name === playerName);
                if (isMyChar) {
                     setDiceContext({
                        title: data.skillName, subtitle: `Exigido pelo Mestre (CD ${data.dc})`, dc: data.dc, mod: data.mod, prof: 0, bonuses: [], rollType: 'normal'
                    });
                    setShowBgDice(true);
                    handlePlayMusic('suspense', false); 
                    addLog({ text: `⚠️ O Mestre exigiu um teste de **${data.skillName}** (CD ${data.dc})!`, type: 'info', sender: 'Sistema' });
                }
                return currentEntities;
            });
        }
    });

    socket.on('mapPinged', (data: { ping: MapPing }) => {
        setPings(prev => [...prev, data.ping]);
        handlePlaySFX('ping', false); 
        setTimeout(() => { setPings(prev => prev.filter(p => p.id !== data.ping.id)); }, 2500);
    });

    return () => {
      socket.off('gameStateSync'); socket.off('notification'); socket.off('newDiceResult'); socket.off('chatMessage'); 
      socket.off('entityPositionUpdated'); socket.off('entityStatusUpdated'); socket.off('entityCreated'); socket.off('entityDeleted'); 
      socket.off('mapChanged'); socket.off('fogUpdated'); socket.off('fogGridSynced'); socket.off('initiativeUpdated'); 
      socket.off('triggerAudio'); socket.off('mapStateUpdated'); socket.off('globalBrightnessUpdated'); socket.off('dmRequestRoll');
      socket.off('playMusic'); socket.off('stopMusic'); socket.off('playSFX'); socket.off('mapPinged'); 
    };
  }, [isLoggedIn, addLog, role, playerName, handlePlayMusic, handleStopMusic, handlePlaySFX, playSound]); 

  const handleResetView = () => {
      setMapOffset({ x: 0, y: 0 }); setMapScale(1);
      if (role === 'DM') {
          socket.emit('syncMapState', { roomId: ROOM_ID, offset: { x: 0, y: 0 }, scale: 1 });
          addLog({ text: "🎥 O Mestre recentralizou a câmera de todos.", type: 'info', sender: 'Sistema' });
      } else { addLog({ text: "🎥 Câmera recentralizada.", type: 'info', sender: 'Sistema' }); }
  };

  const handleMapSync = (offset: {x: number, y: number}, scale: number) => {
    setMapOffset(offset); setMapScale(scale);
    if (role === 'DM') socket.emit('syncMapState', { roomId: ROOM_ID, offset, scale });
  };

  const handleDmRequestRoll = (targetId: number, skillName: string, mod: number, dc: number) => {
      const target = entities.find(e => e.id === targetId);
      addLog({ text: `Mestre solicitou teste de **${skillName}** para **${target ? target.name : 'Alvo'}** (CD ${dc}).`, type: 'info', sender: 'Sistema' });
      socket.emit('dmRequestRoll', { roomId: ROOM_ID, targetId, skillName, mod, dc });
  };

  const handleAttributeRoll = (charName: string, attrName: string, mod: number) => {
      setDiceContext({ title: attrName, subtitle: `Teste de Perícia (${charName})`, dc: 15, mod, prof: 0, bonuses: [], rollType: 'normal' });
      setShowBgDice(true);
  };

  const handleApplyDamageFromChat = (targetId: number, damageExpression: string) => {
        const rollMatch = damageExpression.match(/^(\d+)d(\d+)(\+(\d+))?$/i);
        let totalDano = 0; let rollString = "";
        if (rollMatch) {
            const count = parseInt(rollMatch[1]); const sides = parseInt(rollMatch[2]); const mod = rollMatch[4] ? parseInt(rollMatch[4]) : 0;
            let sum = 0; let rolls = [];
            for(let i=0; i<count; i++) { const val = Math.floor(Math.random() * sides) + 1; rolls.push(val); sum += val; }
            totalDano = sum + mod;
            rollString = `[${rolls.join(', ')}]${mod > 0 ? `+${mod}` : ''}`;
        } else { totalDano = parseInt(damageExpression) || 0; rollString = "Dano Fixo"; }

        const target = entities.find(e => e.id === targetId);
        if (target && totalDano > 0) {
            handleUpdateHP(targetId, -totalDano);
            handlePlaySFX('sword', true);
            addLog({ text: `⚔️ **DANO APLICADO:** Rolou ${damageExpression} ${rollString} = **${totalDano} de Dano** no ${target.name}!`, type: 'damage', sender: 'Sistema' });
        }
  };

  const handleDiceComplete = (total: number, isSuccess: boolean, isCritical: boolean, isSecret: boolean) => {
      const senderName = role === 'DM' ? 'Mestre' : playerName;
      let resultMsg = isCritical ? (total >= 20 ? "CRÍTICO! ⚔️" : "FALHA CRÍTICA! 💀") : (isSuccess ? "SUCESSO! ✅" : "FALHA ❌");
      let isAttackHit = false; let targetIdForDamage: number | null = null; let targetInfoMsg = "";

      if (targetEntityIds.length > 0 && diceContext.title.toLowerCase().includes("ataque")) {
          const target = entities.find(e => e.id === targetEntityIds[0]);
          if (target) {
              if (total >= target.ac || (isCritical && total >= 20)) { 
                  resultMsg = `**ACERTOU!** ⚔️ (vs CA ${target.ac})`; targetInfoMsg = `\n🎯 *${target.name}* foi atingido!`; isAttackHit = true; targetIdForDamage = target.id;
              } else { resultMsg = `**ERROU!** 🛡️ (vs CA ${target.ac})`; targetInfoMsg = `\n💨 *${target.name}* defendeu o ataque.`; }
          }
      }

      const publicText = `🎲 **${senderName}** rolou ${diceContext.title}: **${total}** - ${resultMsg}${targetInfoMsg}`;

      if (isSecret) {
          const secretText = `👁️ (Secreto) ` + publicText;
          addLog({ text: role === 'DM' ? secretText : `🎲 **${senderName}** rolou dados misteriosamente...`, type: 'roll', sender: senderName, isSecret: true, secretContent: secretText, targetId: targetIdForDamage, isHit: isAttackHit });
      } else {
          addLog({ text: publicText, type: 'roll', sender: senderName, targetId: targetIdForDamage, isHit: isAttackHit });
          ignoreNextDiceSound.current = true;
          setTimeout(() => { ignoreNextDiceSound.current = false; }, 2000);
          socket.emit('rollDice', { sides: 20, result: total, roomId: ROOM_ID, user: senderName });
      }
      setTimeout(() => setShowBgDice(false), 2000);
  };

  const openDiceRoller = () => {
      setDiceContext({ title: 'Rolagem Livre', subtitle: 'Sorte', dc: 10, mod: 0, prof: 0, bonuses: [], rollType: 'normal' });
      setShowBgDice(true);
  };

  const handleDMRoll = (title: string, subtitle: string, mod: number, rollType: 'normal' | 'advantage' | 'disadvantage' = 'normal') => {
      setDiceContext({ title, subtitle, dc: 10, mod, prof: 0, bonuses: [], rollType });
      setShowBgDice(true);
  };

  const handleAddXP = (id: number, amount: number) => {
    const entity = entities.find(e => e.id === id);
    if (!entity || entity.type !== 'player') return;
    const oldXP = entity.xp || 0;
    const newXP = oldXP + amount;
    const oldLevel = entity.level || 1;
    const calculatedLevel = getLevelFromXP(newXP);
    setEntities(prev => prev.map(ent => ent.id === id ? { ...ent, xp: newXP } : ent));
    socket.emit('updateEntityStatus', { entityId: id, updates: { xp: newXP }, roomId: ROOM_ID });
    addLog({ text: `${entity.name} ganhou ${amount} XP!`, type: 'info', sender: 'Sistema' });
    if (calculatedLevel > oldLevel) {
        addLog({ text: `✨ ${entity.name} está pronto para subir de nível!`, type: 'info', sender: 'Sistema' });
        playSound('levelup'); 
    }
  };

  const handleUpdateHP = (id: number, change: number) => {
    const entity = entities.find(e => e.id === id);
    if (!entity) return;
    const newHp = Math.min(entity.maxHp, Math.max(0, entity.hp + change));
    if (entity.hp > 0 && newHp <= 0) addLog({ text: `☠️ **${entity.name} caiu inconsciente!**`, type: 'damage', sender: 'Sistema' });
    setEntities(prev => prev.map(ent => ent.id === id ? { ...ent, hp: newHp } : ent));
    socket.emit('updateEntityStatus', { entityId: id, updates: { hp: newHp }, roomId: ROOM_ID });
  };

  const handleSendMessage = (text: string) => {
      const senderName = role === 'DM' ? 'MESTRE' : playerName;
      
      const whisperMatch = text.match(/^\/w\s+"([^"]+)"\s+(.+)$/i) || text.match(/^\/w\s+([^\s]+)\s+(.+)$/i);
      
      if (whisperMatch) {
          const whisperTarget = whisperMatch[1];
          const whisperText = whisperMatch[2];
          
          addLog({ text: whisperText, type: 'chat', sender: senderName, isWhisper: true, whisperTarget: whisperTarget });
          return;
      }

      const rollMatch = text.match(/^\/r\s+(\d+)d(\d+)(\+(\d+))?$/i);
      if (rollMatch) {
        const count = parseInt(rollMatch[1]); const sides = parseInt(rollMatch[2]); const mod = rollMatch[4] ? parseInt(rollMatch[4]) : 0;
        let sum = 0; let rolls = [];
        for(let i=0; i<count; i++) { const val = Math.floor(Math.random() * sides) + 1; rolls.push(val); sum += val; }
        const total = sum + mod; const rollString = `[${rolls.join(', ')}]` + (mod > 0 ? ` + ${mod}` : '');
        addLog({ text: `🎲 Rolou ${count}d${sides}${mod ? '+'+mod : ''}: ${rollString} = **${total}**`, type: 'roll', sender: senderName });
        handlePlaySFX('dado', true);
      } else { addLog({ text: text, type: 'chat', sender: senderName }); }
  };

  const handleGiveItem = (targetId: number, item: any) => {
      setEntities(prev => prev.map(ent => {
          if (ent.id !== targetId) return ent;
          const newInventory = [...(ent.inventory || []), item];
          socket.emit('updateEntityStatus', { entityId: targetId, updates: { inventory: newInventory }, roomId: ROOM_ID });
          addLog({ text: `🎁 ${ent.name} recebeu ${item.quantity}x ${item.name}!`, type: 'info', sender: 'Sistema' });
          return { ...ent, inventory: newInventory };
      }));
  };

  const handleDropLootOnMap = (item: Item, sourceId: number, x: number, y: number) => {
      setEntities(prev => prev.map(ent => {
          if (ent.id !== sourceId) return ent;
          const newInv = (ent.inventory || []).filter(i => i.id !== item.id);
          socket.emit('updateEntityStatus', { entityId: sourceId, updates: { inventory: newInv }, roomId: ROOM_ID });
          return { ...ent, inventory: newInv };
      }));
      const lootEntity: Entity = {
          id: Date.now(), name: item.name, hp: 1, maxHp: 1, ac: 10, x: x, y: y, type: 'player', color: '#fbbf24', 
          image: item.image, size: 0.5, conditions: [], stats: { str:0, dex:0, con:0, int:0, wis:0, cha:0 }, visible: true, inventory: [item], level: 0, classType: 'Item'
      };
      setEntities(prev => [...prev, lootEntity]);
      socket.emit('createEntity', { entity: lootEntity, roomId: ROOM_ID });
      addLog({ text: `🎒 ${item.name} foi jogado no chão!`, type: 'info', sender: 'Sistema' });
      handlePlaySFX('dado', true); 
  };

  const handleGiveItemToToken = (item: Item, sourceId: number, targetId: number) => {
      if (sourceId === targetId) return; 
      const sourceEntity = entities.find(e => e.id === sourceId);
      const targetEntity = entities.find(e => e.id === targetId);
      if (!sourceEntity || !targetEntity) return;

      const sourceInv = (sourceEntity.inventory || []).filter(i => i.id !== item.id);
      const targetInv = [...(targetEntity.inventory || []), { ...item, isEquipped: false }]; 

      setEntities(prev => prev.map(ent => {
          if (ent.id === sourceId) return { ...ent, inventory: sourceInv };
          if (ent.id === targetId) return { ...ent, inventory: targetInv };
          return ent;
      }));

      socket.emit('updateEntityStatus', { entityId: sourceId, updates: { inventory: sourceInv }, roomId: ROOM_ID });
      socket.emit('updateEntityStatus', { entityId: targetId, updates: { inventory: targetInv }, roomId: ROOM_ID });
      addLog({ text: `🤝 **${sourceEntity.name}** deu **${item.name}** para **${targetEntity.name}**.`, type: 'info', sender: 'Sistema' });
      handlePlaySFX('dado', true);
  };

  const handlePickUpLoot = (lootEntity: Entity) => {
      let receiver: Entity | undefined;
      if (role === 'PLAYER') { receiver = entities.find(e => e.name === playerName && e.type === 'player'); } 
      else { if (targetEntityIds.length > 0) receiver = entities.find(e => e.id === targetEntityIds[0]); }

      if (!receiver) {
          setToastMsg({ text: role === 'DM' ? "Selecione um token (Alvo) para pegar o item." : "Você não tem um personagem para pegar isso.", id: Date.now() });
          return;
      }

      const item = lootEntity.inventory && lootEntity.inventory[0];
      if (!item) { handleDeleteEntity(lootEntity.id); return; }

      const newInventory = [...(receiver.inventory || []), item];
      setEntities(prev => prev.map(ent => ent.id === receiver!.id ? { ...ent, inventory: newInventory } : ent));
      socket.emit('updateEntityStatus', { entityId: receiver.id, updates: { inventory: newInventory }, roomId: ROOM_ID });

      handleDeleteEntity(lootEntity.id);
      setStatusSelectionId(null);
      addLog({ text: `🎒 ${receiver.name} pegou ${item.name} do chão.`, type: 'info', sender: 'Sistema' });
      handlePlaySFX('dado', true); 
  };

  const handleContextMenuAction = (action: string, entity: Entity) => {
      switch (action) {
          case 'VIEW_SHEET':
              if (role === 'DM') setEditingEntity(entity);
              else { setToastMsg({ text: `Visualizando ficha de ${entity.name} (Em breve)`, id: Date.now() }); }
              break;
          case 'WHISPER': 
              // AQUI! Em vez de usar o evento do Sidebar, dizemos ao App para abrir a janela!
              setPrivateChatTarget(entity.name);
              break;
          case 'SET_ATTACKER': setAttackerId(entity.id); break;
          case 'SET_TARGET': handleSetTarget(entity.id, true); break;
          case 'TOGGLE_VISIBILITY': handleToggleVisibility(entity.id); break;
          case 'HEAL_FULL': handleUpdateHP(entity.id, entity.maxHp); break;
          case 'TOGGLE_DEAD': if (entity.hp > 0) handleUpdateHP(entity.id, -entity.hp); else handleUpdateHP(entity.id, 1); break;
      }
      setContextMenu(null);
  };

  const handlePingMap = (x: number, y: number) => {
      const myColor = role === 'DM' ? '#ef4444' : '#3b82f6'; 
      const newPing: MapPing = { id: Date.now().toString() + Math.random(), x, y, color: myColor };
      setPings(prev => [...prev, newPing]);
      socket.emit('pingMap', { ping: newPing, roomId: ROOM_ID });
      handlePlaySFX('ping', true); 
      setTimeout(() => { setPings(prev => prev.filter(p => p.id !== newPing.id)); }, 2500);
  };

  const handleUpdatePosition = (id: number, newX: number, newY: number) => {
    let shouldSyncFog = false;
    let newFogGrid = [...fogGrid.map(row => [...row])];

    setEntities(prev => {
        return prev.map(ent => {
            if (ent.id === id) {
                const updatedEnt = { ...ent, x: newX, y: newY };
                if (updatedEnt.type === 'player' && updatedEnt.visionRadius && updatedEnt.visionRadius > 0) {
                     const radius = updatedEnt.visionRadius;
                     const startY = Math.max(0, Math.floor(newY - radius));
                     const endY = Math.min(newFogGrid.length - 1, Math.ceil(newY + radius));
                     const startX = Math.max(0, Math.floor(newX - radius));
                     const endX = Math.min(newFogGrid[0].length - 1, Math.ceil(newX + radius));

                     for (let y = startY; y <= endY; y++) {
                         for (let x = startX; x <= endX; x++) {
                             const distance = Math.sqrt(Math.pow(x - newX, 2) + Math.pow(y - newY, 2));
                             if (distance <= radius && newFogGrid[y][x] === false) {
                                 newFogGrid[y][x] = true;
                                 shouldSyncFog = true;
                             }
                         }
                     }
                }
                return updatedEnt;
            }
            return ent;
        });
    });

    socket.emit('updateEntityPosition', { entityId: id, x: newX, y: newY, roomId: ROOM_ID });
    if (shouldSyncFog) {
        setFogGrid(newFogGrid);
        socket.emit('syncFogGrid', { grid: newFogGrid, roomId: ROOM_ID });
    }
  };

  const handleRotateToken = (id: number, angle: number) => { setEntities(prev => prev.map(ent => ent.id === id ? { ...ent, rotation: angle } : ent)); socket.emit('updateEntityStatus', { entityId: id, updates: { rotation: angle }, roomId: ROOM_ID }); };
  const handleResizeToken = (id: number, size: number) => { setEntities(prev => prev.map(ent => ent.id === id ? { ...ent, size } : ent)); socket.emit('updateEntityStatus', { entityId: id, updates: { size }, roomId: ROOM_ID }); };
  const handleFlipToken = (id: number) => { const ent = entities.find(e => e.id === id); if (!ent) return; const newMirrored = !ent.mirrored; setEntities(prev => prev.map(e => e.id === id ? { ...e, mirrored: newMirrored } : e)); socket.emit('updateEntityStatus', { entityId: id, updates: { mirrored: newMirrored }, roomId: ROOM_ID }); };
  const handleToggleCondition = (id: number, condition: string) => {
    setEntities(prev => prev.map(ent => {
        if (ent.id !== id) return ent;
        const hasCondition = ent.conditions.includes(condition);
        const newConditions = hasCondition ? ent.conditions.filter(c => c !== condition) : [...ent.conditions, condition];
        if (!hasCondition) addLog({ text: `${ent.name} recebeu condição: ${condition}`, type: 'info', sender: 'Sistema' });
        socket.emit('updateEntityStatus', { entityId: id, updates: { conditions: newConditions }, roomId: ROOM_ID });
        return { ...ent, conditions: newConditions };
    }));
  };

  const handleToggleVisibility = (id: number) => {
    setEntities(prev => prev.map(ent => {
        if (ent.id !== id) return ent;
        const newVisible = ent.visible === undefined ? false : !ent.visible; 
        if (role === 'DM') addLog({ text: newVisible ? `👁️ ${ent.name} revelou-se!` : `👻 ${ent.name} desapareceu nas sombras.`, type: 'info', sender: 'Sistema' }, false); 
        socket.emit('updateEntityStatus', { entityId: id, updates: { visible: newVisible }, roomId: ROOM_ID });
        return { ...ent, visible: newVisible };
    }));
  };

  const handleEditEntity = (id: number, updates: Partial<Entity>) => { setEntities(prev => prev.map(ent => ent.id === id ? { ...ent, ...updates } : ent)); socket.emit('updateEntityStatus', { entityId: id, updates, roomId: ROOM_ID }); };
  const handleDeleteEntity = (id: number) => { setEntities(prev => prev.filter(ent => ent.id !== id)); socket.emit('deleteEntity', { entityId: id, roomId: ROOM_ID }); if (attackerId === id) setAttackerId(null); };
  
  const createEntity = (type: 'enemy' | 'player', name: string, x: number, y: number, customStats?: Partial<Entity>) => {
    const newId = Date.now(); 
    const newEntity: Entity = { 
      id: newId, name, hp: customStats?.hp || 10, maxHp: customStats?.maxHp || customStats?.hp || 10, ac: customStats?.ac || 10, x, y, rotation: 0, mirrored: false, conditions: [], 
      color: type === 'enemy' ? '#ef4444' : '#3b82f6', type, image: customStats?.image || (type === 'enemy' ? "/tokens/lobo.png" : "/tokens/aliado.png"), 
      visionRadius: 9, stats: customStats?.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, classType: customStats?.classType || "NPC", size: customStats?.size || 2,
      xp: customStats?.xp || 0, level: customStats?.level || 1, inventory: customStats?.inventory || [], race: customStats?.race || 'Humano', visible: true,
      proficiencies: customStats?.proficiencies || {}, deathSaves: customStats?.deathSaves || { successes: 0, failures: 0 }, inspiration: customStats?.inspiration || false,
      spellSlots: customStats?.spellSlots || {}, spells: customStats?.spells || [], coins: customStats?.coins || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }
    };
    setEntities(prev => [...prev, newEntity]);
    socket.emit('createEntity', { entity: newEntity, roomId: ROOM_ID });
    addLog({ text: `${name} entrou na mesa.`, type: 'info', sender: 'Sistema' });
  };

  const handleAddEntity = (type: 'enemy' | 'player', name: string, customStats?: MonsterPreset) => { createEntity(type, name, 8, 6, customStats as Partial<Entity>); };
  const handleMapDrop = (type: string, x: number, y: number) => { const entityType = type as 'enemy' | 'player'; const nextNum = entities.filter(e => e.type === entityType).length + 1; createEntity(entityType, entityType === 'enemy' ? `Monstro ${nextNum}` : `Aliado ${nextNum}`, x, y); };
  const handleFogUpdate = (x: number, y: number, shouldReveal: boolean) => {
    if (role !== 'DM') return; 
    setFogGrid(prev => { const newGrid = prev.map(row => [...row]); if (newGrid[y]) newGrid[y][x] = shouldReveal; return newGrid; });
    socket.emit('updateFog', { x, y, shouldReveal, roomId: ROOM_ID });
  };
  const handleFogBulkUpdate = (cells: {x: number, y: number}[], shouldReveal: boolean) => {
    if (role !== 'DM') return;
    setFogGrid(prev => {
        const newGrid = prev.map(row => [...row]);
        cells.forEach(cell => {
            if (newGrid[cell.y] && newGrid[cell.y][cell.x] !== undefined) {
                newGrid[cell.y][cell.x] = shouldReveal;
            }
        });
        socket.emit('syncFogGrid', { grid: newGrid, roomId: ROOM_ID });
        return newGrid;
    });
  };
  const handleResetFog = () => { const newGrid = createInitialFog(); setFogGrid(newGrid); socket.emit('syncFogGrid', { grid: newGrid, roomId: ROOM_ID }); };
  const handleRevealAll = () => { const newGrid = fogGrid.map(row => row.map(() => true)); setFogGrid(newGrid); socket.emit('syncFogGrid', { grid: newGrid, roomId: ROOM_ID }); };
  const handleSyncFog = () => { socket.emit('syncFogGrid', { grid: fogGrid, roomId: ROOM_ID }); };
  
  const handleChangeMap = (mapUrl: string) => { setCurrentMap(mapUrl); setFogGrid(createInitialFog()); socket.emit('changeMap', { mapUrl, roomId: ROOM_ID }); };
  
  const handleSaveGame = () => {
    socket.emit('saveGame', { roomId: ROOM_ID, entities, fogGrid, currentMap, initiativeList, activeTurnId, chatMessages, customMonsters, globalBrightness, currentTrack });
    addLog({ text: "O Mestre salvou o estado da mesa no servidor.", type: 'info', sender: 'Sistema' });
  };

  const handleSaveMonsterPreset = (preset: MonsterPreset) => { setCustomMonsters(prev => [...prev, preset]); addLog({ text: `Novo monstro salvo na lista: ${preset.name}`, type: 'info', sender: 'Sistema' }); };
  const handleUpdateGlobalBrightness = (val: number) => { setGlobalBrightness(val); socket.emit('updateGlobalBrightness', { brightness: val, roomId: ROOM_ID }); };

  const handleAddToInitiative = (entity: Entity) => { if (initiativeList.find(i => i.id === entity.id)) return; setInitModalEntity(entity); };
  const handleSubmitInitiative = (val: number) => {
    if (!initModalEntity) return;
    const newItem = { id: initModalEntity.id, name: initModalEntity.name, value: val };
    const newList = [...initiativeList, newItem].sort((a, b) => b.value - a.value);
    setInitiativeList(newList);
    const newActive = activeTurnId === null ? initModalEntity.id : activeTurnId;
    setActiveTurnId(newActive);
    socket.emit('updateInitiative', { list: newList, activeTurnId: newActive, roomId: ROOM_ID });
    addLog({ text: `${initModalEntity.name} rolou Iniciativa: ${val}`, type: 'info', sender: 'Sistema' });
    handlePlaySFX('dado', true);
    setInitModalEntity(null);
  };

  const handleRemoveFromInitiative = (id: number) => { const newList = initiativeList.filter(i => i.id !== id); setInitiativeList(newList); socket.emit('updateInitiative', { list: newList, activeTurnId, roomId: ROOM_ID }); };
  const handleNextTurn = () => {
    if (initiativeList.length === 0) return;
    const nextId = initiativeList[(initiativeList.findIndex(i => i.id === activeTurnId) + 1) % initiativeList.length].id;
    setActiveTurnId(nextId);
    socket.emit('updateInitiative', { list: initiativeList, activeTurnId: nextId, roomId: ROOM_ID });
    const nextEntity = initiativeList.find(i => i.id === nextId);
    if(nextEntity) addLog({ text: `Turno de: ${nextEntity.name}`, type: 'info', sender: 'Sistema' });
  };
  const handleClearInitiative = () => { setInitiativeList([]); setActiveTurnId(null); socket.emit('updateInitiative', { list: [], activeTurnId: null, roomId: ROOM_ID }); };
  const handleSortInitiative = () => { const newList = [...initiativeList].sort((a, b) => b.value - a.value); setInitiativeList(newList); socket.emit('updateInitiative', { list: newList, activeTurnId, roomId: ROOM_ID }); };
  
  const handleSetTarget = (id: number | number[] | null, multiSelect: boolean = false) => {
    if (role !== 'DM') return;
    if (id === null) { if (!multiSelect) setTargetEntityIds([]); return; }
    if (Array.isArray(id)) { setTargetEntityIds(multiSelect ? Array.from(new Set([...targetEntityIds, ...id])) : id); return; }
    setTargetEntityIds(multiSelect ? (targetEntityIds.includes(id) ? targetEntityIds.filter(tid => tid !== id) : [...targetEntityIds, id]) : [id]);
  };
  
  const handleSetAttacker = (id: number | null) => { if (role !== 'DM') return; setAttackerId(id); };
  const handleSelectEntityForStatus = (entity: Entity) => { setStatusSelectionId(entity.id); };
  
  const handleLogin = (selectedRole: 'DM' | 'PLAYER', name: string, charData?: any) => {
    setRole(selectedRole); setPlayerName(name); setIsLoggedIn(true); setGamePhase('LOBBY'); 
    socket.emit('joinRoom', ROOM_ID);
    if (selectedRole === 'PLAYER' && charData) {
        setTimeout(() => {
            setEntities(prev => {
                if (!prev.find(e => e.name.toLowerCase() === name.toLowerCase() && e.type === 'player')) {
                    const newEntity: Entity = { 
                        id: charData.id || Date.now(), name, hp: charData.hp, maxHp: charData.maxHp, ac: charData.ac, x: 8, y: 6, rotation: charData.rotation || 0, mirrored: charData.mirrored || false, conditions: charData.conditions || [], color: '#3b82f6', type: 'player', image: charData.image, stats: charData.stats, classType: charData.classType, visionRadius: charData.visionRadius || 9, size: charData.size || 1, xp: charData.xp || 0, level: charData.level || 1, inventory: charData.inventory || [], race: charData.race || 'Humano', visible: charData.visible !== false, proficiencies: charData.proficiencies || {}, deathSaves: charData.deathSaves || { successes: 0, failures: 0 }, inspiration: charData.inspiration || false, spellSlots: charData.spellSlots || {}, spells: charData.spells || [], coins: charData.coins || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }
                    };
                    socket.emit('createEntity', { entity: newEntity, roomId: ROOM_ID }); return [...prev, newEntity];
                }
                return prev;
            });
        }, 1500); 
    }
  };

  const handleStartGame = () => { setGamePhase('GAME'); addLog({ text: "A aventura começou!", type: 'info', sender: 'Sistema' }); };

  const selectedStatusEntity = statusSelectionId ? entities.find(e => e.id === statusSelectionId) : null;
  let modalPosition = { top: 0, left: 0 };
  if (selectedStatusEntity) {
      const canvasOffsetX = (windowSize.w - CANVAS_WIDTH) / 2; const canvasOffsetY = (windowSize.h - CANVAS_HEIGHT) / 2;
      const tokenPixelX = (selectedStatusEntity.x * GRID_SIZE * mapScale) + mapOffset.x + canvasOffsetX;
      const tokenPixelY = (selectedStatusEntity.y * GRID_SIZE * mapScale) + mapOffset.y + canvasOffsetY;
      modalPosition = { top: tokenPixelY, left: tokenPixelX + ((selectedStatusEntity.size || 1) * GRID_SIZE * mapScale) + 15 };
      if (modalPosition.left + 330 > windowSize.w - 320) { modalPosition.left = tokenPixelX - 340; }
      if (modalPosition.top + 400 > windowSize.h) { modalPosition.top = windowSize.h - 410; }
      if (modalPosition.top < 10) modalPosition.top = 10;
  }

  const handleSaveNewAlly = (id: number, data: Partial<Entity>) => { const nextNum = entities.filter(e => e.type === 'player').length + 1; const finalName = data.name || `Aliado ${nextNum}`; createEntity('player', finalName, 4, 4, { ...data, name: finalName }); setShowAllyCreator(false); };
  const handleSaveNewEnemy = (data: Partial<Entity>) => { const nextNum = entities.filter(e => e.type === 'enemy').length + 1; createEntity('enemy', data.name || `Monstro ${nextNum}`, 8, 6, data); setShowEnemyCreator(false); };

  if (!isLoggedIn) return <LoginScreen onLogin={handleLogin} />;
  if (gamePhase === 'LOBBY') return <Lobby availableCharacters={entities.filter(e => e.type === 'player')} onStartGame={handleStartGame} myPlayerName={playerName} />;

  const isMobilePlayer = role === 'PLAYER' && windowSize.w <= 1024;
  const myCharacter = isMobilePlayer ? entities.find(e => e.name === playerName && e.type === 'player') : null;

  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-rpgBg" onClick={() => { if (Howler.ctx && Howler.ctx.state !== 'running') Howler.ctx.resume(); }}>
      
      {/* --- A NOTIFICAÇÃO É CLICÁVEL E ABRE A JANELA SECRETA --- */}
      {toastMsg && (
        <div 
           onClick={() => {
               if (toastMsg.sender) setPrivateChatTarget(toastMsg.sender);
               setToastMsg(null);
           }}
           className={`fixed top-5 left-1/2 -translate-x-1/2 z-[400] bg-gray-900 border px-6 py-3 rounded-xl animate-in slide-in-from-top-5 fade-in duration-300 flex items-center gap-3 ${toastMsg.sender ? 'border-pink-500/50 text-pink-50 shadow-[0_0_20px_rgba(236,72,153,0.4)] cursor-pointer hover:bg-gray-800' : 'border-cyan-500/50 text-cyan-50 shadow-[0_0_20px_rgba(6,182,212,0.4)]'}`}
        >
            <span className="text-xl">🔔</span><span className="font-bold tracking-wider">{toastMsg.text}</span>
        </div>
      )}

      {/* --- A JANELA DE SUSSURROS PRIVADA FLUTUANTE --- */}
      {privateChatTarget && (
          <div className="fixed bottom-4 right-[450px] z-[300] w-80 bg-gray-900 border border-pink-500/50 rounded-t-xl rounded-bl-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
              <div className="bg-gradient-to-r from-pink-900 to-purple-900 p-2 flex justify-between items-center border-b border-pink-500/30 shadow-md">
                  <span className="text-pink-100 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                      🤫 {privateChatTarget}
                  </span>
                  <button onClick={() => setPrivateChatTarget(null)} className="text-pink-300 hover:text-white transition-colors text-lg">✕</button>
              </div>
              
              <div className="h-64 overflow-y-auto p-3 flex flex-col gap-2 bg-[#111] custom-scrollbar">
                  {chatMessages.filter(msg => msg.isWhisper && ((msg.sender === (role === 'DM' ? 'Mestre' : playerName) && msg.whisperTarget === privateChatTarget) || (msg.sender === privateChatTarget && msg.whisperTarget === (role === 'DM' ? 'Mestre' : playerName)))).length === 0 && (
                      <p className="text-gray-600 text-xs italic text-center mt-4">Início da conversa secreta...</p>
                  )}
                  {chatMessages.filter(msg => msg.isWhisper && ((msg.sender === (role === 'DM' ? 'Mestre' : playerName) && msg.whisperTarget === privateChatTarget) || (msg.sender === privateChatTarget && msg.whisperTarget === (role === 'DM' ? 'Mestre' : playerName)))).map(msg => (
                      <div key={msg.id} className={`p-2 rounded max-w-[85%] text-xs shadow-md ${msg.sender === (role === 'DM' ? 'Mestre' : playerName) ? 'bg-pink-900/40 text-pink-100 self-end border border-pink-700/50 rounded-tr-none' : 'bg-gray-800 text-gray-200 self-start border border-gray-600 rounded-tl-none'}`}>
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
      {editingEntity && (<EditEntityModal entity={editingEntity} onSave={(id, updates) => { handleEditEntity(id, updates); setEditingEntity(null); }} onClose={() => setEditingEntity(null)} />)}
      <BaldursDiceRoller isOpen={showBgDice} onClose={() => setShowBgDice(false)} title={diceContext.title} subtitle={diceContext.subtitle} difficultyClass={diceContext.dc} baseModifier={diceContext.mod || 0} proficiency={diceContext.prof || 0} rollType={diceContext.rollType || 'normal'} extraBonuses={diceContext.bonuses} onComplete={handleDiceComplete} />

      {isMobilePlayer && myCharacter ? (
          <MobilePlayerSheet character={myCharacter} onUpdateHP={handleUpdateHP} onRollAttribute={handleAttributeRoll} onOpenDiceRoller={openDiceRoller} onUpdateCharacter={handleEditEntity} />
      ) : (
          <>
            {selectedStatusEntity && (
                <div className="fixed z-50 bg-gray-900/95 border-2 border-cyan-400 p-4 rounded-xl shadow-[0_0_30px_rgba(34,211,238,0.3)] text-cyan-50 w-80 backdrop-blur-md animate-in fade-in zoom-in duration-100 font-mono transition-all ease-linear" style={{ top: modalPosition.top, left: modalPosition.left }}>
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-cyan-400/40 relative"><h3 className="text-base font-black tracking-[0.15em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400">{selectedStatusEntity.classType === 'Item' ? 'LOOT' : 'STATUS'}</h3><button onClick={() => setStatusSelectionId(null)} className="text-cyan-500 hover:text-white transition-colors text-base font-bold">✕</button></div>
                {selectedStatusEntity.classType === 'Item' ? (
                    <div className="flex flex-col items-center gap-4 py-2">
                        <div className="w-24 h-24 bg-black/50 rounded-lg border border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)] flex items-center justify-center p-2 relative overflow-hidden group"><div className="absolute inset-0 bg-yellow-500/10 blur-xl"></div>{selectedStatusEntity.image ? (<img src={selectedStatusEntity.image} alt="Item" className="w-full h-full object-contain relative z-10" />) : (<span className="text-2xl">🎁</span>)}</div>
                        <div className="text-center"><h2 className="text-xl font-bold text-yellow-400 drop-shadow-sm">{selectedStatusEntity.name}</h2><p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Item no Chão</p></div>
                        <button onClick={() => handlePickUpLoot(selectedStatusEntity)} className="w-full py-3 bg-yellow-600/20 hover:bg-yellow-600/40 border border-yellow-500 text-yellow-200 font-bold uppercase tracking-widest rounded transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg"><span>✋</span> Pegar Item</button>
                        {role === 'DM' && (<p className="text-[9px] text-gray-500 text-center italic mt-1">(Dica: Selecione um token alvo para entregar o item a ele)</p>)}
                    </div>
                ) : (
                    <>
                        <div className="flex gap-3 mb-4">
                            <div onClick={() => role === 'DM' && setEditingEntity(selectedStatusEntity)} className={`w-16 h-16 rounded-lg border-2 border-cyan-400 overflow-hidden shrink-0 relative shadow-lg shadow-cyan-500/20 group ${role === 'DM' ? 'cursor-pointer' : ''}`}>
                            {selectedStatusEntity.image ? (<img src={selectedStatusEntity.image} alt={selectedStatusEntity.name} className="w-full h-full object-cover" />) : (<div className="w-full h-full flex items-center justify-center font-bold text-xl" style={{ backgroundColor: selectedStatusEntity.color }}>{selectedStatusEntity.name[0]}</div>)}
                            {role === 'DM' && (<div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><span className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest border border-cyan-300 px-1 rounded">Editar</span></div>)}
                            </div>
                            <div className="flex flex-col justify-center gap-1 text-xs w-full">
                            <div className="flex justify-between items-end border-b border-white/10 pb-1"><span className="text-cyan-400 font-bold uppercase tracking-wider text-[10px]">Nome</span><span className="font-bold truncate ml-1 text-white text-sm max-w-[140px]">{selectedStatusEntity.name}</span></div>
                            <div className="flex justify-between items-end border-b border-white/10 pb-1"><span className="text-cyan-400 font-bold uppercase tracking-wider text-[10px]">Classe</span><span className="font-bold text-white text-xs">{selectedStatusEntity.classType || 'N/A'}</span></div>
                            <div className="flex justify-between items-center bg-cyan-950/50 px-2 py-1 rounded border border-cyan-500/20 mt-1"><span className="text-cyan-400 font-bold text-[10px] uppercase">Nível</span><span className="font-black text-yellow-400 text-sm drop-shadow-sm">{getLevelFromXP(selectedStatusEntity.xp || 0)}</span></div>
                            </div>
                        </div>
                        <div className="mb-4">
                            <div className="flex justify-between text-[10px] font-bold mb-1 px-1 uppercase tracking-wider"><span className="text-cyan-400">Integridade</span><span className={selectedStatusEntity.hp < selectedStatusEntity.maxHp / 2 ? "text-red-400" : "text-cyan-100"}>{selectedStatusEntity.hp} / {selectedStatusEntity.maxHp}</span></div>
                            <div className="w-full h-3 bg-gray-800 rounded border border-cyan-500/30 overflow-hidden relative shadow-inner"><div className={`h-full transition-all duration-300 relative ${selectedStatusEntity.hp <= selectedStatusEntity.maxHp * 0.25 ? 'bg-red-600' : selectedStatusEntity.hp <= selectedStatusEntity.maxHp * 0.5 ? 'bg-yellow-500' : 'bg-gradient-to-r from-cyan-500 to-blue-600'}`} style={{ width: `${Math.max(0, Math.min(100, (selectedStatusEntity.hp / selectedStatusEntity.maxHp) * 100))}%` }}></div></div>
                        </div>
                        {selectedStatusEntity.stats && (
                            <div className="grid grid-cols-2 gap-2 text-xs bg-black/40 p-2 rounded-lg border border-cyan-500/20">
                            {Object.entries(selectedStatusEntity.stats).map(([stat, value]) => {
                                const mod = Math.floor((value - 10) / 2); const modStr = mod >= 0 ? `+${mod}` : `${mod}`; const labels: Record<string, string> = { str: 'FOR', dex: 'DES', con: 'CON', int: 'INT', wis: 'SAB', cha: 'CAR' };
                                return (<div key={stat} className="flex justify-between items-center px-2 py-1.5 bg-cyan-900/20 rounded border border-white/5 hover:border-cyan-500/30 transition-colors"><span className="font-bold text-cyan-500 text-[10px] uppercase">{labels[stat]}</span><div className="flex gap-1.5 items-baseline"><span className="text-white font-bold">{value}</span><span className={`font-black text-[10px] ${mod > 0 ? 'text-green-400' : mod < 0 ? 'text-red-400' : 'text-gray-500'}`}>{modStr}</span></div></div>);
                            })}
                            </div>
                        )}
                    </>
                )}
                </div>
            )}
            {showAllyCreator && (<EditEntityModal entity={{ id: 0, name: '', hp: 20, maxHp: 20, ac: 12, x:0, y:0, type: 'player', color: '', conditions: [], mirrored: false, size: 1, inventory: [] }} onSave={(id, updates) => handleSaveNewAlly(id, updates)} onClose={() => setShowAllyCreator(false)} />)}
            {showEnemyCreator && (<MonsterCreatorModal onSave={handleSaveNewEnemy} onSavePreset={handleSaveMonsterPreset} onClose={() => setShowEnemyCreator(false)} />)}
            {contextMenu && (<ContextMenu x={contextMenu.x} y={contextMenu.y} entity={contextMenu.entity} role={role} onClose={() => setContextMenu(null)} onAction={handleContextMenuAction} />)}
            
            <main className="relative flex-grow h-full overflow-hidden bg-black text-white">
                <div className="absolute top-4 left-4 z-[150] pointer-events-none opacity-50"><span className={`text-[10px] font-bold px-2 py-1 rounded border ${role === 'DM' ? 'bg-red-900 border-red-500' : 'bg-blue-900 border-blue-500'}`}>{role === 'DM' ? 'Mestre Supremo' : `Jogador: ${playerName}`}</span></div>

                <GameMap 
                    mapUrl={currentMap} gridSize={GRID_SIZE} entities={entities} role={role} fogGrid={fogGrid} isFogMode={isFogMode} fogTool={fogTool} activeTurnId={activeTurnId}
                    onFogUpdate={handleFogUpdate} onFogBulkUpdate={handleFogBulkUpdate} fogShape={fogShape}
                    onMoveToken={handleUpdatePosition} onAddToken={handleMapDrop} onRotateToken={handleRotateToken}
                    onResizeToken={handleResizeToken} onTokenDoubleClick={handleAddToInitiative} targetEntityIds={targetEntityIds} attackerId={attackerId} onSetTarget={handleSetTarget}
                    onSetAttacker={handleSetAttacker} onFlipToken={handleFlipToken} activeAoE={activeAoE} onAoEComplete={() => setActiveAoE(null)} aoeColor={aoeColor} onSelectEntity={handleSelectEntityForStatus}
                    externalOffset={mapOffset} externalScale={mapScale} onMapChange={handleMapSync} focusEntity={focusEntity} globalBrightness={globalBrightness}
                    onDropItem={handleDropLootOnMap} onGiveItemToToken={handleGiveItemToToken} onContextMenu={(e, entity) => { setContextMenu({ x: e.clientX, y: e.clientY, entity }); }} pings={pings} onPing={handlePingMap}
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
                    initiativeList={initiativeList} activeTurnId={activeTurnId} onAddToInitiative={handleAddToInitiative} onRemoveFromInitiative={handleRemoveFromInitiative} onNextTurn={handleNextTurn} onClearInitiative={handleClearInitiative} onSortInitiative={handleSortInitiative} targetEntityIds={targetEntityIds} attackerId={attackerId} onSetTarget={handleSetTarget} onToggleCondition={handleToggleCondition} onSetAttacker={handleSetAttacker} activeAoE={activeAoE} onSetAoE={setActiveAoE} chatMessages={chatMessages} onSendMessage={handleSendMessage} aoeColor={aoeColor} onSetAoEColor={setAoEColor} onOpenCreator={(type) => { if (type === 'player') setShowAllyCreator(true); if (type === 'enemy') setShowEnemyCreator(true); }} onAddXP={handleAddXP} customMonsters={customMonsters} globalBrightness={globalBrightness} onSetGlobalBrightness={handleUpdateGlobalBrightness} onRequestRoll={handleDmRequestRoll} onToggleVisibility={handleToggleVisibility} currentTrack={currentTrack} onPlayMusic={handlePlayMusic} onStopMusic={handleStopMusic} onPlaySFX={handlePlaySFX} audioVolume={audioVolume} onSetAudioVolume={setAudioVolume} onResetView={handleResetView} onGiveItem={handleGiveItem} onApplyDamageFromChat={handleApplyDamageFromChat} onDMRoll={handleDMRoll} /> 
                : <SidebarPlayer entities={entities} myCharacterName={playerName} myCharacterId={entities.find(e => e.name === playerName)?.id || 0} initiativeList={initiativeList} activeTurnId={activeTurnId} chatMessages={chatMessages} onSendMessage={handleSendMessage} onRollAttribute={handleAttributeRoll} onUpdateCharacter={handleEditEntity} onSelectEntity={(entity) => { setFocusEntity(entity); setTimeout(() => setFocusEntity(null), 100); }} onApplyDamageFromChat={handleApplyDamageFromChat} />
                }
            </aside>
          </>
      )}
    </div>
  );
}

export default App;