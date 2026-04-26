import React, { useState, useRef, useEffect, useCallback } from 'react';
import Chat, { ChatMessage } from './Chat'; 
import { Entity, MonsterPreset, FogRoom } from '../App';
import EditEntityModal from './EditEntityModal';
import CampaignManager from './CampaignManager';
import SkillList from './SkillList';
import ItemCreator from './ItemCreator';
import Scratchpad from './Scratchpad'; 
import Soundboard from './Soundboard';
import { mapEntityStatsToAttributes } from '../utils/attributeMapping';
import { EntityControlRow } from './EntityControlRow';
import { Image as ImageIcon, Check, X, Brush, Square, Minus, Tent, Gem, Search, ShieldAlert, Flame, Heart, Sword, ChevronDown, ChevronRight, ChevronLeft, Activity, LayoutGrid, Trash2, BookOpen, BookText, Info, AlertTriangle, Undo2, Skull, Eye, EyeOff } from 'lucide-react';
import UniversalDiceRoller from './UniversalDiceRoller';
import socket from '../services/socket'; 

export interface InitiativeItem { id: number; name: string; value: number; }

const MONSTER_LIST: MonsterPreset[] = [
  { name: 'Lobo', hp: 11, ac: 13, image: '/tokens/Raças/Orc/druid/druid_orc_humanoid_male_medium_01.png' }, 
  { name: 'Goblin', hp: 7, ac: 15, image: '/tokens/Raças/Gnome/rogue/rogue_gnome_humanoid_male_small_01.png' }, 
  { name: 'Esqueleto', hp: 13, ac: 13, image: '/tokens/Raças/Dwarf/fighter/fighter_dwarf_humanoid_male_medium_01.png' }, 
  { name: 'Orc', hp: 15, ac: 13, image: '/tokens/Raças/Orc/fighter/fighter_orc_humanoid_male_medium_01.png' },
  { name: 'Bandido', hp: 11, ac: 12, image: '/tokens/Raças/Human/rogue/rogue_human_humanoid_male_medium_01.png' },
  { name: 'Zumbi', hp: 22, ac: 8, image: '/tokens/Raças/Human/commoner/commoner_human_humanoid_male_medium_01.png' } 
];

const INITIAL_MAPS = [
    { name: 'Floresta', url: '/maps/floresta.jpg' }, 
    { name: 'Caverna', url: '/maps/caverna.jpg' }, 
    { name: 'Taverna', url: '/maps/taverna.jpg' }, 
    { name: 'Masmorra', url: '/maps/masmorra.jpg' }
];

type SidebarTab = 'combat' | 'map' | 'create' | 'audio' | 'tools' | 'campaign' | 'rules'; 
type MainTab = 'tools' | 'chat';

export interface SidebarDMProps {
  entities: Entity[];
  onUpdateHP: (id: number, change: number) => void;
  onAddEntity: (type: 'enemy' | 'player', name: string, preset?: MonsterPreset) => void;
  onDeleteEntity: (id: number) => void;
  onEditEntity: (id: number, updates: Partial<Entity>) => void;
  isFogMode: boolean;
  onToggleFogMode: () => void;
  onResetFog: () => void;
  onRevealAll: () => void;
  fogTool: 'reveal' | 'hide' | 'room' | 'wall' | 'eraseWall' | string;
  onSetFogTool: (tool: string) => void;
  fogShape?: 'brush' | 'rect' | 'line';
  onSetFogShape?: (shape: 'brush' | 'rect' | 'line') => void;
  onSyncFog: () => void;
  onSaveGame: () => void;
  onChangeMap: (mapUrl: string) => void;
  initiativeList: InitiativeItem[];
  activeTurnId: number | null;
  onAddToInitiative: (entity: Entity) => void;
  onRemoveFromInitiative: (id: number) => void;
  onNextTurn: () => void;
  onClearInitiative: () => void;
  onSortInitiative: () => void;
  targetEntityIds: number[];
  attackerId: number | null;
  onSetTarget: (id: number | number[] | null, multiSelect?: boolean) => void;
  onToggleCondition: (id: number, condition: string) => void;
  activeAoE: 'circle' | 'cone' | 'cube' | null;
  onSetAoE: (type: 'circle' | 'cone' | 'cube' | null) => void;
  chatMessages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onSetAttacker: (id: number | null) => void;
  aoeColor: string;
  onSetAoEColor: (color: string) => void;
  onOpenCreator: (type: 'player' | 'enemy') => void;
  onAddXP?: (id: number, amount: number) => void;
  customMonsters?: MonsterPreset[]; 
  globalBrightness?: number;
  onSetGlobalBrightness?: (val: number) => void;
  onRequestRoll: (targetId: number, skillName: string, mod: number, dc: number) => void;
  onToggleVisibility: (id: number) => void;
  currentTrack: string | null;
  onPlayMusic: (trackId: string) => void;
  onStopMusic: () => void;
  onPlaySFX: (sfxId: string) => void;
  audioVolume: number;
  onSetAudioVolume: (val: number) => void;
  onResetView: () => void;
  onGiveItem: (targetId: number, item: any) => void;
  onApplyDamageFromChat: (targetId: number, damageExpression: string) => void;
  onDMRoll: (title: string, subtitle: string, mod: number, rollType?: 'normal' | 'advantage' | 'disadvantage') => void;
  onLongRest: () => void; 
  availableItems?: any[]; 
  availableConditions?: any[]; 
  onOpenLootGenerator?: () => void; 
  onRequestCustomRoll?: (targetIds: number[], expression: string, title: string) => void;
  fogRooms?: FogRoom[];
  onToggleFogRoom?: (roomId: string, reveal: boolean) => void;
  onDeleteFogRoom?: (roomId: string) => void;
  conditionsData?: any[];
  onStartCombat: (combatantIds: number[]) => void;
  onQueueInitiativeRoll?: (entityId: number, entityName: string, mod: number) => void; // <--- ADICIONE AQUI
}

const extractTextFromEntries = (entries: any[], depth = 0): string => {
    if (depth > 10) return '';
    if (!entries || !Array.isArray(entries)) return '';
    return entries.map(e => {
        if (typeof e === 'string') return e.replace(/\{@[a-z]+\s([^|}]+)(?:\|[^}]+)?\}/gi, '$1');
        if (e.name && e.entries) return `${e.name}: ${extractTextFromEntries(e.entries, depth + 1)}`;
        if (e.entries) return extractTextFromEntries(e.entries, depth + 1);
        if (e.items) return e.items.map((item:any) => typeof item === 'string' ? `• ${item.replace(/\{@[a-z]+\s([^|}]+)(?:\|[^}]+)?\}/gi, '$1')}` : `• ${item.name}: ${item.entry ? item.entry.replace(/\{@[a-z]+\s([^|}]+)(?:\|[^}]+)?\}/gi, '$1') : ''}`).join('\n');
        return '';
    }).join('\n\n');
};

const DescriptionPanel: React.FC<{ title: string; description: string; onClose: () => void; }> = ({ title, description, onClose }) => {
    return (
        <div className="absolute top-0 right-0 h-full w-[340px] bg-[#111111] border-l border-amber-900/50 z-[210] flex flex-col transform transition-transform animate-in slide-in-from-right duration-300 shadow-[-10px_0_30px_rgba(0,0,0,0.8)]">
            <div className="bg-black/60 p-4 shrink-0 flex items-center justify-between border-b border-amber-900/30 shadow-sm">
                <h3 className="text-lg font-black text-amber-500 truncate flex items-center gap-2"><Info size={16} className="text-amber-600"/> {title}</h3>
                <button onClick={onClose} className="text-gray-500 hover:text-amber-500 hover:bg-white/5 p-1.5 rounded transition-colors"><ChevronRight size={20}/></button>
            </div>
            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
                <div className="space-y-4 font-serif leading-relaxed text-sm text-gray-300">
                    {description ? description.split('\n\n').map((para, i) => <p key={i} className="whitespace-pre-wrap">{para}</p>) : "Nenhuma descrição disponível."}
                </div>
            </div>
            <div className="bg-black/80 p-3 text-center border-t border-amber-900/30 shrink-0 shadow-inner">
                <span className="text-[10px] text-amber-900 uppercase tracking-widest font-bold">Nexus VTT Codex</span>
            </div>
        </div>
    )
}

