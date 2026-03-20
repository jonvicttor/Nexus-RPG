import React, { useState, useEffect, useRef } from 'react';
import { Entity } from '../App';
import { Shield, Crown, CheckCircle2, XCircle, User, Heart, Clipboard, Check, Sparkles, Send, Lock, MessageSquare, Sword } from 'lucide-react';
import { Howl } from 'howler';

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
}

const TavernPanel = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
  <div className={`relative p-1 rounded-3xl overflow-hidden group border border-white/5 transition-all duration-500 shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-amber-600/10 via-amber-900/5 to-blue-900/10 opacity-60 transition-opacity duration-700 z-0"></div>
      <div className="absolute inset-0 opacity-10 mix-blend-overlay pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] contrast-150 brightness-75 z-0"></div>
      <Sparkles className="absolute top-4 left-4 text-amber-500/10 w-5 h-5 z-0" />
      <Sparkles className="absolute top-4 right-4 text-amber-500/10 w-5 h-5 scale-x-[-1] z-0" />
      <div className="relative rounded-[22px] bg-black/60 backdrop-blur-xl shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] p-5 md:p-6 h-full flex flex-col z-10">
          {children}
      </div>
  </div>
);

const TavernSparks = () => {
    const sparks = [...Array(15)].map((_, i) => ({
      left: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 5}s`,
      animationDuration: `${3 + Math.random() * 4}s`,
    }));
  
    return (
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          {sparks.map((spark, i) => (
              <div key={i} className={`absolute w-1 h-1 bg-amber-500 rounded-full animate-sparks opacity-70 blur-[1px] shadow-[0_0_10px_#f59e0b]`}
                  style={{ left: spark.left, bottom: '-10%', animationDelay: spark.animationDelay, animationDuration: spark.animationDuration }}
              />
          ))}
      </div>
    );
};

