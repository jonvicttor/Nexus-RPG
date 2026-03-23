import React, { useState, useEffect, useRef } from 'react';
import { Shield, Heart, Sword, Backpack, Dices, Circle, CheckCircle2, Star, Skull, Flame, MessageSquare, Send } from 'lucide-react';
import { Entity } from '../App';
import Chat, { ChatMessage } from './Chat';

interface MobileSheetProps {
    character: Entity;
    onUpdateHP: (id: number, amount: number) => void;
    onRollAttribute: (charName: string, attrName: string, mod: number) => void;
    onOpenDiceRoller?: () => void;
    onUpdateCharacter: (id: number, updates: Partial<Entity>) => void;
    chatMessages: ChatMessage[];
    onSendMessage: (text: string) => void;
    onApplyDamageFromChat: (targetId: number, damageExpression: string) => void;
}

const SKILLS = [
    { name: 'Acrobacia', attr: 'dex' }, { name: 'Arcanismo', attr: 'int' },
    { name: 'Atletismo', attr: 'str' }, { name: 'Enganação', attr: 'cha' },
    { name: 'Furtividade', attr: 'dex' }, { name: 'História', attr: 'int' },
    { name: 'Intimidação', attr: 'cha' }, { name: 'Intuição', attr: 'wis' },
    { name: 'Investigação', attr: 'int' }, { name: 'Lidar com Animais', attr: 'wis' },
    { name: 'Medicina', attr: 'wis' }, { name: 'Natureza', attr: 'int' },
    { name: 'Percepção', attr: 'wis' }, { name: 'Persuasão', attr: 'cha' },
    { name: 'Prestidigitação', attr: 'dex' }, { name: 'Religião', attr: 'int' },
    { name: 'Sobrevivência', attr: 'wis' }
];

const SAVING_THROWS = [
    { name: 'Força', attr: 'str' }, { name: 'Destreza', attr: 'dex' },
    { name: 'Constituição', attr: 'con' }, { name: 'Inteligência', attr: 'int' },
    { name: 'Sabedoria', attr: 'wis' }, { name: 'Carisma', attr: 'cha' }
];

