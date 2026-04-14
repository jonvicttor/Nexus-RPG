import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sword, Shield, Backpack, Sparkles, BookOpen, GripHorizontal, X, Package, Weight, Flame, Plus, Minus, Target, ShieldAlert } from 'lucide-react';
import { Entity, Item } from '../App';

interface CharacterSheetFloatingProps {
    character: Entity;
    onClose: () => void;
    // 👉 CORREÇÃO: Agora aceita a expressão de dano!
    onRollAttribute: (charName: string, attrName: string, mod: number, damageExpr?: string, damageType?: string) => void;
    onUpdateHP: (id: number, change: number) => void;
    onUpdateCharacter: (id: number, updates: Partial<Entity>) => void;
    onDropItem: (itemId: string) => void;
    onCastSpell?: (spell: { id: string, name: string, level: number, school?: string, damage?: string, range?: string, casting_time?: string, description?: string }) => void;
    availableSpells?: any[]; 
}

const SKILLS = [
    { id: 'Acrobacia', stat: 'dex' }, { id: 'Adestrar Animais', stat: 'wis' },
    { id: 'Arcanismo', stat: 'int' }, { id: 'Atletismo', stat: 'str' },
    { id: 'Enganação', stat: 'cha' }, { id: 'Furtividade', stat: 'dex' },
    { id: 'História', stat: 'int' }, { id: 'Intimidação', stat: 'cha' },
    { id: 'Intuição', stat: 'wis' }, { id: 'Investigação', stat: 'int' },
    { id: 'Medicina', stat: 'wis' }, { id: 'Natureza', stat: 'int' },
    { id: 'Percepção', stat: 'wis' }, { id: 'Performance', stat: 'cha' },
    { id: 'Persuasão', stat: 'cha' }, { id: 'Prestidigitação', stat: 'dex' },
    { id: 'Religião', stat: 'int' }, { id: 'Sobrevivência', stat: 'wis' }
];

