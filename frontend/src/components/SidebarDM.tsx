import React, { useState, useRef } from 'react';
import Soundboard from './Soundboard'; 
import Chat, { ChatMessage } from './Chat'; 
import { Entity, MonsterPreset } from '../App';
import EditEntityModal from './EditEntityModal';
import CampaignManager from './CampaignManager';
import { getLevelFromXP, getNextLevelXP } from '../utils/gameRules';
import SkillList from './SkillList';
import ItemCreator from './ItemCreator';
import Scratchpad from './Scratchpad'; 
import { mapEntityStatsToAttributes } from '../utils/attributeMapping';
import { Eye, EyeOff } from 'lucide-react';

export interface InitiativeItem { id: number; name: string; value: number; }

const MONSTER_LIST: MonsterPreset[] = [
  { name: 'Lobo', hp: 11, ac: 13, image: '/tokens/lobo.png' },
  { name: 'Goblin', hp: 7, ac: 15, image: '/tokens/goblin.png' },
  { name: 'Esqueleto', hp: 13, ac: 13, image: '/tokens/skeleton.png' },
  { name: 'Orc', hp: 15, ac: 13, image: '/tokens/orc.png' },
  { name: 'Bandido', hp: 11, ac: 12, image: '/tokens/bandido.png' },
  { name: 'Zumbi', hp: 22, ac: 8, image: '/tokens/zumbi.png' }
];

const AVAILABLE_MAPS = [
    { name: 'Floresta', url: '/maps/floresta.jpg' }, 
    { name: 'Caverna', url: '/maps/caverna.jpg' }, 
    { name: 'Taverna', url: '/maps/taverna.jpg' }, 
    { name: 'Masmorra', url: '/maps/masmorra.jpg' }
];

type SidebarTab = 'combat' | 'map' | 'create' | 'audio' | 'tools' | 'campaign'; 
type MainTab = 'tools' | 'chat';

interface SidebarDMProps {
  entities: Entity[];
  onUpdateHP: (id: number, change: number) => void;
  onAddEntity: (type: 'enemy' | 'player', name: string, preset?: MonsterPreset) => void;
  onDeleteEntity: (id: number) => void;
  onEditEntity: (id: number, updates: Partial<Entity>) => void;
  isFogMode: boolean;
  onToggleFogMode: () => void;
  onResetFog: () => void;
  onRevealAll: () => void;
  fogTool: 'reveal' | 'hide';
  onSetFogTool: (tool: 'reveal' | 'hide') => void;
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
  
  // PROPS DE ÁUDIO
  currentTrack: string | null;
  onPlayMusic: (trackId: string) => void;
  onStopMusic: () => void;
  onPlaySFX: (sfxId: string) => void;
  audioVolume: number;
  onSetAudioVolume: (val: number) => void;

  // MAPA
  onResetView: () => void;

  // INVENTÁRIO 
  onGiveItem: (targetId: number, item: any) => void;

  // NOVO: APLICAR DANO VIA CHAT
  onApplyDamageFromChat: (targetId: number, damageExpression: string) => void;
}

