import React, { useState } from 'react';
import { Sword, CornerUpLeft, UserPlus, ArrowRight, Check, Star, Plus } from 'lucide-react';

interface CombatActionsProps {
    allFilteredActions: any[];
    expandedActionIds: Record<string, boolean>;
    toggleActionExpansion: (id: string) => void;
    executeActionAttack: (action: any) => void;
    executeActionSave: (action: any) => void;
    executeActionDamage: (action: any) => void;
    onSendMessage: (msg: string) => void;
    equippedWeapons: any[];
    knownSpells: any[];
    handleSaveCustomAction: (actionForm: any) => void;
    translateTerm: (term: string) => string;
    sign: (mod: number) => string;
    currentAC: number;
    dexMod: number;
    myCharacter: any;
    proficiencyBonus: number;
    spellDC: number;
    actionForm: any;
    setActionForm: React.Dispatch<React.SetStateAction<any>>;
    isEditingAction: boolean;
    setIsEditingAction: React.Dispatch<React.SetStateAction<boolean>>;
    handleAutoFill: (val: string) => void;
    customActions: any[];
    onUpdateCharacter?: (id: number, updates: any) => void;
}

const CombatActions: React.FC<CombatActionsProps> = ({
    allFilteredActions, expandedActionIds, toggleActionExpansion,
    executeActionAttack, executeActionSave, executeActionDamage,
    onSendMessage, handleSaveCustomAction, translateTerm, sign,
    currentAC, dexMod, myCharacter, proficiencyBonus, spellDC,
    actionForm, setActionForm, isEditingAction, setIsEditingAction,
    handleAutoFill, customActions, onUpdateCharacter
}) => {
    const [actionFilter, setActionFilter] = useState<'all' | 'attack' | 'action' | 'bonus action' | 'reaction' | 'other'>('all');
    const [combatActionsUsed, setCombatActionsUsed] = useState<Record<string, boolean>>({});

    const handleDeleteCustomAction = (id: string) => {
        if (!myCharacter || !onUpdateCharacter) return;
        if (window.confirm("Remover esta ação do painel de batalha?")) {
            const updatedActions = customActions.filter((a: any) => a.id !== id);
            onUpdateCharacter(myCharacter.id, { customActions: updatedActions });
        }
    };

    return (
        <div className="view-enter p-4 min-h-full" style={{ background: '#12111a' }}>
            <div style={{ color: "#c9aa71", fontFamily: 'sans-serif', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Ações de Combate</div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                {[
                    { id: 'attack', label: 'Atacar', icon: <Sword size={16} color="#e05a5a" />, bg: '#2a0f0f', msg: 'Ataque Rolado' },
                    { id: 'dodge', label: 'Esquivar', icon: <CornerUpLeft size={16} color="#5a8aaa" />, bg: '#0f1a2a', msg: '🛡️ **Esquiva (Dodge):** Jogadas contra mim têm desvantagem.' },
                    { id: 'help', label: 'Ajudar', icon: <UserPlus size={16} color="#3ddc84" />, bg: '#0f2a1a', msg: '🤝 **Ajudar (Help):** O próximo ataque do aliado tem Vantagem.' },
                    { id: 'dash', label: 'Disparar', icon: <ArrowRight size={16} color="#e8a030" />, bg: '#2a1f0a', msg: '🏃 **Disparada (Dash):** Movimento extra neste turno.' },
                ].map(action => (
                    <button key={action.id} onClick={() => { setCombatActionsUsed(prev => ({ ...prev, [action.id]: true })); if (action.id !== 'attack') onSendMessage(action.msg); }} style={{ background: '#0e0d16', border: '1px solid #2a2440', borderRadius: '10px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: combatActionsUsed[action.id] ? 0.4 : 1, transition: 'all 0.2s', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ background: action.bg, padding: '6px', borderRadius: '6px', display: 'flex' }}>{action.icon}</div>
                            <span style={{ color: '#c9aa71', fontFamily: 'sans-serif', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>{action.label}</span>
                        </div>
                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: combatActionsUsed[action.id] ? 'none' : '1px solid #3a3460', background: combatActionsUsed[action.id] ? '#c9aa71' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {combatActionsUsed[action.id] && <Check size={12} color="#12111a" strokeWidth={4} />}
                        </div>
                    </button>
                ))}
            </div>

            <button onClick={() => { setCombatActionsUsed(prev => ({ ...prev, bonus: true })); onSendMessage('✨ **Ação Bônus Utilizada!**'); }} style={{ width: '100%', background: '#0e0d16', border: '1px solid #2a2440', borderRadius: '10px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: combatActionsUsed['bonus'] ? 0.4 : 1, transition: 'all 0.2s', cursor: 'pointer', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ background: '#1a0f2a', padding: '6px', borderRadius: '6px', display: 'flex' }}><Star size={16} color="#a855f7" /></div>
                    <span style={{ color: '#c9aa71', fontFamily: 'sans-serif', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Ação Bônus</span>
                </div>
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: combatActionsUsed['bonus'] ? 'none' : '1px solid #3a3460', background: combatActionsUsed['bonus'] ? '#c9aa71' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {combatActionsUsed['bonus'] && <Check size={12} color="#12111a" strokeWidth={4} />}
                </div>
            </button>

            <button onClick={() => setCombatActionsUsed({})} style={{ width: '100%', background: 'transparent', border: '1px solid #2a2440', borderRadius: '10px', padding: '12px', color: '#5a5070', fontFamily: 'sans-serif', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s' }}>Novo Turno</button>

            <div style={{ marginTop: '24px', borderTop: '1px solid #2a2440', paddingTop: '24px' }}>
                <div className="flex gap-2 mb-4 overflow-x-auto pb-3 shrink-0 items-center flex-wrap">
                    {[{ id: 'all', label: 'ALL' }, { id: 'attack', label: 'ATTACK' }, { id: 'action', label: 'ACTION' }, { id: 'bonus action', label: 'BONUS' }, { id: 'reaction', label: 'REACTION' }, { id: 'other', label: 'OTHER' }].map(f => (
                        <button key={f.id} onClick={() => setActionFilter(f.id as any)} className={`px-3 py-1 text-[9px] font-bold tracking-widest uppercase rounded transition-colors ${actionFilter === f.id ? 'bg-[#c9aa71] text-[#12111a]' : 'bg-[#0e0d16] text-[#8a7a5a] border border-[#2a2440] hover:bg-[#2a2440]'}`}>{f.label}</button>
                    ))}
                    <button onClick={() => { setActionForm({ name: '', attackMod: 'none', damageExpr: '', damageType: 'Físico', saveAttr: 'none' }); setIsEditingAction(!isEditingAction); }} className="pb-1 text-[10px] font-black tracking-widest uppercase transition-colors text-[#c9aa71] hover:underline ml-auto flex items-center gap-1"><Plus size={10} /> Macro</button>
                </div>

                {isEditingAction && (
                    <div className="bg-[#0e0d16] border border-[#2a2440] rounded-xl p-5 mb-5 shadow-2xl animate-in slide-in-from-top-4 relative overflow-hidden">
                        <h4 className="text-[11px] text-[#c9aa71] font-black uppercase tracking-widest border-b border-[#2a2440] pb-2 mb-4 relative z-10">{actionForm.id ? 'Editar Macro' : 'Criar Novo Macro'}</h4>

                        <div className="space-y-4 relative z-10">
                            <div>
                                <label className="text-[9px] text-[#8a7a5a] uppercase font-bold mb-1.5 block">Nome do Macro</label>
                                <input type="text" value={actionForm.name} onChange={e => setActionForm({ ...actionForm, name: e.target.value })} placeholder="Ex: Fúria, Golpe Especial..." className="w-full bg-[#12111a] border border-[#2a2440] rounded-lg p-2.5 text-white text-xs outline-none focus:border-[#c9aa71] transition-colors" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[9px] text-[#8a7a5a] uppercase font-bold mb-1.5 block">Fórmula de Dano</label>
                                    <input type="text" value={actionForm.damageExpr} onChange={e => setActionForm({ ...actionForm, damageExpr: e.target.value })} placeholder="Ex: 8d6" className="w-full bg-[#12111a] border border-[#2a2440] rounded-lg p-2.5 text-white text-xs outline-none focus:border-[#c9aa71] font-mono transition-colors" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[9px] text-[#8a7a5a] uppercase font-bold mb-1.5 block">Rolar Ataque?</label>
                                    <select value={actionForm.attackMod} onChange={e => setActionForm({ ...actionForm, attackMod: e.target.value })} className="w-full bg-[#12111a] border border-[#2a2440] rounded-lg p-2.5 text-white text-xs outline-none focus:border-[#c9aa71] transition-colors">
                                        <option value="none">Não</option><option value="str">Sim (FOR)</option><option value="dex">Sim (DES)</option><option value="spell">Sim (Magia)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] text-[#8a7a5a] uppercase font-bold mb-1.5 block">Resistência?</label>
                                    <select value={actionForm.saveAttr} onChange={e => setActionForm({ ...actionForm, saveAttr: e.target.value })} className="w-full bg-[#12111a] border border-[#2a2440] rounded-lg p-2.5 text-white text-xs outline-none focus:border-[#c9aa71] transition-colors">
                                        <option value="none">Não</option><option value="FOR">FOR</option><option value="DES">DES</option><option value="CON">CON</option><option value="INT">INT</option><option value="SAB">SAB</option><option value="CAR">CAR</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-2 pt-4 border-t border-[#2a2440]">
                                <button onClick={() => setIsEditingAction(false)} className="flex-1 py-3 bg-[#12111a] hover:bg-[#2a2440] border border-[#2a2440] text-gray-300 text-[10px] uppercase tracking-widest font-black rounded-lg transition-colors">Cancelar</button>
                                <button onClick={() => { handleSaveCustomAction(actionForm); setIsEditingAction(false); }} disabled={!actionForm.name.trim()} className="flex-[2] py-3 bg-[#c9aa71] hover:bg-[#d4b784] text-[#12111a] text-[10px] uppercase tracking-widest font-black rounded-lg disabled:opacity-50 transition-all">Salvar Macro</button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {allFilteredActions.length === 0 ? (
                        <p className="text-[10px] text-gray-500 italic text-center py-8 font-serif">Nenhuma ação encontrada para este filtro.</p>
                    ) : (
                        <div className="w-full">
                            <div className="grid grid-cols-12 gap-2 pb-2 mb-2 text-[9px] font-black text-[#8a7a5a] uppercase tracking-widest items-center border-b border-[#2a2440]">
                                <div className="col-span-5 pl-2">Action</div>
                                <div className="col-span-2 text-center">Range</div>
                                <div className="col-span-2 text-center">Hit / DC</div>
                                <div className="col-span-3 text-right pr-4">Damage / Notes</div>
                            </div>
                            <div className="flex flex-col gap-2">
                                {allFilteredActions.map((action: any, idx) => {
                                    const showHeader = actionFilter === 'all' && (idx === 0 || allFilteredActions[idx - 1].typeDetail !== action.typeDetail);

                                    return (
                                        <React.Fragment key={action.id || action.name}>
                                            {showHeader && (
                                                <div className="flex items-end justify-between border-b border-[#2a2440] mt-6 pb-1.5 mb-2">
                                                    <span className="text-[11px] font-black text-[#c9aa71] uppercase tracking-[0.2em]">{action.typeDetail}</span>
                                                    {action.type === 'macro' && (
                                                        <button onClick={(e) => { e.stopPropagation(); setActionForm({ name: '', attackMod: 'none', damageExpr: '', damageType: 'Físico', saveAttr: 'none' }); setIsEditingAction(!isEditingAction); }} className="text-[9px] font-bold text-blue-400 uppercase hover:text-blue-300 transition-colors">
                                                            Gerenciar Macros
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            <div className="grid grid-cols-12 gap-2 py-3 px-2 rounded-xl group bg-[#0e0d16] border border-[#2a2440] hover:border-[#c9aa71] transition-all cursor-pointer shadow-sm" onClick={() => toggleActionExpansion(action.id || action.name)}>
                                                <div className="col-span-5 flex items-center gap-3">
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-xs font-bold text-gray-200 group-hover:text-[#c9aa71] transition-colors truncate">{action.name}</span>
                                                        <span className="text-[9px] text-[#8a7a5a] uppercase tracking-widest truncate">{translateTerm(action.category)}</span>
                                                    </div>
                                                </div>
                                                <div className="col-span-2 text-center flex items-center justify-center">
                                                    <span className="text-[10px] font-mono text-[#8a7a5a] bg-[#12111a] px-2 py-1 rounded border border-[#2a2440]">{action.range?.split(' ')[0] || '--'}</span>
                                                </div>
                                                <div className="col-span-2 flex justify-center items-center">
                                                    {(action.attackMod && action.attackMod !== 'none') ? (
                                                        <button onClick={(e) => { e.stopPropagation(); executeActionAttack(action); }} className="bg-[#12111a] border border-[#2a2440] rounded text-gray-300 font-black text-xs hover:border-[#c9aa71] transition-colors min-w-[36px] py-1 px-1.5">
                                                            {action.hitMod >= 0 ? `+${action.hitMod}` : action.hitMod}
                                                        </button>
                                                    ) : (action.saveAttr && action.saveAttr !== 'none') ? (
                                                        <button onClick={(e) => { e.stopPropagation(); executeActionSave(action); }} className="bg-[#12111a] border border-[#2a2440] rounded text-gray-300 font-black text-[10px] hover:border-[#c9aa71] transition-colors min-w-[36px] py-1.5 px-1.5">
                                                            {action.saveAttr}
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-600 text-xs">--</span>
                                                    )}
                                                </div>
                                                <div className="col-span-3 flex justify-end items-center gap-3 pr-2">
                                                    {action.damageExpr ? (
                                                        <button onClick={(e) => { e.stopPropagation(); executeActionDamage(action); }} className="bg-[#12111a] border border-[#2a2440] rounded text-[#c9aa71] hover:border-[#c9aa71] font-bold text-[11px] px-2 py-1 flex items-center justify-center transition-colors font-mono">
                                                            {action.damageExpr}
                                                        </button>
                                                    ) : action.type === 'macro' ? (
                                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteCustomAction(action.id); }} className="chip" style={{ color: "var(--accent-red)", borderColor: "rgba(224,69,56,0.5)", background: "rgba(224,69,56,0.1)", fontWeight: 700 }}>Del</button>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-600 italic">--</span>
                                                    )}
                                                </div>

                                                {expandedActionIds[action.id || action.name] && (
                                                    <div className="col-span-12 mt-2 pl-4 pr-4 text-xs text-gray-400 font-serif leading-relaxed whitespace-pre-wrap pt-3 pb-1 border-t border-[#2a2440]">
                                                        <span className="font-bold text-[#c9aa71]">{action.name}. </span>
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
    );
}

export default CombatActions;