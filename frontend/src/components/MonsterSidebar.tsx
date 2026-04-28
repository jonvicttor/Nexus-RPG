import React, { useState } from 'react';
import { Entity } from '../App';
import { Skull, Shield, Zap, Sword, ShieldAlert, Users, ArrowUpRight, Sparkles, ChevronRight } from 'lucide-react';
import socket from '../services/socket';

export interface InitiativeItem { id: number; name: string; value: number; }

interface Props {
  monster: Entity;
  onClose: () => void;
  onRoll: (title: string, subtitle: string, mod: number, damageExpr?: string, damageType?: string) => void;
  onUpdateHP: (id: number, change: number) => void;
  // --- NOVAS PROPS PARA O TARGET PICKER ---
  onSetTarget: (id: number | number[] | null, multiSelect?: boolean) => void;
  entities: Entity[];
  initiativeList: InitiativeItem[];
}

// Componente Interno de Seleção de Alvo (Estilo Grimoire)
const TargetPickerModal = ({ actionType, entities, initiativeList, myId, onClose, onSelect }: any) => {
    const validTargets = entities.filter((ent: Entity) => initiativeList.some((init: any) => init.id === ent.id) && ent.id !== myId);
    const enemies = validTargets.filter((e: Entity) => e.type === 'player'); // Para o monstro, o inimigo é o player
    const allies = validTargets.filter((e: Entity) => e.type === 'enemy');

    const primaryTargets = actionType === 'attack' ? enemies : allies;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-[#0e0d16] border border-[#c8942a] rounded-xl shadow-2xl w-[360px] flex flex-col overflow-hidden max-h-[70vh]" onClick={e => e.stopPropagation()}>
                <div className={`p-4 border-b border-[#2e2518] ${actionType === 'attack' ? 'bg-[#2a0f0f]' : 'bg-[#0f2a1a]'}`}>
                    <h3 className="font-['Cinzel',_serif] font-bold text-[#e8dcc8] text-sm uppercase tracking-widest">
                        {actionType === 'attack' ? 'Escolher Alvo do Ataque' : 'Ajudar qual Aliado?'}
                    </h3>
                </div>
                <div className="flex-1 overflow-y-auto grimoire-scrollbar p-2 bg-[#0f0d0a]">
                    <div className="flex flex-col gap-1">
                        {primaryTargets.map((ent: Entity) => (
                            <button key={ent.id} onClick={() => onSelect(ent)} className="flex items-center gap-3 w-full p-2 bg-[#1a1510] hover:bg-[#221c13] border border-[#2e2518] hover:border-[#c8942a] rounded-lg transition-all text-left group">
                                <div className="w-10 h-10 rounded-full border border-[#c8942a]/30 overflow-hidden shrink-0 bg-black">
                                    {ent.tokenImage || ent.image ? <img src={ent.tokenImage || ent.image} className="w-full h-full object-cover" alt=""/> : <div className="w-full h-full bg-gray-900" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-['Crimson_Pro',_serif] font-bold text-[#e8dcc8] truncate">{ent.name}</div>
                                    <div className="text-[9px] font-['Cinzel',_serif] text-[#4a3e28] uppercase tracking-widest">{ent.type === 'player' ? 'Jogador' : 'NPC'}</div>
                                </div>
                                <ChevronRight size={14} className="text-[#4a3e28] group-hover:text-[#c8942a]"/>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function MonsterSidebar({ monster, onClose, onRoll, onUpdateHP, onSetTarget, entities, initiativeList }: Props) {
  const [hpInput, setHpInput] = useState('');
  const [combatActionsUsed, setCombatActionsUsed] = useState<Record<string, boolean>>({});
  const [targetPicker, setTargetPicker] = useState<{ isOpen: boolean, type: 'attack' | 'help' }>({ isOpen: false, type: 'attack' });

  const roomId = window.location.pathname.split('/').pop() || 'mesa-do-victor';
  const getMod = (val: number) => Math.floor((val - 10) / 2);
  const formatMod = (val: number) => { const m = getMod(val); return m >= 0 ? `+${m}` : `${m}`; };
  
  const stats = monster.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const maxHpSafe = Math.max(1, monster.maxHp);
  const hpPercent = (monster.hp / maxHpSafe) * 100;
  const dexMod = getMod(stats.dex);

  const handleActionClick = (actionId: string, msg: string) => {
      if (actionId === 'attack') {
          setTargetPicker({ isOpen: true, type: 'attack' });
      } else if (actionId === 'help') {
          setTargetPicker({ isOpen: true, type: 'help' });
      } else {
          setCombatActionsUsed(prev => ({...prev, [actionId]: true})); 
          const chatMsg = { 
              id: Date.now().toString(), 
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
              text: `**${monster.name}**: ${msg}`, 
              type: 'info', 
              sender: 'Mestre' 
          };
          socket.emit('sendMessage', { roomId, message: chatMsg });
      }
  };

  const handleTargetSelection = (target: Entity) => {
      setCombatActionsUsed(prev => ({...prev, [targetPicker.type]: true}));
      onSetTarget(target.id); // Trava a mira no mapa

      if (targetPicker.type === 'attack') {
          const chatMsg = { 
              id: Date.now().toString(), 
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
              text: `🎯 **${monster.name}** fixou o olhar em **${target.name}** e prepara um ataque!`, 
              type: 'info', 
              sender: 'Mestre' 
          };
          socket.emit('sendMessage', { roomId, message: chatMsg });
      } else {
          const chatMsg = { 
            id: Date.now().toString(), 
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
            text: `🤝 **${monster.name}** está ajudando **${target.name}**!`, 
            type: 'info', 
            sender: 'Mestre' 
          };
          socket.emit('sendMessage', { roomId, message: chatMsg });
      }
      setTargetPicker({ ...targetPicker, isOpen: false });
  };

  const handleDamage = () => {
    const val = parseInt(hpInput);
    if (val > 0) { onUpdateHP(monster.id, -val); setHpInput(''); }
  };

  const handleHeal = () => {
    const val = parseInt(hpInput);
    if (val > 0) { onUpdateHP(monster.id, val); setHpInput(''); }
  };

  const MAX_VISUAL_BLOCKS = 30;
  const blocksToRender = Math.min(maxHpSafe, MAX_VISUAL_BLOCKS);
  const activeBlocks = Math.ceil((monster.hp / maxHpSafe) * blocksToRender);

  let hpColorClass = 'bg-[#4a7a28]';
  if (hpPercent < 25) hpColorClass = 'bg-[#8b1a1a] animate-pulse';
  else if (hpPercent < 50) hpColorClass = 'bg-[#c8942a]';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&display=swap');
        .grimoire-scrollbar::-webkit-scrollbar { width: 3px; }
        .grimoire-scrollbar::-webkit-scrollbar-track { background: #0f0d0a; border-left: 1px solid #1e1a12; }
        .grimoire-scrollbar::-webkit-scrollbar-thumb { background: #4a3820; border-radius: 0px; }
      `}</style>

      {targetPicker.isOpen && (
          <TargetPickerModal 
              actionType={targetPicker.type}
              entities={entities}
              initiativeList={initiativeList}
              myId={monster.id}
              onClose={() => setTargetPicker({ ...targetPicker, isOpen: false })}
              onSelect={handleTargetSelection}
          />
      )}

      <div className="fixed top-0 left-0 h-full w-[340px] bg-[#0f0d0a] border-r border-[#2e2518] z-[600] flex flex-col animate-in slide-in-from-left duration-300 font-['Crimson_Pro',_serif]">
        
        <div className="p-5 flex items-center justify-between bg-[#1a1510] border-b border-[#1e1a12] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-[50px] h-[50px] rounded-full border border-[#c8942a] p-[2px] shrink-0 bg-[#0f0d0a]">
              <div className="w-full h-full rounded-full border border-[#2e2518] overflow-hidden bg-[#1a1510]">
                {(monster.tokenImage || monster.image) && <img src={monster.tokenImage || monster.image} className="w-full h-full object-cover grayscale-[20%] contrast-125" alt="" />}
              </div>
            </div>
            <div className="flex flex-col">
              <h2 className="font-['Cinzel',_serif] font-semibold text-[#c8942a] text-[18px] uppercase tracking-[2px] leading-none">
                <span className="text-[#8a7550] mr-1">✦</span>{monster.name}
              </h2>
              <span className="font-['Cinzel',_serif] font-normal text-[#4a3e28] text-[9px] uppercase tracking-[4px] mt-1">
                {monster.race || 'Humanoide'} • {monster.classType || 'NPC'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-[#4a3e28] hover:text-[#8b1a1a] transition-colors self-start mt-1">
            <Skull size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto grimoire-scrollbar p-5 space-y-6">
          {monster.level && (
            <div className="inline-block bg-[#1e1205] border border-[#c8942a] text-[#e8a030] font-['Cinzel',_serif] text-[9px] uppercase tracking-[1px] px-2.5 py-0.5 rounded-[4px] -mt-3 mb-2">
              Nível de Desafio {monster.level}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-end">
              <span className="font-['Cinzel',_serif] text-[9px] text-[#4a3e28] tracking-[4px]">Pontos de Vida</span>
              <span className="font-semibold text-[14px] text-[#c8942a] leading-none">{monster.hp} / {monster.maxHp}</span>
            </div>
            <div className="flex w-full h-[10px] gap-[1px] bg-[#0f0d0a] border border-[#2e2518] p-[1px] rounded-[4px]">
              {Array.from({ length: blocksToRender }).map((_, i) => (
                <div key={i} className={`flex-1 h-full rounded-[1px] ${i < activeBlocks ? hpColorClass : 'bg-[#1a1510]'}`} />
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input type="number" value={hpInput} onChange={e => setHpInput(e.target.value)} placeholder="0" className="w-16 bg-[#1a1510] border border-[#2e2518] text-[#e8dcc8] font-semibold text-center rounded-[4px] outline-none hover:border-[#4a3820] focus:border-[#c8942a] transition-colors" />
              <button onClick={handleHeal} className="flex-1 bg-[#2d5c1a] hover:bg-[#3d7c24] border-t border-t-[#c8942a] border-x border-b border-[#2e2518] text-[#e8dcc8] font-['Cinzel',_serif] text-[10px] uppercase tracking-[2px] font-semibold rounded-[4px] transition-colors">+ Curar</button>
              <button onClick={handleDamage} className="flex-1 bg-[#6b1414] hover:bg-[#8b1a1a] border-t border-t-[#c8942a] border-x border-b border-[#2e2518] text-[#e8dcc8] font-['Cinzel',_serif] text-[10px] uppercase tracking-[2px] font-semibold rounded-[4px] transition-colors">Dano</button>
            </div>
          </div>

          <div className="w-full border-t border-[#1e1a12]"></div>

          <div className="flex gap-3">
            <div className="flex-1 bg-[#1a1510] border border-[#2e2518] rounded-[6px] p-3 flex flex-col items-center justify-center relative overflow-hidden">
              <Shield size={16} className="text-[#8a7550] mb-1" strokeWidth={1.5} />
              <span className="text-[28px] font-semibold text-[#e8dcc8] leading-none mb-1">{monster.ac}</span>
              <span className="font-['Cinzel',_serif] text-[8px] tracking-[2px] text-[#4a3e28] uppercase">Classe de Arm.</span>
            </div>
            <div className="flex-1 bg-[#1a1510] border border-[#2e2518] hover:border-[#c8942a] hover:bg-[#221c13] rounded-[6px] p-3 flex flex-col items-center justify-center relative cursor-pointer transition-colors" onClick={() => onRoll('Iniciativa', `Rolagem de ${monster.name}`, dexMod)}>
              <Zap size={16} className="text-[#8a7550] mb-1" strokeWidth={1.5} />
              <span className="text-[28px] font-semibold text-[#e8dcc8] leading-none mb-1">{dexMod >= 0 ? `+${dexMod}` : dexMod}</span>
              <span className="font-['Cinzel',_serif] text-[8px] tracking-[2px] text-[#4a3e28] uppercase">Iniciativa</span>
            </div>
          </div>

          <div className="w-full border-t border-[#1e1a12]"></div>

          {/* GRID DE ATRIBUTOS */}
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(stats).map(([k, v]) => {
              const mod = getMod(Number(v));
              const modColor = mod > 0 ? 'text-[#4a7a28]' : mod < 0 ? 'text-[#8b1a1a]' : 'text-[#8a7550]';
              return (
                <button key={k} onClick={() => onRoll(`Teste de ${k.toUpperCase()}`, monster.name, mod)} className="bg-[#1a1510] border border-[#2e2518] hover:border-[#4a3820] hover:bg-[#221c13] rounded-[6px] p-2 flex flex-col items-center justify-center transition-colors">
                  <span className="font-['Cinzel',_serif] text-[8px] tracking-[3px] text-[#4a3e28] uppercase mb-0.5">{k}</span>
                  <span className="text-[22px] font-semibold text-[#e8dcc8] leading-none mb-1">{v}</span>
                  <span className={`font-['Cinzel',_serif] text-[11px] ${modColor}`}>({formatMod(Number(v))})</span>
                </button>
              );
            })}
          </div>

          {/* AÇÕES RÁPIDAS */}
          <div className="pt-2">
              <div className="flex items-center gap-3 mb-4 opacity-70">
                <div className="h-[1px] flex-1 bg-[#4a3820]"></div>
                <span className="font-['Cinzel',_serif] text-[9px] tracking-[3px] text-[#c8942a] uppercase">Ações Rápidas</span>
                <div className="h-[1px] flex-1 bg-[#4a3820]"></div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                  {[
                      { id: 'attack', label: 'Atacar', icon: <Sword size={14} color="#6b2a2a" strokeWidth={2.5}/>, msg: 'Ataque Rolado' },
                      { id: 'dodge', label: 'Esquivar', icon: <ShieldAlert size={14} color="#1e3a5a" strokeWidth={2.5}/>, msg: '🛡️ **Esquiva (Dodge):** Jogadas contra o monstro têm desvantagem.' },
                      { id: 'help', label: 'Ajudar', icon: <Users size={14} color="#1e3a18" strokeWidth={2.5}/>, msg: '🤝 **Ajudar (Help):** Concede Vantagem a um aliado.' },
                      { id: 'dash', label: 'Disparar', icon: <ArrowUpRight size={14} color="#4a3010" strokeWidth={2.5}/>, msg: '🏃 **Disparada (Dash):** Movimento extra neste turno.' },
                  ].map(action => (
                      <button key={action.id} type="button" onClick={() => handleActionClick(action.id, action.msg)} className="bg-[#1a1510] border border-[#2e2518] rounded-[5px] p-2 flex items-center justify-between hover:border-[#4a3820] hover:bg-[#221c13] transition-colors group cursor-pointer" style={{ opacity: combatActionsUsed[action.id] ? 0.5 : 1 }}>
                        <div className="flex items-center gap-2">{action.icon}<span className="font-['Cinzel',_serif] text-[11px] text-[#e8dcc8]">{action.label}</span></div>
                        <div className="w-2 h-2 rounded-full border border-[#2e2518] bg-[#1a1510]" style={{ background: combatActionsUsed[action.id] ? '#c8942a' : '#1a1510' }}></div>
                      </button>
                  ))}
              </div>
              <button onClick={() => handleActionClick('bonus', '✨ **Ação Bônus Utilizada!**')} className="w-full bg-[#1a1510] border border-[#2e2518] rounded-[5px] p-2 flex items-center justify-between hover:border-[#4a3820] hover:bg-[#221c13] transition-colors group cursor-pointer mb-2" style={{ opacity: combatActionsUsed['bonus'] ? 0.5 : 1 }}>
                <div className="flex items-center gap-2"><Sparkles className="text-[#2a1a4a] w-[14px] h-[14px]" strokeWidth={2.5}/><span className="font-['Cinzel',_serif] text-[11px] text-[#e8dcc8]">Ação Bônus</span></div>
                <div className="w-2 h-2 rounded-full border border-[#2e2518]" style={{ background: combatActionsUsed['bonus'] ? '#c8942a' : '#1a1510' }}></div>
              </button>
          </div>

          {/* ATAQUES DO MONSTRO */}
          <div className="pt-2 pb-6">
            <div className="flex items-center gap-3 mb-4 opacity-70">
              <div className="h-[1px] flex-1 bg-[#4a3820]"></div>
              <span className="font-['Cinzel',_serif] text-[10px] tracking-[3px] text-[#c8942a] uppercase">Ataques & Habilidades</span>
              <div className="h-[1px] flex-1 bg-[#4a3820]"></div>
            </div>
            {monster.actions && monster.actions.length > 0 ? (
              <div className="space-y-3">
                {monster.actions.map((act: any, idx: number) => (
                  <div key={idx} className="bg-[#1a1510] border border-[#2e2518] hover:border-[#c8942a] hover:bg-[#221c13] rounded-[6px] p-3 flex flex-col cursor-pointer transition-colors"
                    onClick={() => {
                        // Ao clicar no ataque, abre o seletor de alvo primeiro
                        setTargetPicker({ isOpen: true, type: 'attack' });
                        // A rolagem real será disparada após a seleção do alvo para vincular o dano
                        // Por enquanto, rola o ataque base
                        onRoll(`Ataque: ${act.name}`, `${monster.name} ataca!`, act.attackBonus || 0, act.damage, act.damageType);
                    }}
                  >
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="font-['Cinzel',_serif] text-[13px] font-semibold text-[#c8942a] uppercase tracking-wide">{act.name}</span>
                      <span className="text-[11px] text-[#8a7550] italic text-right">{act.range || 'Corpo-a-corpo'}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[12px] text-[#4a7a28] font-semibold">{act.attackBonus >= 0 ? `+${act.attackBonus}` : act.attackBonus} Acerto</span>
                      <div className="flex items-center gap-1.5 bg-[#0f0d0a] border border-[#2e2518] px-2 py-1 rounded-[4px]">
                        <span className="text-[12px] font-semibold text-[#8b1a1a]">{act.damage}</span>
                        <span className="font-['Cinzel',_serif] text-[8px] tracking-[1px] bg-[#6b1414] text-[#e8dcc8] px-1 rounded-[2px]">DANO</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-[12px] text-[#4a3e28] italic text-center py-4">Este manuscrito não detalha seus ataques.</p>}
          </div>

        </div>
      </div>
    </>
  );
}