const AoEColorPicker = ({ selected, onSelect }: { selected: string, onSelect: (c: string) => void }) => {
    const colors = [{ c: '#ef4444', label: '🔥', name: 'Fogo' }, { c: '#3b82f6', label: '❄️', name: 'Gelo' }, { c: '#22c55e', label: '🧪', name: 'Ácido' }, { c: '#a855f7', label: '🔮', name: 'Magia' }, { c: '#eab308', label: '⚡', name: 'Raio' }, { c: '#111827', label: '🌑', name: 'Escuridão' }];
    return (
        <div className="flex gap-1 justify-center bg-black/40 p-1.5 rounded mt-2">
            {colors.map(opt => (<button key={opt.c} onClick={() => onSelect(opt.c)} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] transition-all hover:scale-110 border ${selected === opt.c ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-70 hover:opacity-100'}`} style={{ backgroundColor: opt.c }} title={opt.name}>{opt.label}</button>))}
        </div>
    );
};

const EntityControlRow = ({ entity, onUpdateHP, onDeleteEntity, onClickEdit, onAddToInit, isTarget, isAttacker, onSetTarget, onSetAttacker, onToggleCondition, onAddXP, onToggleVisibility }: any) => {
  const hpPercent = Math.max(0, Math.min(100, (entity.hp / entity.maxHp) * 100));
  const isDead = entity.hp <= 0;
  let barColor = 'bg-green-500';
  if (hpPercent < 30) barColor = 'bg-red-600'; else if (hpPercent < 60) barColor = 'bg-yellow-500';
  const [showXPInput, setShowXPInput] = useState(false);
  const [xpAmount, setXpAmount] = useState('');
  const handleGiveXP = (e: React.FormEvent) => { e.preventDefault(); const amount = parseInt(xpAmount); if (amount && onAddXP) { onAddXP(entity.id, amount); setXpAmount(''); setShowXPInput(false); } };

  return (
    <div className={`relative p-3 rounded border transition-all flex flex-col gap-2 group overflow-hidden cursor-pointer ${isDead ? 'opacity-60 grayscale bg-gray-900 border-gray-800' : ''} ${isTarget && !isDead ? 'bg-red-900/30 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : isAttacker ? 'bg-blue-900/30 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'bg-black/40 border-white/10 hover:bg-black/60'}`} onClick={(e) => onSetTarget(entity.id, e.shiftKey)}>
      {isDead && (<div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20 z-0"><span className="text-4xl">💀</span></div>)}
      
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 bg-black/90 border border-white/20 rounded p-0.5 shadow-xl">
        {entity.type === 'player' && (<button onClick={(e) => { e.stopPropagation(); setShowXPInput(!showXPInput); }} className="text-gray-300 hover:text-purple-400 hover:bg-white/10 rounded p-1.5 transition-colors text-sm" title="Dar XP">✨</button>)}
        <button onClick={(e) => { e.stopPropagation(); onSetAttacker(entity.id); }} className={`hover:bg-white/10 rounded p-1.5 transition-colors text-sm ${isAttacker ? 'text-blue-400' : 'text-gray-300'}`} title="Definir como Atacante">🎯</button>
        <button onClick={(e) => { e.stopPropagation(); onAddToInit(); }} className="text-gray-300 hover:text-yellow-400 hover:bg-white/10 rounded p-1.5 transition-colors text-sm" title="Iniciativa">⚔️</button>
        
        <button onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }} className={`hover:bg-white/10 rounded p-1.5 transition-colors text-sm ${entity.visible === false ? 'text-white/30' : 'text-cyan-400'}`} title={entity.visible === false ? "Revelar" : "Ocultar"}>
            {entity.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>

        <button onClick={(e) => { e.stopPropagation(); onClickEdit(); }} className="text-gray-300 hover:text-blue-400 hover:bg-white/10 rounded p-1.5 transition-colors text-sm" title="Editar">✎</button>
        <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Deletar ${entity.name}?`)) onDeleteEntity(entity.id); }} className="text-gray-300 hover:text-red-500 hover:bg-white/10 rounded p-1.5 transition-colors text-sm" title="Excluir">✕</button>
      </div>

      {showXPInput && (<div className="absolute inset-0 z-30 bg-black/90 flex items-center justify-center p-2" onClick={(e) => e.stopPropagation()}><form onSubmit={handleGiveXP} className="flex gap-2 w-full"><input autoFocus type="number" placeholder="XP" className="w-full bg-gray-800 border border-purple-500 text-white px-2 py-1 rounded text-xs" value={xpAmount} onChange={(e) => setXpAmount(e.target.value)} /><button type="submit" className="bg-purple-600 text-white px-3 py-1 rounded text-xs font-bold">OK</button><button type="button" onClick={() => setShowXPInput(false)} className="text-gray-400 hover:text-white text-xs">X</button></form></div>)}

      <div className="flex items-center justify-between pr-2 z-10 relative">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 flex-shrink-0">
            {entity.image ? (<img src={entity.image} alt={entity.name} className={`w-full h-full rounded-full object-cover border border-white/20 shadow-sm ${entity.visible === false ? 'opacity-50 grayscale' : ''}`}/>) : (<div className="w-full h-full rounded-full" style={{ backgroundColor: entity.color }}></div>)}
            {entity.type === 'player' && (<div className="absolute -bottom-1 -right-1 bg-purple-900 border border-purple-500 text-white text-[9px] font-bold px-1 rounded-full shadow-md">Nv.{getLevelFromXP(entity.xp || 0)}</div>)}
          </div>
          <div className="overflow-hidden">
              <span className={`text-gray-200 font-bold text-sm truncate block ${isDead ? 'line-through text-gray-500' : ''} ${entity.visible === false ? 'opacity-50 italic' : ''}`}>
                  {entity.name} {entity.visible === false && '(Oculto)'}
              </span>
              <span className="text-[10px] text-gray-500 uppercase">{entity.classType || 'NPC'}</span>
          </div>
        </div>
        <div className="text-right"><span className={`text-xs font-bold font-mono ${isDead ? 'text-gray-500' : (entity.hp < entity.maxHp / 2 ? 'text-red-500' : 'text-green-400')}`}>{entity.hp}/{entity.maxHp}</span></div>
      </div>
      
      {entity.type === 'player' && (<div className="w-full h-1 bg-gray-800 rounded-full mt-1 relative overflow-hidden"><div className="h-full bg-purple-500" style={{ width: `${Math.min(100, ((entity.xp || 0) / getNextLevelXP(getLevelFromXP(entity.xp || 0))) * 100)}%` }}></div></div>)}
      <div className="w-full h-1.5 bg-gray-900 rounded-full overflow-hidden border border-white/5 mt-1 z-10 relative"><div className={`h-full ${barColor} transition-all duration-500 ease-out`} style={{ width: `${hpPercent}%` }}></div></div>
    </div>
  );
};

const CombatVsPanel = ({ attacker, targets, onUpdateHP, onSendMessage }: { attacker: Entity | null, targets: Entity[], onUpdateHP: (id: number, change: number) => void, onSendMessage: (text: string) => void }) => {
    const [amount, setAmount] = useState('');
    const applyToAll = (damage: boolean) => {
        const val = parseInt(amount);
        if (val) {
            targets.forEach((ent:Entity) => { onUpdateHP(ent.id, damage ? -val : val); });
            setAmount('');
        }
    };

    const handleAttack = () => {
        if (!attacker || targets.length === 0) return;
        const str = attacker.stats?.str || 10;
        const dex = attacker.stats?.dex || 10;
        const mod = Math.floor((Math.max(str, dex) - 10) / 2);
        const modStr = mod >= 0 ? `+${mod}` : `${mod}`;

        targets.forEach(target => {
            const d20 = Math.floor(Math.random() * 20) + 1;
            const total = d20 + mod;
            let resultText = "";
            let isHit = false;
            let isCrit = false;
            let damage = 0;

            if (d20 === 20) {
                resultText = "CRÍTICO! 💥🔥";
                isHit = true;
                isCrit = true;
            } else if (d20 === 1) {
                resultText = "FALHA CRÍTICA! 💩";
                isHit = false;
            } else if (total >= target.ac) {
                resultText = "ACERTOU! ⚔️";
                isHit = true;
            } else {
                resultText = "ERROU! 🛡️";
                isHit = false;
            }

            if (isHit) {
                const baseDmg = Math.floor(Math.random() * 6) + 1;
                damage = isCrit ? (baseDmg * 2) + mod : baseDmg + mod;
                damage = Math.max(1, damage);
                onUpdateHP(target.id, -damage); 
                resultText += ` (Dano: ${damage} aplicado)`;
            }

            onSendMessage(`🎲 **${attacker.name}** ataca **${target.name}**\nRolagem: [${d20}] ${modStr} = **${total}** vs CA ${target.ac}\nResultado: **${resultText}**`);
        });
    };

    const renderHpBar = (entity: Entity) => {
        const hpPercent = Math.max(0, Math.min(100, (entity.hp / entity.maxHp) * 100));
        let barColor = 'bg-green-500';
        if (hpPercent < 30) barColor = 'bg-red-600';
        else if (hpPercent < 60) barColor = 'bg-yellow-500';
        return (
            <div className="flex flex-col items-center w-full px-1 mt-2">
                <div className="w-20 h-2 bg-gray-700 rounded-full border border-black/50 overflow-hidden relative shadow-inner">
                    <div className={`h-full ${barColor} transition-all duration-300`} style={{ width: `${hpPercent}%` }}></div>
                </div>
                <span className="text-[9px] text-white/80 font-mono mt-0.5 font-bold shadow-black drop-shadow-md">{entity.hp}/{entity.maxHp}</span>
            </div>
        );
    };
    if (targets.length === 0 && !attacker) return null;
    return (
        <section className="mb-4 bg-gradient-to-r from-blue-900/20 to-red-900/20 border border-white/10 rounded-lg p-3 animate-in fade-in zoom-in duration-200">
            <h3 className="text-white/50 font-bold text-[10px] uppercase tracking-widest mb-2 text-center">⚔️ RESOLUÇÃO DE COMBATE</h3>
            <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex flex-col items-center w-1/3">
                    {attacker ? (
                        <>
                            <div className="w-12 h-12 rounded-full border-2 border-blue-500 overflow-hidden shadow-lg bg-black relative"><img src={attacker.image || ''} className="w-full h-full object-cover" alt="" /></div>
                            <span className="text-[10px] text-blue-300 font-bold mt-1 truncate max-w-full text-center leading-tight">{attacker.name}</span>
                            {renderHpBar(attacker)}
                        </>
                    ) : (<div className="w-12 h-12 rounded-full border-2 border-dashed border-blue-500/30 flex items-center justify-center text-blue-500/30 text-xs">?</div>)}
                </div>
                <div className="flex flex-col items-center gap-1">
                    <span className="text-white/20 text-xl font-black">VS</span>
                    {attacker && targets.length > 0 && (
                        <button onClick={handleAttack} className="bg-yellow-600/80 hover:bg-yellow-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg border border-yellow-400/30 animate-pulse active:scale-95 transition-all">⚔️ ATACAR</button>
                    )}
                </div>
                <div className="flex flex-col items-center w-1/3">
                    {targets.length > 0 ? (
                        <>
                            <div className="flex -space-x-2 overflow-hidden justify-center w-full">
                                {targets.slice(0, 3).map(t => (
                                    <div key={t.id} className="w-8 h-8 rounded-full border border-red-500 overflow-hidden bg-black flex-shrink-0"><img src={t.image || ''} className="w-full h-full object-cover" alt="" /></div>
                                ))}
                                {targets.length > 3 && (<div className="w-8 h-8 rounded-full border border-red-500 bg-red-900 text-white text-[8px] flex items-center justify-center">+{targets.length - 3}</div>)}
                            </div>
                            <span className="text-[10px] text-red-400 font-bold mt-1">{targets.length} Alvo(s)</span>
                            {targets.length === 1 && renderHpBar(targets[0])}
                        </>
                    ) : (<div className="w-12 h-12 rounded-full border-2 border-dashed border-red-500/30 flex items-center justify-center text-red-500/30 text-xs">?</div>)}
                </div>
            </div>
            {targets.length > 0 && (
                <div className="flex gap-2 border-t border-white/5 pt-3">
                    <input type="number" placeholder="Valor" className="w-16 bg-black/50 border border-white/20 rounded p-1 text-center text-white text-sm font-bold outline-none focus:border-yellow-500" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') applyToAll(true); }} />
                    <button onClick={() => applyToAll(true)} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow-lg uppercase text-[10px] transition-colors">🩸 Dano</button>
                    <button onClick={() => applyToAll(false)} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold rounded shadow-lg uppercase text-[10px] transition-colors">💚 Curar</button>
                </div>
            )}
        </section>
    );
};

const SidebarDM: React.FC<SidebarDMProps> = ({ 
  entities, onUpdateHP, onAddEntity, onDeleteEntity, onEditEntity,
  isFogMode, onToggleFogMode, onResetFog, onRevealAll, fogTool, onSetFogTool, onSyncFog, onSaveGame, onChangeMap,
  initiativeList, activeTurnId, onAddToInitiative, onRemoveFromInitiative, onNextTurn, onClearInitiative, onSortInitiative,
  targetEntityIds, attackerId, onSetTarget, onToggleCondition,
  activeAoE, onSetAoE, chatMessages, onSendMessage,
  onSetAttacker, aoeColor, onSetAoEColor,
  onOpenCreator, onAddXP, customMonsters, globalBrightness = 1, onSetGlobalBrightness, onRequestRoll, onToggleVisibility,
  currentTrack, onPlayMusic, onStopMusic, onPlaySFX, audioVolume, onSetAudioVolume,
  onResetView, onGiveItem, onApplyDamageFromChat
}) => {
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [activeTab, setActiveTab] = useState<SidebarTab>('combat');
  const [mainTab, setMainTab] = useState<MainTab>('tools'); 
  const [showMonsterSelector, setShowMonsterSelector] = useState(false);
  const [customMapUrl, setCustomMapUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingSkillRequest, setPendingSkillRequest] = useState<{ skillName: string, mod: number } | null>(null);
  const [dcInput, setDcInput] = useState<number>(10);
  const FULL_MONSTER_LIST = [...MONSTER_LIST, ...(customMonsters || [])];
  const targetId = targetEntityIds[0];
  const targetEntity = entities.find(e => e.id === targetId);
  const handleConfirmRequest = () => { if (pendingSkillRequest && targetEntity) { onRequestRoll(targetEntity.id, pendingSkillRequest.skillName, pendingSkillRequest.mod, dcInput); setPendingSkillRequest(null); setDcInput(10); } };
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = (event) => { if (event.target?.result) onChangeMap(event.target.result as string); }; reader.readAsDataURL(file); } };
  const handleDragStart = (e: React.DragEvent, type: 'enemy' | 'player') => { e.dataTransfer.setData("entityType", type); };
  const handleSelectPreset = (monster: MonsterPreset) => { const count = entities.filter(e => e.name.startsWith(monster.name)).length; const finalName = count > 0 ? `${monster.name} ${count + 1}` : monster.name; onAddEntity('enemy', finalName, monster); setShowMonsterSelector(false); };
  const handleLoadCustomMap = () => { if (customMapUrl.trim()) { onChangeMap(customMapUrl); setCustomMapUrl(''); } };
  const attacker = entities.find(e => e.id === attackerId) || null;
  const targets = entities.filter(e => targetEntityIds.includes(e.id));
  const toggleConditionForAll = (cond: string) => { targets.forEach(t => onToggleCondition(t.id, cond)); };
  const rollBulkInitiative = (type: 'npc' | 'selected') => { const targetsToRoll = type === 'npc' ? entities.filter(e => e.type === 'enemy') : entities.filter(e => targetEntityIds.includes(e.id)); if(targetsToRoll.length === 0) return; targetsToRoll.forEach(ent => { if (!initiativeList.find(i => i.id === ent.id)) onAddToInitiative(ent); }); };
  const sidebarStyle = { backgroundColor: '#1a1510', backgroundImage: `url('/assets/bg-couro-sidebar.png')`, backgroundSize: 'cover', backgroundRepeat: 'no-repeat', boxShadow: 'inset 0 0 60px rgba(0,0,0,0.9)', width: '420px', minWidth: '420px', maxWidth: '420px', flex: '0 0 420px' };

  return (
    <>
      {editingEntity && (<EditEntityModal entity={editingEntity} onSave={onEditEntity} onClose={() => setEditingEntity(null)} />)}
      {showMonsterSelector && (
        <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowMonsterSelector(false)}>
          <div className="bg-gray-900 border border-red-900/50 p-6 rounded-lg shadow-2xl w-[450px] max-h-[80vh] overflow-y-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-red-500 font-bold uppercase tracking-widest mb-4 text-center border-b border-white/10 pb-2">Invocar Inimigo</h3>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {FULL_MONSTER_LIST.map((monster, idx) => (
                <button key={`${monster.name}-${idx}`} onClick={() => handleSelectPreset(monster)} className="flex flex-col items-center bg-black/40 hover:bg-red-900/20 border border-white/10 hover:border-red-500/50 p-3 rounded transition-all group">
                  <div className="w-12 h-12 rounded-full overflow-hidden mb-2 border border-white/20 group-hover:border-red-500"><img src={monster.image} alt={monster.name} className="w-full h-full object-cover" /></div>
                  <span className="text-sm font-bold text-gray-300 group-hover:text-white truncate w-full text-center">{monster.name}</span>
                  <div className="flex gap-2 text-[10px] text-gray-500 font-mono mt-1"><span>❤️ {monster.hp}</span><span>🛡️ {monster.ac}</span></div>
                </button>
              ))}
            </div>
            <button onClick={() => { setShowMonsterSelector(false); onOpenCreator('enemy'); }} className="w-full py-3 bg-red-900/40 hover:bg-red-600 border border-red-500/50 text-white font-bold rounded uppercase text-xs transition-all mb-2">⚙️ Personalizar (Criar do Zero)</button>
            <button onClick={() => setShowMonsterSelector(false)} className="w-full py-2 text-xs text-gray-500 hover:text-white border border-transparent hover:border-white/20 rounded">Cancelar</button>
          </div>
        </div>
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

      <div className="flex flex-col h-full border-l-8 border-[#2a2018] relative" style={sidebarStyle}>
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/20 via-transparent to-black/40 z-0" />
        <div className="relative z-10 flex flex-col h-full w-full">
            <div className="flex border-b border-white/10 bg-black/40 flex-shrink-0">
                <button onClick={() => setMainTab('tools')} className={`flex-1 py-3 text-center text-sm font-bold uppercase tracking-wider transition-all ${mainTab === 'tools' ? 'text-white bg-rpgAccent/20 border-b-2 border-rpgAccent' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>🛠️ Ferramentas</button>
                <button onClick={() => setMainTab('chat')} className={`flex-1 py-3 text-center text-sm font-bold uppercase tracking-wider transition-all ${mainTab === 'chat' ? 'text-white bg-rpgAccent/20 border-b-2 border-rpgAccent' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>💬 Chat</button>
            </div>

            {mainTab === 'chat' ? (
                <div className="flex-grow flex flex-col h-full overflow-hidden w-full">
                    <div className="flex items-center justify-between px-4 py-1 border-b border-white/5 bg-black/20"><p className="text-[8px] text-rpgText/30 font-mono italic">Canal Global</p><span className="text-[8px] text-rpgAccent/50 font-mono uppercase">Mestre On-line</span></div>
                    <div className="flex-1 w-full max-w-full overflow-hidden">
                        <Chat 
                            messages={chatMessages} 
                            onSendMessage={onSendMessage} 
                            role="DM" 
                            onApplyDamage={onApplyDamageFromChat} // <--- AQUI REPASA
                        />
                    </div>
                </div>
            ) : (
                <div className="flex flex-col h-full overflow-hidden w-full">
                    <div className="flex border-b border-white/10 bg-black/40 flex-shrink-0">
                        <button onClick={() => setActiveTab('combat')} className={`flex-1 py-2 text-center text-lg transition-all ${activeTab === 'combat' ? 'text-white bg-rpgAccent/20 border-b-2 border-rpgAccent' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} title="Combate">⚔️</button>
                        <button onClick={() => setActiveTab('map')} className={`flex-1 py-2 text-center text-lg transition-all ${activeTab === 'map' ? 'text-white bg-rpgAccent/20 border-b-2 border-rpgAccent' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} title="Mapa">🗺️</button>
                        <button onClick={() => setActiveTab('tools')} className={`flex-1 py-2 text-center text-lg transition-all ${activeTab === 'tools' ? 'text-white bg-rpgAccent/20 border-b-2 border-rpgAccent' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} title="Forja e Dados">🔨</button>
                        <button onClick={() => setActiveTab('campaign')} className={`flex-1 py-2 text-center text-lg transition-all ${activeTab === 'campaign' ? 'text-white bg-rpgAccent/20 border-b-2 border-rpgAccent' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} title="Campanha">📜</button>
                        <button onClick={() => setActiveTab('create')} className={`flex-1 py-2 text-center text-lg transition-all ${activeTab === 'create' ? 'text-white bg-rpgAccent/20 border-b-2 border-rpgAccent' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} title="Criar Entidades">🐉</button>
                        <button onClick={() => setActiveTab('audio')} className={`flex-1 py-2 text-center text-lg transition-all ${activeTab === 'audio' ? 'text-white bg-rpgAccent/20 border-b-2 border-rpgAccent' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} title="Áudio">🔊</button>
                    </div>

                    <div className="flex-grow overflow-y-auto p-4 custom-scrollbar w-full">
                        {activeTab === 'tools' && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                                <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                                    <h3 className="text-purple-400 text-xs font-bold uppercase tracking-widest mb-3">Teste de Perícia</h3>
                                    {targetEntity ? (
                                        <>
                                            <div className="mb-4 flex items-center gap-3 bg-purple-900/20 p-2 rounded">
                                                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700">{targetEntity.image && <img src={targetEntity.image} className="w-full h-full object-cover" alt="" />}</div>
                                                <div><p className="text-sm font-bold text-white">{targetEntity.name}</p><p className="text-[10px] text-gray-400">Solicitando Teste</p></div>
                                            </div>
                                            <SkillList attributes={mapEntityStatsToAttributes(targetEntity)} proficiencyBonus={2} profs={[]} isDmMode={true} onRoll={(skillName, mod) => setPendingSkillRequest({ skillName, mod })}/>
                                        </>
                                    ) : (
                                        <p className="text-gray-500 text-sm italic text-center py-4 bg-white/5 rounded border border-dashed border-white/10">Selecione um token no mapa para rolar perícias.</p>
                                    )}
                                </div>
                                <ItemCreator 
                                    onCreateItem={(item) => targetEntity && onGiveItem(targetEntity.id, item)} 
                                    targetName={targetEntity?.name}
                                />
                                <Scratchpad />
                            </div>
                        )}
                        {activeTab === 'campaign' && (<CampaignManager />)}
                        {activeTab === 'combat' && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                <CombatVsPanel attacker={attacker} targets={targets} onUpdateHP={onUpdateHP} onSendMessage={onSendMessage} />
                                <section className="mb-4 flex gap-2">
                                    <button onClick={() => rollBulkInitiative('npc')} className="flex-1 bg-red-900/30 hover:bg-red-800 border border-red-500/20 text-[10px] text-red-200 py-2 rounded uppercase font-bold tracking-wider">🎲 Rolar NPCs</button>
                                    <button onClick={() => rollBulkInitiative('selected')} className="flex-1 bg-blue-900/30 hover:bg-blue-800 border border-blue-500/20 text-[10px] text-blue-200 py-2 rounded uppercase font-bold tracking-wider">🎲 Rolar Selec.</button>
                                </section>
                                <section className="mb-6 bg-black/40 border border-yellow-900/30 rounded p-2">
                                    <div className="flex justify-between items-center mb-2"><h3 className="text-yellow-500 font-mono text-[10px] uppercase tracking-widest">Iniciativa</h3><div className="flex gap-1"><button onClick={onSortInitiative} className="text-[9px] bg-gray-700 px-2 rounded hover:bg-gray-600" title="Ordenar">Sort</button><button onClick={onClearInitiative} className="text-[9px] bg-red-900/50 px-2 rounded hover:bg-red-600" title="Limpar">Limpar</button></div></div>
                                    {initiativeList.length > 0 ? (<><div className="flex flex-col gap-1 mb-2 max-h-40 overflow-y-auto">{initiativeList.map((item:any, index:number) => (<div key={index} className={`flex justify-between items-center p-2 rounded text-xs cursor-pointer ${item.id === activeTurnId ? 'bg-yellow-900/40 border border-yellow-500/50' : 'bg-white/5 hover:bg-white/10'}`} onClick={(e) => onSetTarget(item.id, e.shiftKey)}><span className={item.id === activeTurnId ? 'text-yellow-200 font-bold' : 'text-gray-300'}>{item.value} - {item.name}</span><button onClick={(e) => { e.stopPropagation(); onRemoveFromInitiative(item.id); }} className="text-red-500 hover:text-red-300 ml-2">×</button></div>))}</div><button onClick={onNextTurn} className="w-full py-2 bg-yellow-700 hover:bg-yellow-600 text-white text-xs font-bold uppercase rounded shadow-lg border border-yellow-500/30 animate-pulse">Próximo Turno ⏩</button></>) : <p className="text-center text-gray-500 text-xs py-2">Sem iniciativa.</p>}
                                </section>
                                <section className="mb-4 bg-black/40 border border-white/10 rounded p-2">
                                    <h3 className="text-[10px] text-gray-400 uppercase mb-2 text-center font-bold tracking-widest">Condições</h3>
                                    <div className="grid grid-cols-2 gap-2">
                                            <button onClick={() => toggleConditionForAll('poison')} className="flex items-center gap-2 px-3 py-2 bg-green-900/40 hover:bg-green-600/60 border border-green-500/30 hover:border-green-400 rounded transition-all active:scale-95 group" title="Envenenado"><span className="text-lg filter drop-shadow-md group-hover:scale-110 transition-transform">☠️</span><span className="text-[10px] font-bold text-green-100 uppercase tracking-wider">Veneno</span></button>
                                            <button onClick={() => toggleConditionForAll('stun')} className="flex items-center gap-2 px-3 py-2 bg-yellow-900/40 hover:bg-yellow-600/60 border border-yellow-500/30 hover:border-yellow-400 rounded transition-all active:scale-95 group" title="Atordoado"><span className="text-lg filter drop-shadow-md group-hover:scale-110 transition-transform">💫</span><span className="text-[10px] font-bold text-yellow-100 uppercase tracking-wider">Atordoar</span></button>
                                            <button onClick={() => toggleConditionForAll('fire')} className="flex items-center gap-2 px-3 py-2 bg-red-900/40 hover:bg-red-600/60 border border-red-500/30 hover:border-red-400 rounded transition-all active:scale-95 group" title="Em Chamas"><span className="text-lg filter drop-shadow-md group-hover:scale-110 transition-transform">🔥</span><span className="text-[10px] font-bold text-red-100 uppercase tracking-wider">Fogo</span></button>
                                            <button onClick={() => toggleConditionForAll('sleep')} className="flex items-center gap-2 px-3 py-2 bg-purple-900/40 hover:bg-purple-600/60 border border-purple-500/30 hover:border-purple-400 rounded transition-all active:scale-95 group" title="Dormindo"><span className="text-lg filter drop-shadow-md group-hover:scale-110 transition-transform">💤</span><span className="text-[10px] font-bold text-purple-100 uppercase tracking-wider">Sono</span></button>
                                    </div>
                                </section>
                                <section className="mb-8">
                                    <h3 className="text-rpgText font-mono text-[10px] uppercase mb-3 opacity-50 tracking-widest">Entidades no Mapa</h3>
                                    <div className="space-y-2">{entities.map((entity) => (<EntityControlRow key={entity.id} entity={entity} onUpdateHP={onUpdateHP} onDeleteEntity={onDeleteEntity} onClickEdit={() => setEditingEntity(entity)} onAddToInit={() => onAddToInitiative(entity)} isTarget={targetEntityIds.includes(entity.id)} isAttacker={attackerId === entity.id} onSetTarget={onSetTarget} onSetAttacker={onSetAttacker} onToggleCondition={onToggleCondition} onAddXP={onAddXP} onToggleVisibility={() => onToggleVisibility(entity.id)} />))}</div>
                                </section>
                            </div>
                        )}
                        {/* ... MAP ... */}
                        {activeTab === 'map' && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                <section className="mb-6 border-b border-white/5 pb-4">
                                    <h3 className="text-rpgText font-mono text-[10px] uppercase mb-2 opacity-50 tracking-widest">Mapa Customizado</h3>
                                    <div className="flex gap-2">
                                            <input type="text" placeholder="Cole o link da imagem..." className="w-full bg-black/50 border border-white/20 rounded p-2 text-xs text-white outline-none focus:border-blue-500" value={customMapUrl} onChange={(e) => setCustomMapUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLoadCustomMap()} />
                                            <button onClick={handleLoadCustomMap} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 rounded text-xs transition-colors disabled:opacity-50" disabled={!customMapUrl.trim()}>Ir</button>
                                    </div>
                                    <div className="mt-2 flex items-center justify-center"><span className="text-[9px] text-gray-500 uppercase mr-2">OU</span><div className="h-px bg-white/10 flex-grow"></div></div>
                                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                                    <button onClick={() => fileInputRef.current?.click()} className="w-full mt-2 bg-purple-900/40 hover:bg-purple-600 border border-purple-500/50 text-white font-bold py-2 rounded uppercase text-xs transition-all flex items-center justify-center gap-2">📂 Abrir Arquivo Local</button>
                                </section>
                                <section className="mb-6 border-b border-white/5 pb-4">
                                    <h3 className="text-rpgText font-mono text-[10px] uppercase mb-2 opacity-50 tracking-widest">Ambiente & Luz</h3>
                                    <div className="bg-black/40 p-2 rounded border border-white/10">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs font-bold text-yellow-500">{globalBrightness >= 1 ? '☀️ Dia' : globalBrightness <= 0.2 ? '🌑 Noite' : '🌅 Crepúsculo'}</span>
                                                <span className="text-[10px] text-gray-500">{Math.round(globalBrightness * 100)}%</span>
                                            </div>
                                            <input type="range" min="0" max="1" step="0.05" value={globalBrightness} onChange={(e) => onSetGlobalBrightness && onSetGlobalBrightness(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"/>
                                    </div>
                                </section>
                                <section className="mb-6 border-b border-white/5 pb-4">
                                    <h3 className="text-rpgText font-mono text-[10px] uppercase mb-2 opacity-50 tracking-widest">Mapas Padrão</h3>
                                    <div className="grid grid-cols-2 gap-2">{AVAILABLE_MAPS.map(map => (<button key={map.url} onClick={() => onChangeMap(map.url)} className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 text-[10px] font-bold py-2 rounded transition-all active:scale-95">{map.name}</button>))}</div>
                                </section>
                                <section className="mb-6 border-b border-white/5 pb-4 bg-white/5 rounded p-2">
                                    <h3 className="text-rpgText font-mono text-[10px] uppercase mb-2 opacity-50 tracking-widest text-center">Magias & Áreas</h3>
                                    <AoEColorPicker selected={aoeColor} onSelect={onSetAoEColor} />
                                    <div className="flex gap-2 mt-3">
                                            <button onClick={() => onSetAoE(activeAoE === 'circle' ? null : 'circle')} className={`flex-1 py-2 rounded text-[10px] font-bold border transition-all flex flex-col items-center gap-1 ${activeAoE === 'circle' ? 'border-white text-white bg-white/10' : 'border-white/10 text-gray-400 hover:bg-white/5'}`} style={activeAoE === 'circle' ? {borderColor: aoeColor, color: aoeColor} : {}}><span className="text-lg">⭕</span> Círculo</button>
                                            <button onClick={() => onSetAoE(activeAoE === 'cone' ? null : 'cone')} className={`flex-1 py-2 rounded text-[10px] font-bold border transition-all flex flex-col items-center gap-1 ${activeAoE === 'cone' ? 'border-white text-white bg-white/10' : 'border-white/10 text-gray-400 hover:bg-white/5'}`} style={activeAoE === 'cone' ? {borderColor: aoeColor, color: aoeColor} : {}}><span className="text-lg">🔺</span> Cone</button>
                                            <button onClick={() => onSetAoE(activeAoE === 'cube' ? null : 'cube')} className={`flex-1 py-2 rounded text-[10px] font-bold border transition-all flex flex-col items-center gap-1 ${activeAoE === 'cube' ? 'border-white text-white bg-white/10' : 'border-white/10 text-gray-400 hover:bg-white/5'}`} style={activeAoE === 'cube' ? {borderColor: aoeColor, color: aoeColor} : {}}><span className="text-lg">🟥</span> Cubo</button>
                                    </div>
                                    {activeAoE && <p className="text-[9px] mt-2 text-center animate-pulse opacity-80" style={{color: aoeColor}}>🖌️ Clique e arraste no mapa</p>}
                                </section>
                                <section className="mb-6 border-b border-white/5 pb-4 bg-black/20 rounded p-2">
                                    <h3 className="text-rpgText font-mono text-[10px] uppercase mb-3 opacity-50 tracking-widest">Neblina de Guerra</h3>
                                    <div className="flex flex-col gap-2">
                                            <button onClick={onToggleFogMode} className={`w-full py-2 rounded text-xs font-bold uppercase tracking-wider border transition-all ${isFogMode ? 'bg-yellow-600 border-yellow-400 text-white shadow-sm' : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700'}`}>{isFogMode ? '✎ Modo Edição Ativo' : '✎ Editar Neblina'}</button>
                                            {isFogMode && (<div className="flex gap-1 bg-black/40 p-1 rounded border border-white/10 mt-1 mb-1"><button onClick={() => onSetFogTool('reveal')} className={`flex-1 py-1 text-[10px] uppercase font-bold rounded transition-colors ${fogTool === 'reveal' ? 'bg-green-600 text-white shadow-sm' : 'hover:bg-white/10 text-gray-400'}`}>🔦 Revelar</button><button onClick={() => onSetFogTool('hide')} className={`flex-1 py-1 text-[10px] uppercase font-bold rounded transition-colors ${fogTool === 'hide' ? 'bg-red-600 text-white shadow-sm' : 'hover:bg-white/10 text-gray-400'}`}>☁️ Esconder</button></div>)}
                                            <div className="flex gap-2"><button onClick={onRevealAll} className="flex-1 py-1 bg-gray-800 hover:bg-gray-700 text-[9px] text-gray-400 rounded border border-gray-700">Tudo Visível</button><button onClick={onResetFog} className="flex-1 py-1 bg-gray-800 hover:bg-gray-700 text-[9px] text-gray-400 rounded border border-gray-700">Tudo Preto</button></div>
                                            <button onClick={onSyncFog} className="w-full py-1 mt-2 bg-purple-900/30 hover:bg-purple-600/50 border border-purple-500/30 text-[9px] text-purple-200 uppercase font-bold rounded transition-all">📡 Sincronizar Jogadores</button>
                                    </div>
                                </section>
                                <div className="px-2">
                                    <button onClick={onSaveGame} className="w-full py-2 bg-green-900/40 hover:bg-green-600/60 border border-green-500/30 text-green-200 text-xs font-bold uppercase rounded transition-all shadow-lg mb-2">💾 Salvar Estado do Jogo</button>
                                    
                                    {/* --- BOTÃO DE RECENTRALIZAR --- */}
                                    <button onClick={onResetView} className="w-full py-2 bg-blue-900/40 hover:bg-blue-600/60 border border-blue-500/30 text-blue-200 text-xs font-bold uppercase rounded transition-all shadow-lg">Recentralizar Câmera 🎯</button>
                                </div>
                            </div>
                        )}
                        {/* ... CREATE ... */}
                        {activeTab === 'create' && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                <h3 className="text-rpgText font-mono text-[10px] uppercase mb-4 opacity-50 tracking-widest text-center">Adicionar Entidades</h3>
                                <button draggable onDragStart={(e) => handleDragStart(e, 'enemy')} onClick={() => setShowMonsterSelector(true)} className="w-full bg-red-900/50 hover:bg-red-600 border border-red-500/30 text-white text-lg font-bold py-6 rounded uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-grab mb-4 flex flex-col items-center gap-2"><span className="text-2xl">👹</span> Adicionar Inimigo</button>
                                <button draggable onDragStart={(e) => handleDragStart(e, 'player')} onClick={() => onOpenCreator('player')} className="w-full bg-blue-900/50 hover:bg-blue-600 border border-blue-500/30 text-white text-lg font-bold py-6 rounded uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-grab flex flex-col items-center gap-2"><span className="text-2xl">🛡️</span> Adicionar Aliado</button>
                                <p className="text-gray-500 text-xs text-center mt-6 italic px-4">Dica: Você também pode arrastar esses botões diretamente para o mapa!</p>
                            </div>
                        )}
                        {/* --- NOVA ABA DE AUDIO INTEGRADA --- */}
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
            )}
        </div>
      </div>
    </>
  );
};

export default SidebarDM;