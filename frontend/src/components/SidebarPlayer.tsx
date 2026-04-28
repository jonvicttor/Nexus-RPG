import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Chat, { ChatMessage } from './Chat';
import { Entity, Item } from '../App';
import LevelUpModal from './LevelUpModal';
import { getLevelFromXP, getProficiencyBonus, calculateHPGain, XP_TABLE } from '../utils/gameRules';
import Inventory from './Inventory';
import { mapEntityStatsToAttributes } from '../utils/attributeMapping';
import { 
  Sword, ChevronRight, ChevronLeft, Info, Hourglass, 
  CornerUpLeft, UserPlus, ArrowRight, Check, Star, Zap, Flame, LayoutGrid, Plus, Skull, Target
} from 'lucide-react';

// --- TIPOS E INTERFACES ---

export interface InitiativeItem { id: number; name: string; value: number; }

interface GothicBannerProps {
  name: string;
  race?: string;
  classType?: string;
  level: number;
  image?: string;
  inspiration: boolean;
  isConcentrating: boolean;
  onSelect: () => void;
}

interface GothicAttributeCircleProps {
  label: string;
  value: number;
  modifier: string;
  color: string;
  onClick: () => void;
}

interface GothicShieldProps {
  attrKey: string;
  abrev: string;
  nome: string;
  valor: number;
  isProf: boolean;
  onClick: () => void;
}

interface DescriptionPanelProps {
  title: string;
  description: string;
  onClose: () => void;
}

interface TargetPickerModalProps {
  actionType: 'attack' | 'help';
  entities: Entity[];
  initiativeList: InitiativeItem[];
  myCharacterId: number;
  onClose: () => void;
  onSelect: (target: Entity) => void;
}

interface SidebarPlayerProps {
  entities: Entity[];
  myCharacterName: string; 
  myCharacterId: number;
  initiativeList: InitiativeItem[];
  activeTurnId: number | null;
  chatMessages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onRollAttribute: (charName: string, attrName: string, mod: number, damageExpression?: string, damageType?: string, rollType?: 'normal'|'advantage'|'disadvantage') => void;
  onUpdateCharacter?: (id: number, updates: Partial<Entity>) => void;
  onSelectEntity?: (entity: Entity) => void;
  onApplyDamageFromChat: (targetId: number, damageExpression: string) => void;
  availableSpells?: any[]; 
  onNextTurn: () => void;
  onPlayerRequestSkill: (skillName: string, mod: number) => void;
  onSetTarget: (id: number | number[] | null, multiSelect?: boolean) => void;
}

// --- CONSTANTES ---

const EMPTY_ARRAY: any[] = [];

const ATTR_COLORS: Record<string, string> = {
  STR: "#c0392b",
  DEX: "#27ae60",
  CON: "#e67e22",
  INT: "#2980b9",
  WIS: "#8e44ad",
  CHA: "#c9aa71",
};

// Cores heráldicas adaptadas para o Dark Mode
const SHIELD_COLORS: Record<string, { fill: string, stroke: string, texto: string, profFill: string }> = {
  str: { fill: '#131f0a', stroke: '#3B6D11', texto: '#EAF3DE', profFill: '#1f3d0e' }, // FOR
  dex: { fill: '#0a172b', stroke: '#185FA5', texto: '#E6F1FB', profFill: '#0d284f' }, // DES
  con: { fill: '#290c0c', stroke: '#A32D2D', texto: '#FCEBEB', profFill: '#4a1515' }, // CON
  int: { fill: '#14112e', stroke: '#534AB7', texto: '#EEEDFE', profFill: '#24205c' }, // INT
  wis: { fill: '#241402', stroke: '#854F0B', texto: '#FAEEDA', profFill: '#3d2405' }, // SAB
  cha: { fill: '#260d15', stroke: '#993556', texto: '#FBEAF0', profFill: '#451827' }  // CAR
};

const CLASS_ABILITIES: Record<string, { name: string; max: number; icon: string; desc: string; color: string; unlockLevel: number, type: string }[]> = {
  'BARBARO': [
    { name: 'Fúria', max: 2, icon: '😡', desc: 'Vantagem em FOR, Resistência a dano.', color: 'text-red-500', unlockLevel: 1, type: 'bonus action' },
    { name: 'Ataque Imprudente', max: 99, icon: '⚠️', desc: 'Vantagem no ataque, inimigos têm vantagem.', color: 'text-orange-500', unlockLevel: 2, type: 'action' }
  ],
  'GUERREIRO': [
    { name: 'Retomar o Fôlego', max: 1, icon: '🩹', desc: 'Recupera 1d10 + Nível de PV.', color: 'text-green-400', unlockLevel: 1, type: 'bonus action' },
    { name: 'Surto de Ação', max: 1, icon: '⚡', desc: 'Ganha uma ação extra.', color: 'text-yellow-500', unlockLevel: 2, type: 'action' }
  ],
  'CLERIGO': [
    { name: 'Curar Ferimentos', max: 2, icon: '✨', desc: 'Rola 1d8 + Sabedoria de cura.', color: 'text-blue-400', unlockLevel: 1, type: 'action' },
    { name: 'Canalizar Divindade', max: 1, icon: '🙏', desc: 'Efeito especial do domínio.', color: 'text-yellow-400', unlockLevel: 2, type: 'action' }
  ],
};

const GENERIC_RULES: Record<string, string> = {
    "saving throws": "Uma jogada de salvaguarda representa uma tentativa de resistir a uma ameaça.",
    "proficiencias e treinamento": "Proficiências cobrem treinamento com armaduras, armas e ferramentas.",
    "skills": "Perícias representam um aspecto específico da pontuação de habilidade."
};

const PT_BR_DICT: Record<string, string> = {
    "str": "FOR", "dex": "DES", "con": "CON", "int": "INT", "wis": "SAB", "cha": "CAR",
    "strength": "Força", "dexterity": "Destreza", "constitution": "Constituição", 
    "intelligence": "Inteligência", "wisdom": "Sabedoria", "charisma": "Carisma",
    "acrobatics": "Acrobacia", "animal handling": "Lidar com Animais", "arcana": "Arcanismo",
    "athletics": "Atletismo", "deception": "Enganação", "history": "História", "insight": "Intuição",
    "intimidation": "Intimidação", "investigation": "Investigação", "medicine": "Medicina",
    "nature": "Natureza", "perception": "Percepção", "performance": "Atuação",
    "persuasion": "Persuasão", "religion": "Religião", "sleight of hand": "Prestidigitação",
    "stealth": "Furtividade", "survival": "Sobrevivência",
    "fire": "Ígneo", "cold": "Gélido", "acid": "Ácido", "lightning": "Elétrico", 
    "thunder": "Trovejante", "poison": "Venenoso", "necrotic": "Necrótico", 
    "radiant": "Radiante", "force": "Energia", "psychic": "Psíquico", 
    "bludgeoning": "Contundente", "piercing": "Perfurante", "slashing": "Cortante",
    "heal": "Cura", "healing": "Cura", "all": "TODAS", "attack": "ATAQUE", "action": "AÇÃO", "bonus action": "AÇÃO BÔNUS", "reaction": "REAÇÃO", "other": "OUTRO",
    "saving throws": "Salvaguardas", "proficiencias e treinamento": "Proficiências e Treinamento"
};

const SKILL_MAP: Record<string, string> = {
    "acrobatics": "dex", "animal handling": "wis", "arcana": "int", "athletics": "str",
    "deception": "cha", "history": "int", "insight": "wis", "intimidation": "cha",
    "investigation": "int", "medicine": "wis", "nature": "int", "perception": "wis",
    "performance": "cha", "persuasion": "cha", "religion": "int", "sleight of hand": "dex",
    "stealth": "dex", "survival": "wis"
};

// --- FUNÇÕES UTILITÁRIAS ---

const formatSpellName = (name: string) => {
    if (!name) return "Magia Desconhecida";
    return name.split(' (')[0].replace(/\{@[^}]+\}/g, '').trim();
};

const translateTerm = (term: string) => {
    if (!term) return "";
    return PT_BR_DICT[term] || PT_BR_DICT[term.toLowerCase()] || term;
};

const sign = (n: number) => {
    if (n > 0) return `+${n}`;
    if (n < 0) return `−${Math.abs(n)}`;
    return '0';
};

const getSpellMeta = (spell: any) => {
    let time = "1 ação";
    if (spell.time && Array.isArray(spell.time) && spell.time[0]) {
        time = `${spell.time[0].number} ${translateTerm(spell.time[0].unit)}`;
    } else if (typeof spell.time === 'string') time = spell.time;

    let range = "Visão";
    if (spell.range && spell.range.distance) {
        range = spell.range.distance.amount ? `${spell.range.distance.amount} ${translateTerm(spell.range.distance.type)}` : translateTerm(spell.range.distance.type);
    } else if (typeof spell.range === 'string') range = spell.range;

    let comps = "V, S";
    if (spell.components && typeof spell.components === 'object') {
        const c = [];
        if (spell.components.v) c.push("V");
        if (spell.components.s) c.push("S");
        if (spell.components.m) c.push("M");
        if (c.length > 0) comps = c.join(", ");
    } else if (typeof spell.components === 'string') comps = spell.components;
    
    return { time, range, comps };
};

const getExhaustionText = (level: number) => {
    switch(level) {
        case 1: return "Desv. Habilidade";
        case 2: return "Mov. Metade";
        case 3: return "Desv. Ataques";
        case 4: return "PV Max Metade";
        case 5: return "Mov. Zero";
        case 6: return "Morte";
        default: return "";
    }
}

// --- COMPONENTES VISUAIS GÓTICOS (SVGs) ---

const GothicBanner: React.FC<GothicBannerProps> = ({ name, race, classType, level, image, inspiration, isConcentrating, onSelect }) => (
    <div className="relative w-full h-32 mb-4 group" onClick={onSelect} style={{ cursor: 'pointer' }}>
        <svg width="100%" height="100%" viewBox="0 0 360 120" className="drop-shadow-2xl">
            <defs>
                <linearGradient id="bannerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#141628" />
                    <stop offset="100%" stopColor="#0a0c1e" />
                </linearGradient>
            </defs>
            <path d="M30,10 Q180,10 330,10 L350,25 L330,40 L350,55 L330,70 L350,85 L330,100 L30,100 Q180,100 30,85 L10,70 L30,55 L10,40 L30,25 Z" fill="url(#bannerGrad)" stroke="#c8d4e8" strokeWidth="1.5" />
            <path d="M30,10 L50,25 L30,40 Z" fill="#060810" opacity="0.6" />
            <path d="M330,10 L310,25 L330,40 Z" fill="#060810" opacity="0.6" />
        </svg>
        
        <div className="absolute inset-0 flex items-center px-8 pointer-events-none">
            <div className="relative w-16 h-16 rounded-full border-2 border-[#c8d4e8] overflow-hidden shadow-[0_0_10px_rgba(200,212,232,0.3)] shrink-0 mr-4 bg-[#0a0c1e]">
                <img src={image || '/tokens/aliado.png'} alt="Token" className="w-full h-full object-cover" />
                {isConcentrating && <div className="absolute bottom-0 w-full bg-blue-500/80 text-[8px] text-white text-center font-bold py-0.5">CONC.</div>}
            </div>
            <div className="flex-1 min-w-0">
                <h2 className="text-[#e8eeff] font-cinzel-decorative text-lg tracking-widest uppercase truncate drop-shadow-md">{name}</h2>
                <div className="text-[#8090b8] font-cinzel text-[10px] tracking-widest uppercase mt-0.5 truncate">
                    {race || '—'} • {classType?.split(' (')[0] || '—'}
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <span className="bg-[#0a0c1e] border border-[#c8d4e8] text-[#c8d4e8] px-2 py-0.5 text-[9px] font-cinzel font-bold uppercase tracking-wider rounded-sm">Lvl {level}</span>
                    {inspiration && <span className="text-[#c9aa71] text-xs">✦</span>}
                </div>
            </div>
        </div>
    </div>
);

const GothicAttributeCircle: React.FC<GothicAttributeCircleProps> = ({ label, value, modifier, color, onClick }) => (
    <div className="relative flex flex-col items-center group cursor-pointer" onClick={onClick}>
        <span className="text-[#8090b8] font-cinzel text-[9px] tracking-widest uppercase mb-1 opacity-70 group-hover:opacity-100 transition-opacity">
            {label}
        </span>
        
        <div className="relative flex items-center justify-center w-[60px] h-[75px]">
            <svg width="60" height="75" viewBox="0 0 60 75" className="absolute inset-0 drop-shadow-md transition-transform group-hover:scale-105">
                <circle cx="30" cy="30" r="24" fill="#0a0c1e" stroke="#c8d4e8" strokeWidth="1.5" />
                <path d="M16,45 Q30,65 44,45 L40,40 L20,40 Z" fill="#0a0c1e" stroke="#c8d4e8" strokeWidth="1.5" />
                <circle cx="30" cy="30" r="20" fill="none" stroke="#2a3060" strokeWidth="1" strokeDasharray="3 2" />
            </svg>

            <div className="absolute top-[30px] transform -translate-y-1/2 flex flex-col items-center pointer-events-none">
                <span className="text-[#e8eeff] font-cinzel text-xl font-bold drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                    {value}
                </span>
            </div>

            <div className="absolute bottom-[5px] bg-[#0a0c1e] border border-[#c8d4e8] rounded-full w-7 h-7 flex items-center justify-center shadow-lg pointer-events-none z-10">
                <span className="text-[#e8eeff] font-cinzel text-xs font-bold" style={{ color: color }}>
                    {modifier}
                </span>
            </div>
        </div>
    </div>
);