export default function MobilePlayerSheet({ character, onUpdateHP, onRollAttribute, onOpenDiceRoller, onUpdateCharacter, chatMessages, onSendMessage, onApplyDamageFromChat }: MobileSheetProps) {
    const [activeTab, setActiveTab] = useState<'STATUS' | 'ACTIONS' | 'SPELLS' | 'INVENTORY' | 'CHAT'>('STATUS');
    
    const [unreadMessages, setUnreadMessages] = useState(false);
    const lastMessageCount = useRef(chatMessages.length);

    useEffect(() => {
        if (chatMessages.length > lastMessageCount.current) {
            if (activeTab !== 'CHAT') {
                setUnreadMessages(true);
            }
            lastMessageCount.current = chatMessages.length;
        }
    }, [chatMessages, activeTab]);

    useEffect(() => {
        if (activeTab === 'CHAT') {
            setUnreadMessages(false);
        }
    }, [activeTab]);

    const level = character.level || 1;
    const profBonus = Math.ceil(1 + (level / 4)); 
    
    const getMod = (val: number) => Math.floor((val - 10) / 2);
    const formatMod = (mod: number) => mod >= 0 ? `+${mod}` : `${mod}`;

    const toggleProficiency = (skillName: string) => {
        const currentProf = character.proficiencies?.[skillName] || 0;
        const nextProf = currentProf === 0 ? 1 : currentProf === 1 ? 2 : 0; 
        onUpdateCharacter(character.id, {
            proficiencies: { ...(character.proficiencies || {}), [skillName]: nextProf }
        });
    };

    const toggleInspiration = () => {
        onUpdateCharacter(character.id, { inspiration: !character.inspiration });
    };

    const handleDeathSave = (type: 'successes' | 'failures', value: number) => {
        const current = character.deathSaves || { successes: 0, failures: 0 };
        onUpdateCharacter(character.id, {
            deathSaves: { ...current, [type]: current[type] === value ? value - 1 : value }
        });
    };

    const handleLongRest = () => {
        if(window.confirm("Fazer um Descanso Longo? Isso irá restaurar Vida, Espaços de Magia e Testes de Morte.")) {
            let clearedSlots = { ...character.spellSlots };
            if (clearedSlots) {
                Object.keys(clearedSlots).forEach(level => {
                    clearedSlots[Number(level)].used = 0;
                });
            }
            onUpdateCharacter(character.id, {
                hp: character.maxHp,
                deathSaves: { successes: 0, failures: 0 },
                spellSlots: clearedSlots
            });
        }
    };

    const handleSpellSlotChange = (levelIndex: number, action: 'add_max' | 'remove_max' | 'toggle_used', slotIndex?: number) => {
        const currentSlots = character.spellSlots || {};
        const levelData = currentSlots[levelIndex] || { max: 0, used: 0 };

        let newMax = levelData.max;
        let newUsed = levelData.used;

        if (action === 'add_max' && newMax < 4) newMax++;
        if (action === 'remove_max' && newMax > 0) {
            newMax--;
            if (newUsed > newMax) newUsed = newMax;
        }
        if (action === 'toggle_used' && slotIndex !== undefined) {
             if (newUsed === slotIndex + 1) {
                 newUsed--; // Desmarcar
             } else {
                 newUsed = slotIndex + 1; // Marcar até aqui
             }
        }

        onUpdateCharacter(character.id, {
            spellSlots: { ...currentSlots, [levelIndex]: { max: newMax, used: newUsed } }
        });
    };

    const toggleEquip = (itemId: string) => {
        const newInventory = character.inventory?.map(item => 
            item.id === itemId ? { ...item, isEquipped: !item.isEquipped } : item
        ) || [];
        onUpdateCharacter(character.id, { inventory: newInventory });
    };

    const ProfBubble = ({ level }: { level: number }) => {
        if (level === 2) return <Star size={16} className="text-amber-400 fill-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]" />;
        if (level === 1) return <CheckCircle2 size={16} className="text-green-500 fill-green-900" />;
        return <Circle size={16} className="text-gray-600" />;
    };

    const equippedWeapons = character.inventory?.filter(i => i.type === 'weapon' && i.isEquipped) || [];

    return (
        // FIX: h-[100dvh] para cobrir a tela perfeitamente e evitar corte da dock
        <div className="flex flex-col h-[100dvh] w-screen bg-[#050505] text-amber-50 font-serif items-center justify-center overflow-hidden">
            <div className="w-full max-w-3xl flex flex-col h-full relative bg-[#0a0a0a] md:border-l md:border-r border-gray-900 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                
                <header className="p-4 md:px-8 bg-gradient-to-b from-black to-[#0a0a0a] border-b border-amber-900/50 sticky top-0 z-10 shadow-lg shrink-0">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex gap-3 md:gap-5 items-center">
                            <div className="w-14 h-14 md:w-20 md:h-20 rounded-full border-2 border-amber-600 overflow-hidden bg-black shadow-[0_0_10px_rgba(217,119,6,0.3)]">
                                <img src={character.image || '/tokens/aliado.png'} alt={character.name} className="w-full h-full object-cover" />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 drop-shadow-sm">{character.name}</h1>
                                <p className="text-[10px] md:text-xs text-amber-200/60 uppercase tracking-widest font-bold mt-1">{character.race} • {character.classType} • Nv {level}</p>
                            </div>
                        </div>
                        
                        <div className="flex gap-2 md:gap-4">
                            <button onClick={handleLongRest} title="Descanso Longo" className="flex flex-col items-center justify-center p-2 md:p-3 rounded-xl border border-amber-900/50 bg-gray-900/80 hover:bg-amber-900/40 hover:border-amber-500 transition-all shadow-inner">
                                <Flame size={18} className="text-amber-500" />
                            </button>
                            <button onClick={toggleInspiration} className={`flex flex-col items-center justify-center p-2 md:p-3 rounded-xl border transition-all ${character.inspiration ? 'bg-amber-900/40 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.3)]' : 'bg-gray-900/80 border-gray-800'}`}>
                                <Star size={18} className={character.inspiration ? "text-amber-400 fill-amber-400" : "text-gray-500"} />
                            </button>
                            <div className="flex flex-col items-center bg-gray-900/80 p-2 md:p-3 rounded-xl border border-amber-900/50 shadow-inner min-w-[50px]">
                                <Shield size={18} className="text-gray-400 mb-1" />
                                <span className="font-black text-xl md:text-2xl leading-none">{character.ac}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-gray-900/50 p-2 md:p-3 rounded-xl border border-gray-800">
                        <button onClick={() => onUpdateHP(character.id, -1)} className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-red-950/50 text-red-500 border border-red-900 hover:bg-red-900 active:scale-95 font-black text-xl">-</button>
                        
                        <div className="flex-1 flex flex-col items-center justify-center min-h-[40px]">
                            {character.hp <= 0 ? (
                                <div className="flex flex-col items-center w-full animate-in zoom-in duration-300">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Skull size={14} className="text-red-500 animate-pulse" />
                                        <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest">Inconsciente</span>
                                    </div>
                                    <div className="flex justify-between w-full px-2 md:max-w-[200px]">
                                        <div className="flex gap-2">
                                            {[1, 2, 3].map(i => (
                                                <div key={`suc-${i}`} onClick={() => handleDeathSave('successes', i)} className="cursor-pointer hover:scale-110">
                                                    {(character.deathSaves?.successes || 0) >= i ? <CheckCircle2 size={18} className="text-green-500 fill-green-500" /> : <Circle size={18} className="text-gray-600" />}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            {[1, 2, 3].map(i => (
                                                <div key={`fail-${i}`} onClick={() => handleDeathSave('failures', i)} className="cursor-pointer hover:scale-110">
                                                    {(character.deathSaves?.failures || 0) >= i ? <CheckCircle2 size={18} className="text-red-500 fill-red-500" /> : <Circle size={18} className="text-gray-600" />}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full relative flex flex-col items-center md:max-w-xs">
                                    <Heart size={20} className="absolute -top-4 text-green-500" />
                                    <span className="text-lg md:text-xl font-black mt-1">{character.hp} <span className="text-gray-500 text-sm">/ {character.maxHp}</span></span>
                                    <div className="w-full h-2 mt-1 bg-gray-950 rounded-full overflow-hidden border border-black shadow-inner">
                                        <div className="h-full bg-gradient-to-r from-red-600 to-green-500 transition-all duration-300" style={{ width: `${Math.max(0, Math.min(100, (character.hp / character.maxHp) * 100))}%` }}></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button onClick={() => onUpdateHP(character.id, 1)} className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-green-950/50 text-green-500 border border-green-900 hover:bg-green-900 active:scale-95 font-black text-xl">+</button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 custom-scrollbar relative">
                    
                    {activeTab === 'STATUS' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            <div>
                                <div className="flex justify-between items-end border-b border-amber-900/30 pb-2 mb-4">
                                    <h2 className="text-amber-500/80 uppercase tracking-[0.2em] text-xs font-bold">Atributos</h2>
                                    <span className="text-[10px] md:text-xs text-amber-200/50 font-bold border border-amber-900/50 px-3 py-1 rounded-full bg-amber-900/20">
                                        Proficiência: <span className="text-amber-400">+{profBonus}</span>
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-4">
                                    {Object.entries(character.stats || {}).map(([stat, value]) => {
                                        const mod = getMod(value as number);
                                        return (
                                            <button key={stat} onClick={() => onRollAttribute(character.name, stat.toUpperCase(), mod)} className="bg-gradient-to-b from-gray-900 to-black border border-gray-800 rounded-xl p-3 md:p-4 flex flex-col items-center shadow-lg active:scale-95 transition-transform relative overflow-hidden group hover:border-amber-700/50">
                                                <span className="text-[10px] md:text-xs text-amber-200/50 uppercase tracking-widest font-bold">{stat}</span>
                                                <span className="text-2xl md:text-3xl font-black text-white mt-1 drop-shadow-md">{value as number}</span>
                                                <div className="mt-2 bg-black px-3 py-1 rounded-full border border-gray-800">
                                                    <span className={`text-xs md:text-sm font-black ${mod >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatMod(mod)}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <h2 className="text-amber-500/80 uppercase tracking-[0.2em] text-xs font-bold border-b border-amber-900/30 pb-2 mb-4">Salvaguardas</h2>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4 bg-gray-900/30 p-3 md:p-5 rounded-xl border border-gray-800/50">
                                    {SAVING_THROWS.map(save => {
                                        const attrVal = (character.stats as any)?.[save.attr] || 10;
                                        const baseMod = getMod(attrVal);
                                        const profLevel = character.proficiencies?.[`Save_${save.name}`] || 0;
                                        const totalMod = baseMod + (profLevel === 1 ? profBonus : profLevel === 2 ? profBonus * 2 : 0);

                                        return (
                                            <div key={save.name} className="flex items-center justify-between p-2 md:p-3 bg-black/40 border border-gray-800 rounded-lg hover:border-gray-600 transition-colors">
                                                <div onClick={() => toggleProficiency(`Save_${save.name}`)} className="cursor-pointer p-1">
                                                    <ProfBubble level={profLevel} />
                                                </div>
                                                <button onClick={() => onRollAttribute(character.name, `Salvaguarda: ${save.name}`, totalMod)} className="flex-1 text-left px-2 flex justify-between items-center active:scale-95">
                                                    <span className="text-[11px] md:text-sm text-gray-300 font-bold">{save.name}</span>
                                                    <span className={`text-[11px] md:text-sm font-black ${totalMod >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatMod(totalMod)}</span>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <h2 className="text-amber-500/80 uppercase tracking-[0.2em] text-xs font-bold border-b border-amber-900/30 pb-2 mb-4 flex items-center justify-between">
                                    Perícias <span className="text-gray-500 text-[9px] md:text-xs normal-case">(Toque para rolar)</span>
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-gray-900/30 p-3 md:p-5 rounded-xl border border-gray-800/50">
                                    {SKILLS.map(skill => {
                                        const attrVal = (character.stats as any)?.[skill.attr] || 10;
                                        const baseMod = getMod(attrVal);
                                        const profLevel = character.proficiencies?.[skill.name] || 0;
                                        const totalMod = baseMod + (profLevel === 1 ? profBonus : profLevel === 2 ? profBonus * 2 : 0);

                                        return (
                                            <div key={skill.name} className="flex items-center justify-between p-3 md:p-4 bg-black/40 hover:bg-gray-800 border border-transparent hover:border-gray-700 rounded-lg transition-colors">
                                                <div onClick={() => toggleProficiency(skill.name)} className="cursor-pointer p-2 -ml-2">
                                                    <ProfBubble level={profLevel} />
                                                </div>
                                                
                                                <button onClick={() => onRollAttribute(character.name, skill.name, totalMod)} className="flex-1 flex items-center gap-3 text-left active:scale-95 transition-transform ml-2">
                                                    <div className={`w-8 text-center font-black text-sm md:text-base ${totalMod >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatMod(totalMod)}</div>
                                                    <span className="text-sm md:text-base text-gray-200">{skill.name}</span>
                                                </button>

                                                <span className="text-[10px] md:text-xs text-gray-600 uppercase font-bold tracking-wider">{skill.attr}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'ACTIONS' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div>
                                <h2 className="text-blue-400/80 uppercase tracking-[0.2em] text-xs font-bold border-b border-blue-900/30 pb-2 mb-4 flex justify-between items-center">
                                    <span>Arsenal (Armas Equipadas)</span>
                                </h2>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {equippedWeapons.length > 0 ? equippedWeapons.map(weapon => {
                                        const strMod = getMod(character.stats?.str || 10);
                                        const dexMod = getMod(character.stats?.dex || 10);
                                        
                                        const wName = weapon.name.toLowerCase();
                                        const isFinesseOrRanged = 
                                            weapon.stats?.properties?.some(p => p.toLowerCase().includes('finesse') || p.toLowerCase().includes('distância') || p.toLowerCase().includes('ranged')) || 
                                            wName.includes('arco') || wName.includes('besta') || wName.includes('adaga') || wName.includes('rapieira');
                                            
                                        const bestMod = isFinesseOrRanged ? Math.max(strMod, dexMod) : strMod;
                                        const atkMod = bestMod + profBonus;

                                        return (
                                            <div key={weapon.id} className="bg-gray-900 border border-blue-900/30 rounded-xl p-4 flex items-center gap-4 hover:border-blue-500/50 transition-colors shadow-[0_0_15px_rgba(30,58,138,0.2)]">
                                                <div className="w-14 h-14 bg-black rounded-lg border border-gray-700 flex items-center justify-center shrink-0 overflow-hidden relative">
                                                    {weapon.image ? <img src={weapon.image} alt={weapon.name} className="w-12 h-12 object-contain" /> : <Sword size={24} className="text-gray-500" />}
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-bold text-blue-100 md:text-lg leading-tight">{weapon.name}</h3>
                                                    <p className="text-[10px] md:text-xs text-blue-300/60 mt-1 uppercase tracking-wider">{weapon.stats?.damage || '1d4'} Dano • {isFinesseOrRanged ? 'DES/FOR' : 'FOR'}</p>
                                                </div>
                                                <button onClick={() => onRollAttribute(character.name, `Ataque: ${weapon.name}`, atkMod)} className="w-16 py-3 bg-blue-600 hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)] text-white rounded-lg font-black active:scale-95 transition-all flex flex-col items-center justify-center gap-1">
                                                    <span className="text-xs">🎲</span>
                                                    <span className="text-sm">{formatMod(atkMod)}</span>
                                                </button>
                                            </div>
                                        )
                                    }) : (
                                        <div className="col-span-full flex flex-col items-center justify-center py-12 bg-black/40 border border-dashed border-gray-800 rounded-xl">
                                            <Sword size={32} className="text-gray-700 mb-3" />
                                            <p className="text-gray-400 text-sm italic">Você está desarmado.</p>
                                            <p className="text-gray-500 text-[10px] uppercase tracking-widest mt-2">Vá à aba <span className="text-yellow-500 font-bold">Mochila</span> e equipe uma arma!</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'SPELLS' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div>
                                <h2 className="text-purple-400/80 uppercase tracking-[0.2em] text-xs font-bold border-b border-purple-900/30 pb-2 mb-4 flex items-center justify-between">
                                    <span>Espaços de Magia</span>
                                    <span className="text-[9px] text-gray-500">Toque p/ Gastar</span>
                                </h2>
                                <div className="space-y-3 bg-gray-900/30 p-4 rounded-xl border border-gray-800/50">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => {
                                        const slotData = character.spellSlots?.[level] || { max: 0, used: 0 };
                                        
                                        const hasMax = slotData.max > 0;
                                        const prevLevelData = level > 1 ? character.spellSlots?.[level-1] : null;
                                        const canAdd = hasMax || (level === 1) || (prevLevelData && prevLevelData.max > 0);

                                        if (!canAdd && !hasMax) return null;

                                        return (
                                            <div key={`slot-lvl-${level}`} className="flex items-center justify-between bg-black/40 p-2 rounded-lg border border-white/5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-purple-400/80 w-12">Nível {level}</span>
                                                    <div className="flex gap-1.5">
                                                        {[...Array(Math.max(1, slotData.max))].map((_, i) => {
                                                            const isUsed = i < slotData.used;
                                                            if (slotData.max === 0) return null;
                                                            return (
                                                                <div 
                                                                    key={`bubble-${level}-${i}`} 
                                                                    onClick={() => handleSpellSlotChange(level, 'toggle_used', i)}
                                                                    className="cursor-pointer"
                                                                >
                                                                    {isUsed ? <Circle size={18} className="text-gray-700" /> : <div className="w-[18px] h-[18px] rounded-full bg-purple-600 shadow-[0_0_8px_rgba(147,51,234,0.6)]"></div>}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 border-l border-white/10 pl-2 ml-2">
                                                    <button onClick={() => handleSpellSlotChange(level, 'remove_max')} className="w-6 h-6 flex items-center justify-center bg-red-900/30 text-red-500 rounded hover:bg-red-900/50">-</button>
                                                    <button onClick={() => handleSpellSlotChange(level, 'add_max')} className="w-6 h-6 flex items-center justify-center bg-green-900/30 text-green-500 rounded hover:bg-green-900/50">+</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            <p className="text-center text-gray-500 text-xs py-4 italic border border-dashed border-gray-800 rounded-lg bg-black/20">
                                Grimório de Magias Detalhado<br/>em breve na próxima atualização!
                            </p>
                        </div>
                    )}

                    {activeTab === 'INVENTORY' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                             <div className="flex flex-col flex-shrink-0 bg-gray-900/50 rounded-xl border border-gray-800 pb-2">
                                <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                                    <h3 className="text-xs uppercase font-black text-amber-500 tracking-widest flex items-center gap-1.5"><Backpack size={16} /> Mochila</h3>
                                </div>
                                <div className="p-3 space-y-2">
                                    {!character.inventory || character.inventory.length === 0 ? (
                                        <div className="text-center py-6 text-gray-600 text-xs italic">A mochila está vazia...</div>
                                    ) : character.inventory.map(item => (
                                        <div key={item.id} className={`flex gap-3 items-center p-3 rounded-lg border transition-colors ${item.isEquipped ? 'bg-amber-900/20 border-amber-600 shadow-[0_0_10px_rgba(217,119,6,0.1)]' : 'bg-black/40 border-gray-800'}`}>
                                            <div className="w-12 h-12 rounded-md bg-black/60 border border-gray-700 flex items-center justify-center p-1.5 shrink-0"><img src={item.image} className="max-w-full max-h-full object-contain" alt="" /></div>
                                            <div className="flex-grow"><p className="text-sm font-bold text-white leading-tight">{item.name}</p><p className="text-[10px] text-gray-400 line-clamp-2">{item.description}</p></div>
                                            <div className="flex flex-col items-end gap-1">
                                              {item.quantity > 1 && <span className="text-[10px] bg-gray-700 text-white font-bold px-2 py-0.5 rounded">x{item.quantity}</span>}
                                              {(item.type === 'weapon' || item.type === 'armor') && (
                                                <button onClick={() => toggleEquip(item.id)} className={`text-[9px] px-2 py-1 rounded font-bold uppercase tracking-wider transition-all active:scale-95 ${item.isEquipped ? 'bg-amber-600 text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                                                  {item.isEquipped ? 'Equipado' : 'Equipar'}
                                                </button>
                                              )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'CHAT' && (
                        <div className="absolute inset-0 flex flex-col z-10 bg-[#0a0a0a]">
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <Chat 
                                    messages={chatMessages} 
                                    onSendMessage={onSendMessage} 
                                    role="PLAYER" 
                                    onApplyDamage={onApplyDamageFromChat} 
                                />
                            </div>
                            <div className="p-3 bg-gray-900 border-t border-gray-800 pb-safe">
                                <ChatInput onSendMessage={onSendMessage} />
                            </div>
                        </div>
                    )}
                </main>

                <nav className="absolute bottom-0 left-0 w-full bg-black/95 backdrop-blur-xl border-t border-gray-800 flex justify-around items-end pb-6 pt-3 px-1 md:px-2 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] rounded-b-none md:rounded-b-3xl">
                    <button onClick={() => setActiveTab('STATUS')} className={`flex flex-col items-center w-12 md:w-16 transition-colors hover:scale-105 ${activeTab === 'STATUS' ? 'text-amber-400' : 'text-gray-500'}`}>
                        <Shield size={22} className={activeTab === 'STATUS' ? 'drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]' : ''} />
                        <span className="text-[8px] md:text-[10px] mt-1 font-bold uppercase tracking-wider">Status</span>
                    </button>
                    
                    <button onClick={() => setActiveTab('ACTIONS')} className={`flex flex-col items-center w-12 md:w-16 transition-colors hover:scale-105 ${activeTab === 'ACTIONS' ? 'text-blue-400' : 'text-gray-500'}`}>
                        <Sword size={22} className={activeTab === 'ACTIONS' ? 'drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]' : ''} />
                        <span className="text-[8px] md:text-[10px] mt-1 font-bold uppercase tracking-wider">Ações</span>
                    </button>

                    <div className="relative -top-6 w-16 md:w-20 flex justify-center shrink-0">
                        <button 
                            onClick={onOpenDiceRoller}
                            className="w-14 h-14 md:w-20 md:h-20 bg-gradient-to-br from-indigo-600 via-purple-700 to-indigo-900 rounded-full border-[4px] border-[#0a0a0a] flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.5)] hover:scale-105 active:scale-95 transition-all"
                        >
                            <Dices size={26} className="text-white drop-shadow-md" />
                        </button>
                    </div>

                    <button onClick={() => setActiveTab('INVENTORY')} className={`flex flex-col items-center w-12 md:w-16 transition-colors hover:scale-105 ${activeTab === 'INVENTORY' ? 'text-yellow-500' : 'text-gray-500'}`}>
                        <Backpack size={22} className={activeTab === 'INVENTORY' ? 'drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]' : ''} />
                        <span className="text-[8px] md:text-[10px] mt-1 font-bold uppercase tracking-wider">Bolsa</span>
                    </button>
                    
                    <button onClick={() => setActiveTab('CHAT')} className={`flex flex-col items-center w-12 md:w-16 transition-colors hover:scale-105 relative ${activeTab === 'CHAT' ? 'text-gray-200' : 'text-gray-500'}`}>
                        <div className="relative">
                            <MessageSquare size={22} className={activeTab === 'CHAT' ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : ''} />
                            {unreadMessages && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-black animate-pulse"></span>}
                        </div>
                        <span className="text-[8px] md:text-[10px] mt-1 font-bold uppercase tracking-wider">Chat</span>
                    </button>
                </nav>

            </div>
        </div>
    );
}

// Componente isolado para o input do chat para manter o foco e evitar zoom
const ChatInput = ({ onSendMessage }: { onSendMessage: (msg: string) => void }) => {
    const [input, setInput] = useState('');
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(input.trim()) { onSendMessage(input); setInput(''); }
    };
    return (
        <form onSubmit={handleSubmit} className="flex gap-2">
            <input 
                type="text" 
                value={input} 
                onChange={e => setInput(e.target.value)} 
                placeholder="Mensagem..." 
                className="flex-1 bg-black/50 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" 
                style={{ fontSize: '16px' }} 
            />
            <button type="submit" disabled={!input.trim()} className="bg-purple-600 disabled:bg-gray-800 text-white p-2.5 rounded-xl active:scale-95 transition-transform"><Send size={20}/></button>
        </form>
    );
};