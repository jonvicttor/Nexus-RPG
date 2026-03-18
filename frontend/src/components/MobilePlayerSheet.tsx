import React, { useState } from 'react';
import { Shield, Heart, Sword, Backpack, Dices, Zap, Circle, CheckCircle2, Star, Skull, Flame, BookOpen } from 'lucide-react';
import { Entity } from '../App';

interface MobileSheetProps {
    character: Entity;
    onUpdateHP: (id: number, amount: number) => void;
    onRollAttribute: (charName: string, attrName: string, mod: number) => void;
    onOpenDiceRoller?: () => void;
    onUpdateCharacter: (id: number, updates: Partial<Entity>) => void;
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

export default function MobilePlayerSheet({ character, onUpdateHP, onRollAttribute, onOpenDiceRoller, onUpdateCharacter }: MobileSheetProps) {
    const [activeTab, setActiveTab] = useState<'STATUS' | 'ACTIONS' | 'INVENTORY' | 'SPELLS'>('STATUS');

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

    const ProfBubble = ({ level }: { level: number }) => {
        if (level === 2) return <Star size={16} className="text-amber-400 fill-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]" />;
        if (level === 1) return <CheckCircle2 size={16} className="text-green-500 fill-green-900" />;
        return <Circle size={16} className="text-gray-600" />;
    };

    return (
        // FIX AQUI: Trocado h-screen para h-[100dvh]
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

                <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 custom-scrollbar">
                    
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
                                <h2 className="text-blue-400/80 uppercase tracking-[0.2em] text-xs font-bold border-b border-blue-900/30 pb-2 mb-4">Ataques e Armas</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {character.inventory?.filter(i => i.type === 'weapon').map(weapon => (
                                        <div key={weapon.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-4 hover:border-blue-900/50 transition-colors">
                                            <div className="w-14 h-14 bg-black rounded-lg border border-gray-700 flex items-center justify-center shrink-0">
                                                {weapon.image ? <img src={weapon.image} alt={weapon.name} className="w-12 h-12 object-contain" /> : <Sword size={24} className="text-gray-500" />}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-bold text-blue-100 md:text-lg">{weapon.name}</h3>
                                                <p className="text-sm text-gray-400">{weapon.stats?.damage || '1d4'} de Dano</p>
                                            </div>
                                            <button onClick={() => onRollAttribute(character.name, `Ataque: ${weapon.name}`, getMod(character.stats?.str || 10) + profBonus)} className="px-4 py-3 bg-blue-900/30 hover:bg-blue-800/50 border border-blue-800 text-blue-300 rounded-lg text-xs font-bold uppercase tracking-wider active:scale-95 transition-all">
                                                Atacar
                                            </button>
                                        </div>
                                    )) || <p className="col-span-full text-center text-gray-500 text-sm py-8 italic">Nenhuma arma equipada.</p>}
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
                            <h2 className="text-yellow-500/80 uppercase tracking-[0.2em] text-xs font-bold border-b border-yellow-900/30 pb-2 mb-4">Mochila</h2>
                            <div className="grid grid-cols-3 md:grid-cols-5 gap-3 md:gap-5">
                                {character.inventory?.map(item => (
                                    <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3 md:p-4 flex flex-col items-center text-center relative hover:border-yellow-900/50 transition-colors">
                                        <div className="absolute top-2 right-2 bg-black px-1.5 py-0.5 rounded text-[10px] font-bold text-yellow-500 border border-yellow-900/50 shadow-sm">x{item.quantity}</div>
                                        <div className="w-12 h-12 md:w-16 md:h-16 bg-black rounded-lg border border-gray-700 flex items-center justify-center mb-2 mt-2">
                                            {item.image ? <img src={item.image} alt={item.name} className="w-10 h-10 md:w-14 md:h-14 object-contain" /> : <Backpack size={24} className="text-gray-500" />}
                                        </div>
                                        <span className="text-[10px] md:text-sm font-bold text-gray-200 line-clamp-2 w-full">{item.name}</span>
                                    </div>
                                )) || <p className="col-span-full text-center text-gray-500 text-sm py-8 italic">A mochila está vazia.</p>}
                            </div>
                        </div>
                    )}
                </main>

                <nav className="absolute bottom-0 left-0 w-full bg-black/95 backdrop-blur-xl border-t border-gray-800 flex justify-around items-end pb-6 pt-3 px-2 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] rounded-b-none md:rounded-b-3xl">
                    <button onClick={() => setActiveTab('STATUS')} className={`flex flex-col items-center w-16 md:w-20 transition-colors hover:scale-105 ${activeTab === 'STATUS' ? 'text-amber-400' : 'text-gray-500'}`}>
                        <Shield size={24} className={activeTab === 'STATUS' ? 'drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]' : ''} />
                        <span className="text-[9px] md:text-[10px] mt-1.5 font-bold uppercase tracking-wider">Status</span>
                    </button>
                    
                    <button onClick={() => setActiveTab('ACTIONS')} className={`flex flex-col items-center w-16 md:w-20 transition-colors hover:scale-105 ${activeTab === 'ACTIONS' ? 'text-blue-400' : 'text-gray-500'}`}>
                        <Zap size={24} className={activeTab === 'ACTIONS' ? 'drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]' : ''} />
                        <span className="text-[9px] md:text-[10px] mt-1.5 font-bold uppercase tracking-wider">Ações</span>
                    </button>

                    <div className="relative -top-6 w-20 flex justify-center">
                        <button 
                            onClick={onOpenDiceRoller}
                            className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-indigo-600 via-purple-700 to-indigo-900 rounded-full border-[4px] border-[#0a0a0a] flex items-center justify-center shadow-[0_0_30px_rgba(79,70,229,0.6)] hover:scale-105 active:scale-95 transition-all"
                        >
                            <Dices size={30} className="text-white drop-shadow-md" />
                        </button>
                    </div>

                    <button onClick={() => setActiveTab('SPELLS')} className={`flex flex-col items-center w-16 md:w-20 transition-colors hover:scale-105 ${activeTab === 'SPELLS' ? 'text-purple-400' : 'text-gray-500'}`}>
                        <BookOpen size={24} className={activeTab === 'SPELLS' ? 'drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]' : ''} />
                        <span className="text-[9px] md:text-[10px] mt-1.5 font-bold uppercase tracking-wider">Magias</span>
                    </button>

                    <button onClick={() => setActiveTab('INVENTORY')} className={`flex flex-col items-center w-16 md:w-20 transition-colors hover:scale-105 ${activeTab === 'INVENTORY' ? 'text-yellow-400' : 'text-gray-500'}`}>
                        <Backpack size={24} className={activeTab === 'INVENTORY' ? 'drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]' : ''} />
                        <span className="text-[9px] md:text-[10px] mt-1.5 font-bold uppercase tracking-wider">Mochila</span>
                    </button>
                </nav>

            </div>
        </div>
    );
}