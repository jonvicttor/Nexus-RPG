import React, { useState, useEffect, useRef, useMemo } from 'react';
import socket from '../services/socket';
import { Howl } from 'howler';
import { Trash2, Play, Sword, Crown, ChevronRight, Search, UserPlus, Sparkles, XCircle, Scroll, Map as MapIcon, Key, ChevronLeft, Upload, User, Swords, Star, Fingerprint, Save, X, ChevronDown, ChevronUp, Backpack, BookOpen } from 'lucide-react';

// ============================================================================
// 📖 DICIONÁRIO ARCANO (Tradução Automática do 5eTools para PT-BR)
// ============================================================================
const PT_BR_DICT: Record<string, string> = {
    "acrobatics": "Acrobacia", "animal handling": "Lidar com Animais", "arcana": "Arcanismo",
    "athletics": "Atletismo", "deception": "Enganação", "history": "História", "insight": "Intuição",
    "intimidation": "Intimidação", "investigation": "Investigação", "medicine": "Medicina",
    "nature": "Natureza", "perception": "Percepção", "performance": "Atuação",
    "persuasion": "Persuasão", "religion": "Religião", "sleight of hand": "Prestidigitação",
    "stealth": "Furtividade", "survival": "Sobrevivência",
    "Expertise": "Especialidade", "Sneak Attack": "Ataque Furtivo", "Thieves' Cant": "Gíria de Ladrão",
    "Cunning Action": "Ação Astuta", "Uncanny Dodge": "Esquiva Sobrenatural", "Evasion": "Evasão",
    "Reliable Talent": "Talento Confiável", "Slippery Mind": "Mente Escorregadia", "Elusive": "Elusivo",
    "Stroke of Luck": "Golpe de Sorte", "Ability Score Improvement": "Aumento no Valor de Habilidade",
    "Weapon Mastery": "Maestria em Armas", "Steady Aim": "Mira Estável", "Cunning Strike": "Ataque Astuto",
    "Devious Strikes": "Golpes Desonestos", "Spellcasting": "Conjuração", "Divine Sense": "Sentido Divino",
    "Lay on Hands": "Cura pelas Mãos", "Fighting Style": "Estilo de Luta", "Second Wind": "Retomar o Fôlego",
    "Action Surge": "Ação Surtada", "Rage": "Fúria", "Unarmored Defense": "Defesa Sem Armadura",
    "str": "FOR", "dex": "DES", "con": "CON", "int": "INT", "wis": "SAB", "cha": "CAR"
};

const translateTerm = (term: string) => PT_BR_DICT[term] || PT_BR_DICT[term.toLowerCase()] || term;

const clean5eText = (text: any): string => {
    if (typeof text !== 'string') return "";
    let cleaned = text.replace(/\{@[a-z]+\s([^}]+)\}/gi, (match, contents) => {
        const parts = contents.split('|');
        return parts.length > 2 && parts[2] ? parts[2] : parts[0];
    });
    cleaned = cleaned.replace(/\{@[ib] ([^}]+)\}/gi, '$1');
    return cleaned;
};

const CLASS_METADATA: Record<string, { icon: string, ac: number, fileKey: string }> = {
  'barbarian': { icon: '🪓', ac: 14, fileKey: 'barbarian' },
  'bard':      { icon: '🎵', ac: 13, fileKey: 'bard' },
  'cleric':    { icon: '✨', ac: 18, fileKey: 'cleric' },
  'druid':     { icon: '🌿', ac: 14, fileKey: 'druid' },
  'fighter':   { icon: '⚔️', ac: 16, fileKey: 'fighter' },
  'monk':      { icon: '👊', ac: 15, fileKey: 'monk' },
  'paladin':   { icon: '🛡️', ac: 18, fileKey: 'paladin' },
  'ranger':    { icon: '🏹', ac: 15, fileKey: 'ranger' },
  'rogue':     { icon: '👥', ac: 14, fileKey: 'rogue' },
  'sorcerer':  { icon: '🔥', ac: 12, fileKey: 'sorcerer' },
  'warlock':   { icon: '👁️', ac: 13, fileKey: 'warlock' },
  'wizard':    { icon: '🔮', ac: 12, fileKey: 'wizard' },
  'artificer': { icon: '🔧', ac: 14, fileKey: 'artificer' },
};

const RACE_BONUS_FALLBACK: Record<string, any> = {
    'human': { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1, desc: '+1 em Todos' },
    'dwarf': { str: 0, dex: 0, con: 2, int: 0, wis: 0, cha: 0, desc: '+2 Cons.' },
    'elf': { str: 0, dex: 2, con: 0, int: 0, wis: 0, cha: 0, desc: '+2 Destreza' },
    'halfling': { str: 0, dex: 2, con: 0, int: 0, wis: 0, cha: 0, desc: '+2 Destreza' },
    'gnome': { str: 0, dex: 0, con: 0, int: 2, wis: 0, cha: 0, desc: '+2 Int.' },
    'goliath': { str: 2, dex: 0, con: 1, int: 0, wis: 0, cha: 0, desc: '+2 Força, +1 Con' },
    'orc': { str: 2, dex: 0, con: 1, int: 0, wis: 0, cha: 0, desc: '+2 Força, +1 Con' },
    'tiefling': { str: 0, dex: 0, con: 0, int: 1, wis: 0, cha: 2, desc: '+2 Car., +1 Int' },
    'githzerai': { str: 0, dex: 0, con: 0, int: 1, wis: 2, cha: 0, desc: '+2 Sab., +1 Int' },
    'dragonborn': { str: 2, dex: 0, con: 0, int: 0, wis: 0, cha: 1, desc: '+2 Força, +1 Car.' },
};

const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

interface LoginScreenProps {
  onLogin: (role: 'DM' | 'PLAYER', name: string, charData?: any) => void;
  availableClasses?: any[]; 
  availableRaces?: any[]; 
}

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
          className={`w-full bg-black/60 border-b-2 border-white/10 focus:border-amber-500/80 p-3 text-sm md:text-base text-amber-50 outline-none transition-all font-serif placeholder-white/20 shadow-[inset_0_5px_10px_rgba(0,0,0,0.5)] rounded-t-lg group-hover/input:bg-black/80 ${props.className}`}
      />
      <div className="absolute bottom-0 left-0 w-0 h-[2px] bg-amber-500 transition-all duration-500 group-focus-within/input:w-full"></div>
  </div>
);

const BackgroundWrapper = ({ children, isMuted, toggleMute }: { children: React.ReactNode, isMuted: boolean, toggleMute: () => void }) => (
  <div className="relative w-screen h-[100dvh] flex flex-col overflow-hidden bg-[#050505] font-serif">
    <div className="absolute inset-0 bg-cover bg-center opacity-60 animate-in fade-in duration-[2s]" style={{ backgroundImage: "url('/login-bg.jpg')" }}></div>
    <div className="absolute inset-0 bg-black/80 mix-blend-multiply"></div>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,1)_90%)] pointer-events-none"></div>

    <button onClick={toggleMute} className="absolute top-4 right-4 md:top-6 md:right-6 z-50 text-amber-700 hover:text-amber-400 transition-colors bg-black/60 p-2 md:p-3 rounded-full border border-amber-800/50 hover:border-amber-500 backdrop-blur-md hover:scale-110 active:scale-95 duration-200 group shadow-lg">
      {isMuted ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>}
    </button>
    
    <div className="relative z-10 w-full h-full overflow-y-auto custom-scrollbar flex flex-col animate-in fade-in zoom-in duration-700">
      <div className="m-auto w-full max-w-full flex justify-center py-0 md:py-8 px-0 md:px-4 h-full md:h-auto">
          {children}
      </div>
    </div>
  </div>
);