const Lobby: React.FC<LobbyProps> = ({ availableCharacters, onStartGame, myPlayerName, chatMessages, onSendMessage }) => {
  const [selectedCharId, setSelectedCharId] = useState<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  
  const [localChat, setLocalChat] = useState<{sender: string, text: string, time: string}[]>([{sender: 'Sistema', text: 'Bem-vindos à Taverna! O calor da lareira aguarda.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const musicRef = useRef<Howl | null>(null);

  const titleFont = { fontFamily: '"Uncial Antiqua", serif' };
  const textFont = { fontFamily: '"Crimson Text", serif' };
  const roomCode = "X7B-99"; 

  useEffect(() => {
    const sound = new Howl({
      src: ['/sfx/tavern_ambiance.ogg'], 
      loop: true, volume: 0.3, html5: true, 
    });
    musicRef.current = sound; sound.play();
    return () => { musicRef.current?.stop(); musicRef.current?.unload(); };
  }, []);

  useEffect(() => {
      if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [localChat, chatMessages]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSendChat = (e: React.FormEvent) => {
      e.preventDefault();
      if(!chatInput.trim()) return;
      if (onSendMessage) {
          onSendMessage(chatInput);
      } else {
          setLocalChat(prev => [...prev, { sender: myPlayerName || 'Jogador', text: chatInput, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      }
      setChatInput('');
  };

  const uniqueCharacters = Array.from(new Map(availableCharacters.filter(e => e.type === 'player').map(item => [item.name, item])).values()) as PlayerEntity[];

  const currentPlayers = [
    { id: 99, name: myPlayerName || 'Jogador', role: myPlayerName === 'Mestre' ? 'DM' : 'PLAYER', ready: isReady, selectedCharId: selectedCharId }
  ];

  const displayChat = chatMessages || localChat;

  return (
    <div className="w-full min-h-[100dvh] bg-[#0d0b09] flex items-center justify-center p-4 md:p-6 overflow-y-auto overflow-x-hidden relative custom-scrollbar bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/tavern-bg.jpg')" }}>
      
      <TavernSparks />
      <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-black/70 z-0"></div>
          <div className="absolute inset-0 opacity-[0.15] bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] z-0"></div>
          <div className="absolute -bottom-1/4 left-1/2 -translate-x-1/2 w-full h-3/4 bg-gradient-to-t from-amber-700/20 via-amber-950/10 to-transparent blur-[100px] opacity-80 z-0"></div>
      </div>

      <div className="max-w-[1300px] w-full flex flex-col lg:grid lg:grid-cols-12 gap-5 relative z-10 py-6 lg:py-0 lg:h-[90vh]">
        
        <div className="lg:col-span-8 flex flex-col gap-5 lg:h-full">
          
          <TavernPanel className="shrink-0 !p-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
              <div>
                <h1 className="text-3xl md:text-5xl text-amber-500 mb-1 drop-shadow-md" style={titleFont}>A Taverna</h1>
                <p className="text-gray-400 text-xs md:text-sm italic" style={textFont}>Escolha o seu herói e junte-se à lareira.</p>
              </div>
              <div className="flex items-center gap-3 bg-black/50 px-5 py-3 rounded-xl border border-white/10 w-full sm:w-auto shadow-inner">
                <span className="text-gray-400 text-[10px] md:text-xs uppercase tracking-[0.2em] font-bold">Código:</span>
                <span className="text-amber-400 font-mono font-black tracking-widest text-lg md:text-xl">{roomCode}</span>
                <button onClick={handleCopyCode} className={`p-2 rounded-lg transition-colors flex gap-1 items-center ${copiedCode ? 'bg-green-900/50 text-green-400 border border-green-500/30' : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5'}`}>
                  {copiedCode ? <Check size={16}/> : <Clipboard size={16}/>}
                </button>
              </div>
            </div>
          </TavernPanel>

          <TavernPanel className="flex-grow lg:overflow-hidden flex flex-col">
            <h2 className="text-gray-400 uppercase tracking-[0.2em] text-xs font-black mb-5 border-b border-white/10 pb-3 flex items-center gap-2">
               <Shield size={16} className="text-amber-500"/> Heróis Disponíveis
            </h2>
            
            {/* MELHORIA: Padding adicionado para que o brilho (shadow) não seja cortado nas bordas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:overflow-y-auto lg:pr-4 custom-scrollbar content-start p-2">
              {uniqueCharacters.length > 0 ? uniqueCharacters.map((char) => {
                
                const isLockedByOther = currentPlayers.some(p => p.id !== 99 && p.ready && p.selectedCharId === char.id);
                const isMine = selectedCharId === char.id;

                return (
                  <div 
                    key={char.id}
                    onClick={() => !isLockedByOther && setSelectedCharId(char.id)}
                    className={`relative group border-2 rounded-2xl transition-all duration-300 h-[280px] flex flex-col
                      ${isLockedByOther ? 'border-gray-800 bg-gray-900 grayscale opacity-60 cursor-not-allowed overflow-hidden' : 
                        isMine ? 'border-amber-500 bg-amber-900/20 shadow-[0_0_30px_rgba(245,158,11,0.5)] -translate-y-2 cursor-pointer' : 
                        'border-white/10 bg-black/60 hover:border-white/30 hover:-translate-y-1 cursor-pointer shadow-lg overflow-hidden'
                      }`}
                  >
                    {/* Camada da Imagem com overflow hidden isolado para não cortar o brilho da borda da carta */}
                    <div className="absolute inset-0 rounded-[14px] overflow-hidden">
                      <img src={char.image || '/assets/card-template.png'} className={`w-full h-full object-cover transition-opacity duration-500 ${isMine ? 'opacity-100 animate-pulse-slow' : 'opacity-50 group-hover:opacity-80'}`} alt={char.name} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
                    </div>

                    <div className="relative z-10 flex flex-col h-full justify-end p-5">
                      <h3 className="text-3xl text-white leading-none mb-1 drop-shadow-lg" style={titleFont}>{char.name}</h3>
                      <p className="text-amber-400 text-[10px] md:text-xs uppercase font-black tracking-widest mb-4 drop-shadow-md">{char.race || 'Humano'} • {char.classType || 'Guerreiro'}</p>
                      
                      <div className="flex gap-2 text-xs text-gray-200 bg-black/50 p-2.5 rounded-xl backdrop-blur-md border border-white/10 font-bold">
                        <span className="flex items-center justify-center flex-1 gap-1.5 border-r border-white/10"><Shield size={14} className="text-blue-400"/> AC {char.ac}</span>
                        <span className="flex items-center justify-center flex-1 gap-1.5"><Heart size={14} className="text-red-500"/> HP {char.hp}</span>
                      </div>
                    </div>

                    {isMine && (
                      <div className="absolute top-3 right-3 bg-gradient-to-br from-amber-400 to-amber-600 text-black p-2 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.8)] animate-in zoom-in border border-amber-200 z-20">
                        <CheckCircle2 size={22} />
                      </div>
                    )}
                    {isLockedByOther && (
                      <div className="absolute top-3 right-3 bg-gray-800 text-gray-400 p-2 rounded-full border border-gray-600 shadow-lg z-20">
                        <Lock size={18} />
                      </div>
                    )}
                  </div>
                );
              }) : (
                <div className="col-span-full py-16 flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-white/5 rounded-2xl bg-black/30">
                    <Shield size={40} className="mb-3 opacity-30"/>
                    <p className="text-lg italic" style={textFont}>Nenhum herói forjado ainda.</p>
                </div>
              )}
            </div>
          </TavernPanel>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-5 lg:h-full">
          <TavernPanel className="flex flex-col shrink-0 max-h-[35%] !p-0">
            <h2 className="text-gray-400 uppercase tracking-[0.2em] text-xs font-black mb-3 flex items-center gap-2 border-b border-white/10 pb-3">
              <User size={16} className="text-blue-400"/> Companheiros ({currentPlayers.length}/5)
            </h2>
            <div className="space-y-2 overflow-y-auto pr-1 custom-scrollbar">
              {currentPlayers.map(player => {
                const pChar = uniqueCharacters.find(c => c.id === player.selectedCharId);
                return (
                  <div key={player.id} className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5 shadow-inner">
                    <div className="flex items-center gap-3">
                      {pChar ? (
                         <div className="w-10 h-10 rounded-full border-2 border-amber-500 overflow-hidden shadow-[0_0_10px_rgba(245,158,11,0.3)] shrink-0 bg-black animate-in zoom-in">
                             <img src={pChar.image} alt={pChar.name} className="w-full h-full object-cover" />
                         </div>
                      ) : (
                         <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 shrink-0 bg-black/50 ${player.role === 'DM' ? 'border-purple-500 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 'border-gray-700 text-gray-500'}`}>
                           {player.role === 'DM' ? <Crown size={16}/> : <User size={18}/>}
                         </div>
                      )}
                      
                      <div className="flex flex-col justify-center">
                        <div className="text-sm text-gray-100 font-bold truncate max-w-[100px] sm:max-w-[130px]">{player.name}</div>
                        <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest">{player.role === 'DM' ? 'Mestre' : (pChar ? pChar.name : 'Escolhendo...')}</div>
                      </div>
                    </div>
                    <div>
                      {player.ready ? (
                        <div className="flex items-center gap-1 text-[10px] text-green-400 bg-green-950/40 px-2.5 py-1.5 rounded-lg border border-green-800/50 font-bold uppercase tracking-wider">
                          <CheckCircle2 size={14}/> Pronto
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[10px] text-amber-500/70 bg-amber-950/20 px-2.5 py-1.5 rounded-lg border border-amber-900/30 font-bold uppercase tracking-wider">
                          <XCircle size={14}/> Aguardando
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TavernPanel>

          <TavernPanel className="flex flex-col flex-1 min-h-0 !p-0">
            <h2 className="text-gray-400 uppercase tracking-[0.2em] text-xs font-black mb-2 border-b border-white/10 pb-3 flex items-center gap-2 shrink-0">
               <MessageSquare size={16} className="text-purple-400"/> Conversa da Lareira
            </h2>
            
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3 mb-3 flex flex-col">
               {displayChat.map((msg, idx) => {
                  const isSystem = msg.sender === 'Sistema';
                  const isMe = msg.sender === (myPlayerName || 'Jogador');
                  return (
                     <div key={idx} className={`flex flex-col max-w-[90%] ${isSystem ? 'self-center text-center' : isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                        {!isSystem && <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-0.5 px-1">{msg.sender}</span>}
                        <div className={`px-3 py-2 rounded-xl text-sm shadow-md text-gray-200 border ${isSystem ? 'bg-amber-900/20 border-amber-500/30 text-amber-200 text-xs italic' : isMe ? 'bg-blue-900/30 border-blue-500/30 rounded-tr-sm' : 'bg-gray-800/50 border-gray-600/50 rounded-tl-sm'}`}>
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
                  className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
               />
               <button type="submit" disabled={!chatInput.trim()} className="bg-amber-600 hover:bg-amber-500 disabled:bg-gray-800 disabled:text-gray-500 text-black p-3 rounded-xl transition-all active:scale-95">
                  <Send size={18} />
               </button>
            </form>
          </TavernPanel>

          <div className="flex flex-col gap-3 shrink-0">
            <button 
              onClick={() => {
                  if (!selectedCharId) {
                      setLocalChat(prev => [...prev, { sender: 'Sistema', text: '⚠️ Escolha um herói primeiro!', time: new Date().toLocaleTimeString() }]);
                      return;
                  }
                  setIsReady(!isReady);
              }}
              className={`w-full py-4 text-base md:text-lg font-black uppercase tracking-[0.2em] rounded-2xl border transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95 group overflow-hidden relative
                ${isReady 
                  ? 'bg-green-900/80 border-green-500 text-green-100 hover:bg-green-800 shadow-[0_0_30px_rgba(34,197,94,0.3)]' 
                  : 'bg-amber-700 border-amber-400 text-black hover:bg-amber-600 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                }`}
              style={titleFont}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              {isReady ? <><CheckCircle2 size={24}/> Em Prontidão</> : <><Sword size={24}/> Marcar como Pronto</>}
            </button>

            <button 
              onClick={onStartGame}
              className="w-full py-3.5 bg-black/60 hover:bg-indigo-950/80 border border-indigo-900/50 hover:border-indigo-500/50 text-indigo-400 hover:text-indigo-200 rounded-xl uppercase text-[10px] md:text-xs font-black tracking-[0.2em] transition-all backdrop-blur-sm"
            >
              Iniciar Aventura (DM Override)
            </button>
          </div>

        </div>
      </div>
      
      <style>{`
        @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        .animate-pulse-slow { animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        
        @keyframes sparks {
            0% { transform: translateY(0) scale(1); opacity: 0; }
            10% { opacity: 0.8; }
            100% { transform: translateY(-100vh) scale(0.3) translateX(calc(-50px + 100px * ${Math.random()})); opacity: 0; }
        }
        .animate-sparks { animation: sparks linear infinite; }
      `}</style>
    </div>
  );
};

export default Lobby;