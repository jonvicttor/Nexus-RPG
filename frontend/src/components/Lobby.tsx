import React, { useState, useEffect, useRef } from 'react';
import { Entity } from '../App';
import { Shield, Crown, CheckCircle2, XCircle, User, Heart, Clipboard, Check, Sparkles, Send, Lock, MessageSquare, Sword, Info, Trash2, Volume2, VolumeX } from 'lucide-react';
import { Howl } from 'howler';
import socket from '../services/socket';

interface PlayerEntity extends Entity {
    race?: string;
    classType?: string;
}

interface LobbyProps {
  availableCharacters: Entity[];
  onStartGame: () => void;
  myPlayerName: string;
  chatMessages?: { sender: string; text: string; timestamp?: string }[];
  onSendMessage?: (text: string) => void;
  roomCode?: string;
}

// --- GLASSMORPHISM PANEL REFINADO ---
const TavernPanel = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
  <div className={`relative p-[1px] rounded-3xl overflow-hidden group transition-all duration-500 shadow-[0_10px_40px_rgba(0,0,0,0.6)] flex flex-col ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-amber-900/30 z-0"></div>
      <div className="absolute inset-[1px] rounded-[23px] overflow-hidden pointer-events-none z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-600/10 via-amber-900/5 to-blue-900/10 opacity-60 transition-opacity duration-700"></div>
          <div className="absolute inset-0 opacity-[0.12] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')] contrast-150 brightness-75"></div>
      </div>
      <Sparkles className="absolute top-4 left-4 text-amber-500/10 w-5 h-5 z-0 pointer-events-none" />
      <Sparkles className="absolute top-4 right-4 text-amber-500/10 w-5 h-5 scale-x-[-1] z-0 pointer-events-none" />
      <div className="relative rounded-[23px] bg-black/60 backdrop-blur-xl shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] p-4 md:p-6 flex-grow flex flex-col z-10 overflow-hidden">
          {children}
      </div>
  </div>
);

// 👉 FIX: Fagulhas agora são fixas na montagem para não reiniciarem a cada "ping" da rede
const TavernSparks = () => {
    const [sparks, setSparks] = useState<{left: string, delay: string, duration: string, tx: string}[]>([]);
    
    useEffect(() => {
        setSparks([...Array(20)].map(() => ({
            left: `${Math.random() * 100}%`,
            delay: `${Math.random() * 5}s`,
            duration: `${3 + Math.random() * 4}s`,
            tx: `${(Math.random() - 0.5) * 150}px` // Desvio lateral aleatório
        })));
    }, []);

    return (
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          {sparks.map((spark, i) => (
              <div key={i} className={`absolute w-1.5 h-1.5 bg-amber-500 rounded-full animate-sparks opacity-0 blur-[1px] shadow-[0_0_10px_#f59e0b]`}
                  style={{ 
                      left: spark.left, 
                      bottom: '-5%', 
                      animationDelay: spark.delay, 
                      animationDuration: spark.duration, 
                      '--tx': spark.tx 
                  } as React.CSSProperties}
              />
          ))}
      </div>
    );
};