const AoEColorPicker = ({ selected, onSelect }: { selected: string, onSelect: (c: string) => void }) => {
    const colors = [{ c: '#ef4444', label: '🔥', name: 'Fogo' }, { c: '#3b82f6', label: '❄️', name: 'Gelo' }, { c: '#22c55e', label: '🧪', name: 'Ácido' }, { c: '#a855f7', label: '🔮', name: 'Magia' }, { c: '#eab308', label: '⚡', name: 'Raio' }, { c: '#111827', label: '🌑', name: 'Escuridão' }];
    return (
        <div className="flex gap-2 justify-center bg-black/60 p-2 rounded-xl mt-3 border border-white/5 shadow-inner">
            {colors.map(opt => (<button key={opt.c} onClick={() => onSelect(opt.c)} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all hover:scale-110 border-2 ${selected === opt.c ? 'border-white scale-110 shadow-[0_0_15px_currentColor]' : 'border-transparent opacity-60 hover:opacity-100'}`} style={{ backgroundColor: opt.c, color: selected === opt.c ? opt.c : 'transparent' }} title={opt.name}>{opt.label}</button>))}
        </div>
    );
};

const CollapsibleSection = ({ title, icon: Icon, children, defaultOpen = false }: { title: string, icon?: any, children: React.ReactNode, defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className={`bg-black/40 backdrop-blur-md border ${isOpen ? 'border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.05)]' : 'border-white/5'} rounded-xl flex flex-col overflow-hidden mb-4 transition-all duration-300`}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className={`flex justify-between items-center p-3 transition-colors cursor-pointer w-full text-left ${isOpen ? 'bg-gradient-to-r from-amber-900/20 to-transparent border-b border-amber-500/20' : 'bg-transparent hover:bg-white/5'}`}
            >
                <h3 className={`font-black text-[11px] uppercase tracking-[0.2em] flex items-center gap-2 ${isOpen ? 'text-amber-500' : 'text-gray-400'}`}>
                    {Icon && <Icon size={14} className={isOpen ? "opacity-100" : "opacity-50"}/>} {title}
                </h3>
                {isOpen ? <ChevronDown size={16} className="text-amber-500" /> : <ChevronRight size={16} className="text-gray-500" />}
            </button>
            {isOpen && (
                <div className="animate-in slide-in-from-top-2 fade-in duration-300">
                    {children}
                </div>
            )}
        </div>
    );
};

const CustomConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirmar", confirmColor = "bg-red-600 hover:bg-red-500" }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onCancel}>
            <div className="bg-[#111] border border-white/10 p-6 rounded-xl shadow-2xl w-80 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <h3 className="text-white font-black text-lg mb-2 flex items-center gap-2">
                    <AlertTriangle size={20} className="text-amber-500"/> {title}
                </h3>
                <p className="text-gray-400 text-sm mb-6 leading-relaxed font-serif">{message}</p>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold uppercase tracking-widest rounded-lg transition-colors border border-white/10">Cancelar</button>
                    <button onClick={onConfirm} className={`flex-[1.5] py-2.5 text-white text-xs font-black uppercase tracking-widest rounded-lg transition-all shadow-lg active:scale-95 ${confirmColor}`}>{confirmText}</button>
                </div>
            </div>
        </div>
    );
};

const CombatVsPanel = ({ attacker, targets, onUpdateHP, onSendMessage, onDMRoll, onRequestRoll }: any) => {
    const [amount, setAmount] = useState('');
    const [saveAttr, setSaveAttr] = useState('DES');
    
    const applyToAll = (damage: boolean) => {
        const val = parseInt(amount);
        if (val) {
            targets.forEach((ent:Entity) => { onUpdateHP(ent.id, damage ? -val : val); });
            setAmount('');
        }
    };

    const requestMassSave = () => {
        targets.forEach((t: Entity) => { onRequestRoll(t.id, `Salvaguarda de ${saveAttr}`, 0, 10); });
        onSendMessage(`🐉 **O Mestre Exigiu um Teste!**\n> Os alvos selecionados devem rolar **Resistência de ${saveAttr}** imediatamente!`);
    };

    const getAtkMod = () => {
        if (!attacker) return 0;
        const str = attacker.stats?.str || 10;
        const dex = attacker.stats?.dex || 10;
        return Math.floor((Math.max(str, dex) - 10) / 2);
    };
    const atkMod = getAtkMod();

    const handleVisualAttack = (rollType: 'normal' | 'advantage' | 'disadvantage') => {
        if (!attacker) return;
        const targetNames = targets.length > 0 ? targets.map((t: Entity) => t.name).join(', ') : 'o vazio';
        onDMRoll(`Ataque de "${attacker.name}"`, `Alvo(s): ${targetNames}`, atkMod, rollType);
    };

    const renderHpBar = (entity: Entity) => {
        const hpPercent = Math.max(0, Math.min(100, (entity.hp / entity.maxHp) * 100));
        let barColor = 'from-green-500 to-green-400';
        let shadow = 'shadow-[0_0_10px_rgba(34,197,94,0.3)]';
        if (hpPercent < 30) { barColor = 'from-red-600 to-red-500'; shadow = 'shadow-[0_0_10px_rgba(220,38,38,0.5)]'; }
        else if (hpPercent < 60) { barColor = 'from-yellow-500 to-yellow-400'; shadow = 'shadow-[0_0_10px_rgba(234,179,8,0.3)]'; }
        
        return (
            <div className="flex flex-col items-center w-full mt-3 pointer-events-none" title="Vida Atual">
                <div className="w-full h-2 bg-black border border-white/10 rounded-full overflow-hidden shadow-inner">
                    <div className={`h-full bg-gradient-to-r ${barColor} ${shadow} transition-all duration-500`} style={{ width: `${hpPercent}%` }}></div>
                </div>
                <span className="text-[10px] text-gray-400 font-mono mt-1.5 uppercase tracking-widest font-bold">{entity.hp} / {entity.maxHp} HP</span>
            </div>
        );
    };

    const renderAttributeCard = (label: string, value: number) => {
        const mod = Math.floor((value - 10) / 2);
        return (
            <div className="flex flex-col items-center border border-white/10 rounded-xl bg-black/40 p-2 shadow-inner group hover:border-blue-500/50 hover:bg-blue-900/10 transition-all cursor-default relative w-[52px] h-[68px]">
                <span className="text-[8px] font-black uppercase text-gray-500 group-hover:text-blue-300 z-10 tracking-widest mb-1">{label}</span>
                <span className="text-xl font-black text-white leading-none z-10">{mod >= 0 ? `+${mod}` : mod}</span>
                <div className="absolute -bottom-2 bg-black border border-white/10 rounded-xl px-2 py-[2px] text-[9px] font-bold z-20 group-hover:border-blue-50 group-hover:text-white transition-colors text-gray-400 shadow-md">
                    {value}
                </div>
            </div>
        );
    }

    if (!attacker && targets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-40 opacity-40">
                <div className="w-16 h-16 rounded-full bg-black/50 border border-white/10 flex items-center justify-center mb-3 shadow-inner">
                    <Sword size={24} className="text-gray-500" />
                </div>
                <span className="text-xs font-serif italic text-center text-gray-400">Selecione o Atacante e o(s) Alvo(s)<br/>na lista abaixo.</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full justify-between pb-2">
            <div>
                {attacker && (
                    <div className="flex items-start justify-between gap-4 mb-4 pb-5 border-b border-white/10 relative">
                        <div className="absolute -left-3 top-0 bottom-5 w-1 bg-gradient-to-b from-blue-500 to-transparent rounded-r"></div>
                        <div className="flex flex-wrap gap-2 w-[65%] justify-start">
                            {renderAttributeCard('FOR', attacker.stats?.str || 10)}
                            {renderAttributeCard('DES', attacker.stats?.dex || 10)}
                            {renderAttributeCard('CON', attacker.stats?.con || 10)}
                            {renderAttributeCard('INT', attacker.stats?.int || 10)}
                            {renderAttributeCard('SAB', attacker.stats?.wis || 10)}
                            {renderAttributeCard('CAR', attacker.stats?.cha || 10)}
                        </div>
                        <div className="flex flex-col items-center justify-start w-[30%] gap-2 bg-black/30 p-2 rounded-xl border border-white/5">
                            <div className="w-12 h-[52px] relative flex flex-col items-center justify-center cursor-default hover:scale-105 transition-transform" title="Classe de Armadura (CA)">
                                <svg className="absolute inset-0 w-full h-full text-blue-900/40 drop-shadow-[0_0_10px_rgba(59,130,246,0.2)]" viewBox="0 0 100 120" preserveAspectRatio="none">
                                    <path d="M50 0 L100 15 L100 60 C100 90 75 110 50 120 C25 110 0 90 0 60 L0 15 Z" fill="currentColor" stroke="#3b82f6" strokeWidth="2"/>
                                </svg>
                                <span className="text-[8px] font-black uppercase text-blue-200 relative z-10 -mt-1 tracking-widest">CA</span>
                                <span className="text-2xl font-black text-white relative z-10 leading-none drop-shadow-md">{attacker.ac || 10}</span>
                            </div>
                            {renderHpBar(attacker)}
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between gap-4 mb-4 relative z-10">
                    <div className="flex flex-col items-center w-full">
                        {targets.length > 0 && (
                            <div className="w-full bg-black/40 border border-red-900/30 rounded-xl p-3 shadow-inner relative">
                                <div className="absolute -left-3 top-2 bottom-2 w-1 bg-gradient-to-b from-red-500 to-transparent rounded-r"></div>
                                <div className="flex flex-col items-center">
                                    <div className="flex -space-x-4 overflow-hidden justify-center w-full mb-3">
                                        {targets.slice(0, 5).map((t: Entity, idx: number) => (
                                            <div key={t.id} className="w-14 h-14 rounded-full border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] overflow-hidden bg-black flex-shrink-0 relative z-10" style={{ zIndex: 10 - idx }}>
                                                <img src={t.tokenImage || t.image || ''} className="w-full h-full object-cover" alt="" />
                                            </div>
                                        ))}
                                        {targets.length > 5 && (<div className="w-14 h-14 rounded-full border-2 border-red-500 bg-red-950 text-red-200 text-xs font-black flex items-center justify-center z-0 relative -ml-5 shadow-[0_0_15px_rgba(239,68,68,0.4)]">+{targets.length - 5}</div>)}
                                    </div>
                                    
                                    {targets.length === 1 ? (
                                        <div className="flex flex-col items-center w-full">
                                            <span className="text-[14px] text-white font-black uppercase tracking-wider truncate max-w-full text-center">{targets[0].name}</span>
                                            <div className="mt-2 flex gap-4 text-[11px] font-mono items-center justify-center bg-black/50 px-3 py-1.5 rounded-lg border border-white/5">
                                                <span title="Armor Class" className="text-gray-400">CA <strong className="text-white text-sm ml-1">{targets[0].ac}</strong></span>
                                                <div className="w-px h-4 bg-white/20"></div>
                                                <span title="Hit Points" className="text-gray-400">HP <strong className={`text-sm ml-1 ${targets[0].hp < targets[0].maxHp / 2 ? 'text-red-500' : 'text-green-400'}`}>{targets[0].hp}/{targets[0].maxHp}</strong></span>
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-[11px] text-red-400 font-black uppercase tracking-[0.2em] bg-red-950/50 border border-red-900 px-4 py-1.5 rounded-full shadow-inner">{targets.length} Alvos Selecionados</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-auto space-y-4">
                {attacker && targets.length > 0 && (
                    <div className="flex gap-2 justify-center pt-2 relative z-10">
                        <button onClick={() => handleVisualAttack('disadvantage')} className="flex-1 bg-black/60 hover:bg-white/10 text-gray-400 text-[10px] font-bold py-3 rounded-xl border border-white/10 transition-all uppercase tracking-widest hover:border-white/30" title="Rolar 2 dados e pegar o MENOR">
                            Desv.
                        </button>
                        <button onClick={() => handleVisualAttack('normal')} className="flex-[1.5] bg-gradient-to-t from-red-800 to-red-600 hover:from-red-700 hover:to-red-500 text-white text-xs font-black py-3 rounded-xl shadow-[0_0_20px_rgba(220,38,38,0.4)] border border-red-400 transition-all active:scale-95 uppercase tracking-widest flex items-center justify-center gap-2" title="Rolar D20 padrão">
                            <span className="text-lg">🎲</span> Atacar
                        </button>
                        <button onClick={() => handleVisualAttack('advantage')} className="flex-1 bg-black/60 hover:bg-white/10 text-gray-400 hover:text-green-400 text-[10px] font-bold py-3 rounded-xl border border-white/10 transition-all uppercase tracking-widest hover:border-green-500/50" title="Rolar 2 dados e pegar o MAIOR">
                            Vant.
                        </button>
                    </div>
                )}

                {targets.length > 0 && (
                    <div className="bg-black/40 border border-red-900/30 rounded-xl p-3 shadow-inner relative z-10 flex flex-col gap-3">
                        <div className="flex gap-2">
                            <input type="number" placeholder="HP" className="w-16 bg-black border border-white/10 rounded-lg p-2 text-center text-white text-sm font-black outline-none focus:border-red-500 shadow-inner placeholder-gray-700" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') applyToAll(true); }} />
                            <button onClick={() => applyToAll(true)} className="flex-1 bg-black hover:bg-red-900/80 border border-white/10 hover:border-red-500 text-gray-400 hover:text-red-100 font-bold rounded-lg uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-1.5 active:scale-95"><Flame size={14}/> Dano</button>
                            <button onClick={() => applyToAll(false)} className="flex-1 bg-black hover:bg-green-900/80 border border-white/10 hover:border-green-500 text-gray-400 hover:text-green-100 font-bold rounded-lg uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-1.5 active:scale-95"><Heart size={14}/> Curar</button>
                        </div>
                        <div className="flex gap-2 border-t border-white/5 pt-3">
                            <select value={saveAttr} onChange={e => setSaveAttr(e.target.value)} className="w-16 bg-black border border-white/10 rounded-lg p-1 text-center text-gray-400 font-bold outline-none focus:border-amber-500 cursor-pointer text-xs appearance-none">
                                <option value="FOR">FOR</option><option value="DES">DES</option><option value="CON">CON</option><option value="INT">INT</option><option value="SAB">SAB</option><option value="CAR">CAR</option>
                            </select>
                            <button onClick={requestMassSave} className="flex-1 bg-amber-900/20 hover:bg-amber-600 border border-amber-700/50 hover:border-amber-400 text-amber-500 hover:text-black font-black rounded-lg uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-1.5 shadow-[0_0_10px_rgba(245,158,11,0.1)] active:scale-95">
                                <ShieldAlert size={14}/> Exigir Resistência
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const CONDITION_MAP = [
    { id: 'Blinded', icon: '🦇', label: 'Cego', bg: 'bg-gray-900 hover:bg-gray-800', border: 'border-gray-500/50', text: 'text-gray-200' },
    { id: 'Charmed', icon: '💕', label: 'Enfeitiçado', bg: 'bg-pink-950 hover:bg-pink-900', border: 'border-pink-500/50', text: 'text-pink-300' },
    { id: 'Deafened', icon: '🔇', label: 'Surdo', bg: 'bg-slate-900 hover:bg-slate-800', border: 'border-slate-500/50', text: 'text-slate-300' },
    { id: 'Exhaustion', icon: '😩', label: 'Exaustão', bg: 'bg-amber-950 hover:bg-amber-900', border: 'border-amber-500/50', text: 'text-amber-300' },
    { id: 'Frightened', icon: '😱', label: 'Amedrontado', bg: 'bg-indigo-950 hover:bg-indigo-900', border: 'border-indigo-500/50', text: 'text-indigo-300' },
    { id: 'Grappled', icon: '🤼', label: 'Agarrado', bg: 'bg-orange-950 hover:bg-orange-900', border: 'border-orange-500/50', text: 'text-orange-300' },
    { id: 'Incapacitated', icon: '😵', label: 'Incapacitado', bg: 'bg-stone-900 hover:bg-stone-800', border: 'border-stone-500/50', text: 'text-stone-300' },
    { id: 'Invisible', icon: '👻', label: 'Invisível', bg: 'bg-teal-950 hover:bg-teal-900', border: 'border-teal-500/50', text: 'text-teal-300' },
    { id: 'Paralyzed', icon: '⚡', label: 'Paralisado', bg: 'bg-yellow-950 hover:bg-yellow-900', border: 'border-yellow-500/50', text: 'text-yellow-300' },
    { id: 'Petrified', icon: '🗿', label: 'Petrificado', bg: 'bg-zinc-900 hover:bg-zinc-800', border: 'border-zinc-500/50', text: 'text-zinc-300' },
    { id: 'Poisoned', icon: '🤢', label: 'Envenenado', bg: 'bg-green-950 hover:bg-green-900', border: 'border-green-500/50', text: 'text-green-300' },
    { id: 'Prone', icon: '⏬', label: 'Caído', bg: 'bg-amber-950 hover:bg-amber-900', border: 'border-amber-500/50', text: 'text-amber-300' },
    { id: 'Restrained', icon: '⛓️', label: 'Impedido', bg: 'bg-red-950 hover:bg-red-900', border: 'border-red-500/50', text: 'text-red-300' },
    { id: 'Stunned', icon: '💫', label: 'Atordoado', bg: 'bg-fuchsia-950 hover:bg-fuchsia-900', border: 'border-fuchsia-500/50', text: 'text-fuchsia-300' },
    { id: 'Unconscious', icon: '💤', label: 'Inconsciente', bg: 'bg-purple-950 hover:bg-purple-900', border: 'border-purple-500/50', text: 'text-purple-300' },
];

const SidebarDM: React.FC<SidebarDMProps> = ({ 
  entities, onUpdateHP, onAddEntity, onDeleteEntity, onEditEntity,
  isFogMode, onToggleFogMode, onResetFog, onRevealAll, fogTool, onSetFogTool, 
  fogShape = 'brush', onSetFogShape, 
  onSyncFog, onSaveGame, onChangeMap,
  initiativeList, activeTurnId, onAddToInitiative, onRemoveFromInitiative, onNextTurn, onClearInitiative, onSortInitiative,
  targetEntityIds, attackerId, onSetTarget, onToggleCondition,
  activeAoE, onSetAoE, chatMessages, onSendMessage,
  onSetAttacker, aoeColor, onSetAoEColor,
  onOpenCreator, onAddXP, customMonsters, globalBrightness = 1, onSetGlobalBrightness, onRequestRoll, onToggleVisibility,
  currentTrack, onPlayMusic, onStopMusic, onPlaySFX, audioVolume, onSetAudioVolume,
  onResetView, onGiveItem, onApplyDamageFromChat,
  onDMRoll, onLongRest, availableItems, availableConditions, onOpenLootGenerator,
  onRequestCustomRoll,
  fogRooms = [], onToggleFogRoom, onDeleteFogRoom,
  conditionsData,
  onStartCombat,    
  onQueueInitiativeRoll // <--- ADICIONE AQUI
}) => {
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [activeTab, setActiveTab] = useState<SidebarTab>('combat');
  const [mainTab, setMainTab] = useState<MainTab>('tools'); 
  const [pendingSkillRequest, setPendingSkillRequest] = useState<{ skillName: string, mod: number } | null>(null);
  const [dcInput, setDcInput] = useState<number>(10);
  
  const [monsterSearch, setMonsterSearch] = useState('');
  const [isUniversalRollerOpen, setIsUniversalRollerOpen] = useState(false);
  
  const [customRollExpr, setCustomRollExpr] = useState('1d100');
  const [customRollTitle, setCustomRollTitle] = useState('Rolagem Customizada');

  const [mapList, setMapList] = useState<{name: string, url: string}[]>(INITIAL_MAPS);
  const [customMapUrl, setCustomMapUrl] = useState('');
  const [previewMap, setPreviewMap] = useState<{url: string, name: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [booksData, setBooksData] = useState<any>(null);
  const [activeBookKey, setActiveBookKey] = useState<string>('book-xscreen');
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(0);
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [descriptionPanel, setDescriptionPanel] = useState<{title: string, content: string} | null>(null);

  const [pendingIntents, setPendingIntents] = useState<any[]>([]);
  const [roomId] = useState(window.location.pathname.split('/').pop() || 'mesa-do-victor');

  const [roundCount, setRoundCount] = useState(1);

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, action: () => void, confirmText?: string, confirmColor?: string }>({
      isOpen: false, title: '', message: '', action: () => {}
  });

  const [conditionToast, setConditionToast] = useState<{visible: boolean, condId: string, timeoutId?: NodeJS.Timeout}>({visible: false, condId: ''});

  // 🔴 NOVOS ESTADOS: Modal de Iniciar Combate
  const [showCombatModal, setShowCombatModal] = useState(false);
  const [selectedCombatants, setSelectedCombatants] = useState<number[]>([]);

  const bookNames: Record<string, string> = {
      'book-xscreen': 'Escudo do Mestre',
      'book-xphb': 'Livro do Jogador',
      'book-xdmg': 'Guia do Mestre',
      'book-xmm': 'Manual dos Monstros'
  };

  useEffect(() => {
      socket.on('receiveBooks', (data: any) => setBooksData(data));
      socket.emit('requestBooks');
      
      socket.on('combatIntent', (intentData: any) => {
          setPendingIntents(prev => [...prev, intentData]);
          onPlaySFX('notificacao');
      });

      return () => { 
          socket.off('receiveBooks'); 
          socket.off('combatIntent');
      };
  }, [onPlaySFX]);

  const FULL_MONSTER_LIST = [...MONSTER_LIST, ...(customMonsters || [])];
  
  const filteredMonsters = FULL_MONSTER_LIST.filter(m => 
      m.name.toLowerCase().includes(monsterSearch.toLowerCase())
  );

  const targetId = targetEntityIds[0];
  const targetEntity = entities.find(e => e.id === targetId);
  const handleConfirmRequest = () => { if (pendingSkillRequest && targetEntity) { onRequestRoll(targetEntity.id, pendingSkillRequest.skillName, pendingSkillRequest.mod, dcInput); setPendingSkillRequest(null); setDcInput(10); } };
  
  const handleFileUploadPreview = (e: React.ChangeEvent<HTMLInputElement>) => { 
      const file = e.target.files?.[0]; 
      if (file) { 
          const reader = new FileReader(); 
          reader.onload = (event) => { 
              if (event.target?.result) {
                  const mapName = file.name.replace(/\.[^/.]+$/, "");
                  setPreviewMap({ url: event.target.result as string, name: mapName });
              }
          }; 
          reader.readAsDataURL(file); 
      } 
  };
  
  const handleUrlPreview = () => { 
      if (customMapUrl.trim()) { 
          setPreviewMap({ url: customMapUrl, name: 'Mapa da Web' });
          setCustomMapUrl(''); 
      } 
  };

  const handleConfirmNewMap = () => {
      if (previewMap && previewMap.name.trim()) {
          setMapList(prev => [...prev, { name: previewMap.name, url: previewMap.url }]);
          onChangeMap(previewMap.url);
          setPreviewMap(null);
      }
  };

  const handleDragStart = (e: React.DragEvent, type: 'enemy' | 'player', preset?: MonsterPreset) => { 
      e.dataTransfer.setData("entityType", type); 
      if (preset) {
          e.dataTransfer.setData("application/json", JSON.stringify({ type: 'SPAWN_MONSTER', preset }));
      }
  };

  const handleSelectPreset = (monster: MonsterPreset) => { 
      const count = entities.filter(e => e.name.startsWith(monster.name)).length; 
      const finalName = count > 0 ? `${monster.name} ${count + 1}` : monster.name; 
      onAddEntity('enemy', finalName, monster); 
  };

  const openConditionInfo = (condId: string, label: string) => {
      if (!conditionsData) {
          setDescriptionPanel({ title: label, content: "Base de dados de condições não carregada no momento." });
          return;
      }
      const found = conditionsData.find((c: any) => c.name.toLowerCase() === condId.toLowerCase());
      if (found && found.entries) {
          setDescriptionPanel({ title: label, content: extractTextFromEntries(found.entries) });
      } else {
          setDescriptionPanel({ title: label, content: "Regras não encontradas para esta condição na base de dados." });
      }
  }

  const render5eEntry = (entry: any, idx: number): React.ReactNode => {
      if (!entry) return null;
      if (typeof entry === 'string') {
          const clean = entry.replace(/\{@[a-z]+\s([^|}]+)(?:\|[^}]+)?\}/gi, '$1');
          return <p key={idx} className="text-xs text-gray-300 font-serif mb-2 leading-relaxed">{clean}</p>;
      }
      if (entry.type === 'section' || entry.type === 'entries') {
          return (
              <div key={idx} className="mb-4">
                  <h4 className="text-amber-500 font-black uppercase text-[10px] tracking-widest border-b border-white/10 pb-1 mb-2">{entry.name}</h4>
                  {entry.entries?.map((e: any, i: number) => render5eEntry(e, i))}
              </div>
          );
      }
      if (entry.type === 'table') {
          return (
              <div key={idx} className="overflow-x-auto mb-4 border border-white/10 rounded bg-black/40">
                 <table className="w-full text-left text-xs">
                   <thead className="bg-black/60 text-amber-500">
                     <tr>{entry.colLabels?.map((l: string, i: number) => <th key={i} className="p-2 border-b border-white/10">{l.replace(/\{@[a-z]+\s([^|}]+)(?:\|[^}]+)?\}/gi, '$1')}</th>)}</tr>
                   </thead>
                   <tbody>
                     {entry.rows?.map((rowItem: any, rIdx: number) => {
                         const rowData = Array.isArray(rowItem) ? rowItem : (rowItem.row || []);
                         return (
                             <tr key={rIdx} className="border-t border-white/5 hover:bg-white/5">
                                 {Array.isArray(rowData) && rowData.map((cell, cIdx) => {
                                     let cellContent = '...';
                                     if (typeof cell === 'string') {
                                         cellContent = cell.replace(/\{@[a-z]+\s([^|}]+)(?:\|[^}]+)?\}/gi, '$1');
                                     } else if (typeof cell === 'number') {
                                         cellContent = cell.toString();
                                     } else if (cell && typeof cell === 'object') {
                                         if (cell.roll) {
                                             cellContent = cell.roll.exact !== undefined ? cell.roll.exact.toString() : `${cell.roll.min}-${cell.roll.max}`;
                                         } else if (cell.exact !== undefined) {
                                             cellContent = cell.exact.toString();
                                         } else if (cell.entry) {
                                             cellContent = typeof cell.entry === 'string' ? cell.entry.replace(/\{@[a-z]+\s([^|}]+)(?:\|[^}]+)?\}/gi, '$1') : '...';
                                         }
                                     }
                                     return <td key={cIdx} className="p-2 text-gray-300">{cellContent}</td>;
                                 })}
                             </tr>
                         )
                     })}
                   </tbody>
                 </table>
              </div>
          )
      }
      if (entry.type === 'list') {
          return (
              <ul key={idx} className="list-disc list-inside text-xs text-gray-300 mb-2 pl-2 space-y-1">
                  {entry.items?.map((item: any, i: number) => <li key={i}>{render5eEntry(item, i)}</li>)}
              </ul>
          )
      }
      if (entry.type === 'item') {
          return (
              <div key={idx} className="mb-2">
                  <span className="font-bold text-amber-400 text-xs">{entry.name} </span>
                  {entry.entry ? render5eEntry(entry.entry, 0) : entry.entries?.map((e:any, i:number) => render5eEntry(e, i))}
              </div>
          )
      }
      return null;
  };

  const resolveIntent = (intentId: string, modifier: 'full' | 'half' | 'none') => {
      const intent = pendingIntents.find(i => i.id === intentId);
      if (!intent) return;

      let finalDamage = 0;
      let resolutionMsg = "";

      if (modifier === 'full') {
          finalDamage = intent.rolagemDano;
          resolutionMsg = `💥 O Mestre validou o ataque! **${intent.alvo}** recebe o impacto total de **${finalDamage}** de dano ${intent.tipoDano}.`;
      } else if (modifier === 'half') {
          finalDamage = Math.floor(intent.rolagemDano / 2);
          resolutionMsg = `🛡️ **${intent.alvo}** resistiu em parte! Sofre apenas **${finalDamage}** de dano ${intent.tipoDano}.`;
      } else {
          resolutionMsg = `💨 O Mestre declarou falha! O ataque de **${intent.atacante}** não surtiu efeito em **${intent.alvo}**.`;
      }

      socket.emit('resolve_damage', {
          roomId,
          alvoId: intent.alvoId,
          danoFinal: finalDamage,
          resolucaoMsg: resolutionMsg
      });

      setPendingIntents(prev => prev.filter(i => i.id !== intentId));
  };


  const attacker = entities.find(e => e.id === attackerId) || null;
  const targets = entities.filter(e => targetEntityIds.includes(e.id));
  
  const toggleConditionForAll = useCallback((cond: string) => { 
      if (targets.length > 1) {
          targets.forEach(t => onToggleCondition(t.id, cond));
          if (conditionToast.timeoutId) clearTimeout(conditionToast.timeoutId);
          const tId = setTimeout(() => setConditionToast({visible: false, condId: ''}), 3000);
          setConditionToast({visible: true, condId: cond, timeoutId: tId});
      } else {
          targets.forEach(t => onToggleCondition(t.id, cond)); 
      }
  }, [targets, onToggleCondition, conditionToast.timeoutId]);

  const undoCondition = () => {
      if (conditionToast.condId) {
          targets.forEach(t => onToggleCondition(t.id, conditionToast.condId)); 
          if (conditionToast.timeoutId) clearTimeout(conditionToast.timeoutId);
          setConditionToast({visible: false, condId: ''});
      }
  };
  
  const handleUpdateHP = useCallback((id: number, change: number) => onUpdateHP(id, change), [onUpdateHP]);
  const handleSetTarget = useCallback((id: number | number[] | null, multiSelect?: boolean) => onSetTarget(id, multiSelect), [onSetTarget]);
  const handleSetAttacker = useCallback((id: number | null) => onSetAttacker(id), [onSetAttacker]);
  const handleToggleCondition = useCallback((id: number, condition: string) => onToggleCondition(id, condition), [onToggleCondition]);
  const handleAddXP = useCallback((id: number, amount: number) => { if(onAddXP) onAddXP(id, amount); }, [onAddXP]);
  const handleToggleVisibility = useCallback((id: number) => onToggleVisibility(id), [onToggleVisibility]);
  const handleEditEntity = useCallback((id: number, updates: Partial<Entity>) => onEditEntity(id, updates), [onEditEntity]);
  const handleEditClick = useCallback((entity: Entity) => setEditingEntity(entity), []);
  const handleAddToInitClick = useCallback((entity: Entity) => onAddToInitiative(entity), [onAddToInitiative]);

  const handleDeleteClick = useCallback((entity: Entity) => {
      setConfirmModal({
          isOpen: true,
          title: 'Excluir Entidade',
          message: `Tem certeza que deseja apagar "${entity.name}" do plano de existência? Esta ação não pode ser desfeita.`,
          action: () => { onDeleteEntity(entity.id); setConfirmModal(prev => ({...prev, isOpen: false})); },
          confirmText: 'Apagar',
          confirmColor: 'bg-red-600 hover:bg-red-500'
      });
  }, [onDeleteEntity]);

  const handleNextTurnWrapper = () => {
      if (initiativeList.length > 0) {
          const currentIndex = initiativeList.findIndex(i => i.id === activeTurnId);
          if (currentIndex === initiativeList.length - 1) {
              setRoundCount(prev => prev + 1);
          }
      }
      onNextTurn();
  };

  const handleStartCombatWrapper = (ids: number[]) => {
      setRoundCount(1);
      onStartCombat(ids);
  };

  const handleClearInitiativeWrapper = () => {
      setRoundCount(1);
      onClearInitiative();
  };

  const sidebarStyle = { 
      backgroundColor: '#111', 
      backgroundImage: `url('/assets/bg-couro-sidebar.png')`, 
      backgroundSize: 'cover', 
      backgroundRepeat: 'no-repeat', 
      boxShadow: 'inset 0 0 100px rgba(0,0,0,0.95)', 
      width: isCollapsed ? '0px' : '420px', 
      minWidth: isCollapsed ? '0px' : '420px', 
      maxWidth: isCollapsed ? '0px' : '420px', 
      flex: isCollapsed ? '0 0 0px' : '0 0 420px'
  };

  return (
    <>
      {editingEntity && (<EditEntityModal entity={editingEntity} onSave={onEditEntity} onClose={() => setEditingEntity(null)} />)}
      
      <CustomConfirmModal 
          isOpen={confirmModal.isOpen} 
          title={confirmModal.title} 
          message={confirmModal.message} 
          onConfirm={confirmModal.action} 
          onCancel={() => setConfirmModal(prev => ({...prev, isOpen: false}))} 
          confirmText={confirmModal.confirmText}
          confirmColor={confirmModal.confirmColor}
      />

      {/* 🔴 NOVO: Modal para Iniciar o Combate (Selecionar alvos e Rolar Iniciativa) */}
      {showCombatModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowCombatModal(false)}>
              <div className="bg-[#111] border border-amber-500/30 p-6 rounded-xl shadow-[0_0_40px_rgba(245,158,11,0.2)] w-[400px] max-w-[90vw] animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                  <h3 className="text-amber-500 font-black text-lg mb-2 flex items-center gap-2 uppercase tracking-widest border-b border-amber-900/50 pb-3 shrink-0">
                      <Sword size={20}/> Preparar Combate
                  </h3>
                  <p className="text-gray-400 text-xs mb-4 shrink-0">Selecione os participantes deste confronto. A iniciativa será solicitada automaticamente.</p>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mb-4 space-y-2">
                      {entities.map(ent => (
                          <label key={ent.id} className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${selectedCombatants.includes(ent.id) ? 'bg-amber-900/20 border-amber-500/50' : 'bg-black/50 border-white/5 hover:border-white/20'}`}>
                              <input 
                                  type="checkbox" 
                                  checked={selectedCombatants.includes(ent.id)}
                                  onChange={(e) => {
                                      if (e.target.checked) setSelectedCombatants(prev => [...prev, ent.id]);
                                      else setSelectedCombatants(prev => prev.filter(id => id !== ent.id));
                                  }}
                                  className="accent-amber-500 w-4 h-4 cursor-pointer"
                              />
                              <div className="w-8 h-8 rounded-full overflow-hidden bg-black border border-white/10 shrink-0">
                                  {(ent.tokenImage || ent.image) && <img src={ent.tokenImage || ent.image} alt="" className="w-full h-full object-cover"/>}
                              </div>
                              <span className="text-sm font-bold text-gray-200 truncate">{ent.name}</span>
                              <span className="ml-auto text-[9px] text-gray-500 uppercase tracking-widest shrink-0">{ent.type === 'player' ? 'Jogador' : 'NPC'}</span>
                          </label>
                      ))}
                      {entities.length === 0 && <p className="text-center text-gray-600 text-xs italic py-4">Nenhuma entidade no mapa.</p>}
                  </div>

                  <div className="flex gap-3 pt-3 border-t border-white/10 shrink-0">
                      <button onClick={() => setShowCombatModal(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold uppercase tracking-widest rounded-lg transition-colors border border-white/10">Cancelar</button>
                      <button 
    onClick={() => {
        selectedCombatants.forEach(id => {
            const e = entities.find(x => x.id === id);
            if (e) {
                const attrs = mapEntityStatsToAttributes(e);
                const dexMod = Math.floor((attrs.DES - 10) / 2);
                if (e.type === 'player') {
                    onRequestRoll(id, 'Iniciativa', dexMod, 0); 
                } else if (onQueueInitiativeRoll) {
                    onQueueInitiativeRoll(id, e.name, dexMod);
                }
            }
        });
        onSendMessage(`⚔️ **INICIATIVA ROLADA!**\n> O Mestre iniciou um novo combate! Todos os participantes devem rolar suas iniciativas.`);
        handleStartCombatWrapper(selectedCombatants);
        setShowCombatModal(false);
    }} 
    disabled={selectedCombatants.length === 0}
    className="flex-[1.5] py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:grayscale text-black text-xs font-black uppercase tracking-widest rounded-lg transition-all shadow-[0_0_15px_rgba(245,158,11,0.4)] active:scale-95"
>
    Iniciar ({selectedCombatants.length})
</button>
                  </div>
              </div>
          </div>
      )}
      
      {isUniversalRollerOpen && (
          <UniversalDiceRoller 
              isOpen={isUniversalRollerOpen}
              onClose={() => setIsUniversalRollerOpen(false)}
              title={customRollTitle || "Rolagem do Mestre"}
              subtitle={customRollExpr || "Dados Livres"}
              difficultyClass={10}
              baseModifier={0}
              proficiency={0}
              isDamage={true}
              damageExpression={customRollExpr || "1d100"}
              onComplete={(t: number, s: boolean, c: boolean, sec: boolean) => {
                 setIsUniversalRollerOpen(false); 
              }}
          />
      )}

      {pendingSkillRequest && targetEntity && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setPendingSkillRequest(null)}>
              <div className="bg-[#15151a] border border-purple-500/50 p-6 rounded-lg shadow-2xl w-80 animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                  <h3 className="text-purple-400 font-bold text-center uppercase tracking-widest mb-1">Solicitar Teste</h3>
                  <p className="text-white text-center font-serif text-xl mb-4">{pendingSkillRequest.skillName}</p>
                  <div className="bg-black/40 p-3 rounded mb-4 text-center">
                      <p className="text-xs text-gray-400 mb-1">Alvo</p>
                      <p className="text-white font-bold">{targetEntity.name}</p>
                  </div>
                  
                  <div className="flex justify-center mb-2">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-700 border border-purple-500/50 shadow-lg">
                          {(targetEntity.tokenImage || targetEntity.image) && <img src={targetEntity.tokenImage || targetEntity.image} className="w-full h-full object-cover" alt="" />}
                      </div>
                  </div>

                  <div className="mb-6 text-center">
                      <label className="block text-xs text-yellow-500 font-bold mb-2 uppercase">Classe de Dificuldade (CD)</label>
                      <div className="flex items-center justify-center gap-4">
                          <button onClick={() => setDcInput(Math.max(5, dcInput - 5))} className="w-8 h-8 rounded bg-gray-800 text-white hover:bg-gray-700">-5</button>
                          <input type="number" value={dcInput} onChange={(e) => setDcInput(parseInt(e.target.value) || 10)} className="w-16 bg-black border border-yellow-600/50 text-center text-2xl font-bold text-yellow-500 rounded p-1"/>
                          <button onClick={() => setDcInput(dcInput + 5)} className="w-8 h-8 rounded bg-gray-800 text-white hover:bg-gray-700">+5</button>
                      </div>
                  </div>
                  <button onClick={handleConfirmRequest} className="w-full py-3 bg-gradient-to-r from-purple-700 to-indigo-800 text-white font-bold uppercase tracking-widest rounded shadow-lg hover:brightness-110 transition-all">Exigir Rolagem</button>
              </div>
          </div>
      )}

      {pendingIntents.length > 0 && !isCollapsed && (
          <div className="absolute top-20 -left-[320px] w-[300px] z-[500] flex flex-col gap-3">
              {pendingIntents.map(intent => (
                  <div key={intent.id} className="bg-[#111] border-2 border-amber-600 rounded-xl p-4 shadow-[0_0_30px_rgba(217,119,6,0.3)] animate-in slide-in-from-right duration-300">
                      <div className="flex justify-between items-center border-b border-amber-900/50 pb-2 mb-2">
                          <span className="text-[10px] text-amber-500 font-black uppercase tracking-widest flex items-center gap-2"><AlertTriangle size={14}/> Resolução Pendente</span>
                      </div>
                      
                      <p className="text-xs text-gray-300 mb-1">⚔️ Atacante: <strong className="text-white">{intent.atacante}</strong></p>
                      <p className="text-xs text-gray-300 mb-1">🎯 Alvo: <strong className="text-white">{intent.alvo} (CA {intent.alvoAc})</strong></p>
                      <p className="text-xs text-gray-300 mb-3">💥 Dano Proposto: <strong className="text-red-400 text-lg">{intent.rolagemDano}</strong> <span className="text-[10px] uppercase">({intent.tipoDano})</span></p>

                      <div className="flex flex-col gap-2">
                          <button onClick={() => resolveIntent(intent.id, 'full')} className="w-full bg-red-700 hover:bg-red-600 text-white font-bold text-xs py-2 rounded shadow-sm transition-colors">
                              Aplicar Dano Total ({intent.rolagemDano})
                          </button>
                          <div className="flex gap-2">
                              <button onClick={() => resolveIntent(intent.id, 'half')} className="flex-1 bg-amber-700 hover:bg-amber-600 text-white font-bold text-xs py-2 rounded shadow-sm transition-colors">
                                  Resistiu ({Math.floor(intent.rolagemDano / 2)})
                              </button>
                              <button onClick={() => resolveIntent(intent.id, 'none')} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold text-xs py-2 rounded shadow-sm transition-colors">
                                  Errou / Recusar
                              </button>
                          </div>
                      </div>
                  </div>
              ))}
          </div>
      )}

      <div className="flex flex-col h-full border-l border-white/5 relative z-[140] transition-all duration-300 ease-in-out" style={sidebarStyle}>
        
        <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute top-1/2 -left-8 transform -translate-y-1/2 w-8 h-20 bg-[#1a1a1a] border-y border-l border-amber-900/50 rounded-l-xl flex items-center justify-center text-amber-500 hover:text-amber-400 hover:bg-black cursor-pointer shadow-[-5px_0_15px_rgba(0,0,0,0.8)] z-[200] transition-colors"
        >
            {isCollapsed ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>

        <div className="relative w-[420px] h-full flex flex-col overflow-hidden">
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/40 via-black/10 to-black/60 z-0 backdrop-blur-[2px]" />
            
            {descriptionPanel && <DescriptionPanel title={descriptionPanel.title} description={descriptionPanel.content} onClose={() => setDescriptionPanel(null)} />}

            <div className="relative z-10 flex flex-col h-full w-full">
                <div className="flex bg-black/60 backdrop-blur-md flex-shrink-0 relative">
                    <div className="absolute bottom-0 left-0 w-full h-[1px] bg-white/10"></div>
                    <button onClick={() => setMainTab('tools')} className={`flex-1 py-3 text-center text-xs font-black uppercase tracking-[0.2em] transition-all relative ${mainTab === 'tools' ? 'text-amber-500' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
                        🛠️ Ferramentas
                        {mainTab === 'tools' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]"></div>}
                    </button>
                    <button onClick={() => setMainTab('chat')} className={`flex-1 py-3 text-center text-xs font-black uppercase tracking-[0.2em] transition-all relative ${mainTab === 'chat' ? 'text-amber-500' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
                        💬 Chat
                        {mainTab === 'chat' && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]"></div>}
                    </button>
                </div>

                <div className={`flex-1 min-h-0 flex-col w-full relative z-20 bg-black/30 backdrop-blur-sm ${mainTab === 'chat' ? 'flex' : 'hidden'}`}>
                    <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-black/60 shrink-0">
                        <p className="text-[9px] text-gray-500 font-mono italic">Canal Global</p>
                        <span className="text-[9px] text-amber-500 font-black font-mono uppercase tracking-[0.2em]">Mestre On-line</span>
                    </div>
                    <div className="flex-1 w-full max-w-full overflow-hidden">
                        <Chat 
                            messages={chatMessages} 
                            onSendMessage={onSendMessage} 
                            role="DM" 
                            onApplyDamage={onApplyDamageFromChat} 
                        />
                    </div>
                </div>

                <div className={`flex-1 min-h-0 flex-col w-full ${mainTab === 'tools' ? 'flex' : 'hidden'}`}>
                    <div className="flex bg-black/60 backdrop-blur-md flex-shrink-0 relative border-b border-white/5">
                        <button onClick={() => setActiveTab('combat')} className={`flex-1 py-2.5 text-center text-lg transition-all ${activeTab === 'combat' ? 'text-amber-500 bg-white/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} title="Combate">⚔️</button>
                        <button onClick={() => setActiveTab('map')} className={`flex-1 py-2.5 text-center text-lg transition-all ${activeTab === 'map' ? 'text-amber-500 bg-white/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} title="Mapa">🗺️</button>
                        <button onClick={() => setActiveTab('tools')} className={`flex-1 py-2.5 text-center text-lg transition-all ${activeTab === 'tools' ? 'text-amber-500 bg-white/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} title="Forja e Dados">🔨</button>
                        <button onClick={() => setActiveTab('campaign')} className={`flex-1 py-2.5 text-center text-lg transition-all ${activeTab === 'campaign' ? 'text-amber-500 bg-white/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} title="Campanha">📜</button>
                        <button onClick={() => setActiveTab('create')} className={`flex-1 py-2.5 text-center text-lg transition-all ${activeTab === 'create' ? 'text-amber-500 bg-white/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} title="Bestiário">🐉</button>
                        <button onClick={() => setActiveTab('audio')} className={`flex-1 py-2.5 text-center text-lg transition-all ${activeTab === 'audio' ? 'text-amber-500 bg-white/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} title="Áudio">🔊</button>
                        <button onClick={() => setActiveTab('rules')} className={`flex-1 py-2.5 text-center text-lg transition-all ${activeTab === 'rules' ? 'text-amber-500 bg-white/5' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} title="Biblioteca (Codex 5e)">📖</button>
                    </div>

                    <div className="flex-grow overflow-y-auto p-4 custom-scrollbar w-full relative">
                        
                        {activeTab === 'rules' && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6 h-full flex flex-col">
                                <div className="bg-black/60 backdrop-blur-xl rounded-2xl shadow-2xl border border-amber-900/30 p-5 relative overflow-hidden flex flex-col flex-1">
                                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.05)_0%,transparent_70%)] pointer-events-none"></div>
                                    
                                    <h3 className="text-amber-500 font-black text-[11px] uppercase tracking-[0.2em] mb-4 flex items-center gap-2 relative z-10 border-b border-amber-900/30 pb-3 shrink-0">
                                        <BookText size={16} /> Biblioteca Nexus (Codex 5e)
                                    </h3>

                                    <div className="relative z-10 flex flex-col flex-1 overflow-hidden">
                                        {!booksData ? (
                                            <div className="flex flex-col items-center justify-center py-10 opacity-50">
                                                <BookOpen size={40} className="mb-4 animate-pulse" />
                                                <p className="text-gray-400 text-xs italic text-center">Buscando tomos ancestrais no servidor...</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 mb-3 shrink-0">
                                                    {Object.keys(booksData).map(bookKey => (
                                                        <button 
                                                            key={bookKey}
                                                            onClick={() => { setActiveBookKey(bookKey); setActiveChapterIndex(0); }}
                                                            className={`px-3 py-1.5 rounded-lg whitespace-nowrap text-[10px] font-bold uppercase tracking-widest transition-colors border ${activeBookKey === bookKey ? 'bg-amber-600/20 border-amber-500 text-amber-400 shadow-[inset_0_0_10px_rgba(245,158,11,0.2)]' : 'bg-black border-white/10 text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                                                        >
                                                            {bookNames[bookKey] || bookKey}
                                                        </button>
                                                    ))}
                                                </div>

                                                {booksData[activeBookKey]?.data && booksData[activeBookKey].data.length > 1 && (
                                                    <div className="mb-4 shrink-0">
                                                        <select 
                                                            value={activeChapterIndex} 
                                                            onChange={(e) => setActiveChapterIndex(Number(e.target.value))}
                                                            className="w-full bg-black/80 border border-white/10 rounded-lg p-2.5 text-xs text-amber-100 font-bold outline-none focus:border-amber-500 shadow-inner"
                                                        >
                                                            {booksData[activeBookKey].data.map((chapter: any, idx: number) => (
                                                                <option key={idx} value={idx}>{chapter.name || `Capítulo ${idx + 1}`}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}

                                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4">
                                                    {booksData[activeBookKey]?.data?.[activeChapterIndex]?.entries?.map((e: any, i: number) => render5eEntry(e, i))}
                                                    {(!booksData[activeBookKey]?.data?.[activeChapterIndex]?.entries) && (
                                                        <p className="text-gray-500 text-xs italic text-center py-10">Este capítulo está vazio ou não pôde ser lido.</p>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'combat' && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-5 pb-10">
                                
                                <div className="bg-black/60 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden relative">
                                    <div className="absolute inset-0 pointer-events-none rounded-2xl shadow-[inset_0_0_30px_rgba(245,158,11,0.05)]"></div>
                                    <div className="flex items-center justify-between p-3 border-b border-white/5 bg-gradient-to-r from-amber-900/20 to-transparent relative z-10">
                                        <span className="text-amber-500 font-black text-[11px] uppercase tracking-[0.2em] flex items-center gap-2">
                                            ⚔️ MESA DE COMBATE
                                        </span>
                                        <button 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setSelectedCombatants(targetEntityIds.length > 0 ? targetEntityIds : entities.filter(e => e.type === 'player').map(e => e.id));
                                                setShowCombatModal(true); 
                                            }} 
                                            className="bg-amber-600 hover:bg-amber-500 text-black text-[9px] px-3 py-1.5 rounded-lg font-black uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(217,119,6,0.3)] active:scale-95"
                                        >
                                            INICIAR COMBATE
                                        </button>
                                    </div>
                                    <div className="p-4 relative z-10">
                                        <CombatVsPanel attacker={attacker} targets={targets} onUpdateHP={onUpdateHP} onSendMessage={onSendMessage} onDMRoll={onDMRoll} onRequestRoll={onRequestRoll} />
                                    </div>
                                </div>

                                <div className="bg-black/60 backdrop-blur-xl border border-amber-900/30 rounded-2xl flex flex-col overflow-hidden relative shadow-2xl">
                                    <div className="flex justify-between items-center p-3 border-b border-amber-900/30 bg-gradient-to-r from-amber-900/10 to-transparent">
                                        <h3 className="text-amber-500 font-black text-[11px] uppercase tracking-[0.2em] flex items-center gap-2">
                                            ⚡ INICIATIVA - RODADA {roundCount}
                                        </h3>
                                        <div className="flex gap-2">
                                            <button onClick={onSortInitiative} className="text-[9px] bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1 rounded text-gray-300 font-bold uppercase tracking-widest transition-colors">Sort</button>
                                            <button onClick={handleClearInitiativeWrapper} className="text-[9px] bg-red-950/50 hover:bg-red-900 border border-red-900/50 px-3 py-1 rounded text-red-200 font-bold uppercase tracking-widest transition-colors">Limpar</button>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 max-h-60">
                                        {initiativeList.length > 0 ? (
                                            <div className="flex flex-col gap-1.5">
                                                {initiativeList.map((item:any, i:number) => {
                                                    const ent = entities.find(e => e.id === item.id);
                                                    const hpPercent = ent ? Math.max(0, Math.min(100, (ent.hp / ent.maxHp) * 100)) : 0;
                                                    
                                                    let hpStatusColor = 'bg-gray-500';
                                                    if (hpPercent > 50) hpStatusColor = 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]';
                                                    else if (hpPercent > 20) hpStatusColor = 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]';
                                                    else if (hpPercent > 0) hpStatusColor = 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse';
                                                    else hpStatusColor = 'bg-black border-2 border-red-900';

                                                    return (
                                                    <div 
                                                        key={i} 
                                                        className={`flex justify-between items-center p-2 rounded-xl text-xs cursor-pointer border backdrop-blur-sm transition-all duration-300 ${item.id === activeTurnId ? 'bg-gradient-to-r from-amber-900/40 to-black/40 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)] scale-[1.02]' : 'bg-white/5 border-transparent hover:bg-white/10'} ${attackerId === item.id ? 'shadow-[inset_3px_0_0_#3b82f6]' : ''} ${targetEntityIds.includes(item.id) ? 'shadow-[inset_-3px_0_0_#ef4444]' : ''}`} 
                                                        onClick={() => onSetAttacker(item.id)} 
                                                        onContextMenu={(e) => { e.preventDefault(); onSetTarget(item.id, e.shiftKey); }} 
                                                        title="Esquerdo: Selecionar Atacante | Direito: Selecionar Alvo"
                                                    >
                                                        <div className="flex items-center gap-3 overflow-hidden flex-1 pl-1">
                                                            <span className={`font-black text-[10px] w-6 text-center ${item.id === activeTurnId ? 'text-amber-400' : 'text-gray-500'}`}>{item.value}</span>
                                                            
                                                            {item.id === activeTurnId && (
                                                                <span className="bg-amber-500/20 text-amber-400 text-[8px] font-black px-1.5 py-0.5 rounded border border-amber-500/50 animate-pulse shrink-0">AGINDO</span>
                                                            )}

                                                            {ent && (
                                                                <div className={`w-2.5 h-2.5 rounded-full ${hpStatusColor} shrink-0 flex items-center justify-center`}>
                                                                    {ent.hp <= 0 && <Skull size={8} className="text-red-500" />}
                                                                </div>
                                                            )}

                                                            <span className={`truncate text-[11px] uppercase tracking-wide ${item.id === activeTurnId ? 'text-amber-100 font-black' : 'text-gray-300 font-bold'}`}>{item.name}</span>
                                                            
                                                            {ent && ent.conditions && ent.conditions.length > 0 && (
                                                                <div className="flex gap-1 shrink-0 ml-1">
                                                                    {ent.conditions.map((c: string, idx: number) => {
                                                                        const icon = CONDITION_MAP.find(cm => cm.id === c)?.icon;
                                                                        return icon ? <span key={idx} className="text-[10px] filter drop-shadow-md leading-none" title={c}>{icon}</span> : null;
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            {ent && (
                                                                <button onClick={(e) => { e.stopPropagation(); onToggleVisibility(ent.id); }} className={`p-1.5 hover:bg-black/60 rounded-lg transition-colors ${ent.visible === false ? 'text-white/20' : 'text-cyan-400'}`}>
                                                                    {ent.visible === false ? <EyeOff size={12}/> : <Eye size={12}/>}
                                                                </button>
                                                            )}
                                                            <button onClick={(e) => { e.stopPropagation(); onRemoveFromInitiative(item.id); }} className="text-gray-600 hover:text-red-500 p-1.5 hover:bg-red-950/50 rounded-lg transition-colors font-bold">✕</button>
                                                        </div>
                                                    </div>
                                                )})}
                                            </div>
                                        ) : (
                                            <p className="text-center text-gray-500 text-xs py-4 italic font-serif">A batalha aguarda o primeiro movimento...</p>
                                        )}
                                    </div>
                                    {initiativeList.length > 0 && (
                                        <div className="p-2 border-t border-amber-900/30 bg-black/40">
                                            <button onClick={handleNextTurnWrapper} className="w-full py-3 bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-xl shadow-[0_0_15px_rgba(217,119,6,0.3)] transition-all active:scale-95">Próximo Turno ⏩</button>
                                        </div>
                                    )}
                                </div>

                                <CollapsibleSection title="Entidades no Mapa" icon={Activity}>
                                    <div className="p-2 space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                                        {entities.map((entity) => (
                                          <EntityControlRow 
                                            key={entity.id} 
                                            entity={entity} 
                                            onUpdateHP={handleUpdateHP} 
                                            onDeleteEntity={handleDeleteClick} 
                                            onClickEdit={handleEditClick} 
                                            onAddToInit={handleAddToInitClick} 
                                            isTarget={targetEntityIds.includes(entity.id)} 
                                            isAttacker={attackerId === entity.id} 
                                            onSetTarget={handleSetTarget} 
                                            onSetAttacker={handleSetAttacker} 
                                            onToggleCondition={handleToggleCondition} 
                                            onAddXP={handleAddXP} 
                                            onToggleVisibility={handleToggleVisibility} 
                                            onEditEntity={handleEditEntity}
                                            CONDITION_MAP={CONDITION_MAP}
                                          />
                                        ))}
                                    </div>
                                </CollapsibleSection>

                                <CollapsibleSection title="Condições" icon={ShieldAlert}>
                                    <div className="p-2 bg-black/20 relative">
                                        <div className="grid grid-cols-3 gap-2">
                                            {CONDITION_MAP.map(cond => (
                                                <button 
                                                    key={cond.id}
                                                    onClick={() => toggleConditionForAll(cond.id)}
                                                    onContextMenu={(e) => { e.preventDefault(); openConditionInfo(cond.id, cond.label); }}
                                                    title={`Botão Esquerdo: Aplicar Condição\nBotão Direito: Ver Regras de ${cond.label}`}
                                                    className={`flex flex-col items-center justify-center gap-1.5 p-2 ${cond.bg} border ${cond.border} rounded-lg transition-all active:scale-95 shadow-inner hover:shadow-lg w-full text-center`}
                                                >
                                                    <span className="text-xl filter drop-shadow-md leading-none">{cond.icon}</span>
                                                    <span className={`text-[8px] font-black ${cond.text} uppercase tracking-widest truncate w-full`}>{cond.label}</span>
                                                </button>
                                            ))}
                                        </div>

                                        {conditionToast.visible && (
                                            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-[#111] border border-blue-500 p-2 rounded-lg shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                                <span className="text-[9px] text-blue-300 font-black uppercase tracking-widest whitespace-nowrap">Condição Aplicada!</span>
                                                <button onClick={undoCondition} className="flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-white text-[9px] uppercase tracking-widest font-bold transition-colors">
                                                    <Undo2 size={10}/> Desfazer
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </CollapsibleSection>

                                <CollapsibleSection title="Áreas (AoE)">
                                    <div className="p-3 flex flex-col items-center bg-black/20">
                                        <AoEColorPicker selected={aoeColor} onSelect={onSetAoEColor} />
                                        <div className="flex gap-2 w-full mt-4">
                                                <button onClick={() => onSetAoE(activeAoE === 'circle' ? null : 'circle')} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex flex-col items-center justify-center gap-1.5 ${activeAoE === 'circle' ? 'border-white text-white bg-white/10 shadow-[inset_0_0_15px_rgba(255,255,255,0.1)]' : 'border-white/5 text-gray-500 hover:bg-white/5'}`} style={activeAoE === 'circle' ? {borderColor: aoeColor, color: aoeColor, textShadow: `0 0 10px ${aoeColor}`} : {}}><span className="text-lg">⭕</span> Círculo</button>
                                                <button onClick={() => onSetAoE(activeAoE === 'cone' ? null : 'cone')} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex flex-col items-center justify-center gap-1.5 ${activeAoE === 'cone' ? 'border-white text-white bg-white/10 shadow-[inset_0_0_15px_rgba(255,255,255,0.1)]' : 'border-white/5 text-gray-500 hover:bg-white/5'}`} style={activeAoE === 'cone' ? {borderColor: aoeColor, color: aoeColor, textShadow: `0 0 10px ${aoeColor}`} : {}}><span className="text-lg">🔺</span> Cone</button>
                                                <button onClick={() => onSetAoE(activeAoE === 'cube' ? null : 'cube')} className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex flex-col items-center justify-center gap-1.5 ${activeAoE === 'cube' ? 'border-white text-white bg-white/10 shadow-[inset_0_0_15px_rgba(255,255,255,0.1)]' : 'border-white/5 text-gray-500 hover:bg-white/5'}`} style={activeAoE === 'cube' ? {borderColor: aoeColor, color: aoeColor, textShadow: `0 0 10px ${aoeColor}`} : {}}><span className="text-lg">🟥</span> Cubo</button>
                                        </div>
                                    </div>
                                </CollapsibleSection>

                            </div>
                        )}

                        {activeTab === 'tools' && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                                
                                <div className="bg-black/60 backdrop-blur-xl p-5 rounded-2xl border border-white/5 shadow-2xl relative overflow-hidden">
                                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.1)_0%,transparent_70%)] pointer-events-none"></div>
                                    <h3 className="text-amber-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2 relative z-10">
                                        <span className="text-base">🎲</span> Rolar Dados 3D
                                    </h3>
                                    <button 
                                        onClick={() => {
                                            setCustomRollTitle('Rolagem do Mestre');
                                            setCustomRollExpr('1d20');
                                            setIsUniversalRollerOpen(true);
                                        }} 
                                        className="w-full py-4 bg-gradient-to-r from-amber-700 to-yellow-600 hover:from-amber-600 hover:to-yellow-500 text-black font-black uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all active:scale-95 border border-yellow-400/50 flex items-center justify-center gap-2 relative z-10"
                                    >
                                        Abrir Dado Universal
                                    </button>
                                </div>

                                <div className="bg-black/60 backdrop-blur-xl p-5 rounded-2xl border border-white/5 shadow-2xl relative overflow-hidden">
                                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.1)_0%,transparent_70%)] pointer-events-none"></div>
                                    <h3 className="text-purple-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2 relative z-10">
                                        <span className="text-base animate-pulse">⚡</span> Forçar Rolagem em Alvos
                                    </h3>
                                    <div className="flex flex-col gap-3 mb-4 relative z-10">
                                        <input 
                                            type="text" 
                                            value={customRollTitle} 
                                            onChange={(e) => setCustomRollTitle(e.target.value)} 
                                            placeholder="Motivo (ex: Bola de Fogo)" 
                                            className="w-full bg-black/80 border border-white/10 rounded-lg p-3 text-xs text-white outline-none focus:border-purple-500 transition-colors shadow-inner" 
                                        />
                                        <input 
                                            type="text" 
                                            value={customRollExpr} 
                                            onChange={(e) => setCustomRollExpr(e.target.value)} 
                                            placeholder="Dado (ex: 8d6)" 
                                            className="w-full bg-black/80 border border-white/10 rounded-lg p-3 text-xs text-purple-200 outline-none focus:border-purple-500 font-mono transition-colors shadow-inner" 
                                        />
                                    </div>
                                    <button 
                                        onClick={() => {
                                            if (targetEntityIds.length > 0 && onRequestCustomRoll) {
                                                onRequestCustomRoll(targetEntityIds, customRollExpr, customRollTitle);
                                            } else {
                                                setIsUniversalRollerOpen(true);
                                            }
                                        }} 
                                        className="w-full py-3 bg-gradient-to-r from-purple-800 to-indigo-900 hover:from-purple-700 hover:to-indigo-800 text-white font-bold uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-95 text-[10px] border border-purple-500/30 relative z-10"
                                    >
                                        {targetEntityIds.length > 0 ? `Forçar em ${targetEntityIds.length} Alvo(s)` : 'Rolar para Mim (Mestre)'}
                                    </button>
                                </div>

                                <div className="bg-black/60 backdrop-blur-xl p-5 rounded-2xl border border-white/5 shadow-2xl relative overflow-hidden">
                                    <h3 className="text-cyan-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4 relative z-10">Teste de Perícia</h3>
                                    {targetEntity ? (
                                        <div className="relative z-10">
                                            <div className="mb-4 flex items-center gap-3 bg-cyan-950/30 border border-cyan-900/50 p-3 rounded-xl shadow-inner">
                                                <div className="w-10 h-10 rounded-full overflow-hidden bg-black border border-cyan-500/50">{targetEntity.image && <img src={targetEntity.tokenImage || targetEntity.image} className="w-full h-full object-cover" alt="" />}</div>
                                                <div><p className="text-sm font-black text-white tracking-wide">{targetEntity.name}</p><p className="text-[9px] text-cyan-500 uppercase tracking-widest font-bold">Alvo Selecionado</p></div>
                                            </div>
                                            <SkillList attributes={mapEntityStatsToAttributes(targetEntity)} proficiencyBonus={2} profs={[]} isDmMode={true} onRoll={(skillName, mod) => setPendingSkillRequest({ skillName, mod })}/>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-6 bg-white/5 rounded-xl border border-dashed border-white/10 relative z-10">
                                            <ShieldAlert size={24} className="text-gray-600 mb-2" />
                                            <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest text-center">Selecione um Alvo<br/>para exigir testes</p>
                                        </div>
                                    )}
                                </div>

                                <ItemCreator 
                                    onCreateItem={(item) => targetEntity && onGiveItem(targetEntity.id, item)} 
                                    targetName={targetEntity?.name}
                                    availableItems={availableItems}
                                />
                                <Scratchpad />
                            </div>
                        )}

                        {activeTab === 'campaign' && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                                <CampaignManager />
                                
                                <section className="bg-black/60 backdrop-blur-xl border border-orange-900/30 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
                                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(249,115,22,0.1)_0%,transparent_70%)] pointer-events-none"></div>
                                    <h3 className="text-orange-500 font-black text-[10px] uppercase tracking-[0.2em] mb-3 border-b border-orange-900/30 pb-3 relative z-10">Gerenciar Grupo</h3>
                                    <p className="text-xs text-gray-400 mb-5 font-serif leading-relaxed relative z-10">Cura completamente todos os aventureiros da mesa e restaura seus espaços de magia e habilidades diárias.</p>
                                    <button 
                                        onClick={() => {
                                            setConfirmModal({
                                                isOpen: true,
                                                title: 'Acampamento Seguro',
                                                message: 'Os heróis montaram acampamento para um descanso longo? Esta ação irá curar totalmente todos os jogadores e restaurar magias.',
                                                action: () => { onLongRest(); setConfirmModal(prev => ({...prev, isOpen: false})); },
                                                confirmText: 'Realizar Descanso Longo',
                                                confirmColor: 'bg-orange-600 hover:bg-orange-500'
                                            });
                                        }} 
                                        className="w-full py-4 bg-gradient-to-r from-orange-900 to-amber-900 hover:from-orange-800 hover:to-amber-800 border border-orange-500/50 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(249,115,22,0.2)] flex items-center justify-center gap-2 active:scale-95 relative z-10"
                                    >
                                        <Tent size={18} /> Acampamento Seguro
                                    </button>
                                </section>
                            </div>
                        )}

                        {activeTab === 'map' && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                                
                                <section className="bg-black/60 backdrop-blur-xl p-5 rounded-2xl border border-blue-900/30 shadow-2xl relative overflow-hidden">
                                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.1)_0%,transparent_70%)] pointer-events-none"></div>
                                    <h3 className="text-blue-400 font-black text-[10px] uppercase mb-4 tracking-[0.2em] flex items-center gap-2 relative z-10"><ImageIcon size={14}/> Carregar Novo Mapa</h3>
                                    
                                    {!previewMap ? (
                                        <div className="relative z-10">
                                            <div className="flex gap-2 mb-4">
                                                <input type="text" placeholder="Cole o link da imagem (URL)..." className="w-full bg-black/80 border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-blue-500 shadow-inner transition-colors" value={customMapUrl} onChange={(e) => setCustomMapUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleUrlPreview()} />
                                                <button onClick={handleUrlPreview} className="bg-blue-700 hover:bg-blue-600 text-white font-bold px-4 rounded-lg text-[10px] uppercase tracking-widest transition-colors disabled:opacity-50" disabled={!customMapUrl.trim()}>Testar</button>
                                            </div>
                                            <div className="flex items-center justify-center mb-4 opacity-50">
                                                <div className="h-px bg-white flex-1"></div>
                                                <span className="text-[9px] text-white uppercase px-3 font-black tracking-widest">Ou Local</span>
                                                <div className="h-px bg-white flex-1"></div>
                                            </div>
                                            <input type="file" ref={fileInputRef} onChange={handleFileUploadPreview} className="hidden" accept="image/*" />
                                            <button onClick={() => fileInputRef.current?.click()} className="w-full bg-black/80 hover:bg-blue-950/50 border border-blue-500/30 text-blue-300 font-black py-3.5 rounded-xl uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 shadow-lg hover:border-blue-400 active:scale-95">📂 Selecionar Arquivo</button>
                                        </div>
                                    ) : (
                                        <div className="animate-in zoom-in-95 duration-200 relative z-10">
                                            <div className="w-full h-36 rounded-xl overflow-hidden border border-blue-500/50 mb-4 shadow-[0_0_20px_rgba(59,130,246,0.2)] relative">
                                                <img src={previewMap.url} alt="Preview" className="w-full h-full object-cover opacity-80" />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent flex items-end p-3">
                                                    <span className="text-[10px] text-blue-300 font-black tracking-[0.2em] uppercase">Pré-visualização</span>
                                                </div>
                                            </div>
                                            
                                            <div className="mb-4">
                                                <label className="text-[9px] text-gray-400 uppercase tracking-widest font-bold mb-1.5 block">Nome do Botão:</label>
                                                <input autoFocus type="text" className="w-full bg-black/80 border border-white/10 rounded-lg p-2.5 text-sm text-white font-bold outline-none focus:border-blue-500 shadow-inner" value={previewMap.name} onChange={(e) => setPreviewMap({...previewMap, name: e.target.value})} />
                                            </div>

                                            <div className="flex gap-2">
                                                <button onClick={() => setPreviewMap(null)} className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-[10px] font-black uppercase tracking-widest py-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors active:scale-95"><X size={14}/> Descartar</button>
                                                <button onClick={handleConfirmNewMap} className="flex-[1.5] bg-blue-700 hover:bg-blue-600 border border-blue-50 text-white text-[10px] font-black uppercase tracking-widest py-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-[0_0_15px_rgba(59,130,246,0.3)] active:scale-95"><Check size={14}/> Salvar & Abrir</button>
                                            </div>
                                        </div>
                                    )}
                                </section>

                                <section className="bg-black/60 backdrop-blur-xl p-5 rounded-2xl border border-white/5 shadow-2xl relative">
                                    <h3 className="text-gray-400 font-mono text-[10px] uppercase mb-4 tracking-[0.2em] font-black">Mapas Salvos</h3>
                                    <div className="grid grid-cols-2 gap-2 max-h-[250px] overflow-y-auto custom-scrollbar pr-1 relative z-10">
                                        {mapList.map((map, idx) => (
                                            <button key={idx} onClick={() => onChangeMap(map.url)} className="bg-black/50 hover:bg-blue-900/20 border border-white/5 hover:border-blue-500/50 text-gray-400 hover:text-blue-100 text-[10px] font-bold uppercase tracking-wider py-4 px-2 rounded-xl transition-all active:scale-95 truncate shadow-inner">
                                                {map.name}
                                            </button>
                                        ))}
                                    </div>
                                </section>

                                <section className="bg-black/60 backdrop-blur-xl p-5 rounded-2xl border border-yellow-900/30 shadow-2xl relative overflow-hidden">
                                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(234,179,8,0.05)_0%,transparent_70%)] pointer-events-none"></div>
                                    <h3 className="text-yellow-500 font-black text-[10px] uppercase mb-4 tracking-[0.2em] relative z-10">Iluminação Global</h3>
                                    <div className="relative z-10">
                                            <div className="flex justify-between items-center mb-2 px-1">
                                                <span className="text-[11px] font-black tracking-widest uppercase text-yellow-400">{globalBrightness >= 1 ? '☀️ Pleno Dia' : globalBrightness <= 0.2 ? '🌑 Escuridão' : '🌅 Crepúsculo'}</span>
                                                <span className="text-[10px] text-gray-500 font-mono font-bold">{Math.round(globalBrightness * 100)}%</span>
                                            </div>
                                            <input type="range" min="0" max="1" step="0.05" value={globalBrightness} onChange={(e) => onSetGlobalBrightness && onSetGlobalBrightness(parseFloat(e.target.value))} className="w-full h-2 bg-black border border-white/10 shadow-inner rounded-lg appearance-none cursor-pointer accent-yellow-500"/>
                                    </div>
                                </section>
                                
                                <section className="bg-black/60 backdrop-blur-xl p-5 rounded-2xl border border-purple-900/30 shadow-2xl relative overflow-hidden">
                                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.05)_0%,transparent_70%)] pointer-events-none"></div>
                                    <h3 className="text-purple-400 font-black text-[10px] uppercase mb-4 tracking-[0.2em] relative z-10">Neblina de Guerra</h3>
                                    <div className="flex flex-col gap-3 relative z-10">
                                            <button onClick={onToggleFogMode} className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border transition-all active:scale-95 ${isFogMode ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]' : 'bg-black border-white/10 text-gray-400 hover:bg-white/5 hover:text-white'}`}>{isFogMode ? '👁️ Fechar Modo Edição' : '👁️ Editar Neblina'}</button>
                                            
                                            {isFogMode && (
                                              <div className="flex flex-col gap-3 bg-black/80 p-3 rounded-xl border border-white/10 animate-in fade-in zoom-in-95 shadow-inner mt-2">
                                                  <div className="flex gap-2">
                                                      <button onClick={() => onSetFogTool('reveal')} className={`flex-1 py-2 text-[10px] uppercase tracking-widest font-black rounded-lg transition-colors border ${fogTool === 'reveal' ? 'bg-green-900/40 border-green-500 text-green-300' : 'bg-black border-white/5 text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}>🔦 Revelar</button>
                                                      <button onClick={() => onSetFogTool('hide')} className={`flex-1 py-2 text-[10px] uppercase tracking-widest font-black rounded-lg transition-colors border ${fogTool === 'hide' ? 'bg-red-900/40 border-red-500 text-red-300' : 'bg-black border-white/5 text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}>☁️ Esconder</button>
                                                  </div>

                                                  <div className="flex gap-2 justify-between border-t border-white/5 pt-3">
                                                      <button onClick={() => onSetFogTool('wall')} className={`flex-1 py-2 text-[9px] uppercase tracking-widest font-black rounded-lg transition-colors border ${fogTool === 'wall' ? 'bg-orange-900/40 border-orange-500 text-orange-300 shadow-[inset_0_0_10px_rgba(249,115,22,0.3)]' : 'bg-black border-white/5 text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}>🧱 Desenhar Parede</button>
                                                      <button onClick={() => onSetFogTool('eraseWall')} className={`flex-1 py-2 text-[9px] uppercase tracking-widest font-black rounded-lg transition-colors border ${fogTool === 'eraseWall' ? 'bg-red-900/40 border-red-500 text-red-300 shadow-[inset_0_0_10px_rgba(239,68,68,0.3)]' : 'bg-black border-white/5 text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}>🔨 Quebrar Parede</button>
                                                  </div>
                                                  
                                                  <div className="flex gap-2 justify-between border-t border-white/5 pt-3">
                                                      <button onClick={() => { onSetFogShape && onSetFogShape('brush'); if(fogTool === 'room') onSetFogTool('reveal'); }} className={`flex-1 py-2 flex flex-col items-center gap-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all border ${fogShape === 'brush' && fogTool !== 'room' ? 'bg-white/10 border-white text-white shadow-inner' : 'bg-black border-white/5 text-gray-500 hover:bg-white/5 hover:text-gray-300'}`} title="Pincel Livre">
                                                          <Brush size={14} /> Livre
                                                      </button>
                                                      <button onClick={() => { onSetFogShape && onSetFogShape('rect'); if(fogTool === 'room') onSetFogTool('reveal'); }} className={`flex-1 py-2 flex flex-col items-center gap-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all border ${fogShape === 'rect' && fogTool !== 'room' ? 'bg-white/10 border-white text-white shadow-inner' : 'bg-black border-white/5 text-gray-500 hover:bg-white/5 hover:text-gray-300'}`} title="Desenhar Retângulo Simples">
                                                          <Square size={14} /> Caixa
                                                      </button>
                                                      <button onClick={() => { onSetFogShape && onSetFogShape('line'); if(fogTool === 'room') onSetFogTool('reveal'); }} className={`flex-1 py-2 flex flex-col items-center gap-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all border ${fogShape === 'line' && fogTool !== 'room' ? 'bg-white/10 border-white text-white shadow-inner' : 'bg-black border-white/5 text-gray-500 hover:bg-white/5 hover:text-gray-300'}`} title="Desenhar Linha">
                                                          <Minus size={14} /> Linha
                                                      </button>
                                                      
                                                      <button onClick={() => onSetFogTool('room')} className={`flex-1 py-2 flex flex-col items-center gap-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all border ${fogTool === 'room' ? 'bg-cyan-900/40 border-cyan-500 text-cyan-300 shadow-[inset_0_0_10px_rgba(6,182,212,0.3)]' : 'bg-black border-white/5 text-gray-500 hover:bg-white/5 hover:text-gray-300'}`} title="Demarcar um Novo Cômodo">
                                                          <LayoutGrid size={14} /> Sala
                                                      </button>
                                                  </div>
                                                  
                                                  <p className="text-center text-[9px] text-gray-500 font-serif italic mt-1 border-t border-white/5 pt-2">
                                                      {fogTool === 'room' ? 'Arraste para demarcar um novo Cômodo.' : 'Arraste sobre o mapa para pintar a névoa.'}
                                                  </p>
                                              </div>
                                            )}

                                            <div className="flex gap-2 mt-2">
                                                <button onClick={onRevealAll} className="flex-1 py-2.5 bg-black hover:bg-white/5 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-white rounded-lg border border-white/10 transition-colors">Limpar Tudo</button>
                                                <button onClick={onResetFog} className="flex-1 py-2.5 bg-black hover:bg-white/5 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-white rounded-lg border border-white/10 transition-colors">Tudo Preto</button>
                                            </div>
                                            <button onClick={onSyncFog} className="w-full py-3 mt-2 bg-purple-900/30 hover:bg-purple-700/50 border border-purple-500/50 text-[10px] text-purple-100 uppercase tracking-[0.2em] font-black rounded-xl transition-all flex justify-center items-center gap-2 active:scale-95 shadow-[0_0_10px_rgba(168,85,247,0.2)]">📡 Sincronizar Jogadores</button>
                                    </div>
                                    
                                    {fogRooms.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-white/10 relative z-10">
                                            <h4 className="text-[9px] text-gray-400 uppercase tracking-widest font-bold mb-3 flex items-center justify-between">
                                                <span>Salas Demarcadas</span>
                                                <span className="bg-black border border-white/10 px-2 rounded-full">{fogRooms.length}</span>
                                            </h4>
                                            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                                                {fogRooms.map(room => (
                                                    <div key={room.id} className="flex items-center justify-between bg-black/60 border border-white/5 p-2 rounded-lg group hover:border-cyan-500/30 transition-colors">
                                                        <span className="text-xs font-black uppercase tracking-wide text-gray-300 truncate pl-2">{room.name}</span>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button 
                                                                onClick={() => onToggleFogRoom && onToggleFogRoom(room.id, true)} 
                                                                className="px-3 py-1.5 bg-green-900/30 hover:bg-green-800/50 text-green-400 rounded transition-colors text-[9px] font-black uppercase tracking-wider"
                                                                title="Revelar Sala"
                                                            >
                                                                Revelar
                                                            </button>
                                                            <button 
                                                                onClick={() => onToggleFogRoom && onToggleFogRoom(room.id, false)} 
                                                                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded transition-colors text-[9px] font-black uppercase tracking-wider"
                                                                title="Ocultar Sala"
                                                            >
                                                                Ocultar
                                                            </button>
                                                            <button 
                                                                onClick={() => onDeleteFogRoom && onDeleteFogRoom(room.id)} 
                                                                className="p-1.5 hover:bg-red-900/50 text-gray-500 hover:text-red-400 rounded transition-colors"
                                                                title="Deletar Marcação"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </section>
                                
                                <div className="pt-2 pb-6 space-y-3">
                                    <button onClick={onSaveGame} className="w-full py-4 bg-gradient-to-r from-green-900 to-emerald-900 hover:from-green-800 hover:to-emerald-800 border border-green-500/50 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] active:scale-95 flex justify-center items-center gap-2">
                                        💾 Salvar Estado da Mesa
                                    </button>
                                    <button onClick={onResetView} className="w-full py-3 bg-black hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all active:scale-95">
                                        Recentralizar Câmera 🎯
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'create' && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                                
                                <div className="flex gap-2">
                                    <button onClick={() => onOpenCreator('player')} className="flex-1 bg-black/60 backdrop-blur-md hover:bg-blue-900/30 border border-white/10 hover:border-blue-500/50 text-gray-300 hover:text-white text-[10px] font-black py-4 rounded-2xl uppercase tracking-widest transition-all shadow-lg active:scale-95 flex flex-col items-center gap-2">
                                        <span className="text-2xl filter drop-shadow-md">🛡️</span> Aliado
                                    </button>
                                    <button onClick={() => onOpenCreator('enemy')} className="flex-1 bg-black/60 backdrop-blur-md hover:bg-red-900/30 border border-white/10 hover:border-red-500/50 text-gray-300 hover:text-white text-[10px] font-black py-4 rounded-2xl uppercase tracking-widest transition-all shadow-lg active:scale-95 flex flex-col items-center gap-2">
                                        <span className="text-2xl filter drop-shadow-md">⚙️</span> Monstro
                                    </button>
                                </div>

                                <div>
                                    <button 
                                        onClick={onOpenLootGenerator} 
                                        className="w-full bg-gradient-to-r from-amber-700 to-yellow-600 hover:from-amber-600 hover:to-yellow-500 border border-yellow-400 text-black text-[10px] font-black py-4 rounded-2xl uppercase tracking-[0.2em] transition-all shadow-[0_0_20px_rgba(217,119,6,0.4)] active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <Gem size={18} className="text-white" /> Gerar Saque Mágico
                                    </button>
                                </div>

                                <div className="bg-black/60 backdrop-blur-xl border border-red-900/30 rounded-2xl p-4 shadow-2xl relative overflow-hidden">
                                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.05)_0%,transparent_70%)] pointer-events-none"></div>
                                    <h3 className="text-red-500 font-black text-[11px] uppercase tracking-[0.2em] mb-4 flex items-center justify-between border-b border-red-900/30 pb-3 relative z-10">
                                        <span>🐉 Bestiário Negro</span>
                                        <span className="text-gray-600 text-[8px] tracking-normal">(Arraste para o mapa)</span>
                                    </h3>

                                    <div className="mb-4 relative z-10">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Search size={14} className="text-gray-500" />
                                        </div>
                                        <input 
                                            type="text" 
                                            placeholder="Invoque pelo nome..." 
                                            value={monsterSearch}
                                            onChange={(e) => setMonsterSearch(e.target.value)}
                                            className="w-full bg-black/80 border border-white/10 rounded-xl py-3 pl-9 pr-3 text-xs text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all placeholder-gray-600 shadow-inner"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1 relative z-10">
                                        {filteredMonsters.length > 0 ? (
                                            filteredMonsters.map((monster, idx) => (
                                                <button 
                                                    key={`${monster.name}-${idx}`} 
                                                    draggable 
                                                    onDragStart={(e) => handleDragStart(e, 'enemy', monster)} 
                                                    onClick={() => handleSelectPreset(monster)} 
                                                    className="flex flex-col items-center bg-black/50 hover:bg-red-950/40 border border-white/5 hover:border-red-500/50 p-3 rounded-xl transition-all group cursor-grab active:cursor-grabbing shadow-inner"
                                                >
                                                    <div className="w-12 h-12 rounded-full overflow-hidden mb-2 border-2 border-white/10 group-hover:border-red-500 shadow-[0_0_10px_rgba(0,0,0,0.8)] group-hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all">
                                                        <img src={monster.tokenImage || monster.image} alt={monster.name} className="w-full h-full object-cover" />
                                                    </div>
                                                    <span className="text-[10px] font-black text-gray-400 group-hover:text-white uppercase tracking-wider truncate w-full text-center mt-1">
                                                        {monster.name}
                                                    </span>
                                                    <div className="flex gap-3 text-[9px] font-bold font-mono mt-1.5 bg-black/60 px-2 py-1 rounded-lg border border-white/5">
                                                        <span className="text-red-500" title="Pontos de Vida">HP {monster.hp}</span>
                                                        <span className="text-blue-500" title="Classe de Armadura">CA {monster.ac}</span>
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="col-span-2 text-center py-8 text-gray-600 text-xs italic font-serif">
                                                O bestiário não conhece essa criatura.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {activeTab === 'audio' && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300 h-full">
                                <Soundboard 
                                    currentTrack={currentTrack}
                                    onPlayMusic={onPlayMusic}
                                    onStopMusic={onStopMusic}
                                    onPlaySFX={onPlaySFX}
                                    globalVolume={audioVolume}
                                    onVolumeChange={onSetAudioVolume}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      </div>
    </>
  );
};

export default SidebarDM;