const GothicShield: React.FC<GothicShieldProps> = ({ attrKey, abrev, nome, valor, isProf, onClick }) => {
    const c = SHIELD_COLORS[attrKey] || SHIELD_COLORS.str;
    const currentFill = isProf ? c.profFill : c.fill;

    return (
        <div className="flex flex-col items-center group cursor-pointer" onClick={onClick}>
            <svg viewBox="0 0 90 100" className="w-[48px] h-auto drop-shadow-xl transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]">
                <path 
                    d="M45 4 L82 18 L82 52 C82 72 63 88 45 96 C27 88 8 72 8 52 L8 18 Z" 
                    fill={currentFill} 
                    stroke={c.stroke} 
                    strokeWidth={isProf ? "3" : "1.5"} 
                />
                <path 
                    d="M45 14 L74 26 L74 52 C74 67 59 80 45 88 C31 80 16 67 16 52 L16 26 Z" 
                    fill="none" 
                    stroke={c.stroke} 
                    strokeWidth="1" 
                    strokeDasharray="3,2" 
                />
                <text x="45" y="46" fontSize="22" fontWeight="700" fill={c.texto} textAnchor="middle" fontFamily="var(--ff)">
                    {abrev}
                </text>
                <text x="45" y="74" fontSize="20" fontWeight="900" fill={c.texto} textAnchor="middle" fontFamily="var(--fb)">
                    {sign(valor)}
                </text>
            </svg>
            <span className="mt-2 text-[9px] uppercase font-bold tracking-widest text-center" style={{ color: c.texto, fontFamily: "var(--ff)" }}>
                {nome}
            </span>
        </div>
    );
};

// ============================================================================
// COMPONENTES DE INTERFACE
// ============================================================================

const IdentityCard = ({ title, content }: { title: string, content: string | undefined }) => {
    if (!content || content.trim() === '') return null;
    return (
        <div className="mb-3">
            <h4 className="text-[9px] text-[#8090b8] uppercase tracking-[0.15em] font-cinzel mb-1 border-b border-[#2a3060] pb-1">{title}</h4>
            <p className="text-[12px] text-[#e8eeff] font-crimson italic leading-relaxed whitespace-pre-wrap opacity-90">{content}</p>
        </div>
    );
};

const DescriptionPanel: React.FC<DescriptionPanelProps> = ({ title, description, onClose }) => {
    return (
        <div className="absolute top-0 right-0 h-full w-[360px] bg-[#0d0e1f] border-l border-[#2a3060] z-[210] flex flex-col transform transition-transform animate-in slide-in-from-right duration-300 shadow-2xl">
            <div className="bg-[#0a0c1e] p-4 shrink-0 flex items-center justify-between border-b border-[#2a3060]">
                <h3 className="text-lg font-cinzel-decorative text-[#c8d4e8] truncate flex items-center gap-2"><Info size={18}/> {title}</h3>
                <button type="button" onClick={onClose} className="text-[#8090b8] hover:text-[#c8d4e8] hover:bg-white/5 p-1.5 rounded transition-colors"><ChevronRight size={20}/></button>
            </div>
            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
                <div className="space-y-4 font-crimson leading-relaxed text-sm text-[#e8eeff]">
                    {description ? description.split('\n\n').map((para, i) => <p key={i} className="whitespace-pre-wrap opacity-90">{para}</p>) : "Nenhuma descrição disponível."}
                </div>
            </div>
        </div>
    )
}

// =====================================
// COMPONENTE: MODAL DE SELEÇÃO DE ALVO
// =====================================

