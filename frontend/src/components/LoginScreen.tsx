import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import socket from '../services/socket';
import { Howl } from 'howler';
import { Trash2, Plus, Play, Sword, Crown, ChevronRight, Search, UserPlus, Sparkles, XCircle, Scroll, Map as MapIcon, Key } from 'lucide-react';

// --- DADOS E REGRAS ---
const RACES = {
  'HUMANO':    { bonus: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, desc: '+1 em Todos' },
  'ANAO':      { bonus: { str: 0, dex: 0, con: 2, int: 0, wis: 0, cha: 0 }, desc: '+2 Cons.' },
  'ELFO':      { bonus: { str: 0, dex: 2, con: 0, int: 0, wis: 0, cha: 0 }, desc: '+2 Destreza' },
  'HALFLING':  { bonus: { str: 0, dex: 2, con: 0, int: 0, wis: 0, cha: 0 }, desc: '+2 Destreza' },
  'DRACONATO': { bonus: { str: 2, dex: 0, con: 0, int: 0, wis: 0, cha: 1 }, desc: '+2 Força, +1 Car.' },
  'GNOMO':     { bonus: { str: 0, dex: 0, con: 0, int: 2, wis: 0, cha: 0 }, desc: '+2 Int.' },
  'MEIO-ELFO': { bonus: { str: 0, dex: 1, con: 1, int: 0, wis: 0, cha: 2 }, desc: '+2 Car., +1 Dex/Con' },
  'MEIO-ORC':  { bonus: { str: 2, dex: 0, con: 1, int: 0, wis: 0, cha: 0 }, desc: '+2 Força, +1 Cons.' },
  'TIEFLING':  { bonus: { str: 0, dex: 0, con: 0, int: 1, wis: 0, cha: 2 }, desc: '+2 Car., +1 Int.' },
};

const CLASSES = {
  'BARBARO':    { hpBase: 12, image: '/tokens/barbaro.png', ac: 14, icon: '🪓' },
  'BARDO':       { hpBase: 8,  image: '/tokens/bardo.png',   ac: 13, icon: '🎵' },
  'CLERIGO':     { hpBase: 8,  image: '/tokens/clerigo.png', ac: 18, icon: '✨' },
  'DRUIDA':      { hpBase: 8,  image: '/tokens/druida.png',  ac: 14, icon: '🌿' },
  'GUERREIRO':   { hpBase: 10, image: '/tokens/guerreiro.png', ac: 16, icon: '⚔️' },
  'MONGE':       { hpBase: 8,  image: '/tokens/monge.png',   ac: 15, icon: '👊' },
  'PALADINO':    { hpBase: 10, image: '/tokens/paladino.png', ac: 18, icon: '🛡️' },
  'ARQUEIRO':    { hpBase: 10, image: '/tokens/arqueiro.png', ac: 15, icon: '🏹' },
  'ASSASSINO':   { hpBase: 8,  image: '/tokens/assassino.png',  ac: 14, icon: '🗡️' },
  'FEITICEIRO':  { hpBase: 6,  image: '/tokens/feiticeiro.png', ac: 12, icon: '🔥' },
  'BRUXO':       { hpBase: 8,  image: '/tokens/bruxo.png',   ac: 13, icon: '👁️' },
  'MAGO':        { hpBase: 6,  image: '/tokens/mago.png',    ac: 12, icon: '🔮' },
};

const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

interface LoginScreenProps {
  onLogin: (role: 'DM' | 'PLAYER', name: string, charData?: any) => void;
}

// --- COMPONENTES DE UI MOVIDOS PARA FORA PARA EVITAR BUG DO TECLADO ---
const ArcaneContainer = ({ children, className = '', width = 'w-full md:w-[500px]' }: { children: React.ReactNode, className?: string, width?: string }) => (
  <div className={`relative ${width} p-1 rounded-3xl overflow-hidden group/container ${className} transition-all duration-500`}>
      <div className="absolute inset-0 bg-gradient-to-br from-amber-600/30 via-transparent to-blue-900/30 opacity-50 group-hover/container:opacity-100 transition-opacity duration-700"></div>
      <div className="absolute inset-[2px] rounded-[22px] bg-gradient-to-br from-amber-900/20 via-black to-blue-900/20 backdrop-blur-xl"></div>
      <div className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] contrast-150 brightness-75"></div>
      <div className="relative rounded-3xl bg-[#0a0a0a]/90 shadow-[inset_0_0_30px_rgba(0,0,0,1)] border border-white/5 p-4 md:p-8 h-full overflow-hidden flex flex-col">
          <Sparkles className="absolute top-3 left-3 text-amber-700/30 w-5 h-5" />
          <Sparkles className="absolute top-3 right-3 text-amber-700/30 w-5 h-5 scale-x-[-1]" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-amber-800/50 to-transparent"></div>
          {children}
      </div>
  </div>
);

const MetalButton = ({ children, onClick, disabled, variant = 'amber', className = '', fullWidth = false }: any) => {
  const colors = variant === 'amber' 
      ? 'from-amber-700 via-amber-600 to-amber-800 border-amber-500/40 shadow-amber-900/30 text-amber-50 hover:text-white' 
      : variant === 'blue'
      ? 'from-blue-900 via-blue-800 to-blue-950 border-blue-500/40 shadow-blue-900/30 text-blue-50 hover:text-white'
      : 'from-red-900 via-red-800 to-red-950 border-red-500/40 shadow-red-900/30 text-red-50 hover:text-white';
  
  return (
      <button type="button" onClick={onClick} disabled={disabled} className={`relative group overflow-hidden px-4 md:px-6 py-2 md:py-3 rounded-xl border-t border-b ${colors} bg-gradient-to-r shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all duration-200 ${fullWidth ? 'w-full' : ''} ${className} disabled:opacity-50 disabled:cursor-not-allowed`}>
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <span className={`relative z-10 font-black uppercase tracking-[0.2em] text-[10px] md:text-xs flex items-center justify-center gap-2 drop-shadow-md`}>
              {children}
          </span>
      </button>
  );
}

