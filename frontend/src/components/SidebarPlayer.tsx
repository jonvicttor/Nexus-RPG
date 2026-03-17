import React, { useState, useEffect, useRef } from 'react';
import Chat, { ChatMessage } from './Chat';
import { Entity, Item } from '../App';
import LevelUpModal from './LevelUpModal';
import { getLevelFromXP, getProficiencyBonus, calculateHPGain, XP_TABLE } from '../utils/gameRules';
import SkillList from './SkillList';
import Inventory from './Inventory';
import { mapEntityStatsToAttributes } from '../utils/attributeMapping';
import { 
  Shield, Zap, Skull, Backpack, Dna, Flame, Heart, Scroll 
} from 'lucide-react';

// --- TIPAGEM ---
export interface InitiativeItem {
  id: number;
  name: string;
  value: number;
}

// --- DADOS ---
const CLASS_ABILITIES: Record<string, { name: string; max: number; icon: string; desc: string; color: string; unlockLevel: number }[]> = {
  'BARBARO': [
    { name: 'Fúria', max: 2, icon: '😡', desc: 'Vantagem em FOR, Resistência a dano.', color: 'text-red-500', unlockLevel: 1 },
    { name: 'Ataque Imprudente', max: 99, icon: '⚠️', desc: 'Vantagem no ataque, inimigos têm vantagem.', color: 'text-orange-500', unlockLevel: 2 }
  ],
  'GUERREIRO': [
    { name: 'Retomar o Fôlego', max: 1, icon: '🩹', desc: 'Recupera 1d10 + Nível de PV.', color: 'text-green-400', unlockLevel: 1 },
    { name: 'Surto de Ação', max: 1, icon: '⚡', desc: 'Ganha uma ação extra.', color: 'text-yellow-500', unlockLevel: 2 }
  ],
  'CLERIGO': [
    { name: 'Curar Ferimentos', max: 2, icon: '✨', desc: 'Rola 1d8 + Sabedoria de cura.', color: 'text-blue-400', unlockLevel: 1 },
    { name: 'Canalizar Divindade', max: 1, icon: '🙏', desc: 'Efeito especial do domínio.', color: 'text-yellow-400', unlockLevel: 2 }
  ],
};

const SPELL_SLOTS_BY_LEVEL: Record<number, number[]> = {
    1: [2], 2: [3], 3: [4, 2], 4: [4, 3], 5: [4, 3, 2] 
};

interface SidebarPlayerProps {
  entities: Entity[];
  myCharacterName: string; 
  myCharacterId: number;
  initiativeList: InitiativeItem[];
  activeTurnId: number | null;
  chatMessages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onRollAttribute: (charName: string, attrName: string, mod: number) => void;
  onUpdateCharacter?: (id: number, updates: Partial<Entity>) => void;
  onSelectEntity?: (entity: Entity) => void;
  
  // NOVO: APLICAR DANO VIA CHAT
  onApplyDamageFromChat: (targetId: number, damageExpression: string) => void;
}