const TargetPickerModal: React.FC<TargetPickerModalProps> = ({ actionType, entities, initiativeList, myCharacterId, onClose, onSelect }) => {
    const validTargets = entities.filter(ent => initiativeList.some(init => init.id === ent.id) && ent.id !== myCharacterId);
    const enemies = validTargets.filter(e => e.type === 'enemy');
    const allies = validTargets.filter(e => e.type === 'player');
    const primaryTargets = actionType === 'attack' ? enemies : allies;
    const secondaryTargets = actionType === 'attack' ? allies : enemies;
    const primaryLabel = actionType === 'attack' ? 'Inimigos no Combate' : 'Aliados no Combate';
    const secondaryLabel = actionType === 'attack' ? 'Aliados (Fogo Amigo?)' : 'Inimigos';

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-[#0a0c1e] border border-[#c8d4e8] rounded-xl shadow-[0_0_30px_rgba(13,14,31,0.8)] w-[400px] flex flex-col overflow-hidden max-h-[80vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className={`p-4 border-b border-[#2a3060] flex items-center justify-between ${actionType === 'attack' ? 'bg-[#2a0f0f]/50' : 'bg-[#0f2a1a]/50'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${actionType === 'attack' ? 'bg-[#c0392b]/20' : 'bg-[#27ae60]/20'}`}>
                            {actionType === 'attack' ? <Target size={24} className="text-[#c0392b]" /> : <UserPlus size={24} className="text-[#27ae60]" />}
                        </div>
                        <div>
                            <h3 className="font-cinzel font-bold text-[#e8eeff] text-lg leading-tight">
                                {actionType === 'attack' ? 'Escolha um Alvo' : 'Quem você vai Ajudar?'}
                            </h3>
                            <p className="font-cinzel text-[10px] text-[#8090b8] uppercase tracking-widest">
                                {actionType === 'attack' ? 'Selecione a criatura para focar' : 'Conceda Vantagem a um aliado'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-[#2a3060] hover:text-[#c8d4e8] transition-colors"><ChevronRight size={24}/></button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {primaryTargets.length > 0 && (
                        <div className="mb-4">
                            <div className="text-[9px] font-cinzel text-[#2a3060] uppercase tracking-[0.2em] mb-2 pl-2 border-b border-[#2a3060] pb-1">{primaryLabel}</div>
                            <div className="flex flex-col gap-1">
                                {primaryTargets.map(ent => (
                                    <button key={ent.id} onClick={() => onSelect(ent)} className="flex items-center gap-3 w-full p-2 bg-[#0d0e1f] hover:bg-[#141628] border border-[#2a3060] hover:border-[#c8d4e8] rounded transition-all text-left group">
                                        <div className="w-10 h-10 rounded-full border border-[#3a3460] group-hover:border-[#c8d4e8] overflow-hidden shrink-0 bg-black">
                                            {ent.tokenImage || ent.image ? <img src={ent.tokenImage || ent.image} className="w-full h-full object-cover" alt=""/> : <div className="w-full h-full" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-cinzel text-gray-200 group-hover:text-[#e8eeff] truncate">{ent.name}</div>
                                            <div className="text-[8px] text-[#8090b8] uppercase tracking-widest truncate">{ent.type === 'player' ? 'Jogador' : 'Monstro'}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {secondaryTargets.length > 0 && (
                        <div>
                            <div className="text-[9px] font-cinzel text-[#2a3060] uppercase tracking-[0.2em] mb-2 pl-2 border-b border-[#2a3060] pb-1">{secondaryLabel}</div>
                            <div className="flex flex-col gap-1">
                                {secondaryTargets.map(ent => (
                                    <button key={ent.id} onClick={() => onSelect(ent)} className="flex items-center gap-3 w-full p-2 bg-[#0d0e1f] hover:bg-[#141628] border border-[#2a3060] hover:border-[#c8d4e8] rounded transition-all text-left group opacity-60 hover:opacity-100">
                                        <div className="w-8 h-8 rounded-full border border-[#3a3460] group-hover:border-[#c8d4e8] overflow-hidden shrink-0 bg-black">
                                            {ent.tokenImage || ent.image ? <img src={ent.tokenImage || ent.image} className="w-full h-full object-cover" alt=""/> : <div className="w-full h-full" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-cinzel text-gray-300 group-hover:text-[#e8eeff] truncate text-sm">{ent.name}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {validTargets.length === 0 && (
                        <div className="text-center p-6 opacity-50">
                            <Skull size={32} className="mx-auto mb-2 text-[#8090b8]" />
                            <p className="text-xs font-cinzel text-[#8090b8]">Ninguém na lista de iniciativa.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// =====================================
// COMPONENTE PRINCIPAL
// =====================================

const SidebarPlayer: React.FC<SidebarPlayerProps> = ({ 
  entities, myCharacterName, myCharacterId, initiativeList, activeTurnId, chatMessages, onSendMessage, onRollAttribute, onUpdateCharacter, onSelectEntity, onApplyDamageFromChat, availableSpells, onNextTurn, onSetTarget
}) => {
  const [activeTab, setActiveTab] = useState<'abilities' | 'actions' | 'spells' | 'inventory' | 'features' | 'background' | 'notes' | 'chat'>('actions');
  const [actionFilter, setActionFilter] = useState<'all' | 'attack' | 'action' | 'bonus action' | 'reaction' | 'other'>('all');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [pendingLevelData, setPendingLevelData] = useState<{ newLevel: number, hpGain: number } | null>(null);

  const [descriptionPanel, setDescriptionPanel] = useState<{ title: string, content: string } | null>(null);
  const [expandedActionIds, setExpandedActionIds] = useState<Record<string, boolean>>({});
  const [hpInput, setHpInput] = useState<string>('');

  const [abilityUsage, setAbilityUsage] = useState<Record<string, number>>({}); 
  const [deathSaves, setDeathSaves] = useState({ successes: 0, failures: 0 });
  const [combatActionsUsed, setCombatActionsUsed] = useState<Record<string, boolean>>({});
  const [targetPicker, setTargetPicker] = useState<{ isOpen: boolean, type: 'attack' | 'help' }>({ isOpen: false, type: 'attack' });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isEditingAction, setIsEditingAction] = useState(false);
  const [actionForm, setActionForm] = useState<{ id?: string, name: string, attackMod: string, damageExpr: string, damageType: string, saveAttr: string }>({
      name: '', attackMod: 'none', damageExpr: '', damageType: 'Físico', saveAttr: 'none'
  });

  const myCharacter = entities.find(e => e.id === myCharacterId) || entities.find(e => e.type === 'player' && e.name === myCharacterName); 
  const customActions = useMemo(() => (myCharacter as any)?.customActions || EMPTY_ARRAY, [myCharacter]); 
  const charDetails = (myCharacter as any)?.details; 
  
  const currentXP = myCharacter?.xp || 0;
  const calculatedLevel = getLevelFromXP(currentXP);
  const savedLevel = myCharacter?.level || 1;
  const proficiencyBonus = getProficiencyBonus(savedLevel);
  const attributes = myCharacter ? mapEntityStatsToAttributes(myCharacter) : { FOR: 10, DES: 10, CON: 10, INT: 10, SAB: 10, CAR: 10 };
  const proficiencies = myCharacter?.proficiencies || {};
  
  const inventory = (myCharacter?.inventory || []);
  const equippedWeapons = inventory.filter(i => i.type === 'weapon' && i.isEquipped); 
  const equippedArmor = inventory.find(i => i.isEquipped && i.type === 'armor');
  const armorBonus = equippedArmor?.stats?.ac || 0;
  const currentAC = (myCharacter?.ac || 10) + armorBonus; 

  const strMod = Math.floor((attributes.FOR - 10) / 2);
  const dexMod = Math.floor((attributes.DES - 10) / 2);
  const conMod = Math.floor((attributes.CON - 10) / 2);
  const intMod = Math.floor((attributes.INT - 10) / 2);
  const wisMod = Math.floor((attributes.SAB - 10) / 2);
  const chaMod = Math.floor((attributes.CAR - 10) / 2);

  const mods = { 'str': strMod, 'dex': dexMod, 'con': conMod, 'int': intMod, 'wis': wisMod, 'cha': chaMod };

  const nextLevelTotalXP = 300 * Math.pow(2, savedLevel - 1); 
  const currentLevelBaseXP = XP_TABLE ? XP_TABLE[savedLevel - 1] : 0;
  const xpVisivel = currentXP - currentLevelBaseXP;
  const xpNecessarioNoNivel = nextLevelTotalXP - currentLevelBaseXP;
  
  const xpPercent = nextLevelTotalXP > currentLevelBaseXP ? Math.min(100, ((currentXP - currentLevelBaseXP) / (nextLevelTotalXP - currentLevelBaseXP)) * 100) : 100;
  const hpPercent = myCharacter && myCharacter.maxHp > 0 ? (myCharacter.hp / myCharacter.maxHp) * 100 : 0;
  
  const tempHp = charDetails?.tempHp || 0;
  const exhaustionLevel = charDetails?.exhaustion || 0;
  const isConcentrating = charDetails?.isConcentrating || false;

  const totalWeight = inventory.reduce((acc, item) => acc + (item.weight || 0) * item.quantity, 0);
  const maxWeight = (attributes.FOR || 10) * 7.5; 
  const weightPercent = Math.min(100, (totalWeight / maxWeight) * 100);

  const isBloodied = hpPercent <= 30 && (myCharacter?.hp || 0) > 0;
  const inCombat = initiativeList.length > 0;
  const isMyTurn = !inCombat || activeTurnId === myCharacterId;

  const isStealthy = myCharacter?.conditions?.includes('Furtivo');
  const isRogue = myCharacter?.classType?.toLowerCase().includes('ladino') || myCharacter?.classType?.toLowerCase().includes('rogue');
  const sneakAttackDmg = isRogue ? `${Math.ceil(savedLevel / 2)}d6` : '';

  const handleTriggerRoll = useCallback((charName: string, attrName: string, mod: number, damageExpr?: string, damageType?: string) => {
      onRollAttribute(charName, attrName, mod, damageExpr, damageType);
  }, [onRollAttribute]);
  
  const handleIntentToDamage = useCallback((actionName: string, damageExpr: string, damageType: string) => {
      let finalDamageExpr = damageExpr;
      if (isStealthy && isRogue) finalDamageExpr = `${damageExpr} + ${sneakAttackDmg}`;
      onRollAttribute(myCharacterName, `Dano: ${actionName}`, 0, finalDamageExpr, damageType);
  }, [onRollAttribute, myCharacterName, isStealthy, isRogue, sneakAttackDmg]);

  const executeActionAttack = (action: any) => {
      let finalDamageExpr = action.damageExpr;
      let rollType: 'normal' | 'advantage' | 'disadvantage' = 'normal';
      if (isStealthy) {
          rollType = 'advantage';
          if (isRogue) finalDamageExpr = `${action.damageExpr} + ${sneakAttackDmg}`;
      }
      onRollAttribute(myCharacterName, `Ataque: ${action.name}`, action.hitMod || 0, finalDamageExpr, action.damageType, rollType);
  };

  const executeActionDamage = (action: any) => {
      let finalDamageExpr = action.damageExpr;
      if (isStealthy && isRogue) finalDamageExpr = `${action.damageExpr} + ${sneakAttackDmg}`;
      onRollAttribute(myCharacterName, `Dano: ${action.name}`, 0, finalDamageExpr, action.damageType);
  };

  const getSpellcastingMod = () => {
      const cType = myCharacter?.classType?.toLowerCase() || '';
      if (cType.includes('wizard') || cType.includes('mago') || cType.includes('artificer') || cType.includes('artifice')) return Math.floor((attributes.INT - 10) / 2);
      if (cType.includes('sorcerer') || cType.includes('feiticeiro') || cType.includes('warlock') || cType.includes('bruxo') || cType.includes('bard') || cType.includes('bardo') || cType.includes('paladin') || cType.includes('paladino')) return Math.floor((attributes.CAR - 10) / 2);
      return Math.floor((attributes.SAB - 10) / 2); 
  };
  
  const spellMod = getSpellcastingMod();
  const spellAttackBonus = spellMod + proficiencyBonus;
  const spellDC = 8 + proficiencyBonus + spellMod;

  const hasSpellSlots = useMemo(() => {
      if (!myCharacter?.spellSlots) return false;
      return [1,2,3,4,5,6,7,8,9].some(level => (myCharacter.spellSlots as any)[level]?.max > 0);
  }, [myCharacter?.spellSlots]);

  const knownSpells = useMemo(() => {
      const rawSpells = myCharacter?.spells || [];
      return rawSpells.map((sp: any) => {
          const isString = typeof sp === 'string';
          const rawName = isString ? sp : sp.name;
          const cleanName = formatSpellName(rawName);
          const spId = isString ? cleanName : (sp.id || cleanName);
          const compendiumData = availableSpells?.find(s => s.name.toLowerCase() === cleanName.toLowerCase());
          const finalLevel = compendiumData?.level !== undefined ? parseInt(compendiumData.level) : (isString ? 0 : (parseInt(sp.level) || 0));
          
          let desc = compendiumData?.description || compendiumData?.entries || sp.description || "";
          if (Array.isArray(desc)) desc = desc.join('\n');
          if (typeof desc === 'string') desc = desc.replace(/\{@[a-z]+\s+([^}]+)\}/gi, '$1');

          const rawText = JSON.stringify(compendiumData || sp).toLowerCase();
          let parsedDamage = compendiumData?.damage || sp.damage || "";
          let parsedType = "";

          if (!parsedDamage) {
              const dmgMatch = rawText.match(/\{@(damage|dice)\s+([^}]+)\}/i);
              if (dmgMatch) {
                  parsedDamage = dmgMatch[2];
              } else {
                  const txtMatch = rawText.match(/(\d+d\d+)(?:\s*(?:\+\s*\d+)?)\s*(fire|cold|lightning|acid|poison|necrotic|radiant|thunder|force|psychic|bludgeoning|piercing|slashing)?\s*(damage|dano)/i);
                  if (txtMatch) {
                      parsedDamage = txtMatch[1];
                      if (txtMatch[2]) parsedType = translateTerm(txtMatch[2]);
                  }
              }
          }

          if (!parsedType) {
              const typeRegex = /(fire|cold|acid|lightning|thunder|poison|necrotic|radiant|force|psychic)\s*(damage|dano)/i;
              const typeMatch = rawText.match(typeRegex);
              if (typeMatch) parsedType = translateTerm(typeMatch[1]);
          }

          const isAttack = rawText.includes('spell attack') || rawText.includes('ataque com magia') || rawText.includes('{@hit');
          const isSave = rawText.includes('saving throw') || rawText.includes('teste de resistência') || !!compendiumData?.savingThrow;

          return { 
              ...(compendiumData || {}), id: spId, name: cleanName, level: finalLevel, 
              parsedDamage, parsedType: parsedType || "Mágico", isAttack, isSave, cleanDescription: desc, type: 'action'
          };
      }).sort((a, b) => a.name.localeCompare(b.name));
  }, [myCharacter?.spells, availableSpells]);

  const allFilteredActions = useMemo(() => {
    let list: any[] = [];
    equippedWeapons.forEach(weapon => {
        const isFinesseOrRanged = weapon.stats?.properties?.some(p => p.toLowerCase().includes('finesse') || p.toLowerCase().includes('distância')) || weapon.name.toLowerCase().includes('arco');
        const totalHitMod = (isFinesseOrRanged ? dexMod : strMod) + proficiencyBonus;
        const translatedWpnType = translateTerm(['cortante', 'perfurante', 'contundente'].find(t => (weapon.stats?.properties?.join(' ').toLowerCase() || '').includes(t)) || 'Físico');
        list.push({ 
            id: weapon.id, name: weapon.name, attackMod: isFinesseOrRanged ? 'dex' : 'str', 
            damageExpr: weapon.stats?.damage || '1d4', damageType: translatedWpnType, hitMod: totalHitMod,
            category: 'attack', type: 'weapon', typeDetail: 'Armas Equipadas', range: isFinesseOrRanged ? 'Distância' : '5 ft.',
            desc: `Ataque com arma. Modificador: ${isFinesseOrRanged ? 'Destreza' : 'Força'}.`
        });
    });
    list.push(...knownSpells.map(s => {
        const meta = getSpellMeta(s);
        const metaText = `Tempo: ${meta.time} | Alcance: ${meta.range} | Comp: ${meta.comps}`;
        return {
            ...s, category: s.isAttack ? 'attack' : 'action', type: 'spell', typeDetail: `Magias Nível ${s.level}`, range: meta.range,
            desc: `${metaText}\n\n${s.cleanDescription}`
        }
    }));
    customActions.forEach((action: any) => {
        list.push({ ...action, category: action.attackMod !== 'none' ? 'attack' : (action.type === 'bonus action' ? 'bonus action' : 'action'), type: 'macro', typeDetail: 'Macros', range: '--', desc: "Ação customizada." });
    });
    list.push(...(CLASS_ABILITIES[myCharacter?.classType?.toUpperCase() || ''] || []).map(a => ({...a, category: a.type, type: 'feature', typeDetail: 'Habilidades', range: '--'})));

    if (actionFilter === 'all') return list.sort((a,b) => a.category.localeCompare(b.category));
    return list.filter(a => a.category === actionFilter).sort((a,b) => a.name.localeCompare(b.name));
  }, [equippedWeapons, knownSpells, customActions, myCharacter?.classType, strMod, dexMod, proficiencyBonus, actionFilter]);

  const toggleActionExpansion = (id: string) => {
      setExpandedActionIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCoinChange = (coinType: 'cp' | 'sp' | 'ep' | 'gp' | 'pp', amount: number) => {
      if (!myCharacter || !onUpdateCharacter) return;
      const currentCoins = myCharacter.coins || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
      const newVal = Math.max(0, currentCoins[coinType] + amount);
      onUpdateCharacter(myCharacter.id, { coins: { ...currentCoins, [coinType]: newVal } });
  };

  const renderCoin = (type: 'cp' | 'sp' | 'ep' | 'gp' | 'pp', label: string, colorClass: string) => {
      const val = myCharacter?.coins?.[type] || 0;
      return (
          <div className={`flex-1 flex flex-col items-center justify-center p-1.5 rounded border ${colorClass} relative group overflow-hidden shadow-inner bg-[#0a0c1e] transition-colors`}>
              <span className="text-[8px] font-cinzel opacity-60 mb-0.5">{label}</span>
              <span className="font-cinzel text-sm text-[#e8eeff]">{val}</span>
              <div className="absolute inset-0 flex items-center justify-between px-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm">
                  <button type="button" onClick={() => handleCoinChange(type, -1)} className="text-red-400 hover:text-red-300 font-bold px-1.5 hover:bg-white/10 rounded transition-colors">-</button>
                  <button type="button" onClick={() => handleCoinChange(type, 1)} className="text-green-400 hover:text-green-300 font-bold px-1.5 hover:bg-white/10 rounded transition-colors">+</button>
              </div>
          </div>
      );
  };

  useEffect(() => { 
      if (activeTab === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [chatMessages, activeTab]);

  useEffect(() => {
      if (myCharacter && calculatedLevel > savedLevel) {
          const hpGain = calculateHPGain(myCharacter.classType || 'npc', myCharacter.stats?.con || 10);
          setPendingLevelData({ newLevel: calculatedLevel, hpGain: hpGain });
          setShowLevelUpModal(true);
      }
  }, [calculatedLevel, savedLevel, myCharacter]);

  const handleHeal = (e: React.MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      const val = hpInput.trim() === '' ? 1 : parseInt(hpInput);
      if (!isNaN(val) && val > 0 && myCharacter && onUpdateCharacter) {
          onUpdateCharacter(myCharacter.id, { hp: Math.min((myCharacter.maxHp || 10), (myCharacter.hp || 0) + val) });
          setHpInput('');
          onSendMessage(`💚 **${myCharacter.name}** curou **${val} PV**.`);
      }
  };

  const handleTakeDamage = (e: React.MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      const val = hpInput.trim() === '' ? 1 : parseInt(hpInput);
      if (!isNaN(val) && val > 0 && myCharacter && onUpdateCharacter) {
          let remainingDamage = val;
          let newTemp = tempHp;
          if (tempHp > 0) {
              if (tempHp >= val) { newTemp -= val; remainingDamage = 0; }
              else { remainingDamage -= tempHp; newTemp = 0; }
          }
          const newHp = Math.max(0, (myCharacter.hp || 0) - remainingDamage);
          let logMsg = `🩸 **${myCharacter.name}** sofreu **${val} de dano**`;
          if (tempHp > 0) { logMsg += ` *(Absorveu ${val - remainingDamage} com PV Temporário)*`; }
          logMsg += `.`;
          onSendMessage(logMsg);
          if (isConcentrating && val > 0) {
              const cd = Math.max(10, Math.floor(val / 2));
              onSendMessage(`⚠️ **QUEBRA DE CONCENTRAÇÃO:** ${myCharacter.name} precisa rolar Resistência de **Constituição (CD ${cd})**!`);
          }
          onUpdateCharacter(myCharacter.id, { hp: newHp, details: { ...(myCharacter.details || {}), tempHp: newTemp } });
          setHpInput('');
      }
  };

  const handleUseAbility = (abilityName: string, max: number, desc: string) => {
    if (!myCharacter) return;
    const key = `${myCharacter.name}_${abilityName}`;
    const current = abilityUsage[key] || 0;
    if (max !== 99 && current >= max) { alert("Habilidade esgotada!"); return; }
    if (max !== 99) setAbilityUsage(prev => ({ ...prev, [key]: current + 1 }));
    onSendMessage(`⚡ **${myCharacter.name}** usou **${abilityName}**!\n> *${desc}*`);
  };

  const handleEquipItem = (item: Item) => {
      if (!myCharacter || !onUpdateCharacter) return;
      let newInv = [...inventory];
      if (item.type === 'potion') {
          onSendMessage(`🧪 **${myCharacter.name}** usou **${item.name}**.`);
          if (item.quantity > 1) newInv = newInv.map(i => i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i);
          else newInv = newInv.filter(i => i.id !== item.id);
          onUpdateCharacter(myCharacter.id, { inventory: newInv });
          return;
      }
      if (item.isEquipped) {
          newInv = newInv.map(i => i.id === item.id ? { ...i, isEquipped: false } : i);
          onUpdateCharacter(myCharacter.id, { inventory: newInv });
          onSendMessage(`🛡️ **${myCharacter.name}** desequipou **${item.name}**.`);
          return;
      }
      if (item.type === 'armor') newInv = newInv.map(i => i.type === 'armor' ? { ...i, isEquipped: false } : i);
      else if (item.type === 'weapon') { 
          const eqList = newInv.filter(i => i.isEquipped && i.type === 'weapon');
          if (eqList.length >= 2) newInv = newInv.map(i => i.id === eqList[0].id ? { ...i, isEquipped: false } : i);
      }
      newInv = newInv.map(i => i.id === item.id ? { ...i, isEquipped: true } : i);
      onUpdateCharacter(myCharacter.id, { inventory: newInv });
      onSendMessage(`⚔️ **${myCharacter.name}** equipou **${item.name}**.`);
  };

  const handleDropItem = (item: Item) => {
      if (!myCharacter || !onUpdateCharacter) return;
      if (window.confirm(`Descartar ${item.name}?`)) {
          const newInv = inventory.filter(i => i.id !== item.id);
          onUpdateCharacter(myCharacter.id, { inventory: newInv });
          onSendMessage(`🗑️ **${myCharacter.name}** descartou **${item.name}**.`);
      }
  };

  const handleDeathSave = (type: 'success' | 'failure') => {
      if (!myCharacter) return;
      const newVal = type === 'success' ? deathSaves.successes + 1 : deathSaves.failures + 1;
      if (newVal > 3) return; 
      setDeathSaves(prev => ({ ...prev, [type === 'success' ? 'successes' : 'failures']: newVal }));
      const roll = Math.floor(Math.random() * 20) + 1;
      onSendMessage(`💀 **${myCharacter.name}** rolou Salvaguarda de Morte: ${type.toUpperCase()} (${newVal}/3) [Dado: ${roll}]`);
  };

  const handleShortRest = (e: React.MouseEvent) => {
      e.preventDefault();
      if (!myCharacter || !onUpdateCharacter) return;
      const hitDie = Math.floor(Math.random() * 8) + 1 + Math.floor(((myCharacter.stats?.con || 10) - 10)/2);
      const newHp = Math.min((myCharacter.hp || 0) + hitDie, myCharacter.maxHp || 10);
      onUpdateCharacter(myCharacter.id, { hp: newHp });
      onSendMessage(`⛺ **${myCharacter.name}** descansou e recuperou **${hitDie} PV**.`);
  };

  const handleLongRest = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!myCharacter || !onUpdateCharacter) return;
    if (window.confirm("Fazer um Descanso Longo?")) {
        setAbilityUsage({}); setDeathSaves({ successes: 0, failures: 0 });
        let clearedSlots = { ...myCharacter.spellSlots };
        if (clearedSlots) Object.keys(clearedSlots).forEach(level => { clearedSlots[Number(level)].used = 0; });
        const newExhaustion = Math.max(0, exhaustionLevel - 1);
        onUpdateCharacter(myCharacter.id, { 
            hp: myCharacter.maxHp, 
            spellSlots: clearedSlots,
            details: { ...(myCharacter.details || {}), tempHp: 0, exhaustion: newExhaustion }
        });
        onSendMessage(`💤 **${myCharacter.name}** realizou um Descanso Longo.`);
    }
  };

  const handleSpellSlotChange = (levelIndex: number, action: 'add_max' | 'remove_max' | 'toggle_used', slotIndex?: number) => {
      if (!myCharacter || !onUpdateCharacter) return;
      const currentSlots = myCharacter.spellSlots || {};
      const levelData = currentSlots[levelIndex] || { max: 0, used: 0 };
      let newMax = levelData.max; let newUsed = levelData.used;
      if (action === 'add_max' && newMax < 4) newMax++;
      if (action === 'remove_max' && newMax > 0) { newMax--; if (newUsed > newMax) newUsed = newMax; }
      if (action === 'toggle_used' && slotIndex !== undefined) { if (newUsed === slotIndex + 1) newUsed--; else newUsed = slotIndex + 1; }
      onUpdateCharacter(myCharacter.id, { spellSlots: { ...currentSlots, [levelIndex]: { max: newMax, used: newUsed } } });
  };

  const onCastSpellRP = (spell: any) => {
      if (!myCharacter || !onUpdateCharacter) return;
      const level = parseInt(spell.level) || 0;
      if (level > 0) {
          const currentSlots = myCharacter.spellSlots || {};
          const levelData = currentSlots[level] || { max: 0, used: 0 };
          if (levelData.used >= levelData.max) { alert(`Sem espaços para Círculo ${level}!`); return; }
          onUpdateCharacter(myCharacter.id, { spellSlots: { ...currentSlots, [level]: { ...levelData, used: levelData.used + 1 } } });
      }
      onSendMessage(`✨ **${myCharacter.name}** conjurou **${spell.name}**${level > 0 ? ` (Círculo ${level})` : ''}!`);
  };

  const handleSaveCustomAction = () => {
      if (!myCharacter || !onUpdateCharacter || !actionForm.name.trim()) return;
      const newAction = { ...actionForm, id: actionForm.id || Date.now().toString() };
      let updatedActions;
      if (actionForm.id) updatedActions = customActions.map((a: any) => a.id === actionForm.id ? newAction : a);
      else updatedActions = [...customActions, newAction];
      onUpdateCharacter(myCharacter.id, { customActions: updatedActions } as any);
      setIsEditingAction(false);
  };

  const handleDeleteCustomAction = (id: string) => {
      if (!myCharacter || !onUpdateCharacter) return;
      if (window.confirm("Remover ação?")) {
          const updatedActions = customActions.filter((a: any) => a.id !== id);
          onUpdateCharacter(myCharacter.id, { customActions: updatedActions } as any);
      }
  };

  const executeActionSave = (action: any) => {
      handleTriggerRoll(myCharacterName, `Resistência (${action.saveAttr}) contra ${action.name}`, 0);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const openDescription = (termKey: string, actualName?: string) => {
    let content = "";
    if (GENERIC_RULES[termKey.toLowerCase()]) content = GENERIC_RULES[termKey.toLowerCase()];
    else if (SKILL_MAP[termKey]) content = `Habilidade de ${translateTerm(SKILL_MAP[termKey])}.`;
    else if ((charDetails as any)?.background && termKey.toLowerCase() === (charDetails as any).background.toLowerCase()) content = (charDetails as any)?.backgroundDesc || "Descrição não disponível.";
    else if (attributes[termKey as keyof typeof attributes]) content = `Atributo base.`;
    const actionFound = allFilteredActions.find(a => a.id === termKey || a.name === actualName);
    if (actionFound && actionFound.desc) content = actionFound.desc;
    if (!content) content = `Sem descrição para ${actualName || translateTerm(termKey)}.`;
    setDescriptionPanel({ title: actualName || translateTerm(termKey), content: content });
  };

  const triggerTargetPicker = (type: 'attack' | 'help') => {
      setTargetPicker({ isOpen: true, type });
  };

  const handleTargetSelection = (target: Entity) => {
      onSetTarget(target.id); // 🔥 Aplica a trava do Mestre/Player no mapa
      if (targetPicker.type === 'attack') {
          setActionFilter('attack');
          onSendMessage(`🎯 **${myCharacter?.name}** fixou o alvo em **${target.name}**!`);
      } else if (targetPicker.type === 'help') {
          onSendMessage(`🤝 **${myCharacter?.name}** está ajudando **${target.name}**!`);
      }
      setTargetPicker({ ...targetPicker, isOpen: false });
  };

  const navItems = [
    { id: "abilities", label: "ATRIBUTOS", icon: "⚔" },
    { id: "actions",   label: "AÇÕES", icon: "🗡" },
    { id: "spells",    label: "MAGIAS", icon: "✨" },
    { id: "inventory", label: "INVENTÁRIO", icon: "⬡" },
    { id: "features",  label: "CARACTERÍSTICAS", icon: "✦" },
    { id: "background",label: "HISTÓRICO", icon: "📜" },
    { id: "notes",     label: "ANOTAÇÕES", icon: "✎" },
    { id: "chat",      label: "CHAT", icon: "💬" },
  ];

  if (!myCharacter) {
      return (
          <div className={`relative h-full transition-all duration-300 bg-[#0d0e1f] z-50 w-[var(--sb-width)]`}>
              <div className="flex flex-col items-center justify-center h-full text-[#8090b8]"><p className="text-xs font-cinzel">Personagem não encontrado.</p></div>
          </div>
      );
  }

  const GLOBAL_CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;600&family=Crimson+Pro:ital,wght@0,400;1,400&display=swap');

    :root {
      --bg:          #0d0e1f;
      --surface:     #0a0c1e;
      --border:      #2a3060;
      --accent:      #c8d4e8;
      --accent-dim:  rgba(200,212,232,0.1);
      --accent-red:  #c0392b;
      --t1:          #e8eeff;
      --t2:          #8090b8;
      --t3:          #2a3060;
      --ff:          'Cinzel', serif;
      --fb:          'Crimson Pro', serif;
      --fd:          'Cinzel Decorative', cursive;
      --sb-width:    360px;
    }

    .font-cinzel { font-family: 'Cinzel', serif; }
    .font-cinzel-decorative { font-family: 'Cinzel Decorative', cursive; }
    .font-crimson { font-family: 'Crimson Pro', serif; }

    .sb-container {
      font-family: var(--fb);
      color: var(--t1);
      background: var(--bg);
    }

    .sb-scroll {
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(128,144,184,0.3) transparent;
    }
    .sb-scroll::-webkit-scrollbar { width: 4px; }
    .sb-scroll::-webkit-scrollbar-thumb { background: rgba(128,144,184,0.3); border-radius: 2px; }

    .view-enter { animation: viewIn .22s ease both; }
    @keyframes viewIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0);     }
    }

    .nav-overlay { animation: overlayIn .18s ease both; }
    @keyframes overlayIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .premium-btn {
      flex: 1; 
      padding: 8px 0; 
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px; 
      color: var(--t2); 
      font-family: var(--ff); 
      font-weight: 600; 
      font-size: 10px; 
      cursor: pointer; 
      letter-spacing: .04em; 
      transition: all 0.2s;
    }
    .premium-btn:hover { 
      border-color: var(--accent); 
      color: var(--accent); 
    }

    .chip {
      display: inline-flex; align-items: center; gap: 4px;
      background: var(--surface); 
      border: 1px solid var(--border);
      border-radius: 2px; 
      padding: 2px 8px;
      font-size: 10px; 
      font-family: var(--ff);
      font-weight: 600; 
      color: var(--t2); 
      white-space: nowrap; 
      cursor: pointer;
      transition: all 0.2s;
    }
    .chip:hover { border-color: var(--accent); background: var(--accent-dim); color: var(--accent); }

    .sec-title {
      font-family: var(--ff); 
      font-size: 10px; 
      font-weight: 700; 
      letter-spacing: .2em; 
      color: var(--accent); 
      text-transform: uppercase;
      padding-bottom: 8px; 
      border-bottom: 1px solid var(--border);
      margin: 20px 0 10px;
    }
    .sec-title:first-child { margin-top: 0; }

    .sk-row {
      display: flex; 
      align-items: center; 
      gap: 14px; 
      padding: 8px 12px; 
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s ease;
      margin-bottom: 2px;
    }
    .sk-row:hover { 
      background: rgba(200, 212, 232, 0.08);
      border-color: rgba(200, 212, 232, 0.1);
    }

    .feat-card {
      background: var(--surface); 
      border: 1px solid var(--border);
      border-radius: 4px; 
      padding: 10px; 
      margin-bottom: 8px;
    }

    .nav-item {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 4px; padding: 10px 8px; cursor: pointer;
      transition: border-color .18s, background .18s;
      display: flex; align-items: center; gap: 10px;
      text-align: left;
    }
    .nav-item:hover,
    .nav-item.active { background: var(--accent-dim); border-color: var(--accent); }

    .atk-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .atk-table th {
      color: var(--t2); font-weight: 700; font-size: 9px; text-transform: uppercase;
      letter-spacing: .08em; padding: 6px 4px; text-align: left; font-family: var(--ff);
    }
    .atk-table td { padding: 8px 4px; color: var(--t1); border-top: 1px solid var(--border); font-family: var(--fb); }
    .atk-table tr.active-row td { background: var(--accent-dim); }
    .atk-table tr:hover td { background: rgba(255,255,255,0.02); }

    .ctag {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 2px; padding: 2px 6px; font-size: 9px; font-weight: 700; color: var(--t2); 
      cursor: pointer; transition: color .2s; font-family: var(--ff);
    }
    .ctag:hover { color: var(--accent); border-color: var(--accent); }
  `;

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      {showLevelUpModal && pendingLevelData && (
          <LevelUpModal newLevel={pendingLevelData.newLevel} hpGain={pendingLevelData.hpGain} charClass={myCharacter.classType || 'GUERREIRO'} oldStats={myCharacter.stats || {str:10,dex:10,con:10,int:10,wis:10,cha:10}} onConfirm={(u) => { if(onUpdateCharacter && myCharacter) { onUpdateCharacter(myCharacter.id, {...u, level: pendingLevelData.newLevel, hp: Math.min((myCharacter.hp||0)+pendingLevelData.hpGain, (myCharacter.maxHp||0)+pendingLevelData.hpGain), maxHp: (myCharacter.maxHp||0)+pendingLevelData.hpGain}); setShowLevelUpModal(false);}}} />
      )}

      {targetPicker.isOpen && (
          <TargetPickerModal 
              actionType={targetPicker.type}
              entities={entities}
              initiativeList={initiativeList}
              myCharacterId={myCharacter.id}
              onClose={() => setTargetPicker({ ...targetPicker, isOpen: false })}
              onSelect={handleTargetSelection}
          />
      )}

      {navOpen && (
        <div className="nav-overlay" onClick={() => setNavOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(13,14,31,.95)", backdropFilter: "blur(6px)", zIndex: 600, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <button type="button" onClick={() => setNavOpen(false)} style={{ position: "absolute", top: 14, right: 18, background: "none", border: "none", color: "var(--t2)", fontSize: 20, cursor: "pointer" }}>✕</button>
            <div style={{ fontFamily: "var(--ff)", fontWeight: "bold", fontSize: 10, color: "var(--t3)", letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 16 }}>Navegação da Ficha</div>
            <div onClick={(e) => e.stopPropagation()} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%", maxWidth: 480 }}>
                {navItems.map((item, idx) => (
                    <button type="button" key={item.id} className={`nav-item ${activeTab === item.id ? 'active' : ''}`} style={idx === 0 ? { gridColumn: "1/-1" } : {}} onClick={() => { setActiveTab(item.id as any); setNavOpen(false); }}>
                        <div style={{ width: 30, height: 30, borderRadius: 2, background: "rgba(255,255,255,.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>{item.icon}</div>
                        <div style={{ fontSize: 10, color: "var(--t1)", letterSpacing: ".03em", lineHeight: 1.3, fontWeight: "bold", fontFamily: "var(--ff)" }}>{item.label}</div>
                    </button>
                ))}
            </div>
        </div>
      )}

      <div className={`sb-container relative h-full transition-all duration-300 ease-in-out flex-shrink-0 z-50 shadow-2xl border-r border-[#2a3060] bg-[#0d0e1f] flex flex-col w-[var(--sb-width)]`}>
          
          {isBloodied && (
              <div className="absolute inset-0 pointer-events-none z-[40] shadow-[inset_0_0_120px_rgba(192,57,43,0.4)] animate-pulse mix-blend-multiply" />
          )}

          <button 
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)} 
              className="absolute top-1/2 -left-6 transform -translate-y-1/2 w-6 h-16 bg-[#0a0c1e] border border-[#2a3060] border-r-0 rounded-l-lg flex items-center justify-center text-[#8090b8] hover:text-[#c8d4e8] cursor-pointer shadow-lg z-[200] transition-colors"
          >
              {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>

          <div className={`${isCollapsed ? 'hidden' : 'flex'} flex-col h-full overflow-hidden w-full relative z-[45]`}>
            {descriptionPanel && <DescriptionPanel title={descriptionPanel.title} description={descriptionPanel.content} onClose={() => setDescriptionPanel(null)} />}
            
            {/* HEADER GÓTICO - Otimizado e Completo */}
            <div style={{ padding: "4px 10px 10px", flexShrink: 0, borderBottom: "1px solid var(--border)", position: 'relative', zIndex: 100 }}>
                <GothicBanner 
                    name={myCharacter.name} 
                    race={myCharacter.race} 
                    classType={myCharacter.classType} 
                    level={savedLevel} 
                    image={myCharacter.image} 
                    inspiration={!!myCharacter.inspiration}
                    isConcentrating={isConcentrating}
                    onSelect={() => onSelectEntity && onSelectEntity(myCharacter)}
                />

                {/* QUICK STATS ROW - CA, Iniciativa, Proficiência e Movimento */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', marginTop: '-4px', justifyContent: 'center' }}>
                    {/* CA */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'rgba(20, 22, 40, 0.6)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 6px', justifyContent: 'center' }}>
                        <div style={{ position: 'relative', width: 22, height: 25, flexShrink: 0 }}>
                            <svg width="22" height="25" viewBox="0 0 44 50">
                                <path d="M22 2 L42 10 L42 30 C42 42 22 48 22 48 C22 48 2 42 2 30 L2 10 Z" fill="#1a1520" stroke="var(--accent)" strokeWidth="2"/>
                            </svg>
                            <span style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: '10px', fontFamily: 'var(--ff)', fontWeight: 'bold' }}>{currentAC}</span>
                        </div>
                        <span style={{ marginLeft: 4, color: 'var(--t2)', fontFamily: 'var(--ff)', fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>CA</span>
                    </div>

                    {/* Iniciativa */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'rgba(20, 22, 40, 0.6)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 6px', justifyContent: 'center' }}>
                        <Zap size={12} color="#8090b8" />
                        <div style={{ marginLeft: 4, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <span style={{ color: 'var(--t2)', fontFamily: 'var(--ff)', fontSize: '7px', textTransform: 'uppercase' }}>Inic.</span>
                            <span style={{ color: 'var(--t1)', fontFamily: 'monospace', fontSize: '11px', fontWeight: 'bold', lineHeight: 1 }}>{sign(dexMod)}</span>
                        </div>
                    </div>

                    {/* Proficiência */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'rgba(20, 22, 40, 0.6)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 6px', justifyContent: 'center' }}>
                        <Star size={12} color="#8090b8" />
                        <div style={{ marginLeft: 4, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <span style={{ color: 'var(--t2)', fontFamily: 'var(--ff)', fontSize: '7px', textTransform: 'uppercase' }}>Prof.</span>
                            <span style={{ color: 'var(--t1)', fontFamily: 'monospace', fontSize: '11px', fontWeight: 'bold', lineHeight: 1 }}>{sign(proficiencyBonus)}</span>
                        </div>
                    </div>

                    {/* Movimento */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'rgba(20, 22, 40, 0.6)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 6px', justifyContent: 'center' }}>
                        <Flame size={12} color="#e8a030" />
                        <div style={{ marginLeft: 4, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <span style={{ color: 'var(--t2)', fontFamily: 'var(--ff)', fontSize: '7px', textTransform: 'uppercase' }}>Mov.</span>
                            <span style={{ color: 'var(--t1)', fontFamily: 'monospace', fontSize: '11px', fontWeight: 'bold', lineHeight: 1 }}>30ft</span>
                        </div>
                    </div>
                </div>

                {/* CONDIÇÕES */}
                {myCharacter.conditions && myCharacter.conditions.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px', padding: '0 4px' }}>
                        {myCharacter.conditions.map((cond: string) => (
                            <div key={cond} style={{ background: 'rgba(200,212,232,0.1)', border: '1px solid var(--border)', borderRadius: '10px', padding: '2px 8px', fontSize: '8px', color: 'var(--accent)', fontFamily: 'var(--ff)', textTransform: 'uppercase', fontWeight: 'bold' }}>
                                {cond}
                            </div>
                        ))}
                    </div>
                )}

                {/* 🩸 NOVO PAINEL DE VIDA E XP 🩸 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', padding: '0 4px' }}>
                    
                    {/* Header HP e Pips Integrados */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: "var(--t1)", textTransform: "uppercase", letterSpacing: ".15em", fontFamily: "var(--ff)", textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}>
                            Pontos de Vida
                        </span>
                        
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                            {/* Pips de Cristal de Sangue */}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", flex: 1 }}>
                                {Array.from({ length: Math.min(myCharacter.maxHp || 1, 50) }).map((_, i) => {
                                    const isActive = i < (myCharacter.hp || 0);
                                    return (
                                        <div key={i} 
                                            onClick={() => { if (onUpdateCharacter && myCharacter) onUpdateCharacter(myCharacter.id, { hp: i + 1 }); }}
                                            style={{
                                                width: '8px', height: '12px', borderRadius: '2px', cursor: 'pointer',
                                                background: isActive ? 'linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)' : 'rgba(0,0,0,0.4)',
                                                border: `1px solid ${isActive ? '#fca5a5' : 'var(--border)'}`,
                                                boxShadow: isActive ? 'inset 0 1px 2px rgba(255,255,255,0.4), 0 0 5px rgba(220,38,38,0.6)' : 'inset 0 1px 3px rgba(0,0,0,0.8)',
                                                transition: 'all 0.2s ease'
                                            }} 
                                        />
                                    );
                                })}
                            </div>

                            {/* Numbers */}
                            <span style={{ fontFamily: "var(--ff)", fontSize: 16, fontWeight: 900, color: "var(--t1)", flexShrink: 0 }}>
                                {myCharacter.hp} <span style={{ fontSize: 11, color: "var(--t2)", fontWeight: 700 }}>/ {myCharacter.maxHp}</span>
                            </span>
                        </div>
                    </div>
                    
                    {/* Controles HP */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'stretch', height: '28px' }}>
                        <input 
                            type="number" 
                            value={hpInput} 
                            onChange={(e) => setHpInput(e.target.value)} 
                            placeholder="1"
                            style={{ 
                                width: '40px', 
                                background: 'rgba(0,0,0,0.3)', 
                                border: '1px solid var(--border)', 
                                color: 'var(--t1)', 
                                borderRadius: '3px', 
                                fontSize: '11px', 
                                textAlign: 'center',
                                outline: 'none',
                                fontFamily: 'var(--fb)',
                                fontWeight: 'bold',
                                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)'
                            }} 
                        />
                        <button type="button" onClick={handleHeal} style={{ flex: 1, background: 'rgba(39, 174, 96, 0.1)', color: '#27ae60', border: '1px solid rgba(39, 174, 96, 0.4)', borderRadius: '3px', fontSize: '9px', fontWeight: '900', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: 'var(--ff)', transition: 'all 0.2s' }} className="hover:bg-[#27ae60]/20 hover:border-[#27ae60]">
                            + Curar
                        </button>
                        <button type="button" onClick={handleTakeDamage} style={{ flex: 1, background: 'rgba(192, 57, 43, 0.1)', color: '#e05a5a', border: '1px solid rgba(192, 57, 43, 0.4)', borderRadius: '3px', fontSize: '9px', fontWeight: '900', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: 'var(--ff)', transition: 'all 0.2s' }} className="hover:bg-[#e05a5a]/20 hover:border-[#e05a5a]">
                            − Dano
                        </button>
                    </div>

                    {/* Exaustão e Testes de Morte */}
                    {exhaustionLevel > 0 && (
                        <div style={{ background: "rgba(192,57,43,0.1)", border: "1px solid rgba(192,57,43,0.3)", color: "var(--accent-red)", padding: "6px 10px", borderRadius: 3, fontSize: 9, textAlign: "center", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", fontFamily: "var(--ff)" }}>
                            ⚠ Exaustão {exhaustionLevel}: {getExhaustionText(exhaustionLevel)}
                        </div>
                    )}

                    {myCharacter.hp <= 0 && (
                        <div style={{ background: "rgba(192,57,43,0.1)", border: "1px solid rgba(192,57,43,0.3)", borderRadius: 3, padding: "8px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 9, color: "var(--accent-red)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", fontFamily: "var(--ff)" }}>Death Saves</span>
                            <div style={{ display: "flex", gap: 16 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <span style={{ fontSize: 9, color: "#27ae60", fontWeight: 700, fontFamily: "var(--ff)" }}>SUC</span>
                                    {[1,2,3].map(i => <div key={i} onClick={() => handleDeathSave('success')} style={{ width: 12, height: 12, borderRadius: "50%", background: i <= deathSaves.successes ? "#27ae60" : "transparent", border: "1.5px solid #27ae60", cursor: "pointer" }} />)}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <span style={{ fontSize: 9, color: "var(--accent-red)", fontWeight: 700, fontFamily: "var(--ff)" }}>FAL</span>
                                    {[1,2,3].map(i => <div key={i} onClick={() => handleDeathSave('failure')} style={{ width: 12, height: 12, borderRadius: "50%", background: i <= deathSaves.failures ? "var(--accent-red)" : "transparent", border: "1.5px solid var(--accent-red)", cursor: "pointer" }} />)}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Divisor XP */}
                    <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0 8px 0' }} />

                    {/* Barra XP e Descansos */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        
                        {/* XP */}
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                <span style={{ fontSize: 9, color: "var(--t2)", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".15em", fontFamily: "var(--ff)" }}>XP</span>
                                <span style={{ fontSize: 9, fontWeight: 700, color: "var(--t2)", fontFamily: "var(--ff)" }}>
                                    <strong style={{ color: "var(--t1)" }}>{xpVisivel.toLocaleString()}</strong> / {xpNecessarioNoNivel.toLocaleString()}
                                </span>
                            </div>
                            <div style={{ height: 4, background: "rgba(0,0,0,0.4)", borderRadius: 2, overflow: "hidden", border: '1px solid var(--border)' }}>
                                <div style={{ width: `${xpPercent}%`, height: "100%", background: "linear-gradient(90deg, #1d4ed8 0%, #3b82f6 100%)", boxShadow: "0 0 8px rgba(59,130,246,0.6)", transition: "width .4s ease" }} />
                            </div>
                        </div>

                        {/* Botões de Descanso Abaixo da XP */}
                        <div style={{ display: "flex", gap: "8px" }}>
                            <button 
                                type="button" 
                                onClick={handleShortRest} 
                                className="flex-1 bg-[#0a0c1e] border border-[#2a3060] hover:border-[#c8d4e8] hover:bg-white/5 rounded-[3px] py-1.5 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[inset_0_1px_2px_rgba(255,255,255,0.02)]"
                                title="Descanso Curto"
                            >
                                <span style={{ fontSize: '11px', color: '#8090b8' }}>⟳</span>
                                <span style={{ fontSize: '9px', fontWeight: 800, color: "var(--t1)", fontFamily: "var(--ff)", textTransform: "uppercase", letterSpacing: ".08em" }}>Curto</span>
                            </button>
                            
                            <button 
                                type="button" 
                                onClick={handleLongRest} 
                                className="flex-1 bg-[#0a0c1e] border border-[#2a3060] hover:border-[#c8d4e8] hover:bg-white/5 rounded-[3px] py-1.5 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[inset_0_1px_2px_rgba(255,255,255,0.02)]"
                                title="Descanso Longo"
                            >
                                <span style={{ fontSize: '10px', color: '#8090b8' }}>☽</span>
                                <span style={{ fontSize: '9px', fontWeight: 800, color: "var(--t1)", fontFamily: "var(--ff)", textTransform: "uppercase", letterSpacing: ".08em" }}>Longo</span>
                            </button>
                        </div>
                        
                    </div>
                </div>
            </div>

            {/* CONTENT WRAPPER */}
            <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                
                {!isMyTurn && (
                    <div style={{
                        position: 'absolute', inset: 0, zIndex: 50,
                        background: 'rgba(13,14,31,0.85)', backdropFilter: 'blur(3px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        pointerEvents: 'auto'
                    }}>
                        <div className="bg-[#0a0c1e] border-2 border-[#c8d4e8]/50 text-[#e8eeff] px-6 py-3 rounded shadow-2xl flex items-center gap-3 animate-pulse">
                            <Hourglass size={20} className="text-[#c8d4e8]" />
                            <span className="font-cinzel font-bold uppercase tracking-widest text-xs text-[#c8d4e8]">Aguardando seu turno...</span>
                        </div>
                    </div>
                )}

                <div className="sb-scroll relative" style={{ flex: 1, overflow: "hidden auto", paddingBottom: "80px" }}>
                    <div key={activeTab} className="view-enter h-full">
                        
                        {activeTab === 'abilities' && (
                            <div style={{ padding: "12px 10px" }}>
                                <div className="sec-title">Atributos Principais</div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px", marginBottom: "16px", justifyContent: "center" }}>
                                    {['FOR', 'DES', 'CON', 'INT', 'SAB', 'CAR'].map((attr) => {
                                        const val = attributes[attr as keyof typeof attributes] || 10;
                                        const mod = Math.floor((val - 10) / 2);
                                        const enKey = Object.keys(PT_BR_DICT).find(k => PT_BR_DICT[k] === attr && k.length === 3)?.toUpperCase() || attr;
                                        const themeColor = ATTR_COLORS[enKey] || "var(--accent)";
                                        return (
                                            <GothicAttributeCircle 
                                                key={attr} 
                                                label={attr} 
                                                value={val} 
                                                modifier={sign(mod)} 
                                                color={themeColor}
                                                onClick={() => handleTriggerRoll(myCharacter.name, attr, mod)} 
                                            />
                                        )
                                    })}
                                </div>

                                <div className="sec-title">Salvaguardas</div>
                                <div className="grid grid-cols-3 gap-y-4 gap-x-2 mb-6 px-2 justify-items-center">
                                    {['str', 'dex', 'con', 'int', 'wis', 'cha'].map((attr) => {
                                        const isProf = proficiencies[`saving_${attr}`];
                                        const finalMod = mods[attr as keyof typeof mods] + (isProf ? proficiencyBonus : 0);
                                        
                                        const fullNames: Record<string, string> = { str: 'Força', dex: 'Destreza', con: 'Constituição', int: 'Inteligência', wis: 'Sabedoria', cha: 'Carisma' };
                                        const abrevs: Record<string, string> = { str: 'FOR', dex: 'DES', con: 'CON', int: 'INT', wis: 'SAB', cha: 'CAR' };

                                        return (
                                            <GothicShield
                                                key={attr}
                                                attrKey={attr}
                                                abrev={abrevs[attr]}
                                                nome={fullNames[attr]}
                                                valor={finalMod}
                                                isProf={!!isProf}
                                                onClick={() => handleTriggerRoll(myCharacter.name, `Teste de Resistência (${translateTerm(attr)})`, finalMod)}
                                            />
                                        )
                                    })}
                                </div>

                                <div className="sec-title">Sentidos Passivos</div>
                                <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                                    {[ { val: 10 + wisMod, lbl: "Percepção" }, { val: 10 + intMod, lbl: "Investigação"}, { val: 10 + wisMod, lbl: "Intuição" } ].map(({ val, lbl }) => (
                                        <div key={lbl} style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 2, padding: "6px 2px", textAlign: "center" }}>
                                            <div style={{ fontFamily: "var(--ff)", fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>{val}</div>
                                            <div style={{ fontSize: 8, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".04em", marginTop: 0, fontFamily: "var(--ff)" }}>{lbl}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className="sec-title" style={{ marginBottom: '15px' }}>Perícias</div>
                                <div style={{ padding: "0 4px" }}>
                                    {Object.keys(SKILL_MAP).sort().map((skill) => {
                                        const attr = SKILL_MAP[skill];
                                        const isProf = proficiencies[skill];
                                        const finalMod = mods[attr as keyof typeof mods] + (isProf ? proficiencyBonus : 0);
                                        
                                        // Formata o nome para Primeira Letra Maiúscula
                                        const skillName = translateTerm(skill);
                                        const formattedName = skillName.charAt(0).toUpperCase() + skillName.slice(1).toLowerCase();

                                        return (
                                            <div 
                                                key={skill} 
                                                onClick={() => handleTriggerRoll(myCharacter.name, skillName, finalMod)} 
                                                className="sk-row"
                                                style={{
                                                    backgroundColor: isProf ? 'rgba(200, 212, 232, 0.04)' : 'transparent',
                                                }}
                                            >
                                                <div style={{ 
                                                    width: 7, height: 7, borderRadius: "50%", flexShrink: 0, 
                                                    background: isProf ? "#c8d4e8" : "transparent", 
                                                    border: `1px solid ${isProf ? "#c8d4e8" : "#2a3060"}`,
                                                    boxShadow: isProf ? "0 0 8px rgba(200, 212, 232, 0.4)" : "none"
                                                }} />

                                                <span style={{ 
                                                    fontSize: 8, fontWeight: 800, textTransform: "uppercase", 
                                                    color: ATTR_COLORS[attr.toUpperCase()], width: 26, textAlign: 'center',
                                                    background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '3px',
                                                    fontFamily: "var(--ff)"
                                                }}>
                                                    {translateTerm(attr)}
                                                </span>

                                                <span style={{ 
                                                    flex: 1, fontSize: 13, color: isProf ? "#e8eeff" : "#8090b8", 
                                                    fontWeight: isProf ? 600 : 400, fontFamily: "var(--fb)", letterSpacing: '0.01em'
                                                }}>
                                                    {formattedName}
                                                </span>

                                                <div style={{
                                                    minWidth: 32, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    background: isProf ? 'rgba(200, 212, 232, 0.1)' : 'rgba(0,0,0,0.2)',
                                                    border: `1px solid ${isProf ? 'rgba(200, 212, 232, 0.2)' : 'var(--border)'}`, borderRadius: '4px'
                                                }}>
                                                    <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: "bold", color: finalMod > 0 ? "#c8d4e8" : finalMod < 0 ? "#ff7676" : "#4a5568" }}>
                                                        {sign(finalMod)}
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {activeTab === 'actions' && (
                            <div className="view-enter p-3 min-h-full" style={{ background: '#0d0e1f' }}>
                                <div style={{ color: "#c8d4e8", fontFamily: 'Cinzel, serif', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Ações de Combate</div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                                    {[
                                        { id: 'attack', label: 'Atacar', icon: <Sword size={14} color="#e05a5a"/>, bg: '#2a0f0f', msg: 'Ataque Selecionado' },
                                        { id: 'dodge', label: 'Esquivar', icon: <CornerUpLeft size={14} color="#5a8aaa"/>, bg: '#0f1a2a', msg: '🛡️ **Esquiva (Dodge)**' },
                                        { id: 'help', label: 'Ajudar', icon: <UserPlus size={14} color="#3ddc84"/>, bg: '#0f2a1a', msg: 'Ajudar Selecionado' },
                                        { id: 'dash', label: 'Disparar', icon: <ArrowRight size={14} color="#e8a030"/>, bg: '#2a1f0a', msg: '🏃 **Disparada (Dash)**' },
                                    ].map(action => (
                                        <button type="button" key={action.id} onClick={() => { 
                                            setCombatActionsUsed(prev => ({...prev, [action.id]: true})); 
                                            if (action.id === 'attack') triggerTargetPicker('attack');
                                            else if (action.id === 'help') triggerTargetPicker('help');
                                            else onSendMessage(action.msg); 
                                        }} style={{ background: '#0a0c1e', border: '1px solid #2a3060', borderRadius: '4px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: combatActionsUsed[action.id] ? 0.4 : 1, transition: 'all 0.2s', cursor: 'pointer' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div style={{ background: action.bg, padding: '4px', borderRadius: '2px', display: 'flex' }}>{action.icon}</div>
                                                <span style={{ color: '#c8d4e8', fontFamily: 'Cinzel, serif', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>{action.label}</span>
                                            </div>
                                            <div className="ml-auto" style={{ width: '14px', height: '14px', borderRadius: '50%', border: combatActionsUsed[action.id] ? 'none' : '1px solid #3a3460', background: combatActionsUsed[action.id] ? '#c8d4e8' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {combatActionsUsed[action.id] && <Check size={10} color="#0d0e1f" strokeWidth={4} />}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                
                                <button type="button" onClick={() => { setCombatActionsUsed(prev => ({...prev, bonus: true})); onSendMessage('✨ **Ação Bônus Utilizada!**'); }} style={{ width: '100%', background: '#0a0c1e', border: '1px solid #2a3060', borderRadius: '4px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: combatActionsUsed['bonus'] ? 0.4 : 1, transition: 'all 0.2s', cursor: 'pointer', marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ background: '#1a0f2a', padding: '4px', borderRadius: '2px', display: 'flex' }}><Star size={14} color="#a855f7"/></div>
                                        <span style={{ color: '#c8d4e8', fontFamily: 'Cinzel, serif', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>Ação Bônus</span>
                                    </div>
                                    <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: combatActionsUsed['bonus'] ? 'none' : '1px solid #3a3460', background: combatActionsUsed['bonus'] ? '#c8d4e8' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {combatActionsUsed['bonus'] && <Check size={10} color="#0d0e1f" strokeWidth={4} />}
                                    </div>
                                </button>

                                <button type="button" onClick={() => { setCombatActionsUsed({}); onNextTurn(); }} style={{ width: '100%', background: 'transparent', border: '1px solid #2a3060', borderRadius: '4px', padding: '10px', color: '#2a3060', fontFamily: 'Cinzel, serif', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s' }}>Novo Turno</button>

                                <div style={{ marginTop: '20px', borderTop: '1px solid #2a3060', paddingTop: '20px' }}>
                                    <div className="flex gap-2 mb-4 overflow-x-auto pb-3 shrink-0 items-center flex-wrap">
                                        {[ { id: 'all', label: 'ALL' }, { id: 'attack', label: 'ATTACK' }, { id: 'action', label: 'ACTION' }, { id: 'bonus action', label: 'BONUS' }, { id: 'reaction', label: 'REACTION' }, { id: 'other', label: 'OTHER' } ].map(f => (
                                            <button type="button" key={f.id} onClick={() => setActionFilter(f.id as any)} className={`px-2 py-1 text-[8px] font-bold tracking-widest uppercase rounded transition-colors cursor-pointer font-cinzel ${actionFilter === f.id ? 'bg-[#c8d4e8] text-[#0d0e1f]' : 'bg-[#0a0c1e] text-[#8090b8] border border-[#2a3060] hover:bg-[#2a3060]'}`}>{f.label}</button>
                                        ))}
                                        <button type="button" onClick={() => { setActionForm({ name: '', attackMod: 'none', damageExpr: '', damageType: 'Físico', saveAttr: 'none' }); setIsEditingAction(!isEditingAction); }} className="pb-1 text-[9px] font-black tracking-widest uppercase transition-colors text-[#c8d4e8] hover:underline ml-auto flex items-center gap-1 cursor-pointer font-cinzel"><Plus size={10}/> Macro</button>
                                    </div>

                                    {isEditingAction && (
                                        <div className="bg-[#0a0c1e] border border-[#2a3060] rounded p-4 mb-4 shadow-2xl animate-in slide-in-from-top-4 relative overflow-hidden">
                                            <h4 className="text-[10px] text-[#c8d4e8] font-cinzel uppercase tracking-widest border-b border-[#2a3060] pb-2 mb-3 relative z-10">{actionForm.id ? 'Editar Macro' : 'Criar Novo Macro'}</h4>
                                            <div className="space-y-3 relative z-10">
                                                <div>
                                                    <label className="text-[8px] text-[#8090b8] uppercase font-bold mb-1 block font-cinzel">Nome do Macro</label>
                                                    <input type="text" value={actionForm.name} onChange={e => setActionForm({...actionForm, name: e.target.value})} placeholder="Ex: Fúria" className="w-full bg-[#0d0e1f] border border-[#2a3060] rounded p-2 text-white text-xs outline-none focus:border-[#c8d4e8] transition-colors font-crimson" />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-[8px] text-[#8090b8] uppercase font-bold mb-1 block font-cinzel">Dano</label>
                                                        <input type="text" value={actionForm.damageExpr} onChange={e => setActionForm({...actionForm, damageExpr: e.target.value})} placeholder="8d6" className="w-full bg-[#0d0e1f] border border-[#2a3060] rounded p-2 text-white text-xs outline-none focus:border-[#c8d4e8] font-mono transition-colors" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[8px] text-[#8090b8] uppercase font-bold mb-1 block font-cinzel">Tipo</label>
                                                        <select value={actionForm.damageType} onChange={e => setActionForm({...actionForm, damageType: e.target.value})} className="w-full bg-[#0d0e1f] border border-[#2a3060] rounded p-2 text-white text-xs outline-none focus:border-[#c8d4e8] transition-colors font-crimson">
                                                            <option value="Físico">Físico</option><option value="Cura">Cura</option>
                                                            {Object.keys(PT_BR_DICT).filter(k => PT_BR_DICT[k] !== k && k.length > 3).map(k => <option key={k} value={PT_BR_DICT[k]}>{PT_BR_DICT[k]}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-[8px] text-[#8090b8] uppercase font-bold mb-1 block font-cinzel">Rolar Ataque?</label>
                                                        <select value={actionForm.attackMod} onChange={e => setActionForm({...actionForm, attackMod: e.target.value})} className="w-full bg-[#0d0e1f] border border-[#2a3060] rounded p-2 text-white text-xs outline-none focus:border-[#c8d4e8] transition-colors font-crimson">
                                                            <option value="none">Não</option><option value="str">Sim (FOR)</option><option value="dex">Sim (DES)</option><option value="spell">Sim (Magia)</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-[8px] text-[#8090b8] uppercase font-bold mb-1 block font-cinzel">Resistência?</label>
                                                        <select value={actionForm.saveAttr} onChange={e => setActionForm({...actionForm, saveAttr: e.target.value})} className="w-full bg-[#0d0e1f] border border-[#2a3060] rounded p-2 text-white text-xs outline-none focus:border-[#c8d4e8] transition-colors font-crimson">
                                                            <option value="none">Sem Resistência</option><option value="FOR">Res: FOR</option><option value="DES">Res: DES</option><option value="CON">Res: CON</option><option value="INT">Res: INT</option><option value="SAB">Res: SAB</option><option value="CAR">Res: CAR</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 pt-2 border-t border-[#2a3060]">
                                                    <button type="button" onClick={() => setIsEditingAction(false)} className="flex-1 py-2 bg-[#0d0e1f] hover:bg-[#2a3060] border border-[#2a3060] text-gray-300 text-[9px] uppercase tracking-widest font-bold rounded transition-colors cursor-pointer font-cinzel">Cancelar</button>
                                                    <button type="button" onClick={handleSaveCustomAction} disabled={!actionForm.name.trim()} className="flex-[2] py-2 bg-[#c8d4e8] hover:bg-[#d4b784] text-[#0d0e1f] text-[9px] uppercase tracking-widest font-bold rounded disabled:opacity-50 transition-all cursor-pointer font-cinzel">Salvar</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                                        {allFilteredActions.length === 0 ? (
                                            <p className="text-[9px] text-gray-500 italic text-center py-8 font-crimson">Nenhuma ação encontrada.</p>
                                        ) : (
                                            <div className="w-full">
                                                <div className="grid grid-cols-12 gap-2 pb-2 mb-2 text-[8px] font-bold text-[#8090b8] uppercase tracking-widest items-center border-b border-[#2a3060] font-cinzel">
                                                    <div className="col-span-5 pl-2">Action</div>
                                                    <div className="col-span-2 text-center">Range</div>
                                                    <div className="col-span-2 text-center">Hit / DC</div>
                                                    <div className="col-span-3 text-right pr-2">Damage</div>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    {allFilteredActions.map((action: any, idx) => {
                                                        const showHeader = actionFilter === 'all' && (idx === 0 || allFilteredActions[idx-1].typeDetail !== action.typeDetail);
                                                        return (
                                                            <React.Fragment key={action.id || action.name}>
                                                                {showHeader && (
                                                                    <div className="flex items-end justify-between border-b border-[#2a3060] mt-6 pb-1.5 mb-2">
                                                                        <span className="text-[10px] font-bold text-[#c8d4e8] uppercase tracking-[0.2em] font-cinzel">{action.typeDetail}</span>
                                                                    </div>
                                                                )}
                                                                <div className="grid grid-cols-12 gap-2 py-2 px-2 rounded group bg-[#0a0c1e] border border-[#2a3060] hover:border-[#c8d4e8] transition-all cursor-pointer shadow-sm" onClick={() => toggleActionExpansion(action.id || action.name)}>
                                                                    <div className="col-span-5 flex items-center gap-2">
                                                                        <div className="flex flex-col min-w-0">
                                                                            <span className="text-xs font-bold text-gray-200 group-hover:text-[#c8d4e8] transition-colors truncate font-crimson">{action.name}</span>
                                                                            <span className="text-[8px] text-[#8090b8] uppercase tracking-widest truncate font-cinzel">{translateTerm(action.category)}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="col-span-2 text-center flex items-center justify-center">
                                                                        <span className="text-[9px] font-mono text-[#8090b8] bg-[#0d0e1f] px-1 py-0.5 rounded border border-[#2a3060]">{action.range?.split(' ')[0] || '--'}</span>
                                                                    </div>
                                                                    <div className="col-span-2 flex justify-center items-center">
                                                                        {(action.attackMod && action.attackMod !== 'none') ? (
                                                                            <button type="button" onClick={(e) => { e.stopPropagation(); executeActionAttack(action); }} className="bg-[#0d0e1f] border border-[#2a3060] rounded text-gray-300 font-bold text-xs hover:border-[#c8d4e8] transition-colors min-w-[30px] py-1 px-1 font-cinzel">
                                                                                {action.hitMod >= 0 ? `+${action.hitMod}` : action.hitMod}
                                                                            </button>
                                                                        ) : (action.saveAttr && action.saveAttr !== 'none') ? (
                                                                            <button type="button" onClick={(e) => { e.stopPropagation(); executeActionSave(action); }} className="bg-[#0d0e1f] border border-[#2a3060] rounded text-gray-300 font-bold text-[9px] hover:border-[#c8d4e8] transition-colors min-w-[30px] py-1 px-1 font-cinzel">
                                                                                {action.saveAttr}
                                                                            </button>
                                                                        ) : (
                                                                            <span className="text-gray-600 text-xs">--</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="col-span-3 flex justify-end items-center gap-2 pr-1">
                                                                        {action.damageExpr ? (
                                                                            <button type="button" onClick={(e) => { e.stopPropagation(); executeActionDamage(action); }} className="bg-[#0d0e1f] border border-[#2a3060] rounded text-[#c8d4e8] hover:border-[#c8d4e8] font-bold text-[10px] px-2 py-1 flex items-center justify-center transition-colors font-mono">
                                                                                {action.damageExpr}
                                                                            </button>
                                                                        ) : action.type === 'macro' ? (
                                                                            <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteCustomAction(action.id); }} className="bg-[#0d0e1f] border border-[#2a3060] rounded text-[#c0392b] hover:border-[#c0392b] font-bold text-[8px] px-2 py-1 uppercase transition-colors font-cinzel">
                                                                                Del
                                                                            </button>
                                                                        ) : (
                                                                            <span className="text-[9px] text-gray-600 italic">--</span>
                                                                        )}
                                                                    </div>
                                                                    
                                                                    {expandedActionIds[action.id || action.name] && (
                                                                        <div className="col-span-12 mt-2 pl-2 pr-2 text-xs text-gray-400 font-crimson leading-relaxed whitespace-pre-wrap pt-2 pb-1 border-t border-[#2a3060]">
                                                                            <span className="font-bold text-[#c8d4e8]">{action.name}. </span>
                                                                            {action.desc}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'spells' && (
                            <div style={{ padding: "12px 10px" }}>
                                {hasSpellSlots && (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 16 }}>
                                        {[1,2,3,4,5,6,7,8,9].map(level => {
                                            const slots = myCharacter?.spellSlots?.[level];
                                            if (!slots || slots.max === 0) return null;
                                            return (
                                                <div key={level} style={{ background: "var(--surface)", padding: "8px", borderRadius: 2, textAlign: "center", border: "1px solid var(--border)", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}>
                                                    <span style={{ display: "block", fontSize: 8, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4, fontFamily: "var(--ff)" }}>Círculo {level}</span>
                                                    <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
                                                        {[...Array(slots.max)].map((_, i) => (
                                                            <div key={i} onClick={() => handleSpellSlotChange(level, 'toggle_used', i)} style={{ width: 10, height: 10, borderRadius: "50%", border: "1.5px solid #60a5fa", background: i < slots.used ? "transparent" : "#3b82f6", cursor: "pointer", boxShadow: i < slots.used ? "inset 0 2px 4px rgba(0,0,0,0.8)" : "0 0 8px rgba(59,130,246,0.6)" }} />
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                <div style={{ display: "flex", gap: 8, marginBottom: 16, background: "linear-gradient(145deg, #1a2333 0%, #111115 100%)", padding: "10px", borderRadius: 2, border: "1px solid rgba(96,165,250,0.3)", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
                                    <div style={{ flex: 1, textAlign: "center" }}>
                                        <div style={{ fontSize: 8, fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 2, fontFamily: "var(--ff)" }}>Ataque Mágico</div>
                                        <div style={{ fontFamily: "var(--ff)", fontSize: 18, fontWeight: 700, color: "var(--t1)", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>{sign(spellAttackBonus)}</div>
                                    </div>
                                    <div style={{ width: 1, background: "var(--border)" }}></div>
                                    <div style={{ flex: 1, textAlign: "center" }}>
                                        <div style={{ fontSize: 8, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 2, fontFamily: "var(--ff)" }}>CD (Resist.)</div>
                                        <div style={{ fontFamily: "var(--ff)", fontSize: 18, fontWeight: 700, color: "var(--t1)", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>{spellDC}</div>
                                    </div>
                                </div>

                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => {
                                    const spellsOfLevel = knownSpells.filter(s => s.level === level);
                                    if (spellsOfLevel.length === 0) return null;
                                    return (
                                        <div key={`spell-lvl-${level}`} style={{ marginBottom: 16 }}>
                                            <div className="sec-title" style={{ borderColor: "#3b82f6", color: "#60a5fa", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>{level === 0 ? 'Truques (Cantrips)' : `Magias de Círculo ${level}`}</div>
                                            <div style={{ background: "var(--surface)", borderRadius: 2, overflow: "hidden", border: "1px solid var(--border)", boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }}>
                                                <table className="atk-table">
                                                    <tbody>
                                                        {spellsOfLevel.map((spell: any) => {
                                                            const meta = getSpellMeta(spell);
                                                            return (
                                                                <React.Fragment key={spell.id}>
                                                                    <tr className={expandedActionIds[spell.id || spell.name] ? 'active-row' : ''} style={{ cursor: "pointer" }} onClick={() => toggleActionExpansion(spell.id || spell.name)}>
                                                                        <td style={{ color: "var(--t1)", paddingLeft: 8 }}>
                                                                            <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 2, fontFamily: "var(--fb)" }}>{spell.name}</div>
                                                                            <div style={{ fontSize: 8, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase", fontFamily: "var(--ff)" }}>{meta.time}</div>
                                                                        </td>
                                                                        <td style={{ textAlign: "center" }}>
                                                                            {spell.isAttack ? (
                                                                                <span onClick={(e) => { e.stopPropagation(); handleTriggerRoll(myCharacterName, `Ataque Mágico: ${spell.name}`, spellAttackBonus, spell.parsedDamage, spell.parsedType); }} className="chip" style={{ color: "#2980b9", border: "1px solid #2980b9", fontWeight: 700, fontFamily: "var(--ff)", fontSize: 11 }}>{sign(spellAttackBonus)}</span>
                                                                            ) : spell.isSave ? (
                                                                                <span onClick={(e) => { e.stopPropagation(); handleTriggerRoll(myCharacterName, `Resistência contra ${spell.name}`, 0); }} className="chip" style={{ color: "var(--accent)", border: "1px solid var(--accent)", fontWeight: 700, fontSize: 9 }}>CD {spellDC}</span>
                                                                            ) : <span style={{color: "var(--t3)", fontWeight: 700}}>—</span>}
                                                                        </td>
                                                                        <td style={{ textAlign: "right", paddingRight: 8 }}>
                                                                            {spell.parsedDamage ? (
                                                                                <span onClick={(e) => { e.stopPropagation(); handleIntentToDamage(spell.name, spell.parsedDamage, spell.parsedType); }} className="chip" style={{ color: "#8b1a1a", borderColor: "#8b1a1a", fontWeight: 700, fontFamily: "var(--ff)", fontSize: 11 }}>{spell.parsedDamage}</span>
                                                                            ) : (
                                                                                <span onClick={(e) => { e.stopPropagation(); onCastSpellRP(spell); }} className="chip" style={{ color: "#fff", borderColor: "#3b82f6", background: "#2563eb", fontWeight: 700, boxShadow: "0 2px 4px rgba(37,99,235,0.4)" }}>Usar</span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                    {expandedActionIds[spell.id || spell.name] && (
                                                                        <tr style={{ background: "var(--bg)" }}>
                                                                            <td colSpan={3} style={{ padding: "8px 12px", fontSize: 11, color: "var(--t2)", lineHeight: 1.5, borderTop: "1px solid var(--border)", fontFamily: "var(--fb)" }}>
                                                                                <div style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 9, color: "var(--t3)", textTransform: "uppercase", fontWeight: 700, fontFamily: "var(--ff)" }}>
                                                                                    <span><strong>Alcance:</strong> {meta.range}</span>
                                                                                    <span><strong>Comp:</strong> {meta.comps}</span>
                                                                                </div>
                                                                                {spell.cleanDescription}
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </React.Fragment>
                                                            )
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )
                                })}
                                {knownSpells.length === 0 && <div style={{ background: "var(--surface)", border: "1px dashed var(--border-md)", borderRadius: 2, padding: 20, textAlign: "center", marginTop: 16 }}><p style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600, fontFamily: "var(--fb)" }}>Seu grimório está vazio.</p></div>}
                            </div>
                        )}

                        {activeTab === 'inventory' && (
                            <div style={{ padding: "12px 10px" }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: "var(--t3)", marginBottom: 4, display: "flex", justifyContent: "space-between", textTransform: "uppercase", letterSpacing: ".05em", fontFamily: "var(--ff)" }}>
                                    <span>Peso Carregado</span>
                                    <strong style={{ color: totalWeight > maxWeight ? 'var(--accent-red)' : 'var(--t1)', fontFamily: "var(--ff)" }}>{totalWeight.toFixed(1)} / {maxWeight} lb</strong>
                                </div>
                                <div style={{ height: 4, background: "var(--surface)", borderRadius: 2, overflow: "hidden", marginBottom: 16, boxShadow: "inset 0 1px 3px rgba(0,0,0,0.8)" }}>
                                    <div style={{ width: `${Math.min(100, weightPercent)}%`, height: "100%", background: totalWeight > maxWeight ? "var(--accent-red)" : "linear-gradient(90deg, #7ab87a 0%, #5b9bd5 100%)", borderRadius: 2 }} />
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, marginBottom: 16 }}>
                                    {renderCoin('cp', 'PC', 'border-orange-500/30 text-orange-300')}
                                    {renderCoin('sp', 'PP', 'border-gray-500/50 text-gray-300')}
                                    {renderCoin('ep', 'PE', 'border-blue-500/30 text-blue-300')}
                                    {renderCoin('gp', 'PO', 'border-yellow-500/50 text-yellow-400')}
                                    {renderCoin('pp', 'PL', 'border-purple-500/40 text-purple-300')}
                                </div>
                                <Inventory items={inventory} ownerId={myCharacter.id} onEquip={handleEquipItem} onDrop={handleDropItem} />
                            </div>
                        )}

                        {activeTab === 'features' && (
                            <div style={{ padding: "12px 10px" }}>
                                <div className="sec-title">Características da Classe</div>
                                {CLASS_ABILITIES[myCharacter.classType?.toUpperCase() || 'GUERREIRO']?.map((ability, idx) => {
                                    if (savedLevel < ability.unlockLevel) return null;
                                    const key = `${myCharacter.name}_${ability.name}`; const used = abilityUsage[key] || 0; const disabled = ability.max !== 99 && used >= ability.max;
                                    return (
                                        <div key={idx} className="feat-card">
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                                                <div style={{ fontFamily: "var(--ff)", fontSize: 12, fontWeight: 700, color: "var(--t1)", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>{ability.icon} {ability.name}</div>
                                                <button type="button" onClick={()=>{handleUseAbility(ability.name, ability.max, ability.desc)}} disabled={disabled} style={{ background: disabled ? "var(--bg)" : "var(--accent)", color: disabled ? "var(--t3)" : "#000", border: `1px solid ${disabled ? "var(--border)" : "var(--accent)"}`, borderRadius: 2, padding: "2px 8px", fontSize: 8, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", boxShadow: disabled ? "none" : "0 2px 6px rgba(229,180,81,0.4)", fontFamily: "var(--ff)" }}>USAR</button>
                                            </div>
                                            <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5, fontFamily: "var(--fb)" }}>{ability.desc}</div>
                                            {ability.max !== 99 && (
                                                <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                                                    {Array.from({length: ability.max}).map((_, i) => (
                                                        <span key={i} className="choice-badge" style={i < used ? { background: "var(--bg)", borderColor: "var(--border)", color: "var(--t3)" } : { borderColor: "var(--accent)", color: "var(--accent)", background: "var(--accent-dim)", fontWeight: 700, boxShadow: "0 0 6px rgba(229,180,81,0.2)", fontSize: '8px', padding: '1px 4px', borderRadius: '2px' }}>Carga {i+1}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                                {(!CLASS_ABILITIES[myCharacter.classType?.toUpperCase() || ''] || CLASS_ABILITIES[myCharacter.classType?.toUpperCase() || ''].length === 0) && (
                                    <div style={{ background: "var(--surface)", border: "1px dashed var(--border-md)", borderRadius: 2, padding: 20, textAlign: "center", marginTop: 16 }}><p style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600, fontFamily: "var(--fb)" }}>Nenhuma habilidade mapeada.</p></div>
                                )}
                            </div>
                        )}

                        {activeTab === 'background' && (
                            <div style={{ padding: "12px 10px" }}>
                                <div className="sec-title">Identidade</div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, marginBottom: 16, background: "var(--surface)", borderRadius: 2, border: "1px solid var(--border)", overflow: "hidden" }}>
                                    {[ { lbl: "Background", val: (charDetails as any)?.background || "—" }, { lbl: "Tendência", val: (charDetails as any)?.alignment || "—" }, { lbl: "Fé", val: (charDetails as any)?.faith || "—" }, { lbl: "Estilo de Vida", val: (charDetails as any)?.lifestyle || "—" } ].map(({ lbl, val }, idx) => (
                                        <div key={lbl} style={{ display: "flex", flexDirection: "column", padding: "8px 10px", borderBottom: idx < 2 ? "1px solid var(--border)" : "none", borderRight: idx % 2 === 0 ? "1px solid var(--border)" : "none", background: "rgba(255,255,255,0.02)" }}>
                                            <span style={{ fontSize: 8, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2, fontFamily: "var(--ff)" }}>{lbl}</span>
                                            <span style={{ color: val === "—" ? "var(--t3)" : "var(--t1)", fontWeight: 600, fontSize: 11, fontFamily: "var(--fb)" }}>{val}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="sec-title">Personalidade</div>
                                <div style={{ background: "var(--surface)", borderRadius: 2, border: "1px solid var(--border)", padding: "12px", marginBottom: 16 }}>
                                    <IdentityCard title="Traços de Personalidade" content={(charDetails as any)?.personalityTraits} />
                                    <IdentityCard title="Ideais" content={(charDetails as any)?.ideals} />
                                    <IdentityCard title="Vínculos (Bonds)" content={(charDetails as any)?.bonds} />
                                    <IdentityCard title="Fraquezas (Flaws)" content={(charDetails as any)?.flaws} />
                                </div>

                                <div className="sec-title">Aparência</div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, background: "var(--surface)", borderRadius: 2, border: "1px solid var(--border)", overflow: "hidden" }}>
                                    {[
                                        {lbl: 'Idade', k: 'age'}, {lbl: 'Gênero', k: 'gender'}, 
                                        {lbl: 'Altura', k: 'height'}, {lbl: 'Peso', k: 'weight'}, 
                                        {lbl: 'Olhos', k: 'eyes'}, {lbl: 'Pele', k: 'skin'}
                                    ].map(({lbl, k}, idx) => {
                                        const val = (charDetails as any)?.physical?.[k] || "—";
                                        return (
                                            <div key={k} style={{ display: "flex", flexDirection: "column", padding: "8px 10px", borderBottom: idx < 4 ? "1px solid var(--border)" : "none", borderRight: idx % 2 === 0 ? "1px solid var(--border)" : "none", background: "rgba(255,255,255,0.02)" }}>
                                                <span style={{ fontSize: 8, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2, fontFamily: "var(--ff)" }}>{lbl}</span>
                                                <span style={{ color: val === "—" ? "var(--t3)" : "var(--t1)", fontWeight: 600, fontSize: 11, fontFamily: "var(--fb)" }}>{val}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {activeTab === 'notes' && (
                            <div style={{ padding: "12px 10px", height: "100%", display: "flex", flexDirection: "column" }}>
                                <div className="sec-title">Anotações do Jogador</div>
                                <textarea 
                                    className="sb-scroll"
                                    style={{ flex: 1, width: '100%', minHeight: "400px", background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '2px', padding: '12px', color: 'var(--t1)', fontSize: '12px', lineHeight: '1.7', fontFamily: 'var(--fb)', outline: 'none', resize: 'none', boxShadow: "inset 0 2px 8px rgba(0,0,0,0.5)" }}
                                    placeholder="Anote pistas, nomes, locais e segredos da campanha aqui..."
                                    defaultValue={myCharacter.dmNotes || ''}
                                    onBlur={(e) => onUpdateCharacter && onUpdateCharacter(myCharacter.id, { dmNotes: e.target.value })}
                                />
                            </div>
                        )}

                        {activeTab === 'chat' && (
                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <Chat messages={chatMessages} onSendMessage={onSendMessage} role="PLAYER" onApplyDamage={onApplyDamageFromChat} />
                            </div>
                        )}

                    </div>
                </div>
            </div>

          </div>
          
          <button
            onClick={() => setNavOpen(true)}
            title="Menu da Ficha"
            style={{
              position: "fixed",
              bottom: 90,
              right: `calc(var(--sb-width) + 24px)`,
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #f5c462 0%, var(--accent) 100%)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 18px rgba(200,212,232,.45)",
              transition: "transform .2s, box-shadow .2s",
              zIndex: 300,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = "scale(1.1)";
              e.currentTarget.style.boxShadow = "0 6px 24px rgba(200,212,232,.6)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 4px 18px rgba(200,212,232,.45)";
            }}
          >
            <LayoutGrid size={22} color="#0d0e1f" />
          </button>
      </div>
    </>
  );
};

export default SidebarPlayer;