const StoneInput = (props: any) => (
  <div className="relative group/input flex-grow w-full">
      <input 
          {...props}
          className={`w-full bg-black/60 border-b-2 border-white/10 focus:border-amber-500/80 p-3 text-lg md:text-xl text-amber-50 outline-none transition-all font-serif placeholder-white/20 shadow-[inset_0_5px_10px_rgba(0,0,0,0.5)] rounded-t-lg group-hover/input:bg-black/80 ${props.className}`}
      />
      <div className="absolute bottom-0 left-0 w-0 h-[2px] bg-amber-500 transition-all duration-500 group-focus-within/input:w-full"></div>
  </div>
);

const BackgroundWrapper = ({ children, isMuted, toggleMute }: { children: React.ReactNode, isMuted: boolean, toggleMute: () => void }) => (
  <div className="relative w-screen h-[100dvh] flex items-center justify-center overflow-hidden bg-[#050505] font-serif">
    <div 
      className="absolute inset-0 bg-cover bg-center opacity-60 animate-in fade-in duration-[2s]"
      style={{ backgroundImage: "url('/login-bg.jpg')" }}
    ></div>
    <div className="absolute inset-0 bg-black/80 mix-blend-multiply"></div>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,1)_90%)] pointer-events-none"></div>
    <div className="absolute inset-0 opacity-[0.15] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] contrast-150 brightness-100 mix-blend-overlay"></div>

    <button onClick={toggleMute} className="absolute top-4 right-4 md:top-6 md:right-6 z-50 text-amber-700 hover:text-amber-400 transition-colors bg-black/60 p-2 md:p-3 rounded-full border border-amber-800/50 hover:border-amber-500 backdrop-blur-md hover:scale-110 active:scale-95 duration-200 group shadow-lg">
      {isMuted ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>}
    </button>
    
    <div className="relative z-10 flex items-center justify-center w-full h-full p-2 md:p-4 animate-in fade-in zoom-in duration-700 overflow-y-auto custom-scrollbar">
      <div className="w-full max-w-full flex justify-center py-8">
          {children}
      </div>
    </div>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;600&display=swap');
      .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); margin: 4px 0; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #78350f; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #b45309; }
      .nexus-glow { text-shadow: 0 0 30px rgba(217, 119, 6, 0.8), 0 0 10px rgba(251, 191, 36, 0.5); }
    `}</style>
  </div>
);

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<'DM' | 'PLAYER'>('PLAYER');
  const [loginIntent, setLoginIntent] = useState<'LOGIN' | 'CREATE'>('CREATE'); 
  const [name, setName] = useState('');
  const [dmPass, setDmPass] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const musicRef = useRef<Howl | null>(null);
  const [savedChar, setSavedChar] = useState<any>(null);

  // Estados do Jogador
  const [selectedRace, setSelectedRace] = useState<keyof typeof RACES>('HUMANO');
  const [selectedClass, setSelectedClass] = useState<keyof typeof CLASSES>('GUERREIRO');
  const [stats, setStats] = useState({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 });
  const [pointsLeft, setPointsLeft] = useState(27);
  const [showFullImage, setShowFullImage] = useState(false);

  // Estados da Campanha do Mestre
  const [campaignName, setCampaignName] = useState('A Mina Perdida de Phandelver');
  const [roomPassword, setRoomPassword] = useState('mesa-do-victor');

  const raceScrollRef = useRef<HTMLDivElement>(null);
  const classScrollRef = useRef<HTMLDivElement>(null);
  const statsScrollRef = useRef<HTMLDivElement>(null); 

  const prevRaceScrollTop = useRef(0);
  const prevClassScrollTop = useRef(0);
  const prevStatsScrollTop = useRef(0); 

  useLayoutEffect(() => {
    if (raceScrollRef.current) {
        raceScrollRef.current.scrollTop = prevRaceScrollTop.current;
    }
    if (classScrollRef.current) {
        classScrollRef.current.scrollTop = prevClassScrollTop.current;
    }
    if (statsScrollRef.current) {
        statsScrollRef.current.scrollTop = prevStatsScrollTop.current;
    }
  });

  const handleSelectRace = (r: keyof typeof RACES) => {
      if (raceScrollRef.current) prevRaceScrollTop.current = raceScrollRef.current.scrollTop;
      setSelectedRace(r);
  };

  const handleSelectClass = (c: keyof typeof CLASSES) => {
      if (classScrollRef.current) prevClassScrollTop.current = classScrollRef.current.scrollTop;
      setSelectedClass(c);
  };

  useEffect(() => {
    const saved = localStorage.getItem('nexus_last_char');
    if (saved) {
      try { setSavedChar(JSON.parse(saved)); } catch(e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    const sound = new Howl({
      src: ['/sfx/login_theme.ogg'], 
      loop: true,
      volume: 0.4, 
      html5: true, 
    });
    musicRef.current = sound;
    const timer = setTimeout(() => { sound.play(); }, 400);
    return () => { clearTimeout(timer); musicRef.current?.stop(); musicRef.current?.unload(); };
  }, []);

  const toggleMute = () => {
    if (musicRef.current) {
      const newState = !isMuted;
      setIsMuted(newState);
      musicRef.current.mute(newState);
    }
  };

  useEffect(() => {
    socket.on('characterFound', (existingChar) => { 
        setIsChecking(false); 
        onLogin('PLAYER', name, existingChar); 
    });
    
    socket.on('characterNotFound', () => { 
        setIsChecking(false); 
        if (loginIntent === 'LOGIN') {
            setError('Personagem não encontrado.');
        } else {
            setStep(3); 
        }
    });
    
    return () => { socket.off('characterFound'); socket.off('characterNotFound'); };
  }, [name, onLogin, loginIntent]);

  const handleLoginByName = () => {
    if (!name.trim()) return setError('Digite o nome do herói.');
    setError('');
    setLoginIntent('LOGIN'); 
    setIsChecking(true);
    socket.emit('checkExistingCharacter', { name });
  };

  const handleStartCreation = () => {
    if (!name.trim()) return setError('Dê um nome para começar.');
    setError('');
    setLoginIntent('CREATE'); 
    setIsChecking(true);
    socket.emit('checkExistingCharacter', { name });
  };

  useEffect(() => {
    let used = 0;
    Object.values(stats).forEach(val => { used += POINT_COST[val] || 0; });
    setPointsLeft(27 - used);
  }, [stats]);

  const handleStatChange = (attr: keyof typeof stats, increment: boolean) => {
    if (statsScrollRef.current) {
        prevStatsScrollTop.current = statsScrollRef.current.scrollTop;
    }

    const nextVal = increment ? stats[attr] + 1 : stats[attr] - 1;
    if (nextVal < 8 || nextVal > 15) return;
    const diff = POINT_COST[nextVal] - POINT_COST[stats[attr]];
    if (increment && pointsLeft - diff < 0) return;
    setStats(prev => ({ ...prev, [attr]: nextVal }));
  };

  const getDynamicTokenImage = (raceStr: string, classStr: string) => {
    const clean = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-\s]/g, "");
    return `/tokens/${clean(raceStr)}_${clean(classStr)}.png`;
  };

  const calculateFinalData = () => {
    const racial = (RACES as any)[selectedRace].bonus;
    const finalStats = { str: stats.str + racial.str, dex: stats.dex + racial.dex, con: stats.con + racial.con, int: stats.int + racial.int, wis: stats.wis + racial.wis, cha: stats.cha + racial.cha };
    const conMod = Math.floor((finalStats.con - 10) / 2);
    const hpMax = Math.max(1, (CLASSES as any)[selectedClass].hpBase + conMod);
    return { name, stats: finalStats, hp: hpMax, maxHp: hpMax, ac: (CLASSES as any)[selectedClass].ac, image: getDynamicTokenImage(selectedRace, selectedClass), race: selectedRace, classType: selectedClass, xp: 0, level: 1 };
  };

  const handleFinalSubmit = () => {
    if (role === 'DM') {
      if (dmPass === 'admin123') {
          setError('');
          setStep(4); 
      } else {
          setError('Senha Incorreta!');
      }
    } else {
      const finalData = calculateFinalData();
      localStorage.setItem('nexus_last_char', JSON.stringify(finalData));
      onLogin('PLAYER', name, finalData);
    }
  };

  const handleStartCampaign = () => {
      if (!campaignName.trim() || !roomPassword.trim()) {
          setError('Preencha o nome da campanha e a chave da sala.');
          return;
      }
      setError('');
      onLogin('DM', 'Mestre Supremo', { campaignName, roomId: roomPassword });
  };

  const handleQuickLogin = () => {
      if (savedChar) onLogin('PLAYER', savedChar.name, savedChar);
  };

  const handleDeleteSave = () => {
      if(window.confirm("Esquecer este herói?")) {
          localStorage.removeItem('nexus_last_char');
          setSavedChar(null);
          setStep(1.2); 
      }
  };

  if (step === 1) return (
    <BackgroundWrapper isMuted={isMuted} toggleMute={toggleMute}>
      <div className="flex flex-col items-center gap-8 md:gap-16 w-full max-w-6xl">
        <div className="text-center space-y-2 md:space-y-4 relative w-full px-4">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[500px] h-[150px] md:h-[200px] bg-amber-500/20 blur-[80px] md:blur-[120px] -z-10 animate-pulse"></div>
          <div className="relative inline-block w-full max-w-full">
             <h1 className="text-6xl sm:text-8xl md:text-[10rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-100 via-amber-500 to-amber-900 tracking-widest nexus-glow drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)]" style={{ fontFamily: 'Cinzel Decorative' }}>
                NEXUS
             </h1>
             <div className="absolute -bottom-2 md:-bottom-6 left-1/2 -translate-x-1/2 w-3/4 md:w-full h-1 md:h-2 bg-gradient-to-r from-transparent via-amber-600/80 to-transparent blur-[2px] md:blur-[3px] border-t border-amber-300/30"></div>
          </div>
          <p className="text-amber-200/70 tracking-[0.5em] md:tracking-[1em] text-xs md:text-xl font-bold uppercase drop-shadow-lg border-b-2 border-amber-900/30 pb-2 md:pb-4 inline-block px-4 md:px-12 mt-4 md:mt-6">Sistema de RPG</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 md:gap-8 w-full justify-center items-stretch px-4 md:px-8 max-w-3xl">
          
          <button onClick={() => { setRole('PLAYER'); if (savedChar) setStep(1.5); else setStep(1.2); }} className="group relative w-full md:flex-1 h-[200px] md:h-[280px] overflow-hidden rounded-3xl transition-all duration-500 hover:scale-[1.03] active:scale-95">
             <ArcaneContainer width="w-full" className="h-full hover:shadow-[0_0_50px_rgba(37,99,235,0.3)] hover:border-blue-500/50 transition-all">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-transparent to-black opacity-60 z-0"></div>
                <div className="relative z-10 flex flex-col h-full items-center justify-center p-4 md:p-6 text-center gap-3 md:gap-6">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-blue-950 to-black border border-blue-500/30 shadow-lg group-hover:border-blue-400 group-hover:from-blue-900 transition-colors flex items-center justify-center">
                        <Sword size={32} className="text-blue-400 group-hover:text-blue-200 transition-colors drop-shadow-md" />
                    </div>
                    <div>
                        <h3 className="text-2xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-blue-500 group-hover:from-white group-hover:to-blue-300 transition-all drop-shadow-lg leading-tight" style={{ fontFamily: 'Cinzel Decorative' }}>SOU JOGADOR</h3>
                        <p className="text-blue-200/60 text-xs md:text-sm mt-1 md:mt-2 font-serif tracking-wider group-hover:text-blue-100 hidden sm:block">Entrar na aventura com meu herói.</p>
                    </div>
                    <ChevronRight className="absolute bottom-4 right-4 md:bottom-8 md:right-8 text-blue-500/30 w-6 h-6 md:w-8 md:h-8 group-hover:text-blue-400 group-hover:translate-x-2 transition-all" />
                </div>
             </ArcaneContainer>
          </button>

          <button onClick={() => { setRole('DM'); setStep(2); }} className="group relative w-full md:flex-1 h-[200px] md:h-[280px] overflow-hidden rounded-3xl transition-all duration-500 hover:scale-[1.03] active:scale-95">
             <ArcaneContainer width="w-full" className="h-full hover:shadow-[0_0_50px_rgba(220,38,38,0.3)] hover:border-red-500/50 transition-all">
                <div className="absolute inset-0 bg-gradient-to-br from-red-900/40 via-transparent to-black opacity-60 z-0"></div>
                <div className="relative z-10 flex flex-col h-full items-center justify-center p-4 md:p-6 text-center gap-3 md:gap-6">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-red-950 to-black border border-red-500/30 shadow-lg group-hover:border-red-400 group-hover:from-red-900 transition-colors flex items-center justify-center">
                        <Crown size={32} className="text-red-400 group-hover:text-red-200 transition-colors drop-shadow-md" />
                    </div>
                    <div>
                        <h3 className="text-2xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-200 to-red-500 group-hover:from-white group-hover:to-red-300 transition-all drop-shadow-lg leading-tight" style={{ fontFamily: 'Cinzel Decorative' }}>SOU O MESTRE</h3>
                        <p className="text-red-200/60 text-xs md:text-sm mt-1 md:mt-2 font-serif tracking-wider group-hover:text-red-100 hidden sm:block">Gerenciar o mundo e a história.</p>
                    </div>
                    <ChevronRight className="absolute bottom-4 right-4 md:bottom-8 md:right-8 text-red-500/30 w-6 h-6 md:w-8 md:h-8 group-hover:text-red-400 group-hover:translate-x-2 transition-all" />
                </div>
             </ArcaneContainer>
          </button>
        </div>
      </div>
    </BackgroundWrapper>
  );

  if (step === 1.5 && savedChar) return (
    <BackgroundWrapper isMuted={isMuted} toggleMute={toggleMute}>
        <ArcaneContainer width="w-full max-w-[450px]" className="!p-6 md:!p-10 gap-6 md:gap-8 flex flex-col items-center">
            <h2 className="text-xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-100 to-amber-400 uppercase tracking-widest border-b-2 border-amber-900/50 pb-2 md:pb-4 w-full text-center drop-shadow-md" style={{ fontFamily: 'Cinzel' }}>Retornar à Aventura</h2>
            
            <div className="relative group cursor-pointer mt-2 md:mt-4" onClick={handleQuickLogin}>
                <div className="absolute inset-0 bg-amber-600/30 blur-3xl rounded-full -z-10 group-hover:bg-amber-500/50 transition-all opacity-50"></div>
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-[4px] md:border-[6px] border-amber-600/80 overflow-hidden shadow-[0_0_40px_rgba(245,158,11,0.5)] transition-all group-hover:scale-105 group-hover:border-amber-400 group-hover:shadow-[0_0_60px_rgba(245,158,11,0.8)] relative z-10 bg-black">
                    <img src={savedChar.image || '/tokens/aliado.png'} alt={savedChar.name} className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-3 md:-bottom-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-800 to-amber-950 text-amber-100 text-xs md:text-sm font-black px-4 md:px-6 py-1 md:py-1.5 rounded-full border-2 border-amber-500/80 shadow-lg z-20 uppercase tracking-wider whitespace-nowrap">
                    Nível {savedChar.level || 1}
                </div>
            </div>

            <div className="text-center mt-2 md:mt-4 space-y-1 md:space-y-2">
                <h3 className="text-3xl md:text-5xl font-black text-white drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)]" style={{ fontFamily: 'Cinzel Decorative' }}>{savedChar.name}</h3>
                <div className="inline-block bg-black/50 px-3 md:px-4 py-1 rounded-lg border border-amber-900/50">
                    <p className="text-amber-300 text-xs md:text-sm font-bold uppercase tracking-[0.1em] md:tracking-[0.2em]">{savedChar.race} | {savedChar.classType}</p>
                </div>
            </div>

            <MetalButton onClick={handleQuickLogin} fullWidth variant="amber" className="py-4 md:py-5 text-sm md:text-base mt-2 md:mt-4">
                <Play size={20} fill="currentColor" /> Entrar no Mundo
            </MetalButton>

            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full pt-4 md:pt-6 border-t-2 border-amber-900/30">
                <button onClick={() => { setName(''); setStep(1.2); }} className="flex-1 py-3 bg-black/50 hover:bg-amber-900/20 border border-amber-900/50 hover:border-amber-500/50 text-amber-200/60 hover:text-amber-100 text-xs font-bold uppercase rounded-xl flex items-center justify-center gap-2 transition-all group">
                    <Plus size={16} className="group-hover:rotate-90 transition-transform" /> Trocar Herói
                </button>
                <button onClick={handleDeleteSave} className="py-3 sm:px-4 bg-red-950/30 hover:bg-red-900/50 border border-red-900/50 hover:border-red-500/50 text-red-400/60 hover:text-red-300 text-xs rounded-xl transition-all flex items-center justify-center gap-2" title="Apagar Save">
                    <Trash2 size={16} /> <span className="sm:hidden uppercase font-bold">Apagar</span>
                </button>
            </div>
            <button onClick={() => setStep(1)} className="text-amber-500/40 hover:text-amber-200 text-[10px] uppercase tracking-[0.3em] font-bold transition-colors pb-1">❮ Voltar ao Início</button>
        </ArcaneContainer>
    </BackgroundWrapper>
  );

  if (step === 1.2 && role === 'PLAYER') return (
    <BackgroundWrapper isMuted={isMuted} toggleMute={toggleMute}>
        <ArcaneContainer width="w-full max-w-[500px]" className="!p-6 md:!p-12 gap-6 md:gap-10 flex flex-col items-center">
             <div className="text-center space-y-1 md:space-y-2">
                <h2 className="text-2xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-blue-100 to-blue-400 uppercase tracking-[0.1em] drop-shadow-md" style={{ fontFamily: 'Cinzel Decorative' }}>Portal dos Viajantes</h2>
                <p className="text-blue-200/50 text-xs md:text-sm font-serif italic">Identifique-se ou inicie uma nova jornada.</p>
             </div>
             <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-blue-900/50 to-transparent"></div>
            
            <div className="w-full space-y-4 md:space-y-6 relative">
                <div className="absolute -left-4 md:-left-6 top-1/2 -translate-y-1/2 w-1 h-12 bg-blue-500/50 blur-[2px] rounded-full hidden sm:block"></div>
                <label className="text-[10px] md:text-xs text-blue-300/70 uppercase font-black tracking-[0.15em] md:tracking-[0.25em] mb-2 md:mb-3 block ml-1 drop-shadow-sm">Já tenho um herói</label>
                <div className="flex flex-col sm:flex-row gap-3 md:gap-4 relative items-stretch w-full">
                    <StoneInput 
                        placeholder="Nome exato do Personagem" 
                        value={name} 
                        onChange={(e: any) => setName(e.target.value)} 
                        onKeyDown={(e: any) => e.key === 'Enter' && handleLoginByName()}
                        className="!text-xl md:!text-2xl !p-3 md:!p-4 !border-blue-900/50 focus:!border-blue-400/80 !text-blue-50 placeholder:!text-blue-200/20 rounded-xl"
                    />
                    <MetalButton onClick={handleLoginByName} disabled={isChecking} variant="blue" className="px-6 py-3 sm:py-0 !rounded-xl flex justify-center items-center">
                        {isChecking && loginIntent === 'LOGIN' ? <Sparkles className="animate-spin" /> : <Search size={24} />}
                        <span className="sm:hidden ml-2 uppercase font-bold text-xs tracking-wider">Procurar</span>
                    </MetalButton>
                </div>
                {error && <p className="text-red-300 text-xs md:text-sm animate-in fade-in slide-in-from-top-2 text-center bg-red-950/50 p-2 md:p-3 rounded-lg border border-red-500/30 shadow-md font-bold flex items-center justify-center gap-2"><XCircle size={16}/> {error}</p>}
            </div>

            <div className="flex items-center w-full gap-4 md:gap-6 opacity-50 my-2 md:my-4">
                <div className="h-px bg-gradient-to-r from-transparent to-blue-500/50 flex-grow"></div>
                <span className="text-blue-200/50 text-xs md:text-sm uppercase font-black tracking-widest">Ou</span>
                <div className="h-px bg-gradient-to-l from-transparent to-blue-500/50 flex-grow"></div>
            </div>

            <MetalButton onClick={() => { setName(''); setStep(2); }} fullWidth variant="amber" className="py-4 md:py-6 text-xs md:text-sm">
                <UserPlus size={20} className="mr-2" /> Forjar Nova Lenda
            </MetalButton>

            <button onClick={() => setStep(1)} className="text-blue-500/40 hover:text-blue-200 text-[10px] uppercase tracking-[0.3em] font-bold transition-colors pb-1 md:pb-2 mt-2 md:mt-4">❮ Cancelar</button>
        </ArcaneContainer>
    </BackgroundWrapper>
  );

  if (step === 2 && role === 'PLAYER') return (
    <BackgroundWrapper isMuted={isMuted} toggleMute={toggleMute}>
      {showFullImage && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95 backdrop-blur-xl cursor-zoom-out animate-in fade-in duration-300 p-4" onClick={() => setShowFullImage(false)}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.1)_0%,transparent_70%)]"></div>
          <img src={getDynamicTokenImage(selectedRace, selectedClass)} alt="Full Preview" className="max-w-full max-h-[85%] object-contain drop-shadow-[0_0_100px_rgba(168,85,247,0.6)] animate-in zoom-in-95 duration-500" onError={(e) => (e.currentTarget.src = '/tokens/aliado.png')} />
        </div>
      )}

      <ArcaneContainer width="w-full max-w-[1100px]" className="h-full md:h-[750px] !p-0 flex flex-col mx-4 md:mx-0 my-4 md:my-0">
        <div className="px-4 md:px-8 py-3 md:py-5 border-b-2 border-amber-900/30 flex justify-between items-center bg-black/40 flex-shrink-0 relative">
          <div className="flex items-center gap-2 md:gap-4">
              <div className="p-1.5 md:p-2 bg-amber-900/30 rounded-lg border border-amber-500/30 shadow-inner"><Scroll className="text-amber-500 w-5 h-5 md:w-6 md:h-6" /></div>
              <h2 className="text-xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-100 to-amber-500 tracking-[0.1em] md:tracking-[0.2em] drop-shadow-md" style={{ fontFamily: 'Cinzel Decorative' }}>FORJAR HERÓI</h2>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full border border-amber-900/50">
             <span className="text-[10px] uppercase font-bold text-amber-500/70 tracking-widest mr-2">Progresso</span>
             <div className="w-16 h-1 bg-amber-900/50 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 w-1/2 shadow-[0_0_10px_#f59e0b]"></div>
             </div>
          </div>
        </div>

        {/* --- CORREÇÃO DA ARMADILHA DE ROLAGEM AQUI --- */}
        <div className="flex flex-col md:flex-row flex-1 overflow-y-auto custom-scrollbar md:overflow-hidden">
            {/* Secção Esquerda: Nome e Preview da Imagem */}
            <div className="w-full md:w-[350px] bg-black/20 md:border-r border-b md:border-b-0 border-white/5 flex flex-row md:flex-col items-center justify-center md:justify-start p-4 md:p-8 gap-4 md:gap-6 flex-shrink-0">
                
                <div className="relative group cursor-pointer flex-shrink-0" onClick={() => setShowFullImage(true)}>
                    <div className="absolute inset-0 bg-amber-500/10 blur-[40px] rounded-full animate-pulse"></div>
                    <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-48 md:h-48 rounded-full border-2 md:border-4 border-amber-600/60 overflow-hidden bg-black shadow-[0_0_40px_rgba(0,0,0,0.8)] relative z-10 hover:border-amber-400 transition-colors">
                        <img src={getDynamicTokenImage(selectedRace, selectedClass)} alt="Token" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = '/tokens/aliado.png')} />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Search className="text-white/80 w-6 h-6 md:w-8 md:h-8" />
                        </div>
                    </div>
                </div>

                <div className="w-full space-y-1 md:space-y-2 flex-1">
                    <label className="text-[9px] md:text-[10px] text-amber-500/60 uppercase font-bold tracking-[0.1em] md:tracking-[0.2em] block text-left md:text-center">Nome da Lenda</label>
                    <input 
                        type="text" 
                        className="w-full bg-black/40 border-b border-amber-900/50 p-2 md:p-3 text-left md:text-center text-xl md:text-2xl text-amber-100 font-serif placeholder-white/10 outline-none focus:border-amber-500 transition-colors"
                        placeholder="Ex: Valerius" 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                    />
                    <div className="w-full bg-black/40 p-2 md:p-4 rounded-xl border border-white/5 space-y-1 md:space-y-2 text-center mt-4 hidden md:block">
                        <div className="text-amber-200 font-bold uppercase tracking-wider text-xs md:text-sm">{selectedRace}</div>
                        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                        <div className="text-amber-500 font-black uppercase tracking-widest text-base md:text-lg">{selectedClass}</div>
                    </div>
                </div>
            </div>

            {/* Secção Direita: Escolha de Raça e Classe */}
            <div className="flex-1 flex flex-col md:flex-row p-4 md:p-8 gap-4 md:gap-6 h-auto md:h-full md:overflow-hidden">
                
                {/* Seleção de Raça */}
                <div className="flex flex-col md:flex-1 min-h-0">
                    <h3 className="text-amber-500/80 font-bold uppercase tracking-[0.15em] md:tracking-[0.2em] text-[10px] md:text-xs mb-2 md:mb-3 flex items-center gap-2">
                        <Crown size={14} /> Selecione a Linhagem
                    </h3>
                    <div ref={raceScrollRef} className="md:flex-1 md:overflow-y-auto custom-scrollbar md:pr-2 bg-black/20 rounded-xl border border-white/5 p-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                            {Object.keys(RACES).map(r => (
                                <div 
                                    key={r} 
                                    role="button" 
                                    onClick={() => handleSelectRace(r as any)} 
                                    className={`cursor-pointer p-2 md:p-3 rounded-lg border text-left transition-all duration-200 relative overflow-hidden group ${selectedRace === r ? 'border-amber-500/60 bg-amber-900/20' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
                                >
                                    <div className="relative z-10 flex flex-col justify-center h-full">
                                        <div className={`font-bold text-xs md:text-sm tracking-wider ${selectedRace === r ? 'text-amber-100' : 'text-gray-400'}`}>{r}</div>
                                        <div className="text-[9px] md:text-[10px] text-amber-500/60 font-bold uppercase mt-0.5 md:mt-1">{(RACES as any)[r].desc}</div>
                                    </div>
                                    {selectedRace === r && <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent"></div>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Seleção de Classe */}
                <div className="flex flex-col md:flex-1 min-h-0 mt-2 md:mt-0">
                    <h3 className="text-amber-500/80 font-bold uppercase tracking-[0.15em] md:tracking-[0.2em] text-[10px] md:text-xs mb-2 md:mb-3 flex items-center gap-2">
                        <Sword size={14} /> Selecione o Ofício
                    </h3>
                    <div ref={classScrollRef} className="md:flex-1 md:overflow-y-auto custom-scrollbar md:pr-2 bg-black/20 rounded-xl border border-white/5 p-2">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                            {Object.keys(CLASSES).map(c => (
                                <div 
                                    key={c} 
                                    role="button" 
                                    onClick={() => handleSelectClass(c as any)} 
                                    className={`cursor-pointer p-2 md:p-3 rounded-lg border flex flex-row md:flex-col items-center justify-start md:justify-center gap-2 md:gap-2 transition-all duration-200 group ${selectedClass === c ? 'border-amber-500/60 bg-amber-900/20' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
                                >
                                    <div className="text-lg md:text-2xl filter drop-shadow-md">{(CLASSES as any)[c].icon}</div>
                                    <div className={`font-bold text-[9px] md:text-[10px] uppercase tracking-widest text-center ${selectedClass === c ? 'text-amber-100' : 'text-gray-500 group-hover:text-gray-300'}`}>{c}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>

        <div className="pt-3 md:pt-4 border-t border-white/10 flex justify-between items-center px-4 md:px-8 pb-4 md:pb-6 flex-shrink-0">
            <button type="button" onClick={() => { setStep(1.2); setLoginIntent('CREATE'); }} className="text-white/30 hover:text-white text-[10px] md:text-xs uppercase tracking-widest font-bold px-2 py-2">Cancelar</button>
            <MetalButton onClick={handleStartCreation} disabled={isChecking} variant="amber" className="px-6 md:px-8 py-2 md:py-3 text-[10px] md:text-xs">
                {isChecking ? <Sparkles className="animate-spin" size={16} /> : 'Próximo: Atributos ❯'}
            </MetalButton>
        </div>
      </ArcaneContainer>
    </BackgroundWrapper>
  );

  if (step === 3 && role === 'PLAYER') return (
    <BackgroundWrapper isMuted={isMuted} toggleMute={toggleMute}>
      <ArcaneContainer width="w-full max-w-[900px]" className="h-full md:h-[650px] !p-0 flex flex-col mx-4 md:mx-0 my-4 md:my-0">
        <div className="p-4 md:p-6 border-b-2 border-amber-900/30 flex justify-between items-center bg-black/40 flex-shrink-0">
          <div className="flex items-center gap-3 md:gap-4">
              <div className="p-1.5 md:p-2 bg-amber-900/30 rounded-lg border border-amber-500/30 shadow-inner"><Crown className="text-amber-500 w-5 h-5 md:w-6 md:h-6" /></div>
              <h2 className="text-xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-100 to-amber-500 tracking-[0.1em] md:tracking-[0.2em] drop-shadow-md" style={{ fontFamily: 'Cinzel Decorative' }}>DISTRIBUIR PODER</h2>
          </div>
          <div className="hidden sm:flex items-center gap-1 bg-black/60 p-2 rounded-full border border-amber-900/50 shadow-inner">
            <div className="w-3 h-3 rounded-full bg-amber-900/50"></div>
            <div className="w-12 h-3 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 shadow-[0_0_15px_#f59e0b]"></div>
          </div>
        </div>

        <div ref={statsScrollRef} className="p-4 md:p-8 flex flex-col h-full items-center justify-start overflow-y-auto custom-scrollbar bg-gradient-to-b from-transparent to-black/30 w-full">
            <div className="text-center mb-6 md:mb-8 flex-shrink-0 relative">
              <div className="absolute inset-0 bg-amber-600/20 blur-[30px] md:blur-[50px] rounded-full -z-10"></div>
              <span className="text-[10px] md:text-sm text-amber-300/70 uppercase font-black tracking-[0.2em] md:tracking-[0.4em] drop-shadow-sm border-b border-amber-900/50 pb-1 md:pb-2 px-4 md:px-8">Pontos Restantes</span>
              <div className={`text-6xl md:text-8xl font-black mt-2 md:mt-4 transition-all duration-500 drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)] ${pointsLeft < 0 ? 'text-red-500 scale-110' : pointsLeft === 0 ? 'text-green-400' : 'text-amber-400'}`} style={{ fontFamily: 'Cinzel Decorative' }}>{pointsLeft}</div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5 w-full max-w-3xl mb-4 md:mb-6 content-center p-3 md:p-6 bg-black/40 rounded-2xl md:rounded-3xl border border-amber-900/30 shadow-inner">
              {Object.keys(stats).map((key) => {
                const attr = key as keyof typeof stats;
                const racial = (RACES as any)[selectedRace].bonus[attr];
                const total = stats[attr] + racial;
                const mod = Math.floor((total - 10) / 2);
                const isMaxed = stats[attr] >= 15;
                const isMin = stats[attr] <= 8;
                
                return (
                  <div key={attr} className="bg-gradient-to-b from-black/60 to-black/80 p-3 md:p-4 rounded-xl md:rounded-2xl border-2 border-amber-900/40 flex flex-col items-center relative transition-all hover:border-amber-500/50 hover:shadow-lg">
                    <span className="text-[10px] md:text-xs text-amber-500/80 font-black uppercase tracking-[0.15em] md:tracking-[0.25em] mb-2 md:mb-3">{attr}</span>
                    <div className="flex items-center gap-2 md:gap-3 bg-black/50 p-1.5 md:p-2 rounded-xl border border-amber-900/30 shadow-inner relative z-10 w-full justify-between">
                      <div role="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleStatChange(attr, false)} className={`w-8 h-8 flex items-center justify-center bg-black/60 border border-white/5 rounded text-white transition-all select-none ${isMin ? 'opacity-20 cursor-not-allowed' : 'hover:bg-red-900/50 cursor-pointer'}`}>-</div>
                      <span className="text-xl md:text-2xl font-black font-serif w-8 md:w-10 text-center text-amber-100">{stats[attr]}</span>
                      <div role="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleStatChange(attr, true)} className={`w-8 h-8 flex items-center justify-center bg-black/60 border border-white/5 rounded text-white transition-all select-none ${(isMaxed || pointsLeft <= 0) ? 'opacity-20 cursor-not-allowed' : 'hover:bg-green-900/50 cursor-pointer'}`}>+</div>
                    </div>
                    <div className="mt-2 md:mt-3 text-[9px] md:text-[10px] text-amber-200/40 font-bold uppercase flex flex-col sm:flex-row items-center justify-center sm:justify-between w-full px-1 md:px-2 gap-1 sm:gap-0">
                        <div className="flex gap-1 md:gap-2">
                             <span>Base {stats[attr]}</span>
                             {racial > 0 && <span className="text-green-400">+{racial}</span>}
                        </div>
                        <div className="flex items-center gap-1 md:gap-2">
                             <span className="hidden sm:inline text-white/30">|</span>
                             <span className="text-blue-300">Mod {mod >= 0 ? `+${mod}` : mod}</span>
                             <span className="text-white/30">|</span>
                             <span className="text-amber-400 font-black text-sm md:text-lg">{total}</span>
                        </div>
                    </div>
                  </div>
                );
              })}
            </div>
        </div>

        <div className="mt-auto w-full flex justify-between items-center border-t-2 border-amber-900/30 p-4 md:p-6 bg-black/60 flex-shrink-0">
           {error && <p className="text-red-400 text-xs animate-bounce mr-2 md:mr-4 absolute -top-8 left-1/2 -translate-x-1/2 bg-black px-3 py-1 rounded border border-red-500 w-max max-w-[90%] text-center">{error}</p>}
           <button onClick={() => setStep(2)} className="text-amber-500/50 hover:text-amber-200 font-bold uppercase tracking-[0.1em] md:tracking-[0.3em] text-[10px] md:text-xs">❮ Voltar</button>
           <MetalButton onClick={handleFinalSubmit} disabled={isChecking || pointsLeft < 0} variant="amber" className="px-6 md:px-12 py-3 md:py-4 text-[10px] md:text-sm">
             {isChecking ? <Sparkles className="animate-spin" size={20} /> : 'Despertar Lenda ❯'}
           </MetalButton>
        </div>
      </ArcaneContainer>
    </BackgroundWrapper>
  );

  if (role === 'DM') {
    if (step === 2) return (
        <BackgroundWrapper isMuted={isMuted} toggleMute={toggleMute}>
            <ArcaneContainer width="w-full max-w-[500px]" className="!p-8 md:!p-12 gap-8 md:gap-10 flex flex-col items-center border-red-900/30 mx-4 md:mx-0">
                <div className="absolute inset-0 bg-red-900/10 mix-blend-overlay pointer-events-none"></div>
                <Crown size={60} className="text-red-500/50 drop-shadow-[0_0_15px_rgba(220,38,38,0.4)] w-12 h-12 md:w-[60px] md:h-[60px]" />
                <div className="text-center space-y-2">
                    <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-200 via-red-500 to-red-800 uppercase tracking-[0.1em] md:tracking-[0.2em] drop-shadow-md" style={{ fontFamily: 'Cinzel Decorative' }}>Acesso do Mestre</h2>
                    <p className="text-red-200/50 text-xs md:text-sm font-serif italic">Apenas para os guardiões do conhecimento.</p>
                </div>
                <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-red-900/50 to-transparent"></div>
                <div className="w-full space-y-4 md:space-y-6 relative">
                    <label className="text-[10px] md:text-xs text-red-300/70 uppercase font-black tracking-[0.15em] md:tracking-[0.25em] mb-2 md:mb-3 flex items-center gap-2 ml-1 drop-shadow-sm">Palavra de Poder</label>
                    <StoneInput type="password" placeholder="••••••••••••" value={dmPass} onChange={(e: any) => setDmPass(e.target.value)} onKeyDown={(e: any) => e.key === 'Enter' && handleFinalSubmit()} className="!text-xl md:!text-3xl !p-3 md:!p-4 !border-red-900/50 focus:!border-red-400/80 !text-red-400 rounded-xl text-center tracking-[0.3em] md:tracking-[0.5em]"/>
                    {error && <p className="text-red-300 text-xs md:text-sm animate-in fade-in slide-in-from-top-2 text-center bg-red-950/50 p-2 md:p-3 rounded-lg border border-red-500/30 shadow-md font-bold flex items-center justify-center gap-2"><XCircle size={16}/> {error}</p>}
                </div>
                <MetalButton onClick={handleFinalSubmit} fullWidth variant="red" className="py-4 md:py-6 text-xs md:text-sm bg-gradient-to-r from-red-900 via-red-800 to-red-950 border-red-500/40 shadow-red-900/30 text-red-50">
                    <Crown size={20} className="mr-2" /> Desbloquear
                </MetalButton>
                <button onClick={() => { setStep(1); setDmPass(''); setError(''); }} className="text-red-500/40 hover:text-red-200 text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] font-bold transition-colors pb-1 md:pb-2 mt-2 md:mt-4">❮ Voltar aos Reinos Mortais</button>
            </ArcaneContainer>
        </BackgroundWrapper>
    );

    if (step === 4) return (
        <BackgroundWrapper isMuted={isMuted} toggleMute={toggleMute}>
            <ArcaneContainer width="w-full max-w-[600px]" className="!p-8 md:!p-12 gap-6 flex flex-col items-center border-red-900/30 mx-4 md:mx-0 animate-in fade-in zoom-in-95 duration-500">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.15),transparent_70%)] pointer-events-none"></div>
                
                <div className="text-center space-y-2 mb-2 w-full">
                    <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-200 via-red-500 to-red-800 uppercase tracking-[0.1em] md:tracking-[0.2em] drop-shadow-md border-b-2 border-red-900/50 pb-4 w-full" style={{ fontFamily: 'Cinzel Decorative' }}>Forjar Campanha</h2>
                </div>

                <div className="w-full space-y-5">
                    <div className="bg-black/40 border border-red-900/30 rounded-2xl p-4 md:p-6 shadow-inner hover:border-red-500/50 transition-colors">
                        <label className="text-[10px] md:text-xs text-red-300/70 uppercase font-black tracking-[0.15em] mb-2 flex items-center gap-2">
                            <MapIcon size={14} className="text-red-500" /> Nome da Crônica
                        </label>
                        <StoneInput 
                            type="text" 
                            placeholder="Ex: A Mina Perdida de Phandelver" 
                            value={campaignName} 
                            onChange={(e: any) => setCampaignName(e.target.value)} 
                            className="!text-lg md:!text-xl !p-3 !border-red-900/50 focus:!border-red-400/80 !text-red-50 rounded-xl"
                        />
                    </div>

                    <div className="bg-black/40 border border-red-900/30 rounded-2xl p-4 md:p-6 shadow-inner hover:border-red-500/50 transition-colors">
                        <label className="text-[10px] md:text-xs text-red-300/70 uppercase font-black tracking-[0.15em] mb-2 flex items-center gap-2">
                            <Key size={14} className="text-red-500" /> Chave da Sala (ID Secreto)
                        </label>
                        <StoneInput 
                            type="text" 
                            placeholder="exemplo: sala-do-dragao" 
                            value={roomPassword} 
                            onChange={(e: any) => setRoomPassword(e.target.value.toLowerCase().replace(/\s+/g, '-'))} 
                            className="!text-lg md:!text-xl !p-3 !border-red-900/50 focus:!border-red-400/80 !text-red-400 rounded-xl font-mono text-center tracking-widest"
                        />
                        <p className="text-[9px] text-red-500/50 mt-2 text-center uppercase tracking-widest">Passe esta chave aos jogadores para entrarem na sua mesa.</p>
                    </div>
                </div>

                {error && <p className="text-red-300 text-xs md:text-sm animate-in fade-in slide-in-from-top-2 text-center bg-red-950/50 p-2 md:p-3 rounded-lg border border-red-500/30 shadow-md font-bold flex items-center justify-center gap-2 w-full mt-2"><XCircle size={16}/> {error}</p>}

                <div className="flex gap-3 md:gap-4 w-full mt-4 pt-6 border-t-2 border-red-900/30">
                    <button onClick={() => { setStep(2); setDmPass(''); }} className="px-4 py-3 text-red-500/50 hover:text-red-200 font-bold uppercase tracking-widest text-[10px] md:text-xs transition-colors rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10">❮ Cancelar</button>
                    <MetalButton onClick={handleStartCampaign} fullWidth variant="red" className="py-4 text-xs md:text-sm">
                        Abrir os Portões ❯
                    </MetalButton>
                </div>
            </ArcaneContainer>
        </BackgroundWrapper>
    );
  }

  return null;
};

export default LoginScreen;