const Lobby: React.FC<LobbyProps> = ({ availableCharacters, onStartGame, myPlayerName, chatMessages, onSendMessage, roomCode }) => {
  const [selectedCharId, setSelectedCharId] = useState<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  
  const [isMuted, setIsMuted] = useState(false);
  const musicRef = useRef<Howl | null>(null);
  
  const [localChat, setLocalChat] = useState<{sender: string, text: string, time: string}[]>([{sender: 'Sistema', text: 'Bem-vindos à Taverna! O calor da lareira aguarda.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const titleFont = { fontFamily: '"Uncial Antiqua", serif' };
  const textFont = { fontFamily: '"Crimson Text", serif' };
  
  const displayRoomCode = roomCode || "SALA-SECRETA"; 
  const isDM = myPlayerName === 'Mestre Supremo' || myPlayerName === 'Mestre' || myPlayerName?.includes('Mestre');

  const [networkPlayers, setNetworkPlayers] = useState<Record<string, any>>({});

  useEffect(() => {
      const myData = { id: socket.id || 'local', name: myPlayerName, role: isDM ? 'DM' : 'PLAYER', ready: isReady, selectedCharId: selectedCharId };
      const emitPresence = () => { socket.emit('sendLobbyMessage', { roomId: displayRoomCode, isPresence: true, player: myData }); };
      emitPresence();
      const interval = setInterval(emitPresence, 1500); 
      return () => clearInterval(interval);
  }, [isReady, selectedCharId, myPlayerName, isDM, displayRoomCode]);

  useEffect(() => {
      const handleLobbyMsg = (msgData: any) => {
          if (msgData.roomId === displayRoomCode) {
              if (msgData.isPresence) {
                  setNetworkPlayers(prev => ({ ...prev, [msgData.player.id]: { ...msgData.player, lastSeen: Date.now() } }));
              } else {
                  setLocalChat(prev => [...prev, msgData]);
              }
          }
      };
      socket.on('receiveLobbyMessage', handleLobbyMsg);
      return () => { socket.off('receiveLobbyMessage', handleLobbyMsg); };
  }, [displayRoomCode]);

  useEffect(() => {
      const interval = setInterval(() => {
          const now = Date.now();
          setNetworkPlayers(prev => {
              let changed = false; const next = { ...prev };
              for (const key in next) { if (now - next[key].lastSeen > 4000) { delete next[key]; changed = true; } }
              return changed ? next : prev;
          });
      }, 2000);
      return () => clearInterval(interval);
  }, []);

  const currentPlayers = [
      { id: socket.id || '99', name: myPlayerName || 'Jogador', role: isDM ? 'DM' : 'PLAYER', ready: isReady, selectedCharId: selectedCharId },
      ...Object.values(networkPlayers).filter(p => p.id !== socket.id)
  ];

  useEffect(() => {
    const sound = new Howl({ 
      src: ['/sfx/tavern_ambiance.mp3', '/sfx/tavern_ambiance.ogg'],
      loop: true, 
      volume: 0.3, 
      html5: true 
    });
    musicRef.current = sound; 
    sound.play();
    return () => { musicRef.current?.stop(); musicRef.current?.unload(); };
  }, []);

  const toggleMute = () => {
    if (musicRef.current) {
      const newState = !isMuted;
      setIsMuted(newState);
      musicRef.current.mute(newState);
    }
  };

  useEffect(() => {
      if (chatScrollRef.current) chatScrollRef.current.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [localChat, chatMessages]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(displayRoomCode);
    setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSendChat = (e: React.FormEvent) => {
      e.preventDefault();
      if(!chatInput.trim()) return;
      const newMsg = { sender: myPlayerName || 'Jogador', text: chatInput, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), roomId: displayRoomCode };
      if (onSendMessage) onSendMessage(chatInput);
      else { socket.emit('sendLobbyMessage', newMsg); setLocalChat(prev => [...prev, newMsg]); }
      setChatInput('');
  };

  // 👉 FIX: Cruzamento de dados! Só mostra a ficha se o nome do dono estiver na lista de online.
  const onlinePlayerNames = currentPlayers.map(p => p.name.toLowerCase());

  const uniqueCharacters = Array.from(new Map(
      availableCharacters
      .filter(e => e.type === 'player' && !deletedIds.includes(e.id))
      .filter(e => onlinePlayerNames.includes(e.name.toLowerCase())) // <-- O FILTRO MÁGICO AQUI
      .map(item => [item.name, item])
  ).values()) as PlayerEntity[];
  
  const displayChat = chatMessages || localChat;

  return (
    <div className="h-[100dvh] w-full relative bg-[#0d0b09] bg-cover bg-center bg-fixed font-serif overflow-y-auto" style={{ backgroundImage: "url('/images/tavern-bg.jpg')" }}>
      <TavernSparks />
      
      <button onClick={toggleMute} className="fixed top-4 right-4 md:top-6 md:right-6 z-50 text-amber-700 hover:text-amber-400 transition-colors bg-black/60 p-2 md:p-3 rounded-full border border-amber-800/50 hover:border-amber-500 backdrop-blur-md hover:scale-110 active:scale-95 duration-200 shadow-lg">
        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>

      <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-black/75 z-0"></div>
          <div className="absolute inset-0 opacity-[0.15] bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] z-0"></div>
          <div className="absolute -bottom-1/4 left-1/2 -translate-x-1/2 w-full h-3/4 bg-gradient-to-t from-amber-700/20 via-amber-950/10 to-transparent blur-[100px] opacity-80 z-0"></div>
      </div>

      <div className="relative z-10 w-full min-h-full p-4 py-8 md:p-8 flex flex-col items-center justify-start lg:justify-center">
        <div className="max-w-[1300px] w-full flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:h-[88vh]">
          
          {/* === COLUNA ESQUERDA === */}
          <div className="lg:col-span-8 flex flex-col gap-6 lg:h-full lg:overflow-hidden">
            <TavernPanel className="shrink-0 !p-0">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full pr-12 md:pr-0">
                <div className="w-full sm:w-auto text-left">
                  <h1 className="text-3xl md:text-5xl text-amber-500 mb-1 drop-shadow-md" style={titleFont}>A Taverna</h1>
                  <p className="text-gray-400 text-xs md:text-sm italic" style={textFont}>Escolha o seu herói e junte-se à lareira.</p>
                </div>
                <div className="flex items-center justify-between sm:justify-start gap-3 bg-black/50 px-4 py-3 rounded-xl border border-white/10 w-auto shadow-inner flex-nowrap">
                  <span className="text-gray-400 text-[10px] md:text-xs uppercase tracking-[0.2em] font-bold shrink-0">Código:</span>
                  <span className="text-amber-400 font-mono font-black tracking-widest text-sm sm:text-base md:text-xl drop-shadow-[0_0_5px_rgba(251,191,36,0.5)] truncate">{displayRoomCode}</span>
                  <button onClick={handleCopyCode} className={`shrink-0 p-2 rounded-lg transition-colors flex gap-1 items-center ${copiedCode ? 'bg-green-900/50 text-green-400 border border-green-500/30' : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5'}`}>
                    {copiedCode ? <Check size={16}/> : <Clipboard size={16}/>}
                  </button>
                </div>
              </div>
            </TavernPanel>

            <TavernPanel className="flex-grow lg:flex-1 flex flex-col min-h-[350px]">
              <div className="flex items-center justify-between mb-2 border-b border-white/10 pb-3 shrink-0">
                  <h2 className="text-amber-500/80 uppercase tracking-[0.2em] text-xs font-black flex items-center gap-2">
                     <Shield size={16} /> Heróis Disponíveis
                  </h2>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest hidden sm:block">Apenas Jogadores Online</span>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2 pb-4 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-1">
                  {uniqueCharacters.length > 0 ? uniqueCharacters.map((char) => {
                    
                    const isLockedByOther = currentPlayers.some(p => p.id !== socket.id && p.ready && p.selectedCharId === char.id);
                    const isMine = selectedCharId === char.id;

                    return (
                      <div 
                        key={char.id}
                        onClick={() => {
                          if (!isLockedByOther && !isDM) {
                              if (selectedCharId === char.id) { setSelectedCharId(null); setIsReady(false); } 
                              else { setSelectedCharId(char.id); setIsReady(true); }
                          }
                        }}
                        className={`relative group rounded-[16px] transition-all duration-300 h-[260px] flex flex-col border-[2px] box-border
                          ${isLockedByOther ? 'border-gray-800 bg-gray-900 grayscale opacity-60 cursor-not-allowed z-0' : 
                            isMine ? 'border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)] -translate-y-2 cursor-pointer z-10' : 
                            isDM ? 'border-white/10 bg-black/60 opacity-80 z-0' : 'border-white/10 bg-black/60 hover:border-white/30 hover:-translate-y-1 cursor-pointer shadow-lg z-0 hover:shadow-[0_10px_20px_rgba(0,0,0,0.5)]'
                          }`}
                      >
                        {isDM && (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if(window.confirm(`Apagar permanentemente a ficha de ${char.name}?`)) {
                                        setDeletedIds(prev => [...prev, char.id]);
                                        socket.emit('deleteEntity', { entityId: char.id, roomId: displayRoomCode });
                                    }
                                }}
                                className="absolute top-3 left-3 bg-black/60 p-2 rounded-full border border-red-900/50 text-red-500 hover:text-white hover:bg-red-600 hover:border-red-400 z-30 transition-all shadow-lg"
                                title="Apagar Ficha"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}

                        <div className="absolute inset-0 rounded-[14px] overflow-hidden">
                          <img src={char.image || '/assets/card-template.png'} className={`w-full h-full object-cover transition-transform duration-700 ${isMine ? 'opacity-100 scale-105' : 'opacity-60 group-hover:opacity-90 group-hover:scale-105'}`} alt={char.name} />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent"></div>
                        </div>

                        <div className="relative z-10 flex flex-col h-full justify-end pt-3 pb-3 px-5">
                          <div className="text-center">
                              <h3 className="text-3xl text-white leading-none mb-1 drop-shadow-lg" style={titleFont}>{char.name}</h3>
                              <p className="text-amber-400 text-[10px] md:text-xs uppercase font-black tracking-widest mb-3 drop-shadow-md">{char.race || 'Humano'} • {char.classType || 'Guerreiro'}</p>
                          </div>
                          
                          <div className="flex gap-2 text-xs text-gray-200 bg-black/50 p-2.5 rounded-xl backdrop-blur-md border border-white/10 font-bold shadow-[0_4px_10px_rgba(0,0,0,0.3)]">
                            <span className="flex items-center justify-center flex-1 gap-1.5 border-r border-white/10"><Shield size={14} className="text-blue-400"/> AC {char.ac}</span>
                            <span className="flex items-center justify-center flex-1 gap-1.5"><Heart size={14} className="text-red-500"/> HP {char.hp}</span>
                          </div>
                        </div>

                        {isMine && (
                          <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-md text-amber-400 p-1.5 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.6)] animate-in zoom-in border border-amber-500/50 z-20">
                            <CheckCircle2 size={24} strokeWidth={2.5} />
                          </div>
                        )}
                        {isLockedByOther && (
                          <div className="absolute top-3 right-3 bg-gray-900/80 backdrop-blur-sm text-gray-500 p-2 rounded-full border border-gray-700 shadow-lg z-20">
                            <Lock size={18} />
                          </div>
                        )}
                      </div>
                    );
                  }) : (
                    <div className="col-span-full py-16 flex flex-col items-center justify-center text-gray-500 border border-dashed border-white/10 rounded-2xl bg-black/30">
                        <Shield size={40} className="mb-3 opacity-30"/>
                        <p className="text-lg italic text-center px-4" style={textFont}>Nenhum herói online neste momento.<br/>Os aventureiros aparecerão quando se juntarem à Taverna.</p>
                    </div>
                  )}
                </div>
              </div>
            </TavernPanel>
          </div>

          {/* === COLUNA DIREITA === */}
          <div className="lg:col-span-4 flex flex-col gap-6 lg:h-full lg:overflow-hidden pb-4 lg:pb-0">
            
            <TavernPanel className="flex flex-col shrink-0 max-h-[250px] lg:max-h-[35%] !p-0">
              <h2 className="text-gray-400 uppercase tracking-[0.2em] text-xs font-black mb-3 flex items-center gap-2 border-b border-white/10 pb-3 shrink-0">
                <User size={16} className="text-blue-400"/> Companheiros Online ({currentPlayers.length})
              </h2>
              <div className="space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                {currentPlayers.map(player => {
                  const pChar = uniqueCharacters.find(c => c.id === player.selectedCharId);
                  return (
                    <div key={player.id} className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5 shadow-[0_2px_10px_rgba(0,0,0,0.2)]">
                      <div className="flex items-center gap-3">
                        {pChar ? (
                           <div className="w-10 h-10 rounded-full border border-amber-500/80 overflow-hidden shadow-[0_0_10px_rgba(245,158,11,0.3)] shrink-0 bg-black animate-in zoom-in">
                               <img src={pChar.image} alt={pChar.name} className="w-full h-full object-cover" />
                           </div>
                        ) : (
                           <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border shrink-0 bg-black/50 ${player.role === 'DM' ? 'border-purple-500/50 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'border-gray-700 text-gray-500'}`}>
                             {player.role === 'DM' ? <Crown size={16}/> : <User size={18}/>}
                           </div>
                        )}
                        
                        <div className="flex flex-col justify-center">
                          <div className="text-sm text-gray-100 font-bold truncate max-w-[100px] sm:max-w-[130px] leading-tight">{player.name}</div>
                          <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest">{player.role === 'DM' ? 'Mestre do Jogo' : (pChar ? pChar.name : 'Escolhendo...')}</div>
                        </div>
                      </div>
                      <div>
                        {player.role === 'DM' ? (
                          <div className="flex items-center gap-1.5 text-[9px] text-purple-300 bg-purple-950/50 px-2.5 py-1.5 rounded-lg border border-purple-800/60 font-black uppercase tracking-[0.1em] shadow-[0_0_10px_rgba(168,85,247,0.1)]">
                            <Crown size={12} strokeWidth={3}/> Administrando
                          </div>
                        ) : player.ready ? (
                          <div className="flex items-center gap-1.5 text-[9px] text-green-300 bg-green-950/50 px-2.5 py-1.5 rounded-lg border border-green-800/60 font-black uppercase tracking-[0.1em] shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                            <CheckCircle2 size={12} strokeWidth={3}/> Pronto
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[9px] text-amber-500/80 bg-amber-950/30 px-2.5 py-1.5 rounded-lg border border-amber-900/40 font-black uppercase tracking-[0.1em]">
                            <XCircle size={12} strokeWidth={3}/> Aguardando
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TavernPanel>

            <TavernPanel className="flex flex-col h-[400px] lg:h-auto lg:flex-1 lg:min-h-0 !p-0">
              <h2 className="text-gray-400 uppercase tracking-[0.2em] text-xs font-black mb-2 border-b border-white/10 pb-3 flex items-center gap-2 shrink-0">
                 <MessageSquare size={16} className="text-purple-400"/> Conversa da Lareira
              </h2>
              
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3 mb-3 flex flex-col pt-2">
                 {displayChat.length === 0 && <p className="text-center text-gray-600 text-xs italic m-auto font-serif">A taverna está silenciosa...</p>}
                 {displayChat.map((msg, idx) => {
                    const isSystem = msg.sender === 'Sistema';
                    const isMe = msg.sender === (myPlayerName || 'Jogador');
                    
                    if (isSystem) {
                        return (
                            <div key={idx} className="self-center flex items-center gap-2 bg-amber-900/10 border border-amber-500/20 px-4 py-2 rounded-full my-1 shadow-sm">
                                <Info size={12} className="text-amber-500/70" />
                                <span className="text-[11px] text-amber-200/80 italic font-serif tracking-wide">{msg.text}</span>
                            </div>
                        );
                    }

                    return (
                       <div key={idx} className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                          <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1 px-1">{msg.sender}</span>
                          <div className={`px-3.5 py-2.5 rounded-2xl text-[13px] shadow-md border leading-relaxed ${isMe ? 'bg-blue-900/40 border-blue-500/30 text-blue-50 rounded-tr-sm' : 'bg-gray-800/60 border-gray-600/50 text-gray-200 rounded-tl-sm'}`}>
                             {msg.text}
                          </div>
                       </div>
                    );
                 })}
              </div>

              <form onSubmit={handleSendChat} className="flex gap-2 shrink-0 mt-auto pt-3 border-t border-white/10">
                 <input 
                    type="text" 
                    value={chatInput} 
                    onChange={e => setChatInput(e.target.value)} 
                    placeholder="Diga algo à mesa..." 
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors shadow-inner"
                    style={{ fontSize: '16px' }}
                 />
                 <button type="submit" disabled={!chatInput.trim()} className="bg-gradient-to-br from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 disabled:from-gray-800 disabled:to-gray-900 disabled:text-gray-600 text-black p-3 rounded-xl transition-all shadow-[0_4px_15px_rgba(245,158,11,0.2)] disabled:shadow-none active:scale-95 flex items-center justify-center">
                    <Send size={18} className="translate-x-[-1px] translate-y-[1px]" />
                 </button>
              </form>
            </TavernPanel>

            <div className="flex flex-col gap-3 shrink-0">
              {isDM ? (
                <button 
                  onClick={onStartGame}
                  className={`w-full py-4 text-base md:text-lg font-black uppercase tracking-[0.25em] rounded-2xl border transition-all duration-300 flex items-center justify-center gap-3 active:scale-95 group overflow-hidden relative bg-gradient-to-r from-purple-900 via-purple-700 to-purple-900 border-purple-500 text-white hover:brightness-110 shadow-[0_0_25px_rgba(168,85,247,0.4)]`}
                  style={titleFont}
                >
                  <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 z-0"></div>
                  <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity z-0"></div>
                  <span className="relative z-10 flex items-center gap-3">
                     <Crown size={24}/> Iniciar Aventura
                  </span>
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => {
                        if (!selectedCharId) {
                            setLocalChat(prev => [...prev, { sender: 'Sistema', text: '⚠️ Escolha um herói primeiro!', time: new Date().toLocaleTimeString() }]);
                            return;
                        }
                        setIsReady(!isReady);
                    }}
                    className={`w-full py-4 text-base md:text-lg font-black uppercase tracking-[0.25em] rounded-2xl border transition-all duration-300 flex items-center justify-center gap-3 active:scale-95 group overflow-hidden relative
                      ${isReady 
                        ? 'bg-green-900/80 border-green-500 text-green-50 hover:bg-green-800 shadow-[0_0_30px_rgba(34,197,94,0.25)]' 
                        : 'bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800 border-amber-500 text-black hover:brightness-110 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                      }`}
                    style={titleFont}
                  >
                    {!isReady && <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 z-0"></div>}
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity z-0"></div>
                    
                    <span className="relative z-10 flex items-center gap-3">
                       {isReady ? <><CheckCircle2 size={24}/> Estou Pronto</> : <><Sword size={24}/> Preparar Batalha</>}
                    </span>
                  </button>

                  <div className="w-full py-3.5 bg-black/40 border border-white/5 text-gray-500 rounded-xl uppercase text-[10px] md:text-xs font-black tracking-[0.2em] flex items-center justify-center backdrop-blur-sm">
                    Aguardando Mestre Iniciar...
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        .animate-pulse-slow { animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        
        @keyframes sparks {
            0% { transform: translate(0, 0) scale(1); opacity: 0; }
            20% { opacity: 1; }
            100% { transform: translate(var(--tx), -100vh) scale(0.3); opacity: 0; }
        }
        .animate-sparks { animation: sparks linear infinite; }

        @keyframes shimmer {
            100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default Lobby;