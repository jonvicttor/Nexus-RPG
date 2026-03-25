import React, { useState, useRef} from 'react';
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
import { Eye, EyeOff, Image as ImageIcon, Check, X, Brush, Square, Minus, Tent } from 'lucide-react'; 

export interface InitiativeItem { id: number; name: string; value: number; }

const MONSTER_LIST: MonsterPreset[] = [
  { name: 'Lobo', hp: 11, ac: 13, image: '/tokens/lobo.png' },
  { name: 'Goblin', hp: 7, ac: 15, image: '/tokens/goblin.png' },
  { name: 'Esqueleto', hp: 13, ac: 13, image: '/tokens/skeleton.png' },
  { name: 'Orc', hp: 15, ac: 13, image: '/tokens/orc.png' },
  { name: 'Bandido', hp: 11, ac: 12, image: '/tokens/bandido.png' },
  { name: 'Zumbi', hp: 22, ac: 8, image: '/tokens/zumbi.png' }
];

const INITIAL_MAPS = [
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
  availableConditions?: any[]; // 👉 ADICIONADO AQUI
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

const CombatVsPanel = ({ attacker, targets, onUpdateHP, onSendMessage, onDMRoll }: any) => {
    const [amount, setAmount] = useState('');
    
    const applyToAll = (damage: boolean) => {
        const val = parseInt(amount);
        if (val) {
            targets.forEach((ent:Entity) => { onUpdateHP(ent.id, damage ? -val : val); });
            setAmount('');
        }
    };

    const getAtkMod = () => {
        if (!attacker) return 0;
        const str = attacker.stats?.str || 10;
        const dex = attacker.stats?.dex || 10;
        return Math.floor((Math.max(str, dex) - 10) / 2);
    };

    const atkMod = getAtkMod();
    const modString = atkMod >= 0 ? `+${atkMod}` : `${atkMod}`;

    const handleVisualAttack = (rollType: 'normal' | 'advantage' | 'disadvantage') => {
        if (!attacker) return;
        const targetNames = targets.length > 0 ? targets.map((t: Entity) => t.name).join(', ') : 'o vazio';
        onDMRoll(`Ataque de ${attacker.name}`, `Alvo(s): ${targetNames}`, atkMod, rollType);
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
        <section className="mb-4 bg-gradient-to-r from-blue-950/40 via-purple-900/20 to-red-950/40 border border-white/10 rounded-xl p-4 shadow-xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>
            
            <h3 className="text-yellow-500/80 font-bold text-[10px] uppercase tracking-widest mb-4 text-center flex items-center justify-center gap-2">
                <span className="w-8 h-px bg-yellow-500/30"></span>
                ⚔️ Mesa de Combate
                <span className="w-8 h-px bg-yellow-500/30"></span>
            </h3>
            
            <div className="flex items-center justify-between gap-4 mb-4 relative z-10">
                <div className="flex flex-col items-center w-[40%]">
                    {attacker ? (
                        <>
                            <div className="w-14 h-14 rounded-full border-2 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.4)] overflow-hidden bg-black relative group">
                                <img src={attacker.image || ''} className="w-full h-full object-cover group-hover:scale-110 transition-transform" alt="" />
                            </div>
                            <span className="text-[11px] text-blue-300 font-black mt-2 truncate max-w-full text-center leading-tight drop-shadow-md">{attacker.name}</span>
                            <div className="bg-black/60 border border-blue-500/30 rounded px-2 py-0.5 mt-1">
                                <span className="text-[9px] font-bold text-gray-400 uppercase">Mod Atq: </span>
                                <span className="text-[10px] font-black text-white">{modString}</span>
                            </div>
                            {renderHpBar(attacker)}
                        </>
                    ) : (
                        <div className="w-14 h-14 rounded-full border-2 border-dashed border-blue-500/30 flex items-center justify-center text-blue-500/30 text-xs bg-black/40">Selecione</div>
                    )}
                </div>

                <div className="flex flex-col items-center justify-center gap-2 w-[20%]">
                    <span className="text-white/20 text-3xl font-black italic" style={{ fontFamily: 'Cinzel Decorative' }}>VS</span>
                </div>

                <div className="flex flex-col items-center w-[40%]">
                    {targets.length > 0 ? (
                        <>
                            <div className="flex -space-x-3 overflow-hidden justify-center w-full">
                                {targets.slice(0, 3).map((t: Entity) => (
                                    <div key={t.id} className="w-12 h-12 rounded-full border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] overflow-hidden bg-black flex-shrink-0 relative z-10">
                                        <img src={t.image || ''} className="w-full h-full object-cover" alt="" />
                                    </div>
                                ))}
                                {targets.length > 3 && (<div className="w-12 h-12 rounded-full border-2 border-red-500 bg-red-950 text-white text-[10px] font-bold flex items-center justify-center z-0 relative -ml-4 shadow-lg shadow-red-500/20">+{targets.length - 3}</div>)}
                            </div>
                            <span className="text-[10px] text-red-400 font-bold mt-2 uppercase tracking-widest">{targets.length} Alvo(s)</span>
                            {targets.length === 1 && (
                                <div className="bg-black/60 border border-red-500/30 rounded px-2 py-0.5 mt-1">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase">CA: </span>
                                    <span className="text-[10px] font-black text-white">{targets[0].ac}</span>
                                </div>
                            )}
                            {targets.length === 1 && renderHpBar(targets[0])}
                        </>
                    ) : (
                        <div className="w-14 h-14 rounded-full border-2 border-dashed border-red-500/30 flex items-center justify-center text-red-500/30 text-xs bg-black/40">Alvo</div>
                    )}
                </div>
            </div>

            {attacker && targets.length > 0 && (
                <div className="flex gap-2 justify-center mt-4 border-t border-white/10 pt-4 relative z-10">
                    <button onClick={() => handleVisualAttack('disadvantage')} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-[9px] font-bold py-2 rounded border border-gray-600 transition-colors uppercase" title="Rolar com Desvantagem">
                        Desvantagem
                    </button>
                    <button onClick={() => handleVisualAttack('normal')} className="flex-[2] bg-gradient-to-b from-yellow-600 to-yellow-800 hover:from-yellow-500 hover:to-yellow-700 text-white text-[11px] font-black py-2 rounded shadow-[0_0_15px_rgba(202,138,4,0.4)] border border-yellow-400/50 transition-all active:scale-95 uppercase tracking-widest flex items-center justify-center gap-1">
                        <span className="text-sm">🎲</span> Rolar Ataque
                    </button>
                    <button onClick={() => handleVisualAttack('advantage')} className="flex-1 bg-gray-800 hover:bg-gray-700 text-green-400 text-[9px] font-bold py-2 rounded border border-green-900/50 transition-colors uppercase" title="Rolar com Vantagem">
                        Vantagem
                    </button>
                </div>
            )}

            {targets.length > 0 && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-white/5 relative z-10">
                    <input type="number" placeholder="HP..." className="w-14 bg-black/80 border border-white/10 rounded p-1 text-center text-white text-xs font-bold outline-none focus:border-red-500" value={amount} onChange={e => setAmount(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') applyToAll(true); }} />
                    <button onClick={() => applyToAll(true)} className="flex-1 bg-red-900/60 hover:bg-red-600 border border-red-700/50 text-red-100 font-bold rounded uppercase text-[10px] transition-colors flex items-center justify-center gap-1">🩸 Dano Direto</button>
                    <button onClick={() => applyToAll(false)} className="flex-1 bg-green-900/60 hover:bg-green-600 border border-green-700/50 text-green-100 font-bold rounded uppercase text-[10px] transition-colors flex items-center justify-center gap-1">💚 Cura</button>
                </div>
            )}
        </section>
    );
};

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
  onDMRoll, onLongRest, availableItems, availableConditions // 👉 ADICIONADO AQUI
}) => {
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [activeTab, setActiveTab] = useState<SidebarTab>('combat');
  const [mainTab, setMainTab] = useState<MainTab>('tools'); 
  const [pendingSkillRequest, setPendingSkillRequest] = useState<{ skillName: string, mod: number } | null>(null);
  const [dcInput, setDcInput] = useState<number>(10);
  
  const [mapList, setMapList] = useState<{name: string, url: string}[]>(INITIAL_MAPS);
  const [customMapUrl, setCustomMapUrl] = useState('');
  const [previewMap, setPreviewMap] = useState<{url: string, name: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 👉 ESTADO PARA CONTROLAR A CAIXA FLUTUANTE DE CONDIÇÕES
  const [hoveredCondition, setHoveredCondition] = useState<string | null>(null);

  const FULL_MONSTER_LIST = [...MONSTER_LIST, ...(customMonsters || [])];
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

  const attacker = entities.find(e => e.id === attackerId) || null;
  const targets = entities.filter(e => targetEntityIds.includes(e.id));
  const toggleConditionForAll = (cond: string) => { targets.forEach(t => onToggleCondition(t.id, cond)); };
  const rollBulkInitiative = (type: 'npc' | 'selected') => { const targetsToRoll = type === 'npc' ? entities.filter(e => e.type === 'enemy') : entities.filter(e => targetEntityIds.includes(e.id)); if(targetsToRoll.length === 0) return; targetsToRoll.forEach(ent => { if (!initiativeList.find(i => i.id === ent.id)) onAddToInitiative(ent); }); };
  const sidebarStyle = { backgroundColor: '#1a1510', backgroundImage: `url('/assets/bg-couro-sidebar.png')`, backgroundSize: 'cover', backgroundRepeat: 'no-repeat', boxShadow: 'inset 0 0 60px rgba(0,0,0,0.9)', width: '420px', minWidth: '420px', maxWidth: '420px', flex: '0 0 420px' };

  // 👉 NOSSO NOVO MAPA DE CONDIÇÕES OFICIAIS
  const CONDITION_MAP = [
      { id: 'Poisoned', icon: '☠️', label: 'Veneno', bg: 'bg-green-900/40 hover:bg-green-600/60', border: 'border-green-500/30', text: 'text-green-100' },
      { id: 'Stunned', icon: '💫', label: 'Atordoado', bg: 'bg-yellow-900/40 hover:bg-yellow-600/60', border: 'border-yellow-500/30', text: 'text-yellow-100' },
      { id: 'Prone', icon: '⏬', label: 'Caído', bg: 'bg-orange-900/40 hover:bg-orange-600/60', border: 'border-orange-500/30', text: 'text-orange-100' },
      { id: 'Unconscious', icon: '💤', label: 'Inconsciente', bg: 'bg-purple-900/40 hover:bg-purple-600/60', border: 'border-purple-500/30', text: 'text-purple-100' },
      { id: 'Blinded', icon: '🦇', label: 'Cego', bg: 'bg-gray-800/40 hover:bg-gray-600/60', border: 'border-gray-500/30', text: 'text-gray-200' },
      { id: 'Restrained', icon: '⛓️', label: 'Impedido', bg: 'bg-red-900/40 hover:bg-red-600/60', border: 'border-red-500/30', text: 'text-red-100' },
  ];

  return (
    <>
      {editingEntity && (<EditEntityModal entity={editingEntity} onSave={onEditEntity} onClose={() => setEditingEntity(null)} />)}
      
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

            <div className={`flex-grow flex-col h-full overflow-hidden w-full ${mainTab === 'chat' ? 'flex' : 'hidden'}`}>
                <div className="flex items-center justify-between px-4 py-1 border-b border-white/5 bg-black/20">
                    <p className="text-[8px] text-rpgText/30 font-mono italic">Canal Global</p>
                    <span className="text-[8px] text-rpgAccent/50 font-mono uppercase">Mestre On-line</span>
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

            <div className={`flex-col h-full overflow-hidden w-full ${mainTab === 'tools' ? 'flex' : 'hidden'}`}>
                <div className="flex border-b border-white/10 bg-black/40 flex-shrink-0">
                    <button onClick={() => setActiveTab('combat')} className={`flex-1 py-2 text-center text-lg transition-all ${activeTab === 'combat' ? 'text-white bg-rpgAccent/20 border-b-2 border-rpgAccent' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} title="Combate">⚔️</button>
                    <button onClick={() => setActiveTab('map')} className={`flex-1 py-2 text-center text-lg transition-all ${activeTab === 'map' ? 'text-white bg-rpgAccent/20 border-b-2 border-rpgAccent' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} title="Mapa">🗺️</button>
                    <button onClick={() => setActiveTab('tools')} className={`flex-1 py-2 text-center text-lg transition-all ${activeTab === 'tools' ? 'text-white bg-rpgAccent/20 border-b-2 border-rpgAccent' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} title="Forja e Dados">🔨</button>
                    <button onClick={() => setActiveTab('campaign')} className={`flex-1 py-2 text-center text-lg transition-all ${activeTab === 'campaign' ? 'text-white bg-rpgAccent/20 border-b-2 border-rpgAccent' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} title="Campanha">📜</button>
                    <button onClick={() => setActiveTab('create')} className={`flex-1 py-2 text-center text-lg transition-all ${activeTab === 'create' ? 'text-white bg-rpgAccent/20 border-b-2 border-rpgAccent' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} title="Bestiário">🐉</button>
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
                                availableItems={availableItems}
                            />
                            <Scratchpad />
                        </div>
                    )}

                    {activeTab === 'campaign' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                            <CampaignManager />
                            
                            <section className="bg-black/40 border border-orange-900/30 rounded-xl p-4 shadow-inner">
                                <h3 className="text-orange-500 font-bold text-[10px] uppercase tracking-widest mb-3 border-b border-orange-900/30 pb-2">Gerenciar Grupo</h3>
                                <p className="text-xs text-gray-400 mb-4 italic">Cura completamente todos os aventureiros (apenas jogadores) e restaura seus espaços de magia.</p>
                                <button 
                                    onClick={() => {
                                        if (window.confirm("Os heróis montaram acampamento para um descanso longo? (Cura total para todos os jogadores)")) {
                                            onLongRest();
                                        }
                                    }} 
                                    className="w-full py-3 bg-gradient-to-r from-orange-900 to-amber-900 hover:from-orange-700 hover:to-amber-700 border border-orange-500/50 text-white font-black uppercase tracking-widest rounded-lg transition-all shadow-[0_0_15px_rgba(249,115,22,0.3)] flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <Tent size={18} /> Descanso Longo
                                </button>
                            </section>
                        </div>
                    )}
                    
                    {activeTab === 'combat' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <CombatVsPanel attacker={attacker} targets={targets} onUpdateHP={onUpdateHP} onSendMessage={onSendMessage} onDMRoll={onDMRoll} />
                            <section className="mb-4 flex gap-2">
                                <button onClick={() => rollBulkInitiative('npc')} className="flex-1 bg-red-900/30 hover:bg-red-800 border border-red-500/20 text-[10px] text-red-200 py-2 rounded uppercase font-bold tracking-wider">🎲 Rolar NPCs</button>
                                <button onClick={() => rollBulkInitiative('selected')} className="flex-1 bg-blue-900/30 hover:bg-blue-800 border border-blue-500/20 text-[10px] text-blue-200 py-2 rounded uppercase font-bold tracking-wider">🎲 Rolar Selec.</button>
                            </section>
                            
                            <section className="mb-6 bg-black/40 border border-yellow-900/30 rounded p-2">
                                <div className="flex justify-between items-center mb-2"><h3 className="text-yellow-500 font-mono text-[10px] uppercase tracking-widest">Iniciativa</h3><div className="flex gap-1"><button onClick={onSortInitiative} className="text-[9px] bg-gray-700 px-2 rounded hover:bg-gray-600" title="Ordenar">Sort</button><button onClick={onClearInitiative} className="text-[9px] bg-red-900/50 px-2 rounded hover:bg-red-600" title="Limpar">Limpar</button></div></div>
                                {initiativeList.length > 0 ? (
                                    <>
                                        <div className="flex flex-col gap-1 mb-2 max-h-40 overflow-y-auto custom-scrollbar">
                                            {initiativeList.map((item:any, index:number) => (
                                                <div 
                                                    key={index} 
                                                    className={`flex justify-between items-center p-2 rounded text-xs cursor-pointer border transition-all ${item.id === activeTurnId ? 'bg-yellow-900/40 border-yellow-500/50' : 'bg-white/5 border-transparent hover:bg-white/10'} ${attackerId === item.id ? 'shadow-[inset_3px_0_0_#3b82f6]' : ''} ${targetEntityIds.includes(item.id) ? 'shadow-[inset_-3px_0_0_#ef4444]' : ''}`} 
                                                    onClick={() => onSetAttacker(item.id)} 
                                                    onContextMenu={(e) => { e.preventDefault(); onSetTarget(item.id, e.shiftKey); }} 
                                                    title="Esquerdo: Selecionar Atacante | Direito: Selecionar Alvo"
                                                >
                                                    <span className={item.id === activeTurnId ? 'text-yellow-200 font-bold' : 'text-gray-300'}>{item.value} - {item.name}</span>
                                                    <button onClick={(e) => { e.stopPropagation(); onRemoveFromInitiative(item.id); }} className="text-red-500 hover:text-red-300 ml-2">×</button>
                                                </div>
                                            ))}
                                        </div>
                                        <button onClick={onNextTurn} className="w-full py-2 bg-yellow-700 hover:bg-yellow-600 text-white text-xs font-bold uppercase rounded shadow-lg border border-yellow-500/30 animate-pulse">Próximo Turno ⏩</button>
                                    </>
                                ) : (
                                    <p className="text-center text-gray-500 text-xs py-2">Sem iniciativa.</p>
                                )}
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

                            {/* 👉 NOVA SEÇÃO DE CONDIÇÕES OFICIAIS */}
                            <section className="mb-4 bg-black/40 border border-white/10 rounded p-2">
                                <h3 className="text-[10px] text-gray-400 uppercase mb-2 text-center font-bold tracking-widest">Condições Oficiais</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {CONDITION_MAP.map(cond => (
                                        <button 
                                            key={cond.id}
                                            onClick={() => toggleConditionForAll(cond.id)}
                                            onMouseEnter={() => setHoveredCondition(cond.id)}
                                            onMouseLeave={() => setHoveredCondition(null)}
                                            className={`flex items-center justify-center gap-2 px-2 py-2 ${cond.bg} border ${cond.border} rounded transition-all active:scale-95 group`}
                                        >
                                            <span className="text-sm filter drop-shadow-md group-hover:scale-110 transition-transform">{cond.icon}</span>
                                            <span className={`text-[10px] font-bold ${cond.text} uppercase tracking-wider`}>{cond.label}</span>
                                        </button>
                                    ))}
                                </div>
                                
                                {/* O Pergaminho de Regras Flutuante */}
                                {hoveredCondition && availableConditions?.find(c => c.name === hoveredCondition) && (
                                    <div className="mt-2 p-2.5 bg-black/80 border border-amber-500/30 rounded-lg animate-in fade-in zoom-in-95 shadow-lg relative z-20">
                                        <h4 className="text-[10px] font-black text-amber-400 uppercase mb-1 border-b border-amber-900/50 pb-1">
                                            {availableConditions.find(c => c.name === hoveredCondition)?.name}
                                        </h4>
                                        <p className="text-[9px] text-gray-300 leading-relaxed whitespace-pre-wrap">
                                            {availableConditions.find(c => c.name === hoveredCondition)?.description}
                                        </p>
                                    </div>
                                )}
                            </section>

                            <section className="mb-8">
                                <h3 className="text-rpgText font-mono text-[10px] uppercase mb-3 opacity-50 tracking-widest">Entidades no Mapa</h3>
                                <div className="space-y-2">{entities.map((entity) => (<EntityControlRow key={entity.id} entity={entity} onUpdateHP={onUpdateHP} onDeleteEntity={onDeleteEntity} onClickEdit={() => setEditingEntity(entity)} onAddToInit={() => onAddToInitiative(entity)} isTarget={targetEntityIds.includes(entity.id)} isAttacker={attackerId === entity.id} onSetTarget={onSetTarget} onSetAttacker={onSetAttacker} onToggleCondition={onToggleCondition} onAddXP={onAddXP} onToggleVisibility={() => onToggleVisibility(entity.id)} />))}</div>
                            </section>
                        </div>
                    )}
                    {activeTab === 'map' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            
                            <section className="mb-6 pb-4 bg-blue-900/10 p-3 rounded-lg border border-blue-500/20 shadow-inner">
                                <h3 className="text-blue-400 font-bold text-[11px] uppercase mb-3 tracking-widest flex items-center gap-2"><ImageIcon size={14}/> Carregar Novo Mapa</h3>
                                
                                {!previewMap ? (
                                    <>
                                        <div className="flex gap-2">
                                            <input type="text" placeholder="Cole o link da imagem (URL)..." className="w-full bg-black/60 border border-white/20 rounded p-2 text-xs text-white outline-none focus:border-blue-500" value={customMapUrl} onChange={(e) => setCustomMapUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleUrlPreview()} />
                                            <button onClick={handleUrlPreview} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 rounded text-xs transition-colors disabled:opacity-50" disabled={!customMapUrl.trim()}>Preview</button>
                                        </div>
                                        <div className="mt-3 mb-3 flex items-center justify-center"><span className="text-[9px] text-gray-500 uppercase px-2 font-bold">Ou do seu Computador</span></div>
                                        <input type="file" ref={fileInputRef} onChange={handleFileUploadPreview} className="hidden" accept="image/*" />
                                        <button onClick={() => fileInputRef.current?.click()} className="w-full bg-black/60 hover:bg-blue-900/40 border border-blue-500/50 text-blue-200 font-bold py-2.5 rounded uppercase text-xs transition-all flex items-center justify-center gap-2 shadow">📂 Escolher Arquivo Local</button>
                                    </>
                                ) : (
                                    <div className="animate-in zoom-in-95 duration-200">
                                        <div className="w-full h-32 rounded-lg overflow-hidden border-2 border-blue-500 mb-3 shadow-[0_0_15px_rgba(59,130,246,0.3)] relative">
                                            <img src={previewMap.url} alt="Preview" className="w-full h-full object-cover opacity-80" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-2">
                                                <span className="text-[10px] text-white font-mono tracking-widest">PRÉ-VISUALIZAÇÃO</span>
                                            </div>
                                        </div>
                                        
                                        <div className="mb-3">
                                            <label className="text-[9px] text-blue-300 uppercase font-bold mb-1 block">Nome do Botão:</label>
                                            <input autoFocus type="text" className="w-full bg-black border border-blue-500/50 rounded p-2 text-sm text-white font-bold" value={previewMap.name} onChange={(e) => setPreviewMap({...previewMap, name: e.target.value})} />
                                        </div>

                                        <div className="flex gap-2">
                                            <button onClick={() => setPreviewMap(null)} className="flex-1 bg-red-900/50 hover:bg-red-700 text-red-200 text-xs py-2 rounded font-bold flex items-center justify-center gap-1 transition-colors"><X size={14}/> Cancelar</button>
                                            <button onClick={handleConfirmNewMap} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs py-2 rounded font-bold flex items-center justify-center gap-1 transition-colors shadow-lg"><Check size={14}/> Salvar & Usar</button>
                                        </div>
                                    </div>
                                )}
                            </section>

                            <section className="mb-6 border-b border-white/5 pb-4">
                                <h3 className="text-rpgText font-mono text-[10px] uppercase mb-2 opacity-50 tracking-widest">Mapas Disponíveis</h3>
                                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                    {mapList.map((map, idx) => (
                                        <button key={idx} onClick={() => onChangeMap(map.url)} className="bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-blue-400 text-gray-300 hover:text-white text-[10px] font-bold py-3 px-2 rounded transition-all active:scale-95 truncate">
                                            {map.name}
                                        </button>
                                    ))}
                                </div>
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
                            
                            <section className="mb-6 border-b border-white/5 pb-4 bg-black/20 rounded p-2">
                                <h3 className="text-rpgText font-mono text-[10px] uppercase mb-3 opacity-50 tracking-widest">Neblina de Guerra</h3>
                                <div className="flex flex-col gap-3">
                                        <button onClick={onToggleFogMode} className={`w-full py-2 rounded text-xs font-bold uppercase tracking-wider border transition-all ${isFogMode ? 'bg-yellow-600 border-yellow-400 text-white shadow-sm' : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700'}`}>{isFogMode ? '✎ Modo Edição Ativo' : '✎ Editar Neblina'}</button>
                                        
                                        {isFogMode && (
                                          <div className="flex flex-col gap-2 bg-black/40 p-2 rounded border border-white/10 animate-in fade-in zoom-in-95">
                                              <div className="flex gap-1 bg-black/40 p-1 rounded border border-white/5">
                                                  <button onClick={() => onSetFogTool('reveal')} className={`flex-1 py-1.5 text-[10px] uppercase font-bold rounded transition-colors ${fogTool === 'reveal' ? 'bg-green-600 text-white shadow-sm' : 'hover:bg-white/10 text-gray-400'}`}>🔦 Revelar</button>
                                                  <button onClick={() => onSetFogTool('hide')} className={`flex-1 py-1.5 text-[10px] uppercase font-bold rounded transition-colors ${fogTool === 'hide' ? 'bg-red-600 text-white shadow-sm' : 'hover:bg-white/10 text-gray-400'}`}>☁️ Esconder</button>
                                              </div>
                                              <div className="flex gap-1 justify-between">
                                                  <button onClick={() => onSetFogShape && onSetFogShape('brush')} className={`flex-1 py-1.5 flex flex-col items-center gap-1 rounded text-[10px] transition-all border ${fogShape === 'brush' ? 'bg-white/10 border-white text-white shadow-inner' : 'border-transparent text-gray-500 hover:bg-white/5 hover:text-gray-300'}`} title="Pincel Livre">
                                                      <Brush size={16} /> Livre
                                                  </button>
                                                  <button onClick={() => onSetFogShape && onSetFogShape('rect')} className={`flex-1 py-1.5 flex flex-col items-center gap-1 rounded text-[10px] transition-all border ${fogShape === 'rect' ? 'bg-white/10 border-white text-white shadow-inner' : 'border-transparent text-gray-500 hover:bg-white/5 hover:text-gray-300'}`} title="Desenhar Retângulo">
                                                      <Square size={16} /> Sala
                                                  </button>
                                                  <button onClick={() => onSetFogShape && onSetFogShape('line')} className={`flex-1 py-1.5 flex flex-col items-center gap-1 rounded text-[10px] transition-all border ${fogShape === 'line' ? 'bg-white/10 border-white text-white shadow-inner' : 'border-transparent text-gray-500 hover:bg-white/5 hover:text-gray-300'}`} title="Desenhar Linha">
                                                      <Minus size={16} /> Linha
                                                  </button>
                                              </div>
                                              <p className="text-center text-[9px] text-yellow-500/70 italic mt-1">Arraste no mapa para pintar.</p>
                                          </div>
                                        )}

                                        <div className="flex gap-2 mt-1"><button onClick={onRevealAll} className="flex-1 py-1.5 bg-gray-800 hover:bg-gray-700 text-[10px] font-bold uppercase text-gray-400 rounded border border-gray-700 transition-colors">Limpar Tudo</button><button onClick={onResetFog} className="flex-1 py-1.5 bg-gray-800 hover:bg-gray-700 text-[10px] font-bold uppercase text-gray-400 rounded border border-gray-700 transition-colors">Tudo Preto</button></div>
                                        <button onClick={onSyncFog} className="w-full py-1.5 mt-1 bg-purple-900/30 hover:bg-purple-600/50 border border-purple-500/30 text-[10px] text-purple-200 uppercase font-bold rounded transition-all flex justify-center items-center gap-2">📡 Sincronizar Jogadores</button>
                                </div>
                            </section>
                            <div className="px-2">
                                <button onClick={onSaveGame} className="w-full py-2 bg-green-900/40 hover:bg-green-600/60 border border-green-500/30 text-green-200 text-xs font-bold uppercase rounded transition-all shadow-lg mb-2">💾 Salvar Estado do Jogo</button>
                                <button onClick={onResetView} className="w-full py-2 bg-blue-900/40 hover:bg-blue-600/60 border border-blue-500/30 text-blue-200 text-xs font-bold uppercase rounded transition-all shadow-lg">Recentralizar Câmera 🎯</button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'create' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            
                            <div className="flex gap-2 mb-6">
                                <button onClick={() => onOpenCreator('player')} className="flex-1 bg-blue-900/50 hover:bg-blue-600 border border-blue-500/30 text-white text-xs font-bold py-3 rounded uppercase tracking-wider transition-all shadow-lg active:scale-95 flex flex-col items-center gap-1">
                                    <span className="text-xl">🛡️</span> Novo Aliado
                                </button>
                                <button onClick={() => onOpenCreator('enemy')} className="flex-1 bg-red-900/50 hover:bg-red-600 border border-red-500/30 text-white text-xs font-bold py-3 rounded uppercase tracking-wider transition-all shadow-lg active:scale-95 flex flex-col items-center gap-1">
                                    <span className="text-xl">⚙️</span> Novo Monstro
                                </button>
                            </div>

                            <div className="bg-black/40 border border-red-900/30 rounded-xl p-3 shadow-inner">
                                <h3 className="text-red-500 font-bold text-[10px] uppercase tracking-widest mb-3 flex items-center justify-between border-b border-red-900/30 pb-2">
                                    <span>🐉 Bestiário Negro</span>
                                    <span className="text-gray-500 text-[8px] normal-case">(Clique ou arraste)</span>
                                </h3>

                                <div className="grid grid-cols-2 gap-2">
                                    {FULL_MONSTER_LIST.map((monster, idx) => (
                                        <button 
                                            key={`${monster.name}-${idx}`} 
                                            draggable 
                                            onDragStart={(e) => handleDragStart(e, 'enemy', monster)} 
                                            onClick={() => handleSelectPreset(monster)} 
                                            className="flex flex-col items-center bg-black/60 hover:bg-red-900/40 border border-white/5 hover:border-red-500/50 p-2 rounded-lg transition-all group cursor-grab active:cursor-grabbing"
                                        >
                                            <div className="w-10 h-10 rounded-full overflow-hidden mb-1.5 border border-white/20 group-hover:border-red-500 shadow-lg">
                                                <img src={monster.image} alt={monster.name} className="w-full h-full object-cover" />
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-300 group-hover:text-white truncate w-full text-center leading-tight">
                                                {monster.name}
                                            </span>
                                            <div className="flex gap-2 text-[9px] text-gray-500 font-mono mt-0.5">
                                                <span className="text-red-400">❤️ {monster.hp}</span>
                                                <span className="text-blue-400">🛡️ {monster.ac}</span>
                                            </div>
                                        </button>
                                    ))}
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
    </>
  );
};

export default SidebarDM;