const CharacterSheetFloating: React.FC<CharacterSheetFloatingProps> = ({ 
    character, onClose, onRollAttribute, onUpdateHP, onUpdateCharacter, onDropItem, onCastSpell, availableSpells = [] 
}) => {
    const [activeTab, setActiveTab] = useState<'main' | 'inventory' | 'spells' | 'traits'>('main');
    const [position, setPosition] = useState({ x: window.innerWidth / 2 - 300, y: window.innerHeight / 2 - 250 });
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef<{ startX: number, startY: number, initialX: number, initialY: number } | null>(null);

    // Estado para controlar as magias expandidas no acordeão
    const [expandedSpells, setExpandedSpells] = useState<Record<string, boolean>>({});

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragRef.current = { startX: e.clientX, startY: e.clientY, initialX: position.x, initialY: position.y };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !dragRef.current) return;
            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;
            setPosition({ x: dragRef.current.initialX + dx, y: dragRef.current.initialY + dy });
        };
        const handleMouseUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    const inventory = character.inventory || [];
    const equippedItems = inventory.filter(i => i.isEquipped);
    
    const totalWeight = inventory.reduce((sum, item) => {
        const itemWeight = parseFloat(item.weight?.toString().replace(/[^\d.]/g, '') || '0');
        return sum + (itemWeight * (item.quantity || 1));
    }, 0);

    let displayAC = character.ac || 10;
    equippedItems.forEach(item => { if (item.stats?.ac) displayAC += item.stats.ac; });

    const toggleEquip = (itemId: string) => {
        const newInv = inventory.map(i => i.id === itemId ? { ...i, isEquipped: !i.isEquipped } : i);
        onUpdateCharacter(character.id, { inventory: newInv });
    };

    const getAttackMod = (item: Item) => {
        if (!character.stats) return 0;
        const strMod = Math.floor((character.stats.str - 10) / 2);
        const dexMod = Math.floor((character.stats.dex - 10) / 2);
        const isFinesseOrRanged = item.stats?.properties?.some(p => p.toLowerCase().includes('finesse') || p.toLowerCase().includes('distância') || p.toLowerCase().includes('ranged')) || item.name.toLowerCase().includes('arco') || item.name.toLowerCase().includes('besta') || item.name.toLowerCase().includes('adaga') || item.name.toLowerCase().includes('rapieira');
        return isFinesseOrRanged ? Math.max(strMod, dexMod) : strMod;
    };

    const allowedSpells = useMemo(() => {
        if (!availableSpells || availableSpells.length === 0) return [];

        const rawClass = (character.classType || '').toLowerCase();
        const targetClasses: string[] = [];

        if (rawClass.includes('wizard') || rawClass.includes('mago')) targetClasses.push('wizard', 'mago');
        if (rawClass.includes('cleric') || rawClass.includes('clérigo') || rawClass.includes('clerigo')) targetClasses.push('cleric', 'clérigo', 'clerigo');
        if (rawClass.includes('bard') || rawClass.includes('bardo')) targetClasses.push('bard', 'bardo');
        if (rawClass.includes('sorcerer') || rawClass.includes('feiticeiro')) targetClasses.push('sorcerer', 'feiticeiro');
        if (rawClass.includes('warlock') || rawClass.includes('bruxo')) targetClasses.push('warlock', 'bruxo');
        if (rawClass.includes('druid') || rawClass.includes('druida')) targetClasses.push('druid', 'druida');
        if (rawClass.includes('paladin') || rawClass.includes('paladino')) targetClasses.push('paladin', 'paladino');
        if (rawClass.includes('ranger') || rawClass.includes('patrulheiro') || rawClass.includes('arqueiro')) targetClasses.push('ranger', 'patrulheiro');
        if (rawClass.includes('artificer') || rawClass.includes('artífice') || rawClass.includes('artifice')) targetClasses.push('artificer', 'artífice', 'artifice');

        if (targetClasses.length === 0) return [];

        const charLevel = character.level || 1;
        const maxSpellLevel = Math.min(9, Math.ceil(charLevel / 2));

        return availableSpells.filter(spell => {
            const spellLvl = parseInt(spell.level?.toString()) || 0;
            if (spellLvl > maxSpellLevel) return false;

            if (!spell.classes || !Array.isArray(spell.classes)) return false;

            return spell.classes.some((c: string) => targetClasses.includes(c.toLowerCase()));
            
        }).sort((a, b) => a.name.localeCompare(b.name));
        
    }, [availableSpells, character.classType, character.level]);

    const toggleSpellExpansion = (spellId: string) => {
        setExpandedSpells(prev => ({
            ...prev,
            [spellId]: !prev[spellId]
        }));
    };

    const getSchoolColor = (school: string) => {
        const s = school?.toLowerCase() || '';
        if (s.includes('evoc')) return 'text-red-400 border-red-900/50 bg-red-900/20';
        if (s.includes('abjur')) return 'text-blue-400 border-blue-900/50 bg-blue-900/20';
        if (s.includes('necro')) return 'text-purple-400 border-purple-900/50 bg-purple-900/20';
        if (s.includes('ilu')) return 'text-pink-400 border-pink-900/50 bg-pink-900/20';
        if (s.includes('encant')) return 'text-fuchsia-400 border-fuchsia-900/50 bg-fuchsia-900/20';
        if (s.includes('transmut')) return 'text-amber-400 border-amber-900/50 bg-amber-900/20';
        if (s.includes('adivinh')) return 'text-cyan-400 border-cyan-900/50 bg-cyan-900/20';
        if (s.includes('conjur')) return 'text-emerald-400 border-emerald-900/50 bg-emerald-900/20';
        return 'text-gray-400 border-gray-700 bg-gray-800/50';
    };

    return (
        <div className="fixed z-[600] w-[600px] h-[550px] bg-[#111111] border border-amber-600/50 rounded-xl shadow-2xl flex flex-col overflow-hidden font-sans pointer-events-auto" style={{ left: position.x, top: position.y }}>
            <div className="bg-gradient-to-r from-gray-900 to-black border-b border-amber-600/30 p-2 flex justify-between items-center cursor-move select-none" onMouseDown={handleMouseDown}>
                <div className="flex items-center gap-2 text-amber-500 opacity-50 hover:opacity-100 transition-opacity">
                    <GripHorizontal size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Ficha de Personagem</span>
                </div>
                <button onClick={onClose} className="text-gray-500 hover:text-red-500 transition-colors"><X size={18} /></button>
            </div>

            <div className="p-4 flex gap-4 border-b border-white/5 shrink-0 bg-black/50">
                <div className="w-20 h-20 rounded-full border-2 border-amber-500 overflow-hidden bg-gray-900 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                    <img src={character.tokenImage || character.image} alt={character.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 flex flex-col justify-center">
                    <h2 className="text-2xl font-black text-amber-50 uppercase tracking-tighter leading-none mb-1">{character.name}</h2>
                    <p className="text-amber-500/80 font-bold text-xs uppercase tracking-widest">{character.race} • {character.classType}</p>
                </div>
                
                <div className="flex gap-3 shrink-0 items-center">
                    <div className="flex flex-col items-center bg-gray-900 border border-gray-700 rounded-lg px-3 py-1">
                        <Shield size={14} className="text-gray-400 mb-1" />
                        <span className="text-xl font-bold text-white leading-none">{displayAC}</span>
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">CA</span>
                    </div>
                    <div className="flex flex-col items-center bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-1 min-w-[80px]">
                        <span className="text-[10px] font-bold text-red-400 mb-0.5 uppercase tracking-widest">Vida</span>
                        <div className="flex items-end gap-1">
                            <span className="text-xl font-bold text-white leading-none">{character.hp}</span>
                            <span className="text-xs text-red-500 font-bold mb-0.5">/ {character.maxHp}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex border-b border-white/10 shrink-0 bg-gray-900">
                <button onClick={() => setActiveTab('main')} className={`flex-1 py-2.5 text-[10px] uppercase font-bold tracking-widest transition-colors flex items-center justify-center gap-2 ${activeTab === 'main' ? 'bg-amber-600/20 text-amber-400 border-b-2 border-amber-500' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}><Sword size={14} /> Principal</button>
                <button onClick={() => setActiveTab('inventory')} className={`flex-1 py-2.5 text-[10px] uppercase font-bold tracking-widest transition-colors flex items-center justify-center gap-2 ${activeTab === 'inventory' ? 'bg-amber-600/20 text-amber-400 border-b-2 border-amber-500' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}><Backpack size={14} /> Inventário ({inventory.length})</button>
                <button onClick={() => setActiveTab('spells')} className={`flex-1 py-2.5 text-[10px] uppercase font-bold tracking-widest transition-colors flex items-center justify-center gap-2 ${activeTab === 'spells' ? 'bg-amber-600/20 text-amber-400 border-b-2 border-amber-500' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}><Sparkles size={14} /> Grimório</button>
                <button onClick={() => setActiveTab('traits')} className={`flex-1 py-2.5 text-[10px] uppercase font-bold tracking-widest transition-colors flex items-center justify-center gap-2 ${activeTab === 'traits' ? 'bg-amber-600/20 text-amber-400 border-b-2 border-amber-500' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}><BookOpen size={14} /> Características</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-black/80">
                
                {activeTab === 'main' && (
                    <div className="animate-in fade-in duration-300">
                        <h3 className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3 border-b border-white/10 pb-1">Atributos Base</h3>
                        <div className="grid grid-cols-6 gap-2 mb-6">
                            {character.stats && Object.entries(character.stats).map(([stat, val]) => {
                                const mod = Math.floor((Number(val) - 10) / 2);
                                const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
                                return (
                                    <button key={stat} onClick={() => onRollAttribute(character.name, stat.toUpperCase(), mod)} className="flex flex-col items-center bg-gray-900 hover:bg-gray-800 border border-white/10 hover:border-amber-500/50 rounded-lg p-2 transition-all active:scale-95 group">
                                        <span className="text-[10px] text-gray-400 font-bold uppercase mb-1">{stat}</span>
                                        <span className="text-xl font-black text-white group-hover:text-amber-400">{modStr}</span>
                                        <span className="text-[9px] text-gray-600 font-mono mt-1 border-t border-white/5 w-full text-center pt-0.5">{val}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <h3 className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3 border-b border-white/10 pb-1">Perícias</h3>
                        <div className="grid grid-cols-2 gap-2 pb-4">
                            {SKILLS.map(skill => {
                                const baseStat = character.stats ? Number((character.stats as any)[skill.stat]) : 10;
                                const mod = Math.floor((baseStat - 10) / 2);
                                const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
                                return (
                                    <button key={skill.id} onClick={() => onRollAttribute(character.name, skill.id, mod)} className="flex items-center justify-between bg-gray-900 border border-white/5 hover:border-cyan-500/50 rounded p-2 transition-all group active:scale-[0.98]">
                                        <div className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-gray-700 group-hover:bg-cyan-500"></span>
                                            <div className="flex flex-col items-start">
                                                <span className="text-xs font-bold text-gray-300 group-hover:text-white uppercase tracking-tight">{skill.id}</span>
                                                <span className="text-[8px] text-gray-600 uppercase">{skill.stat}</span>
                                            </div>
                                        </div>
                                        <span className="text-sm font-black text-white group-hover:text-cyan-400">{modStr}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === 'inventory' && (
                    <div className="animate-in fade-in duration-300">
                         <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                             <h3 className="text-xs text-amber-500 uppercase tracking-widest font-bold">Mochila</h3>
                             <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                                 <Weight size={12}/> Carga Total: <strong className="text-white">{totalWeight.toFixed(1)} lb</strong>
                             </span>
                         </div>
                         {inventory.length === 0 ? (
                             <div className="flex flex-col items-center justify-center py-10 opacity-50">
                                 <Backpack size={48} className="text-gray-600 mb-4" />
                                 <p className="text-gray-400 text-sm font-bold">Inventário Vazio</p>
                             </div>
                         ) : (
                             <div className="grid grid-cols-1 gap-2">
                                 {inventory.map((item, idx) => (
                                     <div key={idx} className={`flex flex-col bg-gray-900 border p-2 rounded-lg ${item.isEquipped ? 'border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.1)]' : 'border-white/5 hover:border-white/20'} group`}>
                                         <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-black rounded border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                                    {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-contain p-1" /> : <Package size={16} className="text-gray-600"/>}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-200 uppercase tracking-tight">{item.name} {item.quantity > 1 && <span className="text-amber-500 text-xs ml-1">x{item.quantity}</span>}</span>
                                                    <div className="flex gap-2 mt-1">
                                                        {item.stats?.damage && <span className="text-[9px] font-mono text-red-400 bg-red-900/30 px-1 rounded">⚔️ {item.stats.damage}</span>}
                                                        {item.stats?.ac !== undefined && <span className="text-[9px] font-mono text-blue-400 bg-blue-900/30 px-1 rounded">🛡️ {item.stats.ac}</span>}
                                                        {item.weight && <span className="text-[9px] font-mono text-gray-500">{item.weight}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div>{item.isEquipped && <span className="text-[9px] uppercase font-bold tracking-widest text-amber-500 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30">Equipado</span>}</div>
                                         </div>
                                         <div className="flex gap-2 mt-2 border-t border-white/5 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                             <button onClick={() => toggleEquip(item.id)} className={`text-[9px] uppercase font-bold px-2 py-1 rounded transition-colors ${item.isEquipped ? 'bg-gray-800 text-gray-400 hover:text-white' : 'bg-amber-900/40 text-amber-400 hover:bg-amber-600 hover:text-white'}`}>{item.isEquipped ? 'Desequipar' : 'Equipar'}</button>
                                             {item.type === 'weapon' && (
                                                 <button onClick={() => onRollAttribute(character.name, `Ataque: ${item.name}`, getAttackMod(item))} className="text-[9px] uppercase font-bold bg-red-900/40 text-red-400 hover:bg-red-600 hover:text-white px-2 py-1 rounded transition-colors">Atacar</button>
                                             )}
                                             <button onClick={() => onDropItem(item.id)} className="text-[9px] uppercase font-bold bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-white px-2 py-1 rounded transition-colors ml-auto">Largar</button>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         )}
                    </div>
                )}

                {activeTab === 'spells' && (
                    <div className="animate-in fade-in duration-300">
                         
                         {allowedSpells.length === 0 ? (
                             <div className="flex flex-col items-center justify-center py-10 opacity-50 text-center px-4">
                                 <Sparkles size={48} className="text-gray-600 mb-4" />
                                 <p className="text-gray-400 text-sm font-bold">O seu Grimório está vazio</p>
                                 <p className="text-gray-600 text-[9px] mt-2 leading-relaxed">Pode ser que a sua classe não seja mágica, ou o seu nível seja muito baixo para conjurar magias.</p>
                             </div>
                         ) : (
                             <div className="flex flex-col gap-4 pb-4">
                                 {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => {
                                     const levelSpells = allowedSpells.filter(s => (parseInt(s.level) || 0) === level);
                                     if (levelSpells.length === 0) return null;
                                     const slots = character.spellSlots?.[level] || { max: 0, used: 0 };
                                     
                                     return (
                                         <div key={level} className="bg-gray-900/50 border border-purple-900/30 rounded-lg overflow-hidden shadow-md">
                                             <div className="bg-purple-950/20 px-3 py-2 flex justify-between items-center border-b border-purple-900/30 shadow-[inset_0_-10px_20px_rgba(0,0,0,0.2)]">
                                                 <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">{level === 0 ? 'Truques (Infinito)' : `Círculo ${level}`}</span>
                                                 {level > 0 && slots.max > 0 && (
                                                     <div className="flex items-center gap-1.5" title="Espaços de Magia Gastos / Totais">
                                                         {Array.from({ length: slots.max }).map((_, i) => (
                                                             <div key={i} className={`w-2.5 h-2.5 rounded-full border border-purple-500/50 ${i < (slots.max - slots.used) ? 'bg-purple-500 shadow-[0_0_8px_#a855f7]' : 'bg-black opacity-50'}`} />
                                                         ))}
                                                     </div>
                                                 )}
                                             </div>
                                             <div className="p-2 flex flex-col gap-2 bg-black/40">
                                                 {levelSpells.map((spell, idx) => {
                                                     const isExpanded = expandedSpells[spell.id || spell.name];
                                                     const canCast = level === 0 || (slots.max > 0 && slots.used < slots.max);
                                                     
                                                     return (
                                                         <div key={spell.name + idx} className="flex flex-col bg-gray-900/80 border border-white/5 hover:border-purple-500/30 rounded-lg overflow-hidden transition-all">
                                                             <div 
                                                                 onClick={() => toggleSpellExpansion(spell.id || spell.name)}
                                                                 className="flex justify-between items-center p-3 cursor-pointer group"
                                                             >
                                                                 <div className="flex flex-col gap-1">
                                                                     <span className="text-xs font-bold text-gray-200 group-hover:text-purple-300 transition-colors flex items-center gap-2">
                                                                         {spell.name}
                                                                     </span>
                                                                     {spell.school && (
                                                                         <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${getSchoolColor(spell.school)} w-max`}>
                                                                             {spell.school}
                                                                         </span>
                                                                     )}
                                                                 </div>
                                                                 <button className="text-gray-500 group-hover:text-purple-400 transition-colors">
                                                                     {isExpanded ? <Minus size={14}/> : <Plus size={14}/>}
                                                                 </button>
                                                             </div>

                                                             {isExpanded && (
                                                                 <div className="px-3 pb-3 pt-1 border-t border-white/5 animate-in slide-in-from-top-1 bg-black/60">
                                                                     
                                                                     <div className="grid grid-cols-2 gap-2 mb-3">
                                                                         {spell.casting_time && (
                                                                             <div className="flex flex-col"><span className="text-[8px] text-gray-500 uppercase font-bold tracking-widest">Tempo</span><span className="text-[10px] text-gray-300">{spell.casting_time}</span></div>
                                                                         )}
                                                                         {spell.range && (
                                                                             <div className="flex flex-col"><span className="text-[8px] text-gray-500 uppercase font-bold tracking-widest">Alcance</span><span className="text-[10px] text-gray-300">{spell.range}</span></div>
                                                                         )}
                                                                     </div>

                                                                     {spell.description && (
                                                                         <p className="text-[10px] text-gray-400 leading-relaxed mb-4 italic border-l-2 border-purple-900/50 pl-2">
                                                                             {spell.description.substring(0, 150)}...
                                                                         </p>
                                                                     )}

                                                                     <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                                                                         <button 
                                                                             onClick={(e) => { e.stopPropagation(); onCastSpell?.(spell); }} 
                                                                             disabled={!canCast}
                                                                             className="flex items-center gap-1.5 text-[9px] uppercase font-bold bg-indigo-900/40 text-indigo-300 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                                             title={canCast ? 'Anuncia no Chat e gasta um Slot (se aplicável)' : 'Sem slots de magia disponíveis!'}
                                                                         >
                                                                             <Sparkles size={12}/> Conjurar
                                                                         </button>
                                                                         
                                                                         <button 
                                                                             onClick={(e) => { e.stopPropagation(); onRollAttribute(character.name, `Ataque Mágico: ${spell.name}`, getAttackMod(character.inventory?.[0] || {} as Item)); }}
                                                                             className="flex items-center gap-1.5 text-[9px] uppercase font-bold bg-blue-900/40 text-blue-300 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded transition-colors"
                                                                         >
                                                                             <Target size={12}/> Atacar (D20)
                                                                         </button>

                                                                         {spell.damage && (
                                                                             <button 
                                                                                 onClick={(e) => { e.stopPropagation(); onRollAttribute(character.name, `Dano: ${spell.name}`, 0, spell.damage); }}
                                                                                 className="flex items-center gap-1.5 text-[9px] uppercase font-bold bg-red-900/40 text-red-300 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded transition-colors shadow-[0_0_10px_rgba(220,38,38,0.1)]"
                                                                             >
                                                                                 <Flame size={12}/> Rolar Dano ({spell.damage})
                                                                             </button>
                                                                         )}

                                                                         <button 
                                                                             onClick={(e) => { e.stopPropagation(); onRollAttribute(character.name, `Resistência contra ${spell.name}`, 0); }}
                                                                             className="flex items-center gap-1.5 text-[9px] uppercase font-bold bg-amber-900/40 text-amber-300 hover:bg-amber-600 hover:text-white px-3 py-1.5 rounded transition-colors ml-auto"
                                                                         >
                                                                             <ShieldAlert size={12}/> Exigir Resis.
                                                                         </button>
                                                                     </div>
                                                                 </div>
                                                             )}
                                                         </div>
                                                     );
                                                 })}
                                             </div>
                                         </div>
                                     );
                                 })}
                             </div>
                         )}
                    </div>
                )}

                {activeTab === 'traits' && (
                    <div className="animate-in fade-in duration-300">
                         <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                             <h3 className="text-xs text-amber-500 uppercase tracking-widest font-bold">Características</h3>
                             <BookOpen size={12} className="text-gray-400"/>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                             <div className="bg-gray-900/50 border border-white/5 rounded-lg p-3">
                                 <h4 className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-2 border-b border-white/5 pb-1">Geral</h4>
                                 <ul className="space-y-2 text-xs">
                                     <li className="flex justify-between"><span className="text-gray-400">Raça:</span> <span className="font-bold text-gray-200">{character.race}</span></li>
                                     <li className="flex justify-between"><span className="text-gray-400">Classe:</span> <span className="font-bold text-gray-200">{character.classType}</span></li>
                                     <li className="flex justify-between"><span className="text-gray-400">Visão:</span> <span className="font-bold text-gray-200">{character.visionRadius}q</span></li>
                                 </ul>
                             </div>
                             <div className="bg-gray-900/50 border border-white/5 rounded-lg p-3">
                                 <h4 className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-2 border-b border-white/5 pb-1">Condições</h4>
                                 <div className="flex flex-wrap gap-1">
                                     {character.conditions?.map(c => (<span key={c} className="text-[9px] font-bold uppercase bg-red-900/40 text-red-400 px-2 py-0.5 rounded">{c}</span>)) || <span className="text-xs text-gray-600">Nenhuma</span>}
                                 </div>
                             </div>
                         </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CharacterSheetFloating;