const Accordion = ({ title, children, defaultOpen = false }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border border-white/10 bg-black/40 rounded-lg overflow-hidden mb-3">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 transition-colors text-left">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                    <span className="font-bold text-amber-100 uppercase tracking-widest text-[11px]">{title}</span>
                </div>
                {isOpen ? <ChevronUp size={16} className="text-amber-500" /> : <ChevronDown size={16} className="text-gray-500" />}
            </button>
            {isOpen && <div className="p-4 bg-black/20 text-gray-300 text-sm border-t border-white/5 leading-relaxed">{children}</div>}
        </div>
    );
};

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, availableClasses = [], availableRaces = [] }) => {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<'DM' | 'PLAYER'>('PLAYER');
  const [loginIntent, setLoginIntent] = useState<'LOGIN' | 'CREATE'>('CREATE'); 
  const [name, setName] = useState('');
  
  const [playerRoomId, setPlayerRoomId] = useState('');
  const [dmPass, setDmPass] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const musicRef = useRef<Howl | null>(null);
  const [savedChar, setSavedChar] = useState<any>(null);
  const [savedCampaigns, setSavedCampaigns] = useState<{name: string, roomId: string}[]>([]);

  // Estados do Mestre
  const [campaignName, setCampaignName] = useState('A Mina Perdida de Phandelver');
  const [roomPassword, setRoomPassword] = useState('mesa-do-victor');

  // =====================================
  // Estados do Builder (D&D Beyond Style)
  // =====================================
  const [builderStep, setBuilderStep] = useState(1);
  const [selectedRaceName, setSelectedRaceName] = useState<string>(''); 
  const [selectedClassName, setSelectedClassName] = useState<string>(''); 
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedEquipmentChoice, setSelectedEquipmentChoice] = useState<'A' | 'B'>('A');

  // NOVO: Controle de opções de raças flexíveis (Tasha / One D&D)
  const [racialChoices, setRacialChoices] = useState<Record<string, string>>({});

  // Atributos (Point Buy)
  const [stats, setStats] = useState({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 });
  const [pointsLeft, setPointsLeft] = useState(27);

  // Identidade & Descrição
  const [charDetails, setCharDetails] = useState({
      background: 'Personalizado', alignment: 'Neutro', faith: '', lifestyle: 'Modesto',
      physical: { hair: '', skin: '', eyes: '', height: '', weight: '', age: '', gender: '' },
      personalityTraits: '', ideals: '', bonds: '', flaws: ''
  });

  const [showFullImage, setShowFullImage] = useState(false);
  const [tokenGender, setTokenGender] = useState<'male' | 'female'>('male');
  const [tokenVariant, setTokenVariant] = useState<number>(1);
  const [customImageURL, setCustomImageURL] = useState<string>(''); 
  const fileInputRef = useRef<HTMLInputElement>(null); 

  const toggleMute = () => {
    if (musicRef.current) {
      const newState = !isMuted;
      setIsMuted(newState);
      musicRef.current.mute(newState);
    }
  };

  useEffect(() => {
      socket.emit('requestCompendium');
      const intervalId = setInterval(() => {
          if (!availableRaces || availableRaces.length === 0) socket.emit('requestCompendium');
          else clearInterval(intervalId);
      }, 3000);
      return () => clearInterval(intervalId);
  }, [availableRaces]);

  const dynamicRaces = useMemo(() => {
      if (!availableRaces || availableRaces.length === 0) return [];
      const uniqueRacesMap = new Map();
      availableRaces.forEach(r => { if (!uniqueRacesMap.has(r.name)) uniqueRacesMap.set(r.name, r); });
      return Array.from(uniqueRacesMap.values()).map((r: any) => {
          const nameLower = r.name.toLowerCase();
          let bonus = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
          let desc = 'Sem bônus fixo';
          if (r.ability && r.ability.length > 0) {
              const ab = r.ability[0];
              const parts = [];
              if (ab.str) { bonus.str = ab.str; parts.push(`+${ab.str} For`); }
              if (ab.dex) { bonus.dex = ab.dex; parts.push(`+${ab.dex} Des`); }
              if (ab.con) { bonus.con = ab.con; parts.push(`+${ab.con} Con`); }
              if (ab.int) { bonus.int = ab.int; parts.push(`+${ab.int} Int`); }
              if (ab.wis) { bonus.wis = ab.wis; parts.push(`+${ab.wis} Sab`); }
              if (ab.cha) { bonus.cha = ab.cha; parts.push(`+${ab.cha} Car`); }
              if (parts.length > 0) desc = parts.join(', ');
              if (ab.choose) desc = "Aumentos de Atributo Flexíveis";
          } else {
              const fallbackKey = Object.keys(RACE_BONUS_FALLBACK).find(k => nameLower.includes(k));
              if (fallbackKey) { bonus = RACE_BONUS_FALLBACK[fallbackKey]; desc = RACE_BONUS_FALLBACK[fallbackKey].desc; }
          }
          return { name: r.name, bonus, desc, source: r.source || 'PHB', ability: r.ability, entries: r.entries, speed: r.speed, languageProficiencies: r.languageProficiencies };
      });
  }, [availableRaces]);

  const dynamicClasses = useMemo(() => {
      if (!availableClasses || availableClasses.length === 0) return [];
      const uniqueClassesMap = new Map();
      availableClasses.forEach(c => { if (!uniqueClassesMap.has(c.name)) uniqueClassesMap.set(c.name, c); });
      return Array.from(uniqueClassesMap.values()).map(c => {
          const nameLower = c.name.toLowerCase();
          const metaKey = Object.keys(CLASS_METADATA).find(k => nameLower.includes(k)) || 'fighter';
          const meta = CLASS_METADATA[metaKey];
          return { ...c, ac: meta.ac, icon: meta.icon, fileKey: meta.fileKey };
      });
  }, [availableClasses]);

  useEffect(() => { if (dynamicRaces.length > 0 && !selectedRaceName) setSelectedRaceName(dynamicRaces[0].name); }, [dynamicRaces, selectedRaceName]);
  useEffect(() => { if (dynamicClasses.length > 0 && !selectedClassName) setSelectedClassName(dynamicClasses[0].name); }, [dynamicClasses, selectedClassName]);

  const handleSelectRace = (rName: string) => { 
      setSelectedRaceName(rName); 
      setTokenVariant(1); 
      setCustomImageURL(''); 
      setRacialChoices({}); // Limpa as opções flexíveis ao trocar de raça
  };
  
  const handleSelectClass = (cName: string) => { setSelectedClassName(cName); setTokenVariant(1); setCustomImageURL(''); setSelectedSkills([]); };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (event) => { if (event.target?.result) setCustomImageURL(event.target.result as string); };
          reader.readAsDataURL(file);
      }
  };

  useEffect(() => {
    const saved = localStorage.getItem('nexus_last_char');
    if (saved) try { setSavedChar(JSON.parse(saved)); } catch(e) {}
    const savedCamps = localStorage.getItem('nexus_saved_campaigns');
    if (savedCamps) try { setSavedCampaigns(JSON.parse(savedCamps)); } catch(e) {}
  }, []);

  useEffect(() => {
    const sound = new Howl({ src: ['/sfx/login_theme.ogg'], loop: true, volume: 0.4, html5: true });
    musicRef.current = sound;
    const timer = setTimeout(() => { sound.play(); }, 400);
    return () => { clearTimeout(timer); musicRef.current?.stop(); musicRef.current?.unload(); };
  }, []);

  useEffect(() => {
    socket.on('characterFound', (existingChar) => { setIsChecking(false); onLogin('PLAYER', name, { ...existingChar, roomId: playerRoomId }); });
    socket.on('characterNotFound', () => { 
        setIsChecking(false); 
        if (loginIntent === 'LOGIN') setError('Personagem não encontrado.');
        else { setStep(2); setBuilderStep(1); }
    });
    return () => { socket.off('characterFound'); socket.off('characterNotFound'); };
  }, [name, onLogin, loginIntent, playerRoomId]);

  const handleLoginByName = () => {
    if (!name.trim()) return setError('Digite o nome do herói.');
    setError(''); setLoginIntent('LOGIN'); setIsChecking(true);
    socket.emit('checkExistingCharacter', { name, roomId: playerRoomId });
  };

  const handleStartCreation = () => { setError(''); setLoginIntent('CREATE'); setStep(2); setBuilderStep(1); };

  useEffect(() => {
    let used = 0; Object.values(stats).forEach(val => { used += POINT_COST[val] || 0; }); setPointsLeft(27 - used);
  }, [stats]);

  const handleStatChange = (attr: keyof typeof stats, increment: boolean) => {
    const nextVal = increment ? stats[attr] + 1 : stats[attr] - 1;
    if (nextVal < 8 || nextVal > 15) return;
    const diff = POINT_COST[nextVal] - POINT_COST[stats[attr]];
    if (increment && pointsLeft - diff < 0) return;
    setStats(prev => ({ ...prev, [attr]: nextVal }));
  };

  const currentRaceData = dynamicRaces.find(r => r.name === selectedRaceName);
  const currentClassData = dynamicClasses.find(c => c.name === selectedClassName);

  // ============================================================================
  // LÓGICA DE BÔNUS RACIAIS FLEXÍVEIS E FIXOS
  // ============================================================================
  const { fixedBonuses, flexibleChoices } = useMemo(() => {
        if (!currentRaceData?.ability?.length) return { fixedBonuses: {}, flexibleChoices: [] };
        
        const ab = currentRaceData.ability[0];
        const fixed: Record<string, number> = {};
        const flexible: { id: string, amount: number, options: string[] }[] = [];

        Object.entries(ab).forEach(([key, val]) => {
            if (key === 'choose') {
                const choices = Array.isArray(val) ? val : [val];
                choices.forEach((choice, index) => {
                    const count = choice.count || 1;
                    const amount = choice.amount || 1;
                    const from = choice.from || ['str', 'dex', 'con', 'int', 'wis', 'cha'];
                    for (let i = 0; i < count; i++) {
                        flexible.push({ id: `choice_${index}_${i}`, amount, options: from });
                    }
                });
            } else {
                fixed[key] = val as number;
            }
        });
        return { fixedBonuses: fixed, flexibleChoices: flexible };
  }, [currentRaceData]);

  const getAppliedRacialBonus = (stat: string) => {
        let total = fixedBonuses[stat] || 0;
        flexibleChoices.forEach(choice => {
            if (racialChoices[choice.id] === stat) {
                total += choice.amount;
            }
        });
        return total;
  };

  const calculateFinalData = () => {
    const classObj = currentClassData || dynamicClasses[0];
    
    const finalStats = { 
        str: stats.str + getAppliedRacialBonus('str'), 
        dex: stats.dex + getAppliedRacialBonus('dex'), 
        con: stats.con + getAppliedRacialBonus('con'), 
        int: stats.int + getAppliedRacialBonus('int'), 
        wis: stats.wis + getAppliedRacialBonus('wis'), 
        cha: stats.cha + getAppliedRacialBonus('cha') 
    };

    const conMod = Math.floor((finalStats.con - 10) / 2);
    const hpMax = Math.max(1, (classObj?.hd?.faces || 8) + conMod);
    
    return { 
        name: name || 'Herói Desconhecido', stats: finalStats, hp: hpMax, maxHp: hpMax, ac: classObj?.ac || 10, 
        image: customImageURL || getDynamicTokenImage(selectedRaceName, classObj?.fileKey || 'fighter', tokenGender, tokenVariant), 
        race: selectedRaceName, classType: selectedClassName, xp: 0, level: 1, roomId: playerRoomId,
        proficiencies: selectedSkills.reduce((acc, skill) => ({ ...acc, [skill]: 1 }), {}),
        details: charDetails
    };
  };

  const submitCampaign = (cName: string, cRoom: string) => {
    if (!cName.trim() || !cRoom.trim()) { setError('Preencha o nome da campanha e a chave da sala.'); return; }
    setError('');
    const newCampaign = { name: cName, roomId: cRoom };
    const existing = savedCampaigns.filter(c => c.roomId !== cRoom);
    const updatedCampaigns = [newCampaign, ...existing].slice(0, 5); 
    localStorage.setItem('nexus_saved_campaigns', JSON.stringify(updatedCampaigns));
    onLogin('DM', 'Mestre Supremo', { campaignName: cName, roomId: cRoom });
  };

  const handleFinalSubmit = () => {
    if (role === 'DM') {
      if (dmPass === 'admin123') { setError(''); setStep(4); } else setError('Senha Incorreta!');
    } else {
      if (!name.trim()) return setError('Sua lenda precisa de um nome na aba Identidade!');
      setIsChecking(true);
      setTimeout(() => {
          const finalData = calculateFinalData();
          localStorage.setItem('nexus_last_char', JSON.stringify(finalData));
          onLogin('PLAYER', finalData.name, finalData);
      }, 800);
    }
  };

  const handleQuickLogin = () => { if (savedChar) onLogin('PLAYER', savedChar.name, { ...savedChar, roomId: playerRoomId }); };
  const handleDeleteSave = () => { if(window.confirm("Esquecer este herói?")) { localStorage.removeItem('nexus_last_char'); setSavedChar(null); setStep(1.2); } };

  const getDynamicTokenImage = (raceName: string, classKey: string, gender: 'male'|'female', variant: number) => {
      if (!raceName) return '/tokens/aliado.png';
      const rLower = raceName.toLowerCase();
      let folder = '', prefix = '';
      if (rLower === 'dwarf' || rLower.startsWith('dwarf ')) { folder = 'Dwarf'; prefix = 'dwarf'; }
      else if (rLower === 'elf' || rLower.startsWith('elf ')) { folder = 'Elf'; prefix = 'elf'; }
      else if (rLower === 'gnome' || rLower.startsWith('gnome ') || rLower === 'halfling' || rLower.startsWith('halfling ')) { folder = 'Gnome'; prefix = 'gnome'; }
      else if (rLower === 'goliath' || rLower.startsWith('goliath ')) { folder = 'Goliath'; prefix = 'goliath'; }
      else if (rLower === 'orc' || rLower.startsWith('orc ')) { folder = 'Orc'; prefix = 'orc'; }
      else if (rLower === 'tiefling' || rLower.startsWith('tiefling ')) { folder = 'Tiefling'; prefix = 'tiefling'; }
      else if (rLower === 'human' || rLower.startsWith('human ')) { folder = 'Human'; prefix = 'human'; }

      if (folder) {
          const cFile = (classKey || 'fighter').toLowerCase();
          const v = variant.toString().padStart(2, '0');
          return `/tokens/Racas/${folder}/${cFile}/${prefix}_${cFile}_${gender}_${v}.png`;
      } else {
          const raceObj = dynamicRaces.find(r => r.name === raceName);
          if (raceObj && raceObj.source) return `/img/races/${raceObj.source}/${raceName.replace(/[^a-zA-Z0-9 -()]/g, '')}.webp`;
          return '/tokens/aliado.png';
      }
  };

  const handleTokenImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => { e.currentTarget.src = '/tokens/aliado.png'; };
  const nextVariant = () => { setTokenVariant(v => v >= 5 ? 1 : v + 1); setCustomImageURL(''); };
  const prevVariant = () => { setTokenVariant(v => v <= 1 ? 5 : v - 1); setCustomImageURL(''); };

  const skillChoicesData = currentClassData?.startingProficiencies?.skills?.[0]?.choose;
  const numSkillsToChoose = skillChoicesData?.count || 2;
  const availableSkillsList = skillChoicesData?.from || ['acrobatics', 'athletics', 'stealth', 'perception'];
  
  const level1Features = useMemo(() => {
      if (!currentClassData || !currentClassData.classFeatures) return [];
      return currentClassData.classFeatures.filter((f: any) => {
          const str = typeof f === 'string' ? f : f.classFeature;
          return str && str.endsWith('|1'); 
      }).map((f: any) => {
          const str = typeof f === 'string' ? f : f.classFeature;
          const rawName = str.split('|')[0]; 
          let description = "Descrição base no compêndio do livro correspondente.";
          if (currentClassData.classFeature && Array.isArray(currentClassData.classFeature)) {
              const fullFeature = currentClassData.classFeature.find((cf: any) => cf.name === rawName && cf.level === 1);
              if (fullFeature && fullFeature.entries) {
                  description = clean5eText(fullFeature.entries.join(" "));
              }
          }
          return { name: translateTerm(rawName), rawName, description };
      });
  }, [currentClassData]);

  const handleToggleSkill = (skill: string) => {
      setSelectedSkills(prev => {
          if (prev.includes(skill)) return prev.filter(s => s !== skill);
          if (prev.length < numSkillsToChoose) return [...prev, skill];
          return prev;
      });
  };

  // ============================================================================
  // TELAS DE LOBBY / LOGIN PADRÃO
  // ============================================================================
  if (step === 1) return (
    <BackgroundWrapper isMuted={isMuted} toggleMute={toggleMute}>
      <div className="flex flex-col items-center gap-8 md:gap-16 w-full max-w-6xl">
        <div className="text-center space-y-2 md:space-y-4 relative w-full px-4">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[500px] h-[150px] md:h-[200px] bg-amber-500/20 blur-[80px] md:blur-[120px] -z-10 animate-pulse"></div>
          <div className="relative inline-block w-full max-w-full">
             <h1 className="text-6xl sm:text-8xl md:text-[10rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-100 via-amber-500 to-amber-900 tracking-widest drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)]" style={{ fontFamily: 'Cinzel Decorative' }}>NEXUS</h1>
             <div className="absolute -bottom-2 md:-bottom-6 left-1/2 -translate-x-1/2 w-3/4 md:w-full h-1 md:h-2 bg-gradient-to-r from-transparent via-amber-600/80 to-transparent blur-[2px] md:blur-[3px] border-t border-amber-300/30"></div>
          </div>
          <p className="text-amber-200/70 tracking-[0.5em] md:tracking-[1em] text-xs md:text-xl font-bold uppercase drop-shadow-lg border-b-2 border-amber-900/30 pb-2 md:pb-4 inline-block px-4 md:px-12 mt-4 md:mt-6">Sistema de RPG</p>
        </div>
        <div className="flex flex-col md:flex-row gap-4 md:gap-8 w-full justify-center items-stretch px-4 md:px-8 max-w-3xl">
          <button onClick={() => { setRole('PLAYER'); setStep(1.1); }} className="group relative w-full md:flex-1 h-[200px] md:h-[280px] overflow-hidden rounded-3xl transition-all duration-500 hover:scale-[1.03] active:scale-95">
             <ArcaneContainer width="w-full" className="h-full hover:shadow-[0_0_50px_rgba(37,99,235,0.3)] hover:border-blue-500/50 transition-all">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-transparent to-black opacity-60 z-0"></div>
                <div className="relative z-10 flex flex-col h-full items-center justify-center p-4 md:p-6 text-center gap-3 md:gap-6">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-blue-950 to-black border border-blue-500/30 shadow-lg group-hover:border-blue-400 flex items-center justify-center"><Sword size={32} className="text-blue-400" /></div>
                    <h3 className="text-2xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-blue-500 leading-tight" style={{ fontFamily: 'Cinzel Decorative' }}>SOU JOGADOR</h3>
                </div>
             </ArcaneContainer>
          </button>
          <button onClick={() => { setRole('DM'); setStep(2); }} className="group relative w-full md:flex-1 h-[200px] md:h-[280px] overflow-hidden rounded-3xl transition-all duration-500 hover:scale-[1.03] active:scale-95">
             <ArcaneContainer width="w-full" className="h-full hover:shadow-[0_0_50px_rgba(220,38,38,0.3)] hover:border-red-500/50 transition-all">
                <div className="absolute inset-0 bg-gradient-to-br from-red-900/40 via-transparent to-black opacity-60 z-0"></div>
                <div className="relative z-10 flex flex-col h-full items-center justify-center p-4 md:p-6 text-center gap-3 md:gap-6">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-red-950 to-black border border-red-500/30 shadow-lg group-hover:border-red-400 flex items-center justify-center"><Crown size={32} className="text-red-400" /></div>
                    <h3 className="text-2xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-200 to-red-500 leading-tight" style={{ fontFamily: 'Cinzel Decorative' }}>SOU O MESTRE</h3>
                </div>
             </ArcaneContainer>
          </button>
        </div>
      </div>
    </BackgroundWrapper>
  );

  if (step === 1.1 && role === 'PLAYER') return (
    <BackgroundWrapper isMuted={isMuted} toggleMute={toggleMute}>
        <ArcaneContainer width="w-full max-w-[500px]" className="!p-6 md:!p-12 gap-6 md:gap-10 flex flex-col items-center">
             <div className="text-center space-y-1 md:space-y-2">
                <h2 className="text-2xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-blue-100 to-blue-400 uppercase tracking-[0.1em] drop-shadow-md" style={{ fontFamily: 'Cinzel Decorative' }}>O Convite</h2>
                <p className="text-blue-200/50 text-xs md:text-sm font-serif italic">Insira a Chave da Sala fornecida pelo Mestre.</p>
             </div>
             <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-blue-900/50 to-transparent"></div>
             
             <div className="w-full space-y-4 md:space-y-6">
                <label className="text-[10px] md:text-xs text-blue-300/70 uppercase font-black tracking-[0.15em] mb-2 md:mb-3 flex items-center gap-2">
                    <Key size={14} className="text-blue-500" /> Código da Taverna
                </label>
                <StoneInput 
                    type="text" 
                    placeholder="Ex: sala-do-dragao" 
                    value={playerRoomId} 
                    onChange={(e: any) => setPlayerRoomId(e.target.value.toLowerCase().replace(/\s+/g, '-'))} 
                    onKeyDown={(e: any) => {
                        if (e.key === 'Enter' && playerRoomId.trim()) {
                            setError('');
                            setStep(savedChar ? 1.5 : 1.2);
                        }
                    }}
                    className="!text-xl md:!text-3xl !p-3 md:!p-4 !border-blue-900/50 focus:!border-blue-400/80 !text-blue-100 rounded-xl text-center font-mono tracking-widest"
                />
                {error && <p className="text-red-300 text-xs text-center font-bold bg-red-900/30 py-2 rounded-lg">{error}</p>}
             </div>
             <MetalButton onClick={() => {
                 if (!playerRoomId.trim()) return setError('Os guardas exigem um código válido!');
                 setError(''); setStep(savedChar ? 1.5 : 1.2);
             }} fullWidth variant="blue" className="py-4 md:py-6 text-xs md:text-sm mt-4"><ChevronRight size={20} className="mr-2" /> Entrar na Taverna</MetalButton>
             <button onClick={() => { setStep(1); setPlayerRoomId(''); setError(''); }} className="text-blue-500/40 hover:text-blue-200 text-[10px] uppercase tracking-[0.3em] font-bold transition-colors pb-1 md:pb-2 mt-2">❮ Voltar aos Portões</button>
        </ArcaneContainer>
    </BackgroundWrapper>
  );

  if (step === 1.5 && savedChar) return (
    <BackgroundWrapper isMuted={isMuted} toggleMute={toggleMute}>
        <ArcaneContainer width="w-full max-w-[450px]" className="!p-6 md:!p-10 gap-6 md:gap-8 flex flex-col items-center">
            <h2 className="text-xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-100 to-amber-400 uppercase trackingest border-b-2 border-amber-900/50 pb-2 md:pb-4 w-full text-center drop-shadow-md" style={{ fontFamily: 'Cinzel' }}>Retornar à Aventura</h2>
            <div className="relative group cursor-pointer mt-2 md:mt-4" onClick={handleQuickLogin}>
                <div className="absolute inset-0 bg-amber-600/30 blur-3xl rounded-full -z-10 group-hover:bg-amber-500/50 transition-all opacity-50"></div>
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-[4px] md:border-[6px] border-amber-600/80 overflow-hidden shadow-[0_0_40px_rgba(245,158,11,0.5)] transition-all group-hover:scale-105 bg-black">
                    <img src={savedChar.image || '/tokens/aliado.png'} alt={savedChar.name} className="w-full h-full object-cover" />
                </div>
            </div>
            <div className="text-center mt-2 md:mt-4 space-y-1 md:space-y-2">
                <h3 className="text-3xl md:text-5xl font-black text-white drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)]" style={{ fontFamily: 'Cinzel Decorative' }}>{savedChar.name}</h3>
                <div className="inline-block bg-black/50 px-3 md:px-4 py-1 rounded-lg border border-amber-900/50"><p className="text-amber-300 text-xs md:text-sm font-bold uppercase tracking-[0.1em]">{savedChar.race} | {savedChar.classType.split(' (')[0]}</p></div>
                <p className="text-blue-400 text-[10px] uppercase tracking-widest font-bold mt-2">Sala: {playerRoomId}</p>
            </div>
            <MetalButton onClick={handleQuickLogin} fullWidth variant="amber" className="py-4 md:py-5 text-sm md:text-base mt-2 md:mt-4"><Play size={20} fill="currentColor" /> Juntar-se à Mesa</MetalButton>
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full pt-4 md:pt-6 border-t-2 border-amber-900/30">
                <button onClick={() => { setName(''); setStep(1.2); }} className="flex-1 py-3 bg-black/50 hover:bg-amber-900/20 border border-amber-900/50 hover:border-amber-500/50 text-amber-200/60 hover:text-amber-100 text-xs font-bold uppercase rounded-xl transition-all">Trocar Herói</button>
                <button onClick={handleDeleteSave} className="py-3 sm:px-4 bg-red-950/30 hover:bg-red-900/50 border border-red-900/50 hover:border-red-500/50 text-red-400/60 hover:text-red-300 text-xs rounded-xl transition-all"><Trash2 size={16} /></button>
            </div>
            <button onClick={() => setStep(1.1)} className="text-amber-500/40 hover:text-amber-200 text-[10px] uppercase tracking-[0.3em] font-bold transition-colors pb-1 mt-2 md:mt-4">❮ Trocar de Sala</button>
        </ArcaneContainer>
    </BackgroundWrapper>
  );

  if (step === 1.2 && role === 'PLAYER') return (
    <BackgroundWrapper isMuted={isMuted} toggleMute={toggleMute}>
        <ArcaneContainer width="w-full max-w-[500px]" className="!p-6 md:!p-12 gap-6 md:gap-10 flex flex-col items-center">
             <div className="text-center space-y-1 md:space-y-2">
                <h2 className="text-2xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-blue-100 to-blue-400 uppercase tracking-[0.1em] drop-shadow-md" style={{ fontFamily: 'Cinzel Decorative' }}>Portal dos Viajantes</h2>
                <p className="text-blue-200/50 text-xs md:text-sm font-serif italic">Acessando a Taverna: <span className="text-blue-400 font-mono font-bold">{playerRoomId}</span></p>
             </div>
            <div className="w-full space-y-4 md:space-y-6 relative">
                <label className="text-[10px] md:text-xs text-blue-300/70 uppercase font-black tracking-[0.15em] mb-2 block ml-1">Já tenho um herói nesta mesa</label>
                <div className="flex flex-col sm:flex-row gap-3 md:gap-4 items-stretch w-full">
                    <StoneInput placeholder="Nome exato do Personagem" value={name} onChange={(e: any) => setName(e.target.value)} onKeyDown={(e: any) => e.key === 'Enter' && handleLoginByName()} className="!text-xl md:!text-2xl !p-3 md:!p-4 !border-blue-900/50 focus:!border-blue-400/80 !text-blue-50 rounded-xl" />
                    <MetalButton onClick={handleLoginByName} disabled={isChecking} variant="blue" className="px-6 py-3 sm:py-0 !rounded-xl flex justify-center items-center">{isChecking && loginIntent === 'LOGIN' ? <Sparkles className="animate-spin" /> : <Search size={24} />}</MetalButton>
                </div>
                {error && <p className="text-red-300 text-xs text-center bg-red-950/50 p-2 rounded-lg">{error}</p>}
            </div>
            <div className="flex items-center w-full gap-4 md:gap-6 opacity-50 my-2"><div className="h-px bg-blue-500/50 flex-grow"></div><span className="text-blue-200/50 text-xs uppercase font-black">Ou</span><div className="h-px bg-blue-500/50 flex-grow"></div></div>
            <MetalButton onClick={handleStartCreation} fullWidth variant="amber" className="py-4 md:py-6 text-xs md:text-sm"><UserPlus size={20} className="mr-2" /> Forjar Nova Lenda</MetalButton>
            <button onClick={() => setStep(1.1)} className="text-blue-500/40 hover:text-blue-200 text-[10px] uppercase font-bold mt-2">❮ Voltar</button>
        </ArcaneContainer>
    </BackgroundWrapper>
  );

  // ============================================================================
  // 👉 CONSTRUTOR DE PERSONAGENS (D&D BEYOND STYLE)
  // ============================================================================
  if (step === 2 && role === 'PLAYER') {
      const BUILDER_STEPS = [
          { id: 1, title: 'ESPÉCIE', icon: <User size={16}/> },
          { id: 2, title: 'CLASSE', icon: <Swords size={16}/> },
          { id: 3, title: 'HABILIDADES', icon: <Star size={16}/> },
          { id: 4, title: 'DESCRIÇÃO', icon: <BookOpen size={16}/> },
          { id: 5, title: 'EQUIPAMENTO', icon: <Backpack size={16}/> },
          { id: 6, title: 'IDENTIDADE', icon: <Fingerprint size={16}/> }
      ];

      return (
        <BackgroundWrapper isMuted={isMuted} toggleMute={toggleMute}>
            {showFullImage && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95 backdrop-blur-xl cursor-zoom-out animate-in fade-in duration-300 p-4" onClick={() => setShowFullImage(false)}>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.1)_0%,transparent_70%)]"></div>
                    <img src={customImageURL || getDynamicTokenImage(selectedRaceName, currentClassData?.fileKey || 'fighter', tokenGender, tokenVariant)} alt="Full Preview" className="max-w-full max-h-[85%] object-contain drop-shadow-[0_0_100px_rgba(245,158,11,0.6)] animate-in zoom-in-95 duration-500" onError={handleTokenImageError} />
                </div>
            )}

            <div className="w-full h-[95vh] md:h-full max-w-[1400px] mx-auto flex flex-col bg-[#0a0a0a]/95 backdrop-blur-xl border-x border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-500 relative">
                <header className="bg-black border-b border-gray-800 flex-shrink-0 z-20 shadow-lg relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-900/20 via-transparent to-red-900/20 pointer-events-none"></div>
                    <div className="flex items-center justify-between px-6 py-4 relative z-10">
                        <span className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 font-serif tracking-wider drop-shadow-md">NEXUS BUILDER</span>
                        <button onClick={() => { setStep(1.2); setLoginIntent('CREATE'); }} className="text-gray-500 hover:text-red-500 transition-colors flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded border border-white/10"><X size={14} /> Cancelar Criação</button>
                    </div>

                    <div className="flex justify-center border-t border-white/5 bg-[#111]">
                        <div className="flex w-full max-w-5xl justify-between overflow-x-auto custom-scrollbar">
                            {BUILDER_STEPS.map((s) => (
                                <button key={s.id} onClick={() => setBuilderStep(s.id)} className={`flex flex-col items-center justify-center gap-2 py-3 px-4 md:px-8 border-b-4 transition-all min-w-[100px] ${builderStep === s.id ? 'border-amber-500 text-amber-400 bg-amber-900/10' : builderStep > s.id ? 'border-amber-900/50 text-gray-300 hover:text-white' : 'border-transparent text-gray-600 hover:text-gray-400'}`}>
                                    <div className="flex items-center gap-2 font-black tracking-widest uppercase text-[9px] md:text-[10px]">
                                        <span className={`hidden sm:flex w-4 h-4 rounded-full items-center justify-center text-[9px] shadow-inner ${builderStep === s.id ? 'bg-amber-500 text-black shadow-amber-500/50' : 'bg-gray-800 text-white'}`}>{s.id}</span>
                                        <span>{s.title}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                <main className="flex-grow overflow-y-auto custom-scrollbar p-6 md:p-12 relative z-10 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.05),transparent_50%)]">
                    {error && <div className="max-w-4xl mx-auto mb-6 p-4 bg-red-950/80 border border-red-500 rounded-lg flex items-center justify-center gap-2 text-red-200 font-bold shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-in slide-in-from-top-4"><XCircle size={18}/> {error}</div>}

                    {/* ABA 1: ESPÉCIE */}
                    {builderStep === 1 && (
                        <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-right-8 duration-500">
                            <div className="mb-8 border-b border-white/10 pb-4">
                                <h2 className="text-3xl font-serif text-amber-400 font-black tracking-wider">Espécie (Raça)</h2>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {dynamicRaces.length === 0 && <p className="text-gray-500 col-span-3 text-center italic py-10">Consultando compêndio mágico...</p>}
                                {dynamicRaces.map((r) => (
                                    <button key={r.name} onClick={() => handleSelectRace(r.name)} className={`p-5 rounded-xl border text-left transition-all duration-200 group relative overflow-hidden ${selectedRaceName === r.name ? 'bg-amber-900/20 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.15)]' : 'bg-black/60 border-white/10 hover:border-amber-500/50 hover:bg-black/80'}`}>
                                        <div className="relative z-10 flex flex-col h-full">
                                            <h3 className={`font-black text-lg md:text-xl uppercase tracking-widest ${selectedRaceName === r.name ? 'text-amber-400' : 'text-gray-200 group-hover:text-white'}`}>{r.name}</h3>
                                            <p className="text-[10px] uppercase font-bold text-amber-600/80 mt-1">{r.desc}</p>
                                        </div>
                                        {selectedRaceName === r.name && <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 blur-2xl rounded-full"></div>}
                                    </button>
                                ))}
                            </div>
                            {currentRaceData && (
                                <div className="mt-8 space-y-4 animate-in slide-in-from-bottom-4">
                                    <Accordion title="Aumentos de Valor de Habilidade" defaultOpen={true}>
                                        <div className="flex flex-col gap-4">
                                            {Object.keys(fixedBonuses).length > 0 && (
                                                <div className="flex gap-2">
                                                    {Object.entries(fixedBonuses).map(([k, v]) => (
                                                        <div key={k} className="bg-amber-600/20 px-3 py-1 rounded border border-amber-500/50 text-amber-400 font-bold uppercase text-xs">+{v} {translateTerm(k)}</div>
                                                    ))}
                                                </div>
                                            )}
                                            
                                            {flexibleChoices.length > 0 && (
                                                <div className="space-y-3 mt-2 border-t border-white/10 pt-3">
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Escolha seus bônus adicionais:</p>
                                                    {flexibleChoices.map((choice) => (
                                                        <div key={choice.id} className="flex flex-col max-w-sm">
                                                            <label className="text-[10px] text-amber-500 uppercase tracking-widest mb-1 font-bold">
                                                                +{choice.amount} para...
                                                            </label>
                                                            <select
                                                                className="bg-black border border-white/20 text-white p-2 rounded outline-none focus:border-amber-500 text-sm font-bold"
                                                                value={racialChoices[choice.id] || ""}
                                                                onChange={(e) => setRacialChoices({ ...racialChoices, [choice.id]: e.target.value })}
                                                            >
                                                                <option value="" disabled>Escolha uma opção</option>
                                                                {choice.options.map((opt: string) => {
                                                                    const isChosenElsewhere = Object.entries(racialChoices).some(([k, v]) => v === opt && k !== choice.id);
                                                                    return (
                                                                        <option key={opt} value={opt} disabled={isChosenElsewhere}>
                                                                            {translateTerm(opt)} (+{choice.amount})
                                                                        </option>
                                                                    );
                                                                })}
                                                            </select>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            
                                            {Object.keys(fixedBonuses).length === 0 && flexibleChoices.length === 0 && (
                                                <div className="text-gray-400 text-xs">Sem bônus registrado.</div>
                                            )}
                                        </div>
                                    </Accordion>
                                    <Accordion title="Idiomas" defaultOpen={true}>
                                        {currentRaceData.languageProficiencies ? 
                                            "Você sabe falar " + Object.keys(currentRaceData.languageProficiencies[0]).map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(", ") + " e Comum." 
                                            : "Você sabe falar Comum e um idioma adicional a sua escolha."}
                                    </Accordion>
                                    <Accordion title="Velocidade" defaultOpen={true}>Sua velocidade base de caminhada é {currentRaceData.speed?.walk || currentRaceData.speed || 30} pés.</Accordion>
                                    {currentRaceData.entries?.map((e: any, i: number) => (
                                        <Accordion key={i} title={`Traço Racial: ${translateTerm(e.name)}`}>{clean5eText(e.entries?.[0] || "Detalhes ausentes no compêndio.")}</Accordion>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ABA 2: CLASSE */}
                    {builderStep === 2 && (
                        <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-right-8 duration-500">
                            <div className="mb-8 border-b border-white/10 pb-4 flex justify-between items-center">
                                <h2 className="text-3xl font-serif text-amber-400 font-black tracking-wider">Classe do Personagem</h2>
                                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/50 px-4 py-1 rounded font-bold">Nível 1</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                                {dynamicClasses.length === 0 && <p className="text-gray-500 col-span-4 text-center italic py-10 border border-dashed border-white/10 rounded-xl">Consultando compêndio mágico...</p>}
                                {dynamicClasses.map((c) => (
                                    <button key={c.name} onClick={() => handleSelectClass(c.name)} className={`p-6 flex flex-col items-center justify-center gap-4 rounded-xl border transition-all duration-200 group relative overflow-hidden ${selectedClassName === c.name ? 'bg-amber-900/20 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.15)] scale-105' : 'bg-black/60 border-white/10 hover:border-amber-500/50 hover:bg-black/80 hover:scale-[1.02]'}`}>
                                        <div className={`text-4xl md:text-5xl filter transition-transform duration-300 ${selectedClassName === c.name ? 'drop-shadow-[0_0_15px_rgba(245,158,11,0.8)] scale-110' : 'drop-shadow-md grayscale group-hover:grayscale-0'}`}>{c.icon}</div>
                                        <h3 className={`font-black text-xs md:text-sm uppercase tracking-[0.2em] text-center ${selectedClassName === c.name ? 'text-amber-400' : 'text-gray-400 group-hover:text-white'}`}>{c.name}</h3>
                                        {selectedClassName === c.name && <div className="absolute inset-0 border-2 border-amber-500/20 rounded-xl pointer-events-none animate-pulse"></div>}
                                    </button>
                                ))}
                            </div>
                            {currentClassData && (
                                <div className="mt-8 space-y-4 animate-in slide-in-from-bottom-4">
                                    <h3 className="text-amber-600 font-bold uppercase tracking-widest text-xs mb-4">Características de Classe: {selectedClassName}</h3>
                                    <Accordion title={`Pontos de Vida`} defaultOpen={true}>
                                        <p><strong>Dado de Vida:</strong> 1d{currentClassData.hd?.faces || 8} por nível de {selectedClassName}.</p>
                                        <p><strong>Pontos de Vida no 1º Nível:</strong> {currentClassData.hd?.faces || 8} + seu modificador de Constituição.</p>
                                    </Accordion>
                                    <Accordion title="Proficiências Iniciais" defaultOpen={true}>
                                        <div className="text-xs space-y-2">
                                            <p><strong>Armaduras:</strong> {currentClassData.startingProficiencies?.armor?.join(', ') || 'Nenhuma'}</p>
                                            <p><strong>Armas:</strong> {currentClassData.startingProficiencies?.weapons?.map((w: any) => clean5eText(typeof w === 'string' ? w : "")).join(', ') || 'Nenhuma'}</p>
                                            <p><strong>Ferramentas:</strong> {currentClassData.startingProficiencies?.tools?.map((w: any) => clean5eText(typeof w === 'string' ? w : "")).join(', ') || 'Nenhuma'}</p>
                                        </div>
                                    </Accordion>
                                    {skillChoicesData && (
                                        <Accordion title={`Escolha de Perícias (${selectedSkills.length}/${numSkillsToChoose})`} defaultOpen={true}>
                                            <p className="text-amber-500/80 text-xs font-bold uppercase mb-3">Escolha {numSkillsToChoose} Perícias da lista abaixo:</p>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                {availableSkillsList.map((skill: string) => {
                                                    const isSelected = selectedSkills.includes(skill);
                                                    const isDisabled = !isSelected && selectedSkills.length >= numSkillsToChoose;
                                                    return (
                                                        <button key={skill} onClick={() => handleToggleSkill(skill)} disabled={isDisabled} className={`p-2 border rounded text-left text-xs uppercase tracking-wider font-bold transition-all ${isSelected ? 'bg-amber-600 text-white border-amber-400' : isDisabled ? 'opacity-30 border-white/5 cursor-not-allowed' : 'bg-black/40 border-white/10 text-gray-400 hover:border-amber-500/50'}`}>
                                                            {isSelected ? '☑ ' : '☐ '} {translateTerm(skill)}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </Accordion>
                                    )}
                                    {level1Features.map((feature: any, idx: number) => (
                                        <Accordion key={idx} title={`Habilidade Nv. 1: ${feature.name}`}>
                                            {feature.description}
                                        </Accordion>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ABA 3: HABILIDADES (POINT BUY MODO D&D BEYOND) */}
                    {builderStep === 3 && (
                        <div className="max-w-4xl mx-auto flex flex-col animate-in fade-in slide-in-from-right-8 duration-500">
                            <h2 className="text-3xl font-serif text-amber-400 font-black tracking-wider mb-6 border-b border-white/10 pb-4">Valores de Habilidade</h2>
                            
                            <div className="flex flex-col md:flex-row justify-between items-center bg-black/40 border border-white/10 p-6 rounded-xl mb-8">
                                <div className="flex flex-col w-full md:w-1/2 mb-4 md:mb-0">
                                    <label className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Método de Geração</label>
                                    <select className="bg-black border border-white/20 text-white p-3 rounded mt-2 outline-none focus:border-amber-500 font-bold">
                                        <option>Compra de Pontos (Point Buy)</option>
                                        <option disabled>Matriz Padrão (Breve)</option>
                                        <option disabled>Rolar Dados (Breve)</option>
                                    </select>
                                </div>
                                <div className="text-center md:text-right">
                                    <span className="text-[10px] text-amber-500 uppercase font-black tracking-[0.2em] block mb-1">Pontos Restantes</span>
                                    <span className={`text-5xl font-black ${pointsLeft < 0 ? 'text-red-500' : 'text-amber-400'}`} style={{ fontFamily: 'Cinzel Decorative' }}>{pointsLeft}</span>
                                </div>
                            </div>

                            <div className="w-full bg-black/40 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                                <div className="grid grid-cols-5 gap-2 p-4 bg-black/80 font-black text-[9px] md:text-xs text-gray-400 uppercase tracking-widest text-center items-center border-b border-white/10">
                                    <div className="text-left pl-2">Atributo</div>
                                    <div>Base</div>
                                    <div>Racial</div>
                                    <div>Total</div>
                                    <div>Mod</div>
                                </div>
                                {Object.keys(stats).map((key) => {
                                    const attr = key as keyof typeof stats;
                                    const racial = getAppliedRacialBonus(attr);
                                    const total = stats[attr] + racial;
                                    const mod = Math.floor((total - 10) / 2);
                                    
                                    return (
                                        <div key={attr} className="grid grid-cols-5 gap-2 p-3 border-b border-white/5 items-center text-center hover:bg-white/5 transition-colors">
                                            <div className="text-left pl-2 font-black text-amber-100 uppercase tracking-widest text-xs md:text-sm">{translateTerm(attr)}</div>
                                            <div className="flex items-center justify-center gap-2">
                                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleStatChange(attr, false)} className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center bg-gray-900 border border-white/10 hover:bg-red-900/50 text-white rounded font-black transition-colors">-</button>
                                                <span className="font-bold text-lg w-6">{stats[attr]}</span>
                                                <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleStatChange(attr, true)} className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center bg-gray-900 border border-white/10 hover:bg-green-900/50 text-white rounded font-black transition-colors">+</button>
                                            </div>
                                            <div className="font-bold text-green-400 text-sm md:text-lg">{racial > 0 ? `+${racial}` : '--'}</div>
                                            <div className="font-black text-amber-400 text-xl md:text-2xl font-serif">{total}</div>
                                            <div className="font-bold text-blue-400 text-lg md:text-xl">{mod >= 0 ? `+${mod}` : mod}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ABA 4: DESCRIÇÃO E DETALHES */}
                    {builderStep === 4 && (
                        <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-right-8 duration-500">
                            <h2 className="text-3xl font-serif text-amber-400 font-black tracking-wider mb-8 border-b border-white/10 pb-4">Descrição e Antecedentes</h2>
                            
                            <div className="space-y-6">
                                <div className="bg-black/40 border border-white/10 rounded-xl p-6">
                                    <h3 className="text-amber-500 font-bold uppercase tracking-widest text-xs mb-4">Detalhes do Personagem</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-2">Origem / Antecedente</label>
                                            <select className="w-full bg-black border border-white/20 text-white p-3 rounded outline-none focus:border-amber-500 font-bold" value={charDetails.background} onChange={(e) => setCharDetails({...charDetails, background: e.target.value})}>
                                                <option value="Personalizado">Personalizado</option><option value="Criminoso">Criminoso</option><option value="Herói do Povo">Herói do Povo</option><option value="Nobre">Nobre</option><option value="Sábio">Sábio</option><option value="Soldado">Soldado</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-2">Tendência (Alinhamento)</label>
                                            <select className="w-full bg-black border border-white/20 text-white p-3 rounded outline-none focus:border-amber-500 font-bold" value={charDetails.alignment} onChange={(e) => setCharDetails({...charDetails, alignment: e.target.value})}>
                                                <option value="Leal e Bom">Leal e Bom</option><option value="Neutro e Bom">Neutro e Bom</option><option value="Caótico e Bom">Caótico e Bom</option>
                                                <option value="Leal e Neutro">Leal e Neutro</option><option value="Verdadeiro Neutro">Neutro</option><option value="Caótico e Neutro">Caótico e Neutro</option>
                                                <option value="Leal e Mau">Leal e Mau</option><option value="Neutro e Mau">Neutro e Mau</option><option value="Caótico e Mau">Caótico e Mau</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-2">Estilo de Vida</label>
                                            <select className="w-full bg-black border border-white/20 text-white p-3 rounded outline-none focus:border-amber-500 font-bold" value={charDetails.lifestyle} onChange={(e) => setCharDetails({...charDetails, lifestyle: e.target.value})}>
                                                <option value="Miserável">Miserável</option><option value="Modesto">Modesto</option><option value="Confortável">Confortável</option><option value="Rico">Rico</option><option value="Aristocrático">Aristocrático</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-2">Fé / Divindade</label>
                                            <input type="text" className="w-full bg-black border border-white/20 text-white p-3 rounded outline-none focus:border-amber-500" placeholder="Ex: Tyr, Deus da Justiça" value={charDetails.faith} onChange={e => setCharDetails({...charDetails, faith: e.target.value})} />
                                        </div>
                                    </div>
                                </div>

                                <Accordion title="Características Físicas" defaultOpen={true}>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {['hair', 'skin', 'eyes', 'height', 'weight', 'age', 'gender'].map(attr => (
                                            <div key={attr}>
                                                <label className="text-[10px] text-amber-500 uppercase font-bold tracking-widest mb-1 block">
                                                    {attr === 'hair' ? 'Cabelo' : attr === 'skin' ? 'Pele' : attr === 'eyes' ? 'Olhos' : attr === 'height' ? 'Altura' : attr === 'weight' ? 'Peso' : attr === 'age' ? 'Idade' : 'Gênero'}
                                                </label>
                                                <input type="text" className="w-full bg-black border border-white/20 p-2 rounded text-sm text-white outline-none focus:border-amber-500" value={(charDetails.physical as any)[attr]} onChange={e => setCharDetails({...charDetails, physical: {...charDetails.physical, [attr]: e.target.value}})} />
                                            </div>
                                        ))}
                                    </div>
                                </Accordion>

                                <Accordion title="Características Pessoais" defaultOpen={true}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] text-amber-500 uppercase font-bold tracking-widest mb-1 block">Traços de Personalidade</label>
                                            <textarea className="w-full h-24 bg-black border border-white/20 p-2 rounded text-sm text-white resize-none outline-none focus:border-amber-500" placeholder="Ex: Eu sempre tenho um plano..." value={charDetails.personalityTraits} onChange={e => setCharDetails({...charDetails, personalityTraits: e.target.value})}></textarea>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-amber-500 uppercase font-bold tracking-widest mb-1 block">Ideais</label>
                                            <textarea className="w-full h-24 bg-black border border-white/20 p-2 rounded text-sm text-white resize-none outline-none focus:border-amber-500" placeholder="Ex: Ajudar os fracos..." value={charDetails.ideals} onChange={e => setCharDetails({...charDetails, ideals: e.target.value})}></textarea>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-amber-500 uppercase font-bold tracking-widest mb-1 block">Vínculos</label>
                                            <textarea className="w-full h-24 bg-black border border-white/20 p-2 rounded text-sm text-white resize-none outline-none focus:border-amber-500" placeholder="Ex: Protejo minha guilda..." value={charDetails.bonds} onChange={e => setCharDetails({...charDetails, bonds: e.target.value})}></textarea>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-amber-500 uppercase font-bold tracking-widest mb-1 block">Defeitos</label>
                                            <textarea className="w-full h-24 bg-black border border-white/20 p-2 rounded text-sm text-white resize-none outline-none focus:border-amber-500" placeholder="Ex: Sou ganancioso..." value={charDetails.flaws} onChange={e => setCharDetails({...charDetails, flaws: e.target.value})}></textarea>
                                        </div>
                                    </div>
                                </Accordion>
                            </div>
                        </div>
                    )}

                    {/* ABA 5: EQUIPAMENTO */}
                    {builderStep === 5 && (
                        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-right-8 duration-500">
                            <h2 className="text-3xl font-serif text-amber-400 font-black tracking-wider mb-8 border-b border-white/10 pb-4 text-center">Equipamento Inicial</h2>
                            
                            {currentClassData && (
                                <div className="flex flex-col gap-6">
                                    <div className="flex gap-4">
                                        <button onClick={() => setSelectedEquipmentChoice('A')} className={`flex-1 py-6 border-2 rounded-2xl font-black uppercase tracking-widest transition-all ${selectedEquipmentChoice === 'A' ? 'bg-amber-600/20 border-amber-500 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)] scale-105' : 'bg-black/60 border-white/10 text-gray-500 hover:border-amber-500/50 hover:text-white'}`}>EQUIPAMENTO</button>
                                        <button onClick={() => setSelectedEquipmentChoice('B')} className={`flex-1 py-6 border-2 rounded-2xl font-black uppercase tracking-widest transition-all ${selectedEquipmentChoice === 'B' ? 'bg-amber-600/20 border-amber-500 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)] scale-105' : 'bg-black/60 border-white/10 text-gray-500 hover:border-amber-500/50 hover:text-white'}`}>OURO</button>
                                    </div>

                                    <div className="bg-black/40 border border-white/10 rounded-xl p-8 shadow-inner min-h-[200px]">
                                        {selectedEquipmentChoice === 'A' ? (
                                            <div>
                                                <h3 className="text-amber-500 font-bold uppercase tracking-widest text-xs mb-4">Itens Concedidos pela Classe</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-300">
                                                    {currentClassData.startingEquipment?.entries?.map((e: any, i: number) => (
                                                        <div key={i} className="bg-black p-3 rounded border border-white/5 flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></div> {clean5eText(e)}
                                                        </div>
                                                    )) || <p>Equipamento padrão do Livro do Jogador.</p>}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                                                <h3 className="text-amber-500 font-bold uppercase tracking-widest text-xs">Rolagem de Ouro Inicial</h3>
                                                <div className="text-6xl font-serif text-amber-400 drop-shadow-md">{clean5eText(currentClassData.startingEquipment?.goldAlternative || '4d4 x 10 GP')}</div>
                                                <p className="text-gray-400 text-sm max-w-md">Ao escolher o ouro inicial, você descarta o equipamento da sua classe e antecedentes para comprar seus próprios itens na taverna.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ABA 6: IDENTIDADE FINAL E O QUE VEM A SEGUIR */}
                    {builderStep === 6 && (
                        <div className="max-w-3xl mx-auto flex flex-col items-center animate-in fade-in slide-in-from-right-8 duration-500">
                            <h2 className="text-3xl md:text-4xl font-serif text-amber-400 font-black tracking-wider mb-10 border-b border-white/10 pb-4 w-full text-center">O Que Vem a Seguir</h2>
                            <div className="w-full bg-black/40 p-6 md:p-10 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center gap-8 relative">
                                <div className="absolute inset-0 bg-gradient-to-b from-amber-900/10 to-transparent pointer-events-none rounded-3xl"></div>
                                <div className="flex flex-col items-center gap-4 w-full z-10">
                                    <div className="flex items-center justify-center gap-4 md:gap-8">
                                        <button onClick={prevVariant} className="p-3 md:p-4 text-amber-600/50 hover:text-amber-400 transition-all bg-black/60 rounded-full border border-white/5 hover:border-amber-500/50 shadow-lg"><ChevronLeft size={24} /></button>
                                        <div className="w-32 h-32 md:w-48 md:h-48 rounded-full border-4 border-amber-600/80 overflow-hidden bg-black shadow-[0_0_50px_rgba(245,158,11,0.3)] relative group cursor-pointer hover:border-amber-400 transition-colors" onClick={() => setShowFullImage(true)}>
                                            <img src={customImageURL || getDynamicTokenImage(selectedRaceName, currentClassData?.fileKey || 'fighter', tokenGender, tokenVariant)} alt="Token" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onError={handleTokenImageError} />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm"><Search className="text-white drop-shadow-lg w-8 h-8" /></div>
                                        </div>
                                        <button onClick={nextVariant} className="p-3 md:p-4 text-amber-600/50 hover:text-amber-400 transition-all bg-black/60 rounded-full border border-white/5 hover:border-amber-500/50 shadow-lg"><ChevronRight size={24} /></button>
                                    </div>
                                    <div className="flex flex-col items-center gap-2 mt-2">
                                        <div className="flex gap-2 bg-black/60 p-1.5 rounded-lg border border-white/5">
                                            <button onClick={() => setTokenGender('male')} className={`px-6 py-2 text-xs font-bold uppercase tracking-widest rounded transition-all ${tokenGender === 'male' ? 'bg-amber-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>Masc.</button>
                                            <button onClick={() => setTokenGender('female')} className={`px-6 py-2 text-xs font-bold uppercase tracking-widest rounded transition-all ${tokenGender === 'female' ? 'bg-amber-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>Fem.</button>
                                        </div>
                                        <span className="text-[10px] text-amber-500/50 font-mono uppercase tracking-widest">Variante {tokenVariant}/5</span>
                                    </div>
                                    <div className="w-full flex justify-center mt-2 border-t border-white/5 pt-4">
                                        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-xs uppercase font-bold tracking-widest bg-black/60 border border-amber-900/50 hover:border-amber-500 hover:text-amber-400 text-amber-600 px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-amber-500/20">
                                            <Upload size={16} /> Usar Imagem Própria
                                        </button>
                                    </div>
                                </div>
                                <div className="w-full max-w-md mt-6 z-10 bg-black/40 p-6 rounded-2xl border border-white/5">
                                    <label className="text-[10px] text-amber-500/80 uppercase font-black tracking-[0.25em] block text-center mb-3">Nome Final do Herói</label>
                                    <StoneInput type="text" className="!text-center !text-2xl md:!text-3xl font-serif text-amber-100 !bg-black/60 !rounded-xl" placeholder="Ex: Valerius" value={name} onChange={(e: any) => setName(e.target.value)} onKeyDown={(e: any) => e.key === 'Enter' && handleFinalSubmit()}/>
                                    <div className="flex justify-center items-center gap-2 mt-4 text-[10px] font-bold uppercase tracking-widest bg-black/50 py-2 rounded-lg border border-white/5">
                                        <span className="text-gray-400">{selectedRaceName || 'Raça'}</span><span className="text-amber-600">|</span><span className="text-amber-500">{selectedClassName || 'Classe'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>

                <footer className="bg-[#050505] border-t border-gray-800 p-4 md:p-6 flex-shrink-0 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
                    <div className="max-w-5xl mx-auto w-full flex justify-between items-center">
                        <button onClick={() => builderStep > 1 ? setBuilderStep(b => b - 1) : setStep(1.2)} className="flex items-center gap-2 px-4 md:px-6 py-3 bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white font-bold text-xs md:text-sm uppercase tracking-widest rounded-lg border border-white/5 transition-colors">
                            <ChevronLeft size={18} /> <span className="hidden sm:inline">Voltar</span>
                        </button>
                        <div className="flex items-center gap-2">
                            {builderStep < 6 ? (
                                <button onClick={() => setBuilderStep(b => b + 1)} className="flex items-center gap-2 px-8 md:px-12 py-3 md:py-4 bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white font-black text-xs md:text-sm uppercase tracking-widest rounded-lg shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-transform active:scale-95 border border-amber-400/50">
                                    Avançar <ChevronRight size={18} />
                                </button>
                            ) : (
                                <button onClick={handleFinalSubmit} disabled={isChecking || pointsLeft < 0} className="flex items-center gap-2 px-8 md:px-12 py-3 md:py-4 bg-gradient-to-r from-green-700 to-green-600 hover:from-green-600 hover:to-green-500 text-white font-black text-xs md:text-sm uppercase tracking-widest rounded-lg shadow-[0_0_20px_rgba(22,163,74,0.6)] transition-transform active:scale-95 border border-green-400/50 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed">
                                    {isChecking ? <Sparkles className="animate-spin" size={18} /> : <Save size={18} />} <span className="hidden sm:inline">Despertar Lenda</span><span className="sm:hidden">Despertar</span>
                                </button>
                            )}
                        </div>
                    </div>
                </footer>
            </div>
        </BackgroundWrapper>
      );
  }

  if (role === 'DM') {
    if (step === 2) return (
        <BackgroundWrapper isMuted={isMuted} toggleMute={toggleMute}>
            <ArcaneContainer width="w-full max-w-[500px]" className="!p-8 md:!p-12 gap-8 md:gap-10 flex flex-col items-center border-red-900/30 w-full">
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
                <MetalButton onClick={handleFinalSubmit} fullWidth variant="red" className="py-4 md:py-6 text-xs md:text-sm bg-gradient-to-r from-red-900 via-red-800 to-red-950 border-red-500/40 shadow-red-900/30 text-red-50"><Crown size={20} className="mr-2" /> Desbloquear</MetalButton>
                <button onClick={() => { setStep(1); setDmPass(''); setError(''); }} className="text-red-500/40 hover:text-red-200 text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] font-bold transition-colors pb-1 md:pb-2 mt-2 md:mt-4">❮ Voltar aos Reinos Mortais</button>
            </ArcaneContainer>
        </BackgroundWrapper>
    );

    if (step === 4) return (
        <BackgroundWrapper isMuted={isMuted} toggleMute={toggleMute}>
            <ArcaneContainer width="w-full max-w-[600px]" className="!p-6 md:!p-10 gap-4 flex flex-col items-center border-red-900/30 w-full animate-in fade-in zoom-in-95 duration-500">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.15),transparent_70%)] pointer-events-none"></div>
                <div className="text-center space-y-2 mb-2 w-full"><h2 className="text-2xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-200 via-red-500 to-red-800 uppercase tracking-[0.1em] md:tracking-[0.2em] drop-shadow-md border-b-2 border-red-900/50 pb-4 w-full" style={{ fontFamily: 'Cinzel Decorative' }}>Crônicas</h2></div>

                <div className="w-full flex-col flex gap-2">
                    {savedCampaigns.length > 0 && (
                        <div className="w-full mb-2">
                            <label className="text-[10px] md:text-xs text-red-300/70 uppercase font-black tracking-[0.15em] mb-3 flex items-center gap-2"><Scroll size={14} className="text-red-500" /> Salão dos Mundos (Salvas)</label>
                            <div className="flex flex-col gap-3 max-h-[180px] overflow-y-auto custom-scrollbar pr-2">
                                {savedCampaigns.map((camp, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <button onClick={() => submitCampaign(camp.name, camp.roomId)} className="flex-1 bg-black/60 hover:bg-red-900/40 border border-red-900/30 hover:border-red-500/50 rounded-2xl p-3 md:p-4 transition-all text-left group shadow-inner">
                                            <div className="text-red-100 font-bold text-sm md:text-base font-serif group-hover:text-white transition-colors truncate">{camp.name}</div>
                                            <div className="text-[9px] md:text-[10px] text-red-500/60 uppercase tracking-widest font-mono mt-1">Sala ID: <span className="text-red-300">{camp.roomId}</span></div>
                                        </button>
                                        <button onClick={() => { if(window.confirm(`Destruir os registros da crônica "${camp.name}"?`)) { const updated = savedCampaigns.filter(c => c.roomId !== camp.roomId); setSavedCampaigns(updated); localStorage.setItem('nexus_saved_campaigns', JSON.stringify(updated)); } }} className="p-3 md:p-4 bg-black/60 hover:bg-red-950 border border-red-900/30 hover:border-red-500/50 rounded-2xl text-red-500/40 hover:text-red-400 transition-all shadow-inner" title="Esquecer Crônica"><Trash2 size={16} /></button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center w-full gap-4 opacity-50 mt-6 mb-4"><div className="h-px bg-gradient-to-r from-transparent to-red-500/50 flex-grow"></div><span className="text-red-200/50 text-[10px] uppercase font-black tracking-widest">Ou Forjar Nova</span><div className="h-px bg-gradient-to-l from-transparent to-red-500/50 flex-grow"></div></div>
                        </div>
                    )}

                    <div className="bg-black/40 border border-red-900/30 rounded-2xl p-4 shadow-inner hover:border-red-500/50 transition-colors space-y-4">
                        <div>
                            <label className="text-[10px] md:text-xs text-red-300/70 uppercase font-black tracking-[0.15em] mb-2 flex items-center gap-2"><MapIcon size={14} className="text-red-500" /> Nome da Nova Crônica</label>
                            <StoneInput type="text" placeholder="Ex: A Mina Perdida de Phandelver" value={campaignName} onChange={(e: any) => setCampaignName(e.target.value)} className="!text-lg md:!text-xl !p-3 !border-red-900/50 focus:!border-red-400/80 !text-red-50 rounded-xl" />
                        </div>
                        <div>
                            <label className="text-[10px] md:text-xs text-red-300/70 uppercase font-black tracking-[0.15em] mb-2 flex items-center gap-2"><Key size={14} className="text-red-500" /> Chave da Sala (ID Secreto)</label>
                            <StoneInput type="text" placeholder="ex: sala-do-dragao" value={roomPassword} onChange={(e: any) => setRoomPassword(e.target.value.toLowerCase().replace(/\s+/g, '-'))} onKeyDown={(e: any) => e.key === 'Enter' && submitCampaign(campaignName, roomPassword)} className="!text-lg md:!text-xl !p-3 !border-red-900/50 focus:!border-red-400/80 !text-red-400 rounded-xl font-mono text-center tracking-widest" />
                            <p className="text-[9px] text-red-500/50 mt-2 text-center uppercase tracking-widest">Passe esta chave aos jogadores para entrarem na sua mesa.</p>
                        </div>
                    </div>
                </div>

                {error && <p className="text-red-300 text-xs md:text-sm animate-in fade-in slide-in-from-top-2 text-center bg-red-950/50 p-2 md:p-3 rounded-lg border border-red-500/30 shadow-md font-bold flex items-center justify-center gap-2 w-full mt-2"><XCircle size={16}/> {error}</p>}

                <div className="flex gap-3 md:gap-4 w-full mt-2 pt-4 border-t-2 border-red-900/30">
                    <button onClick={() => { setStep(2); setDmPass(''); }} className="px-4 py-3 text-red-500/50 hover:text-red-200 font-bold uppercase tracking-widest text-[10px] md:text-xs transition-colors rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10">❮ Cancelar</button>
                    <MetalButton onClick={() => submitCampaign(campaignName, roomPassword)} fullWidth variant="red" className="py-4 text-xs md:text-sm">Abrir os Portões ❯</MetalButton>
                </div>
            </ArcaneContainer>
        </BackgroundWrapper>
    );
  }

  return null;
};

export default LoginScreen; 