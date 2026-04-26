import React, { useState, memo, useRef, useEffect } from 'react';
import { Eye, EyeOff, Skull } from 'lucide-react';
import { Entity } from '../App';
import { getLevelFromXP, getNextLevelXP } from '../utils/gameRules';

interface EntityControlRowProps {
    entity: Entity;
    onUpdateHP: (id: number, change: number) => void;
    onDeleteEntity: (entity: Entity) => void;
    onClickEdit: (entity: Entity) => void;
    onAddToInit: (entity: Entity) => void;
    isTarget: boolean;
    isAttacker: boolean;
    onSetTarget: (id: number | number[] | null, multiSelect?: boolean) => void;
    onSetAttacker: (id: number | null) => void;
    onToggleCondition: (id: number, condition: string) => void;
    onAddXP?: (id: number, amount: number) => void;
    onToggleVisibility: (id: number) => void;
    onEditEntity: (id: number, updates: Partial<Entity>) => void;
    CONDITION_MAP: any[];
}

const EntityControlRowComponent: React.FC<EntityControlRowProps> = ({
    entity, onUpdateHP, onDeleteEntity, onClickEdit, onAddToInit,
    isTarget, isAttacker, onSetTarget, onSetAttacker, onToggleCondition,
    onAddXP, onToggleVisibility, onEditEntity, CONDITION_MAP
}) => {
    const hpPercent = Math.max(0, Math.min(100, (entity.hp / entity.maxHp) * 100));
    const isDead = entity.hp <= 0;
    
    let barColor = 'from-green-500 to-green-400';
    let barShadow = 'shadow-[0_0_10px_rgba(34,197,94,0.4)]';
    if (hpPercent < 30) { barColor = 'from-red-600 to-red-500'; barShadow = 'shadow-[0_0_10px_rgba(220,38,38,0.6)]'; } 
    else if (hpPercent < 60) { barColor = 'from-yellow-500 to-yellow-400'; barShadow = 'shadow-[0_0_10px_rgba(234,179,8,0.4)]'; }

    const [showXPInput, setShowXPInput] = useState(false);
    const [showNotes, setShowNotes] = useState(false);
    const [xpAmount, setXpAmount] = useState('');
    
    // UX de Combate: HP Editável Inline
    const [isEditingHP, setIsEditingHP] = useState(false);
    const [hpInputValue, setHpInputValue] = useState(entity.hp.toString());
    const hpInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditingHP) {
            hpInputRef.current?.focus();
        } else {
            setHpInputValue(entity.hp.toString());
        }
    }, [isEditingHP, entity.hp]);

    const handleGiveXP = (e: React.FormEvent) => { 
        e.preventDefault(); 
        const amount = parseInt(xpAmount); 
        if (amount && onAddXP) { 
            onAddXP(entity.id, amount); 
            setXpAmount(''); 
            setShowXPInput(false); 
        } 
    };

    const submitHPEdit = () => {
        const newHP = parseInt(hpInputValue);
        if (!isNaN(newHP)) {
            const change = newHP - entity.hp;
            if (change !== 0) onUpdateHP(entity.id, change);
        }
        setIsEditingHP(false);
    };

    return (
        <div className={`relative p-3 rounded-xl border backdrop-blur-md transition-all duration-300 flex flex-col gap-2 group overflow-hidden cursor-pointer ${isDead ? 'opacity-50 grayscale bg-black/60 border-gray-800' : ''} ${isTarget && !isDead ? 'bg-red-950/40 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : isAttacker ? 'bg-blue-950/40 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 'bg-black/40 border-white/10 hover:bg-black/60 hover:border-white/20'}`} onClick={(e) => onSetTarget(entity.id, e.shiftKey)}>
            {isDead && (<div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 z-0"><Skull size={40} className="text-gray-300" /></div>)}
            
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 bg-black/80 backdrop-blur-xl border border-white/10 rounded-lg p-1 shadow-2xl">
                {entity.type === 'player' && (<button onClick={(e) => { e.stopPropagation(); setShowXPInput(!showXPInput); setShowNotes(false); }} className="text-gray-400 hover:text-amber-400 hover:bg-white/10 rounded p-1.5 transition-colors text-sm" title="Dar XP">✨</button>)}
                <button onClick={(e) => { e.stopPropagation(); setShowNotes(!showNotes); setShowXPInput(false); }} className={`hover:bg-white/10 rounded p-1.5 transition-colors text-sm ${showNotes ? 'text-purple-400' : 'text-gray-400'}`} title="Anotações Secretas">📝</button>
                <button onClick={(e) => { e.stopPropagation(); onSetAttacker(entity.id); }} className={`hover:bg-white/10 rounded p-1.5 transition-colors text-sm ${isAttacker ? 'text-blue-400' : 'text-gray-400'}`} title="Definir como Atacante">🎯</button>
                <button onClick={(e) => { e.stopPropagation(); onAddToInit(entity); }} className="text-gray-400 hover:text-yellow-400 hover:bg-white/10 rounded p-1.5 transition-colors text-sm" title="Iniciativa">⚔️</button>
                <button onClick={(e) => { e.stopPropagation(); onToggleVisibility(entity.id); }} className={`hover:bg-white/10 rounded p-1.5 transition-colors text-sm ${entity.visible === false ? 'text-white/20' : 'text-cyan-400'}`} title={entity.visible === false ? "Revelar" : "Ocultar"}>
                    {entity.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); onClickEdit(entity); }} className="text-gray-400 hover:text-blue-400 hover:bg-white/10 rounded p-1.5 transition-colors text-sm" title="Editar">✎</button>
                <button onClick={(e) => { e.stopPropagation(); onDeleteEntity(entity); }} className="text-gray-400 hover:text-red-500 hover:bg-white/10 rounded p-1.5 transition-colors text-sm" title="Excluir (Remove o Corpo)">✕</button>
            </div>

            {showXPInput && (<div className="absolute inset-0 z-30 bg-black/95 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in" onClick={(e) => e.stopPropagation()}><form onSubmit={handleGiveXP} className="flex gap-2 w-full"><input autoFocus type="number" placeholder="XP" className="flex-1 bg-black border border-amber-500/50 text-white px-3 py-2 rounded-lg text-sm outline-none focus:border-amber-400" value={xpAmount} onChange={(e) => setXpAmount(e.target.value)} /><button type="submit" className="bg-amber-600 text-black px-4 py-2 rounded-lg font-black uppercase tracking-widest text-xs transition-transform active:scale-95">OK</button><button type="button" onClick={() => setShowXPInput(false)} className="text-gray-500 hover:text-white px-2">✕</button></form></div>)}

            <div className="flex items-center justify-between pr-2 z-10 relative">
                <div className="flex items-center gap-4 pointer-events-none">
                    <div className={`relative w-12 h-12 flex-shrink-0 rounded-full border-2 p-0.5 ${isTarget && !isDead ? 'border-red-500' : isAttacker ? 'border-blue-500' : 'border-white/10'}`}>
                        {(entity.tokenImage || entity.image) ? (<img src={entity.tokenImage || entity.image} alt={entity.name} className={`w-full h-full rounded-full object-cover shadow-inner ${entity.visible === false ? 'opacity-40 grayscale' : ''}`}/>) : (<div className="w-full h-full rounded-full" style={{ backgroundColor: entity.color }}></div>)}
                        {entity.type === 'player' && (<div className="absolute -bottom-1 -right-1 bg-gradient-to-br from-amber-600 to-amber-800 border border-black text-black text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-lg">Nv.{getLevelFromXP(entity.xp || 0)}</div>)}
                    </div>
                    <div className="overflow-hidden flex flex-col justify-center">
                        <span className={`text-white font-bold text-sm tracking-wide truncate block ${isDead ? 'line-through text-gray-600' : ''} ${entity.visible === false ? 'opacity-40 italic' : ''}`}>
                            {entity.name} {entity.visible === false && '(Oculto)'}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold leading-none">{entity.classType || 'NPC'}</span>
                            {entity.conditions && entity.conditions.length > 0 && (
                                <span className="flex gap-1">
                                    {entity.conditions.map((c: string, idx: number) => {
                                        const icon = CONDITION_MAP.find(cm => cm.id === c)?.icon;
                                        return icon ? <span key={idx} className="text-[10px] filter drop-shadow-md leading-none" title={c}>{icon}</span> : null;
                                    })}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="text-right z-20">
                    {isEditingHP ? (
                        <div className="flex items-center" onClick={e => e.stopPropagation()}>
                            <input 
                                ref={hpInputRef}
                                type="number" 
                                value={hpInputValue}
                                onChange={(e) => setHpInputValue(e.target.value)}
                                onBlur={submitHPEdit}
                                onKeyDown={(e) => { if (e.key === 'Enter') submitHPEdit(); }}
                                className="w-14 bg-black border border-amber-500 text-center text-white text-sm font-mono rounded px-1 outline-none"
                            />
                        </div>
                    ) : (
                        <span 
                            onClick={(e) => { e.stopPropagation(); setIsEditingHP(true); }}
                            className={`text-sm font-black font-mono tracking-tighter cursor-text hover:text-amber-300 transition-colors ${isDead ? 'text-gray-600' : (entity.hp < entity.maxHp / 2 ? 'text-red-400' : 'text-white')}`}
                            title="Clique para editar HP"
                        >
                            {entity.hp}<span className="text-[10px] text-gray-500 font-normal">/{entity.maxHp}</span>
                        </span>
                    )}
                </div>
            </div>
            
            {entity.type === 'player' && (<div className="w-full h-1 bg-black/50 rounded-full mt-1.5 relative overflow-hidden pointer-events-none"><div className="h-full bg-cyan-500" style={{ width: `${Math.min(100, ((entity.xp || 0) / getNextLevelXP(getLevelFromXP(entity.xp || 0))) * 100)}%` }}></div></div>)}
            <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/5 mt-1 z-10 relative pointer-events-none shadow-inner"><div className={`h-full bg-gradient-to-r ${barColor} ${barShadow} transition-all duration-500 ease-out`} style={{ width: `${hpPercent}%` }}></div></div>

            {showNotes && (
                <div className="mt-3 pt-3 border-t border-white/10 animate-in slide-in-from-top-2 fade-in duration-200" onClick={e => e.stopPropagation()}>
                    <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-1.5 flex items-center gap-1"><Eye size={10} /> Segredos do Mestre</span>
                    <textarea
                        autoFocus
                        className="w-full bg-black/50 border border-purple-500/30 rounded-lg p-3 text-xs text-purple-100 placeholder-purple-900/50 outline-none focus:border-purple-400 focus:bg-black/80 min-h-[70px] custom-scrollbar transition-all"
                        placeholder="Anotações confidenciais..."
                        defaultValue={entity.dmNotes || ''}
                        onBlur={(e) => onEditEntity(entity.id, { dmNotes: e.target.value })}
                    />
                </div>
            )}
        </div>
    );
};

export const EntityControlRow = memo(EntityControlRowComponent);