const SidebarPlayer: React.FC<SidebarPlayerProps> = ({ 
  entities, myCharacterName, myCharacterId, initiativeList, activeTurnId, chatMessages, onSendMessage, onRollAttribute, onUpdateCharacter, onSelectEntity, onApplyDamageFromChat
}) => {
  const [activeTab, setActiveTab] = useState<'char' | 'inv' | 'spells' | 'chat' | 'journal'>('char');
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [pendingLevelData, setPendingLevelData] = useState<{ newLevel: number, hpGain: number } | null>(null);
  
  const [abilityUsage, setAbilityUsage] = useState<Record<string, number>>({});
  const [spellSlotsUsed, setSpellSlotsUsed] = useState<number[]>([0,0,0,0,0,0,0,0,0]); 
  const [deathSaves, setDeathSaves] = useState({ successes: 0, failures: 0 });

  const chatEndRef = useRef<HTMLDivElement>(null);

  const myCharacter = entities.find(e => e.id === myCharacterId) || entities.find(e => e.type === 'player' && e.name === myCharacterName); 
  
  const currentXP = myCharacter?.xp || 0;
  const calculatedLevel = getLevelFromXP(currentXP);
  const savedLevel = myCharacter?.level || 1;
  const proficiencyBonus = getProficiencyBonus(savedLevel);
  const attributes = myCharacter ? mapEntityStatsToAttributes(myCharacter) : { FOR: 10, DES: 10, CON: 10, INT: 10, SAB: 10, CAR: 10 };
  
  const inventory = (myCharacter?.inventory || []);

  const dexMod = Math.floor((attributes.DES - 10) / 2);
  const equippedArmor = inventory.find(i => i.isEquipped && i.type === 'armor');
  const armorBonus = equippedArmor?.stats?.ac || 0;
  const currentAC = (myCharacter?.ac || 10) + armorBonus; 

  const nextLevelTotalXP = 300 * Math.pow(2, savedLevel - 1); 
  const currentLevelBaseXP = XP_TABLE ? XP_TABLE[savedLevel - 1] : 0;
  const xpVisivel = currentXP - currentLevelBaseXP;
  const xpNecessarioNoNivel = nextLevelTotalXP - currentLevelBaseXP;
  const xpPercent = xpNecessarioNoNivel > 0 ? Math.min(100, (xpVisivel / xpNecessarioNoNivel) * 100) : 100;

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

  const handleUseAbility = (abilityName: string, max: number, desc: string) => {
    if (!myCharacter) return;
    const key = `${myCharacter.name}_${abilityName}`;
    const current = abilityUsage[key] || 0;
    if (max !== 99 && current >= max) { alert("Habilidade esgotada! Faça um descanso."); return; }
    if (max !== 99) setAbilityUsage(prev => ({ ...prev, [key]: current + 1 }));
    onSendMessage(`⚡ **${myCharacter.name}** usou **${abilityName}**!\n> *${desc}*`);
  };

  const handleEquipItem = (item: Item) => {
      if (!myCharacter || !onUpdateCharacter) return;
      let newInv = [...inventory];
      
      if (item.type === 'potion') {
          onSendMessage(`🧪 **${myCharacter.name}** usou **${item.name}**.`);
          if (item.quantity > 1) {
              newInv = newInv.map(i => i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i);
          } else {
              newInv = newInv.filter(i => i.id !== item.id);
          }
          onUpdateCharacter(myCharacter.id, { inventory: newInv });
          return;
      }

      if (item.isEquipped) {
          newInv = newInv.map(i => i.id === item.id ? { ...i, isEquipped: false } : i);
          onUpdateCharacter(myCharacter.id, { inventory: newInv });
          onSendMessage(`🛡️ **${myCharacter.name}** desequipou **${item.name}**.`);
          return;
      }

      if (item.type === 'armor') {
          newInv = newInv.map(i => i.type === 'armor' ? { ...i, isEquipped: false } : i);
      } else if (item.type === 'weapon') { 
          const equippedWeapons = newInv.filter(i => i.isEquipped && i.type === 'weapon');
          if (equippedWeapons.length >= 2) {
              newInv = newInv.map(i => i.id === equippedWeapons[0].id ? { ...i, isEquipped: false } : i);
          }
      }
      
      newInv = newInv.map(i => i.id === item.id ? { ...i, isEquipped: true } : i);
      onUpdateCharacter(myCharacter.id, { inventory: newInv });
      onSendMessage(`⚔️ **${myCharacter.name}** equipou **${item.name}**.`);
  };

  const handleDropItem = (item: Item) => {
      if (!myCharacter || !onUpdateCharacter) return;
      if (window.confirm(`Tem certeza que deseja jogar fora ${item.name}?`)) {
          const newInv = inventory.filter(i => i.id !== item.id);
          onUpdateCharacter(myCharacter.id, { inventory: newInv });
          onSendMessage(`🗑️ **${myCharacter.name}** descartou **${item.name}**.`);
      }
  };

  const handleCastSpell = (spellName: string, level: number) => {
      if (!myCharacter) return; 
      const currentUsed = spellSlotsUsed[level-1] || 0;
      const maxSlots = (SPELL_SLOTS_BY_LEVEL[savedLevel] || [])[level-1] || 0;
      if (currentUsed >= maxSlots) { alert("Sem slots de magia disponíveis neste nível!"); return; }
      const newSlots = [...spellSlotsUsed];
      newSlots[level-1]++;
      setSpellSlotsUsed(newSlots);
      onSendMessage(`✨ **${myCharacter.name}** conjurou **${spellName}** (Slot Nível ${level})!`);
  };

  const handleDeathSave = (type: 'success' | 'failure') => {
      if (!myCharacter) return;
      const newVal = type === 'success' ? deathSaves.successes + 1 : deathSaves.failures + 1;
      if (newVal > 3) return; 
      setDeathSaves(prev => ({ ...prev, [type === 'success' ? 'successes' : 'failures']: newVal }));
      const roll = Math.floor(Math.random() * 20) + 1;
      const msg = type === 'success' ? `Salvaguarda de Morte: SUCESSO (${newVal}/3)` : `Salvaguarda de Morte: FALHA (${newVal}/3)`;
      onSendMessage(`💀 **${myCharacter.name}** rolou ${msg} [Dado: ${roll}]`);
  };

  const handleShortRest = () => {
      if (!myCharacter || !onUpdateCharacter) return;
      const hitDie = Math.floor(Math.random() * 8) + 1 + Math.floor(((myCharacter.stats?.con || 10) - 10)/2);
      const newHp = Math.min((myCharacter.hp || 0) + hitDie, myCharacter.maxHp || 10);
      onUpdateCharacter(myCharacter.id, { hp: newHp });
      onSendMessage(`⛺ **${myCharacter.name}** descansou brevemente e recuperou **${hitDie} PV**.`);
  };

  const handleLongRest = () => {
    if (!myCharacter || !onUpdateCharacter) return;
    if (window.confirm("Fazer um Descanso Longo?")) {
        setAbilityUsage({}); setSpellSlotsUsed([0,0,0,0,0,0,0,0,0]); setDeathSaves({ successes: 0, failures: 0 });
        onUpdateCharacter(myCharacter.id, { hp: myCharacter.maxHp });
        onSendMessage(`💤 **${myCharacter.name}** realizou um Descanso Longo. Vida, magias e recursos restaurados.`);
    }
  };

  return (
    <>
        {showLevelUpModal && pendingLevelData && myCharacter && (
            <LevelUpModal newLevel={pendingLevelData.newLevel} hpGain={pendingLevelData.hpGain} charClass={myCharacter.classType || 'GUERREIRO'} oldStats={myCharacter.stats || {str:10,dex:10,con:10,int:10,wis:10,cha:10}} onConfirm={(u) => { if(onUpdateCharacter && myCharacter) { onUpdateCharacter(myCharacter.id, {...u, level: pendingLevelData.newLevel, hp: Math.min((myCharacter.hp||0)+pendingLevelData.hpGain, (myCharacter.maxHp||0)+pendingLevelData.hpGain), maxHp: (myCharacter.maxHp||0)+pendingLevelData.hpGain}); setShowLevelUpModal(false);}}} />
        )}

        <div className="box-border flex flex-col h-full border-l-8 border-[#2a2018] relative z-50 w-[420px] min-w-[420px] bg-[#1a1510] shadow-[inset_0_0_60px_rgba(0,0,0,0.9)] font-serif text-gray-200">
            {myCharacter && (
            <div className="relative z-10 p-4 border-b border-white/10 bg-gradient-to-b from-black/60 to-transparent">
                <div className="flex gap-4">
                    <div className="relative group cursor-pointer" onClick={() => onSelectEntity && onSelectEntity(myCharacter)}>
                        <div className="w-20 h-20 rounded-full border-2 border-amber-600 overflow-hidden shadow-lg bg-black"><img src={myCharacter.image || '/tokens/aliado.png'} className="w-full h-full object-cover" alt="Token" /></div>
                        <div className="absolute -bottom-2 -right-1 bg-black border border-amber-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold text-amber-500 shadow-md">{savedLevel}</div>
                    </div>
                    <div className="flex-grow pt-1">
                        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-100 to-amber-600 truncate">{myCharacter.name}</h2>
                        <p className="text-xs text-amber-500/70 font-bold uppercase tracking-widest">{myCharacter.race} {myCharacter.classType}</p>
                        <div className="mt-3">
                            <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400 mb-1"><span className="flex items-center gap-1"><Heart size={10} className="text-red-500"/> Vida</span><span className="text-green-400">{myCharacter.hp} / {myCharacter.maxHp}</span></div>
                            <div className="h-2 w-full bg-gray-900 rounded-full border border-white/10 overflow-hidden"><div className="h-full bg-gradient-to-r from-red-900 via-red-600 to-red-500 transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, ((myCharacter.hp || 0) / (myCharacter.maxHp || 1)) * 100))}%` }}></div></div>
                            <div className="mt-1"><div className="flex justify-between text-[8px] text-gray-500 mb-0.5 font-mono"><span>XP</span><span>{xpVisivel} / {xpNecessarioNoNivel}</span></div><div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden border border-white/5"><div className="h-full bg-purple-600" style={{ width: `${xpPercent}%` }}></div></div></div>
                        </div>
                    </div>
                </div>
                {(myCharacter.hp || 0) <= 0 && (
                    <div className="mt-4 bg-red-950/30 border border-red-900/50 rounded p-2 flex justify-between items-center animate-pulse">
                        <span className="text-[10px] text-red-400 uppercase font-bold flex items-center gap-1"><Skull size={12}/> Contra a Morte</span>
                        <div className="flex gap-4">
                            <div className="flex gap-1 items-center"><span className="text-[8px] text-green-700">SUC</span>{[1,2,3].map(i => (<div key={i} onClick={() => handleDeathSave('success')} className={`w-3 h-3 rounded-full border border-green-800 cursor-pointer ${i <= deathSaves.successes ? 'bg-green-500' : 'bg-black'}`}></div>))}</div>
                            <div className="flex gap-1 items-center"><span className="text-[8px] text-red-700">FAL</span>{[1,2,3].map(i => (<div key={i} onClick={() => handleDeathSave('failure')} className={`w-3 h-3 rounded-full border border-red-800 cursor-pointer ${i <= deathSaves.failures ? 'bg-red-500' : 'bg-black'}`}></div>))}</div>
                        </div>
                    </div>
                )}
            </div>
            )}

            <div className="flex border-b border-white/5 bg-black/40 relative z-10">
                <button onClick={() => setActiveTab('char')} className={`flex-1 py-3 flex justify-center items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'char' ? 'text-amber-400 bg-amber-900/20 border-b-2 border-amber-500' : 'text-gray-500 hover:bg-white/5'}`}><Dna size={14}/> Ficha</button>
                <button onClick={() => setActiveTab('inv')} className={`flex-1 py-3 flex justify-center items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'inv' ? 'text-amber-400 bg-amber-900/20 border-b-2 border-amber-500' : 'text-gray-500 hover:bg-white/5'}`}><Backpack size={14}/> Itens</button>
                <button onClick={() => setActiveTab('spells')} className={`flex-1 py-3 flex justify-center items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'spells' ? 'text-amber-400 bg-amber-900/20 border-b-2 border-amber-500' : 'text-gray-500 hover:bg-white/5'}`}><Flame size={14}/> Magia</button>
                <button onClick={() => setActiveTab('chat')} className={`flex-1 py-3 flex justify-center items-center gap-2 text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'chat' ? 'text-amber-400 bg-amber-900/20 border-b-2 border-amber-500' : 'text-gray-500 hover:bg-white/5'}`}>Chat</button>
            </div>

            <div className={`flex-1 min-h-0 w-full max-w-full relative z-10 ${activeTab === 'chat' ? 'overflow-hidden p-0' : 'overflow-y-auto p-4 custom-scrollbar'}`}>
                
                {/* 1. ABA FICHA */}
                {activeTab === 'char' && myCharacter && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-black/40 border border-white/10 rounded p-2 text-center"><span className="text-[9px] text-gray-500 uppercase font-bold block mb-1">Classe de Armadura</span><div className="text-xl font-black text-white flex items-center justify-center gap-1"><Shield size={14} className="text-gray-400"/> {currentAC}</div></div>
                            <div className="bg-black/40 border border-white/10 rounded p-2 text-center"><span className="text-[9px] text-gray-500 uppercase font-bold block mb-1">Iniciativa</span><div className="text-xl font-black text-white flex items-center justify-center gap-1"><Zap size={14} className="text-yellow-500"/> {dexMod >= 0 ? `+${dexMod}` : dexMod}</div></div>
                            <div className="bg-black/40 border border-white/10 rounded p-2 text-center"><span className="text-[9px] text-gray-500 uppercase font-bold block mb-1">Deslocamento</span><div className="text-xl font-black text-white">9m</div></div>
                        </div>
                        <div className="mb-6">
                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-2 tracking-widest border-b border-white/5 pb-1">Habilidades</p>
                            <div className="flex flex-col gap-2">
                                {CLASS_ABILITIES[myCharacter.classType?.toUpperCase() || 'GUERREIRO']?.map((ability, idx) => {
                                    if (savedLevel < ability.unlockLevel) return null;
                                    const key = `${myCharacter.name}_${ability.name}`; const used = abilityUsage[key] || 0; const disabled = ability.max !== 99 && used >= ability.max;
                                    return <button key={idx} onClick={(e)=>{e.stopPropagation(); handleUseAbility(ability.name, ability.max, ability.desc)}} disabled={disabled} className={`flex items-center gap-3 p-2 rounded border transition-all text-left w-full ${disabled?'bg-gray-800/50 opacity-50':'bg-black/30 hover:border-blue-500/30'}`}><span className={`text-xl ${ability.color}`}>{ability.icon}</span><div className="flex-grow min-w-0"><div className="flex justify-between"><span className="text-xs font-bold text-gray-200">{ability.name}</span>{ability.max!==99&&<div className="flex gap-1">{Array.from({length:ability.max}).map((_,i)=><div key={i} className={`w-1.5 h-1.5 rounded-full ${i<used?'bg-gray-700':'bg-green-400'}`}></div>)}</div>}</div><span className="text-[9px] text-gray-500 truncate block">{ability.desc}</span></div></button>
                                })}
                            </div>
                        </div>
                        <div className="relative"><SkillList attributes={attributes} proficiencyBonus={proficiencyBonus} profs={[]} onRoll={(s,m)=>onRollAttribute(myCharacter.name,s,m)}/></div>
                        <div className="grid grid-cols-2 gap-2"><button onClick={handleShortRest} className="py-2 bg-blue-900/20 hover:bg-blue-800/40 border border-blue-500/30 rounded text-xs font-bold text-blue-200">Descanso Curto</button><button onClick={handleLongRest} className="py-2 bg-indigo-900/20 hover:bg-indigo-800/40 border border-indigo-500/30 rounded text-xs font-bold text-indigo-200">Descanso Longo</button></div>
                    </div>
                )}

                {/* 2. ABA INVENTÁRIO (ATUALIZADA COM OWNER ID) */}
                {activeTab === 'inv' && myCharacter && (
                    <Inventory 
                        items={inventory} 
                        ownerId={myCharacter.id} // <--- PASSANDO O ID CORRETAMENTE
                        onEquip={handleEquipItem}
                        onDrop={handleDropItem}
                    />
                )}

                {/* 3. ABA MAGIAS */}
                {activeTab === 'spells' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        {myCharacter ? (
                            <>
                                <div className="text-center mb-6"><h3 className="text-purple-400 font-mono text-xs uppercase tracking-widest mb-1">Grimório Arcano</h3><p className="text-[10px] text-gray-500">Sabedoria {attributes.SAB} • CD {8+proficiencyBonus+Math.floor((attributes.SAB-10)/2)}</p></div>
                                <div className="space-y-4">
                                    {[1, 2, 3].map(level => {
                                        const max = (SPELL_SLOTS_BY_LEVEL[savedLevel]||[])[level-1]||0; if(max===0)return null; const used = spellSlotsUsed[level-1]||0;
                                        return (
                                            <div key={level} className="bg-black/30 border border-purple-900/30 rounded p-3">
                                                <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-purple-200">Círculo {level}</span><div className="flex gap-1">{Array.from({length:max}).map((_,i)=><div key={i} className={`w-2 h-2 rounded-full border border-purple-500 ${i<(max-used)?'bg-purple-400 shadow-[0_0_5px_#a855f7]':'bg-black opacity-30'}`}></div>)}</div></div>
                                                <div className="space-y-1"><button onClick={()=>handleCastSpell("Mísseis Mágicos",level)} disabled={used>=max} className="w-full text-left p-2 rounded hover:bg-purple-900/20 flex justify-between items-center group disabled:opacity-30"><span className="text-xs text-gray-300 group-hover:text-white">Mísseis Mágicos</span><span className="text-[9px] text-purple-500 font-bold uppercase">Conjurar</span></button></div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                                <Scroll size={40} className="mb-2 opacity-20" />
                                <p className="text-xs">Selecione um personagem</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div className="h-full flex flex-col">
                        <Chat 
                            messages={chatMessages} 
                            onSendMessage={onSendMessage} 
                            role="PLAYER" 
                            onApplyDamage={onApplyDamageFromChat} // <--- AQUI REPASA
                        />
                    </div>
                )}
                {activeTab === 'journal' && <div className="p-4"><textarea className="w-full h-64 bg-black/20 border border-white/10 rounded p-3 text-sm text-gray-300 font-sans" placeholder="Diário..."></textarea></div>}
            </div>
        </div>
    </>
  );
};

export default SidebarPlayer;