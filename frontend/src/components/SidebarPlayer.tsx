import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Chat, { ChatMessage } from './Chat';
import { Entity, Item } from '../App';
import LevelUpModal from './LevelUpModal';
import { getLevelFromXP, getProficiencyBonus, calculateHPGain, XP_TABLE } from '../utils/gameRules';
import Inventory from './Inventory';
import { mapEntityStatsToAttributes } from '../utils/attributeMapping';
import { 
  Zap, Skull, Heart, Scroll, Coins, Scale, Sword, BookOpen, Sparkles, Plus, Edit, Trash2, Fingerprint, ChevronRight, ChevronLeft, Flame, Star, CheckCircle, Info
} from 'lucide-react';

export interface InitiativeItem { id: number; name: string; value: number; }

const EMPTY_ARRAY: any[] = [];

const CLASS_ABILITIES: Record<string, { name: string; max: number; icon: string; desc: string; color: string; unlockLevel: number, type: string }[]> = {
  'BARBARO': [
    { name: 'Fúria', max: 2, icon: '😡', desc: 'Vantagem em FOR, Resistência a dano.', color: 'text-red-500', unlockLevel: 1, type: 'bonus action' },
    { name: 'Ataque Imprudente', max: 99, icon: '⚠️', desc: 'Vantagem no ataque, inimigos têm vantagem.', color: 'text-orange-500', unlockLevel: 2, type: 'action' }
  ],
  'GUERREIRO': [
    { name: 'Retomar o Fôlego', max: 1, icon: '🩹', desc: 'Recupera 1d10 + Nível de PV.', color: 'text-green-400', unlockLevel: 1, type: 'bonus action' },
    { name: 'Surto de Ação', max: 1, icon: '⚡', desc: 'Ganha uma ação extra.', color: 'text-yellow-500', unlockLevel: 2, type: 'action' }
  ],
  'CLERIGO': [
    { name: 'Curar Ferimentos', max: 2, icon: '✨', desc: 'Rola 1d8 + Sabedoria de cura.', color: 'text-blue-400', unlockLevel: 1, type: 'action' },
    { name: 'Canalizar Divindade', max: 1, icon: '🙏', desc: 'Efeito especial do domínio.', color: 'text-yellow-400', unlockLevel: 2, type: 'action' }
  ],
};

const GENERIC_RULES = {
    "saving throws": "Uma jogada de salvaguarda (também chamada de salvamento) representa uma tentativa de resistir a um feitiço, uma armadilha, um veneno, uma doença ou uma ameaça semelhante. Normalmente, você não decide fazer uma jogada de salvaguarda; você é forçado a fazer uma porque seu personagem ou monstro está em risco de sofrer dano.\n\nA dificuldade de uma salvaguarda é determinada pelo efeito que a causa. Para magias, a CD é calculada pela habilidade conjuradora de quem lançou o feitiço.",
    "proficiencias e treinamento": "As proficiências cobrem o treinamento com armaduras, armas, ferramentas e habilidades. A proficiência representa o seu conhecimento especializado num tópico específico, seja ele a luta com espadas ou o conhecimento da história antiga.\n\nSeu Bônus de Proficiência é adicionado a testes, ataques ou salvaguardas envolvendo ferramentas ou habilidades nas quais você tem treinamento."
}

const formatSpellName = (name: string) => {
    if (!name) return "Magia Desconhecida";
    return name.split(' (')[0].replace(/\{@[^}]+\}/g, '').trim();
};

const PT_BR_DICT: Record<string, string> = {
    "str": "FOR", "dex": "DES", "con": "CON", "int": "INT", "wis": "SAB", "cha": "CAR",
    "strength": "Força", "dexterity": "Destreza", "constitution": "Constituição", 
    "intelligence": "Inteligência", "wisdom": "Sabedoria", "charisma": "Carisma",
    "acrobatics": "Acrobacia", "animal handling": "Lidar com Animais", "arcana": "Arcanismo",
    "athletics": "Atletismo", "deception": "Enganação", "history": "História", "insight": "Intuição",
    "intimidation": "Intimidação", "investigation": "Investigação", "medicine": "Medicina",
    "nature": "Natureza", "perception": "Percepção", "performance": "Atuação",
    "persuasion": "Persuasão", "religion": "Religião", "sleight of hand": "Prestidigitação",
    "stealth": "Furtividade", "survival": "Sobrevivência",
    "fire": "Ígneo", "cold": "Gélido", "acid": "Ácido", "lightning": "Elétrico", 
    "thunder": "Trovejante", "poison": "Venenoso", "necrotic": "Necrótico", 
    "radiant": "Radiante", "force": "Energia", "psychic": "Psíquico", 
    "bludgeoning": "Contundente", "piercing": "Perfurante", "slashing": "Cortante",
    "heal": "Cura", "healing": "Cura", "all": "ALL", "attack": "ATTACK", "action": "ACTION", "bonus action": "BONUS ACTION", "reaction": "REACTION", "other": "OTHER",
    "saving throws": "Salvaguardas", "proficiencias e treinamento": "Proficiências e Treinamento"
};

const SKILL_MAP: Record<string, string> = {
    "acrobatics": "dex", "animal handling": "wis", "arcana": "int", "athletics": "str",
    "deception": "cha", "history": "int", "insight": "wis", "intimidation": "cha",
    "investigation": "int", "medicine": "wis", "nature": "int", "perception": "wis",
    "performance": "cha", "persuasion": "cha", "religion": "int", "sleight of hand": "dex",
    "stealth": "dex", "survival": "wis"
};

const translateTerm = (term: string) => {
    if (!term) return "";
    return PT_BR_DICT[term] || PT_BR_DICT[term.toLowerCase()] || term;
};

const getSpellMeta = (spell: any) => {
    let time = "1 ação";
    if (spell.time && Array.isArray(spell.time) && spell.time[0]) {
        time = `${spell.time[0].number} ${translateTerm(spell.time[0].unit)}`;
    } else if (typeof spell.time === 'string') time = spell.time;

    let range = "Visão";
    if (spell.range && spell.range.distance) {
        range = spell.range.distance.amount ? `${spell.range.distance.amount} ${translateTerm(spell.range.distance.type)}` : translateTerm(spell.range.distance.type);
    } else if (typeof spell.range === 'string') range = spell.range;

    let comps = "V, S";
    if (spell.components && typeof spell.components === 'object') {
        const c = [];
        if (spell.components.v) c.push("V");
        if (spell.components.s) c.push("S");
        if (spell.components.m) c.push("M");
        if (c.length > 0) comps = c.join(", ");
    } else if (typeof spell.components === 'string') comps = spell.components;
    
    return { time, range, comps };
};

const IdentityCard = ({ title, content }: { title: string, content: string | undefined }) => {
    if (!content || content.trim() === '') return null;
    return (
        <div className="bg-[#fcfcfc] border border-gray-200 rounded p-3 shadow-sm mb-2">
            <h4 className="text-[10px] text-red-800 uppercase tracking-widest font-bold mb-1 border-b border-gray-200 pb-1">{title}</h4>
            <p className="text-xs text-gray-700 font-serif leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>
    );
};

interface DescriptionPanelProps {
    title: string;
    description: string;
    onClose: () => void;
}

const DescriptionPanel: React.FC<DescriptionPanelProps> = ({ title, description, onClose }) => {
    return (
        <div className="absolute top-0 right-0 h-full w-[340px] bg-[#f8f8f8] border-l border-gray-300 z-[210] flex flex-col transform transition-transform animate-in slide-in-from-right duration-300 shadow-[-10px_0_20px_rgba(0,0,0,0.1)]">
            <div className="bg-white p-4 shrink-0 flex items-center justify-between border-b border-gray-200 shadow-sm">
                <h3 className="text-lg font-black text-gray-900 truncate flex items-center gap-2"><Info size={16} className="text-red-700"/> {title}</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"><ChevronRight size={20}/></button>
            </div>
            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
                <div className="space-y-4 font-serif leading-relaxed text-sm text-gray-700">
                    {description ? description.split('\n\n').map((para, i) => <p key={i} className="whitespace-pre-wrap">{para}</p>) : "Nenhuma descrição disponível."}
                </div>
            </div>
            <div className="bg-gray-100 p-3 text-center border-t border-gray-200 shrink-0 shadow-inner">
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Nexus VTT Codex</span>
            </div>
        </div>
    )
}

interface SidebarPlayerProps {
  entities: Entity[];
  myCharacterName: string; 
  myCharacterId: number;
  initiativeList: InitiativeItem[];
  activeTurnId: number | null;
  chatMessages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onRollAttribute: (charName: string, attrName: string, mod: number, damageExpression?: string, damageType?: string) => void;
  onUpdateCharacter?: (id: number, updates: Partial<Entity>) => void;
  onSelectEntity?: (entity: Entity) => void;
  onApplyDamageFromChat: (targetId: number, damageExpression: string) => void;
  availableSpells?: any[]; 
}

const SidebarPlayer: React.FC<SidebarPlayerProps> = ({ 
  entities, myCharacterName, myCharacterId, initiativeList, activeTurnId, chatMessages, onSendMessage, onRollAttribute, onUpdateCharacter, onSelectEntity, onApplyDamageFromChat, availableSpells
}) => {
  const [activeTab, setActiveTab] = useState<'actions' | 'inventory' | 'features' | 'background' | 'notes' | 'chat'>('actions');
  const [actionFilter, setActionFilter] = useState<'all' | 'attack' | 'action' | 'bonus action' | 'reaction' | 'other'>('all');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [pendingLevelData, setPendingLevelData] = useState<{ newLevel: number, hpGain: number } | null>(null);

  const [descriptionPanel, setDescriptionPanel] = useState<{ title: string, content: string } | null>(null);
  const [expandedActionIds, setExpandedActionIds] = useState<Record<string, boolean>>({});
  const [hpInput, setHpInput] = useState<string>('');

  const [abilityUsage, setAbilityUsage] = useState<Record<string, number>>({});
  const [deathSaves, setDeathSaves] = useState({ successes: 0, failures: 0 });
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [isEditingAction, setIsEditingAction] = useState(false);
  const [actionForm, setActionForm] = useState<{ id?: string, name: string, attackMod: string, damageExpr: string, damageType: string, saveAttr: string }>({
      name: '', attackMod: 'none', damageExpr: '', damageType: 'Físico', saveAttr: 'none'
  });

  const myCharacter = entities.find(e => e.id === myCharacterId) || entities.find(e => e.type === 'player' && e.name === myCharacterName); 
  const customActions = useMemo(() => (myCharacter as any)?.customActions || EMPTY_ARRAY, [myCharacter]); 
  const charDetails = (myCharacter as any)?.details; 
  
  const currentXP = myCharacter?.xp || 0;
  const calculatedLevel = getLevelFromXP(currentXP);
  const savedLevel = myCharacter?.level || 1;
  const proficiencyBonus = getProficiencyBonus(savedLevel);
  const attributes = myCharacter ? mapEntityStatsToAttributes(myCharacter) : { FOR: 10, DES: 10, CON: 10, INT: 10, SAB: 10, CAR: 10 };
  const proficiencies = myCharacter?.proficiencies || {};
  
  const inventory = (myCharacter?.inventory || []);
  const equippedWeapons = inventory.filter(i => i.type === 'weapon' && i.isEquipped); 
  const equippedArmor = inventory.find(i => i.isEquipped && i.type === 'armor');
  const armorBonus = equippedArmor?.stats?.ac || 0;
  const currentAC = (myCharacter?.ac || 10) + armorBonus; 

  const strMod = Math.floor((attributes.FOR - 10) / 2);
  const dexMod = Math.floor((attributes.DES - 10) / 2);
  const conMod = Math.floor((attributes.CON - 10) / 2);
  const intMod = Math.floor((attributes.INT - 10) / 2);
  const wisMod = Math.floor((attributes.SAB - 10) / 2);
  const chaMod = Math.floor((attributes.CAR - 10) / 2);

  const mods = { 'str': strMod, 'dex': dexMod, 'con': conMod, 'int': intMod, 'wis': wisMod, 'cha': chaMod };

  const nextLevelTotalXP = 300 * Math.pow(2, savedLevel - 1); 
  const currentLevelBaseXP = XP_TABLE ? XP_TABLE[savedLevel - 1] : 0;
  const xpVisivel = currentXP - currentLevelBaseXP;
  const xpNecessarioNoNivel = nextLevelTotalXP - currentLevelBaseXP;
  const xpPercent = nextLevelTotalXP > 0 ? Math.min(100, ((currentXP - currentLevelBaseXP) / (nextLevelTotalXP - currentLevelBaseXP)) * 100) : 100;
  const hpPercent = myCharacter ? Math.max(0, Math.min(100, (myCharacter.hp / myCharacter.maxHp) * 100)) : 100;

  const totalWeight = inventory.reduce((acc, item) => acc + (item.weight || 0) * item.quantity, 0);
  const maxWeight = (attributes.FOR || 10) * 7.5; 
  const weightPercent = Math.min(100, (totalWeight / maxWeight) * 100);

  // 🔥 GATILHO MÁGICO INSTANTÂNEO 🔥
  // Fecha a barra e manda o sinal para renderizar o dado na mesma fração de segundo!
  const handleTriggerRoll = useCallback((charName: string, attrName: string, mod: number, damageExpr?: string, damageType?: string) => {
      setIsCollapsed(true); 
      onRollAttribute(charName, attrName, mod, damageExpr, damageType);
  }, [onRollAttribute]);

  const getSpellcastingMod = () => {
      const cType = myCharacter?.classType?.toLowerCase() || '';
      if (cType.includes('wizard') || cType.includes('mago') || cType.includes('artificer') || cType.includes('artifice')) return Math.floor((attributes.INT - 10) / 2);
      if (cType.includes('sorcerer') || cType.includes('feiticeiro') || cType.includes('warlock') || cType.includes('bruxo') || cType.includes('bard') || cType.includes('bardo') || cType.includes('paladin') || cType.includes('paladino')) return Math.floor((attributes.CAR - 10) / 2);
      return Math.floor((attributes.SAB - 10) / 2); 
  };
  
  const spellMod = getSpellcastingMod();
  const spellAttackBonus = spellMod + proficiencyBonus;
  const spellDC = 8 + proficiencyBonus + spellMod;

  const hasSpellSlots = useMemo(() => {
      if (!myCharacter?.spellSlots) return false;
      return [1,2,3,4,5,6,7,8,9].some(level => (myCharacter.spellSlots as any)[level]?.max > 0);
  }, [myCharacter?.spellSlots]);

  const knownSpells = useMemo(() => {
      const rawSpells = myCharacter?.spells || [];
      return rawSpells.map((sp: any) => {
          const isString = typeof sp === 'string';
          const rawName = isString ? sp : sp.name;
          const cleanName = formatSpellName(rawName);
          const spId = isString ? cleanName : (sp.id || cleanName);
          const compendiumData = availableSpells?.find(s => s.name.toLowerCase() === cleanName.toLowerCase());
          const finalLevel = compendiumData?.level !== undefined ? parseInt(compendiumData.level) : (isString ? 0 : (parseInt(sp.level) || 0));
          
          let desc = compendiumData?.description || compendiumData?.entries || sp.description || "";
          if (Array.isArray(desc)) desc = desc.join('\n');
          if (typeof desc === 'string') desc = desc.replace(/\{@[a-z]+\s+([^}]+)\}/gi, '$1');

          const rawText = JSON.stringify(compendiumData || sp).toLowerCase();
          let parsedDamage = compendiumData?.damage || sp.damage || "";
          let parsedType = "";

          if (!parsedDamage) {
              const dmgMatch = rawText.match(/\{@(damage|dice)\s+([^}]+)\}/i);
              if (dmgMatch) {
                  parsedDamage = dmgMatch[2];
              } else {
                  const txtMatch = rawText.match(/(\d+d\d+)(?:\s*(?:\+\s*\d+)?)\s*(fire|cold|lightning|acid|poison|necrotic|radiant|thunder|force|psychic|bludgeoning|piercing|slashing)?\s*(damage|dano)/i);
                  if (txtMatch) {
                      parsedDamage = txtMatch[1];
                      if (txtMatch[2]) parsedType = translateTerm(txtMatch[2]);
                  }
              }
          }

          if (!parsedType) {
              const typeRegex = /(fire|cold|acid|lightning|thunder|poison|necrotic|radiant|force|psychic)\s*(damage|dano)/i;
              const typeMatch = rawText.match(typeRegex);
              if (typeMatch) parsedType = translateTerm(typeMatch[1]);
          }

          const isAttack = rawText.includes('spell attack') || rawText.includes('ataque com magia') || rawText.includes('{@hit');
          const isSave = rawText.includes('saving throw') || rawText.includes('teste de resistência') || !!compendiumData?.savingThrow;

          return { 
              ...(compendiumData || {}), id: spId, name: cleanName, level: finalLevel, 
              parsedDamage, parsedType: parsedType || "Mágico", isAttack, isSave, cleanDescription: desc, type: 'action'
          };
      }).sort((a, b) => a.name.localeCompare(b.name));
  }, [myCharacter?.spells, availableSpells]);

  const allFilteredActions = useMemo(() => {
    let list: any[] = [];

    equippedWeapons.forEach(weapon => {
        const isFinesseOrRanged = weapon.stats?.properties?.some(p => p.toLowerCase().includes('finesse') || p.toLowerCase().includes('distância')) || weapon.name.toLowerCase().includes('arco');
        const totalHitMod = (isFinesseOrRanged ? dexMod : strMod) + proficiencyBonus;
        const translatedWpnType = translateTerm(['cortante', 'perfurante', 'contundente'].find(t => (weapon.stats?.properties?.join(' ').toLowerCase() || '').includes(t)) || 'Físico');

        list.push({ 
            id: weapon.id, name: weapon.name, attackMod: isFinesseOrRanged ? 'dex' : 'str', 
            damageExpr: weapon.stats?.damage || '1d4', damageType: translatedWpnType, hitMod: totalHitMod,
            category: 'attack', type: 'weapon', typeDetail: 'Ataques', range: isFinesseOrRanged ? 'Distância' : '5 ft.',
            desc: `Ataque com arma corpo-a-corpo ou à distância. Modificador usado: ${isFinesseOrRanged ? 'Destreza' : 'Força'}.`
        });
    });

    list.push(...knownSpells.map(s => {
        const meta = getSpellMeta(s);
        const metaText = `Tempo de Conjuração: ${meta.time} | Alcance: ${meta.range} | Componentes: ${meta.comps}`;
        return {
            ...s, category: s.isAttack ? 'attack' : 'action', type: 'spell', typeDetail: `Magias Nível ${s.level}`, range: meta.range,
            desc: `${metaText}\n\n${s.cleanDescription}`
        }
    }));
    
    customActions.forEach((action: any) => {
        list.push({ ...action, category: action.attackMod !== 'none' ? 'attack' : (action.type === 'bonus action' ? 'bonus action' : 'action'), type: 'macro', typeDetail: 'Ações Customizadas', range: '--', desc: "Ação customizada criada pelo jogador." });
    });

    list.push(...(CLASS_ABILITIES[myCharacter?.classType?.toUpperCase() || ''] || []).map(a => ({...a, category: a.type, type: 'feature', typeDetail: 'Habilidades de Classe', range: '--'})));

    if (actionFilter === 'all') return list.sort((a,b) => a.category.localeCompare(b.category));
    return list.filter(a => a.category === actionFilter).sort((a,b) => a.name.localeCompare(b.name));
  }, [equippedWeapons, knownSpells, customActions, myCharacter?.classType, strMod, dexMod, proficiencyBonus, actionFilter]);

  const toggleActionExpansion = (id: string) => {
      setExpandedActionIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCoinChange = (coinType: 'cp' | 'sp' | 'ep' | 'gp' | 'pp', amount: number) => {
      if (!myCharacter || !onUpdateCharacter) return;
      const currentCoins = myCharacter.coins || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
      const newVal = Math.max(0, currentCoins[coinType] + amount);
      onUpdateCharacter(myCharacter.id, { coins: { ...currentCoins, [coinType]: newVal } });
  };

  const renderCoin = (type: 'cp' | 'sp' | 'ep' | 'gp' | 'pp', label: string, colorClass: string) => {
      const val = myCharacter?.coins?.[type] || 0;
      return (
          <div className={`flex-1 flex flex-col items-center justify-center p-1.5 rounded border ${colorClass} relative group overflow-hidden bg-white shadow-sm`}>
              <span className="text-[9px] font-black tracking-widest opacity-70 mb-0.5">{label}</span>
              <span className="font-bold text-sm text-gray-800">{val}</span>
              <div className="absolute inset-0 flex items-center justify-between px-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-100/90 backdrop-blur-sm">
                  <button onClick={() => handleCoinChange(type, -1)} className="text-red-600 hover:text-red-800 font-black px-1.5 hover:bg-gray-200 rounded">-</button>
                  <button onClick={() => handleCoinChange(type, 1)} className="text-green-600 hover:text-green-800 font-black px-1.5 hover:bg-gray-200 rounded">+</button>
              </div>
          </div>
      );
  };

  useEffect(() => { if (activeTab === 'chat' && !isCollapsed) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages, activeTab, isCollapsed]);

  useEffect(() => {
      if (myCharacter && calculatedLevel > savedLevel) {
          const hpGain = calculateHPGain(myCharacter.classType || 'npc', myCharacter.stats?.con || 10);
          setPendingLevelData({ newLevel: calculatedLevel, hpGain: hpGain });
          setShowLevelUpModal(true);
      }
  }, [calculatedLevel, savedLevel, myCharacter]);

  const handleHeal = () => {
      const val = parseInt(hpInput);
      if (!isNaN(val) && val > 0 && myCharacter && onUpdateCharacter) {
          onUpdateCharacter(myCharacter.id, { hp: Math.min((myCharacter.maxHp || 10), (myCharacter.hp || 0) + val) });
          setHpInput('');
          onSendMessage(`💚 **${myCharacter.name}** curou **${val} PV**.`);
      }
  };

  const handleTakeDamage = () => {
      const val = parseInt(hpInput);
      if (!isNaN(val) && val > 0 && myCharacter && onUpdateCharacter) {
          onUpdateCharacter(myCharacter.id, { hp: Math.max(0, (myCharacter.hp || 0) - val) });
          setHpInput('');
          onSendMessage(`🩸 **${myCharacter.name}** sofreu **${val} de dano**.`);
      }
  };

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
          if (item.quantity > 1) newInv = newInv.map(i => i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i);
          else newInv = newInv.filter(i => i.id !== item.id);
          onUpdateCharacter(myCharacter.id, { inventory: newInv });
          return;
      }
      if (item.isEquipped) {
          newInv = newInv.map(i => i.id === item.id ? { ...i, isEquipped: false } : i);
          onUpdateCharacter(myCharacter.id, { inventory: newInv });
          onSendMessage(`🛡️ **${myCharacter.name}** desequipou **${item.name}**.`);
          return;
      }
      if (item.type === 'armor') newInv = newInv.map(i => i.type === 'armor' ? { ...i, isEquipped: false } : i);
      else if (item.type === 'weapon') { 
          const eqList = newInv.filter(i => i.isEquipped && i.type === 'weapon');
          if (eqList.length >= 2) newInv = newInv.map(i => i.id === eqList[0].id ? { ...i, isEquipped: false } : i);
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

  const handleDeathSave = (type: 'success' | 'failure') => {
      if (!myCharacter) return;
      const newVal = type === 'success' ? deathSaves.successes + 1 : deathSaves.failures + 1;
      if (newVal > 3) return; 
      setDeathSaves(prev => ({ ...prev, [type === 'success' ? 'successes' : 'failures']: newVal }));
      const roll = Math.floor(Math.random() * 20) + 1;
      onSendMessage(`💀 **${myCharacter.name}** rolou Salvaguarda de Morte: ${type.toUpperCase()} (${newVal}/3) [Dado: ${roll}]`);
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
        setAbilityUsage({}); setDeathSaves({ successes: 0, failures: 0 });
        let clearedSlots = { ...myCharacter.spellSlots };
        if (clearedSlots) Object.keys(clearedSlots).forEach(level => { clearedSlots[Number(level)].used = 0; });
        onUpdateCharacter(myCharacter.id, { hp: myCharacter.maxHp, spellSlots: clearedSlots });
        onSendMessage(`💤 **${myCharacter.name}** realizou um Descanso Longo. Vida, magias e recursos restaurados.`);
    }
  };

  const handleSpellSlotChange = (levelIndex: number, action: 'add_max' | 'remove_max' | 'toggle_used', slotIndex?: number) => {
      if (!myCharacter || !onUpdateCharacter) return;
      const currentSlots = myCharacter.spellSlots || {};
      const levelData = currentSlots[levelIndex] || { max: 0, used: 0 };
      let newMax = levelData.max; let newUsed = levelData.used;
      if (action === 'add_max' && newMax < 4) newMax++;
      if (action === 'remove_max' && newMax > 0) { newMax--; if (newUsed > newMax) newUsed = newMax; }
      if (action === 'toggle_used' && slotIndex !== undefined) { if (newUsed === slotIndex + 1) newUsed--; else newUsed = slotIndex + 1; }
      onUpdateCharacter(myCharacter.id, { spellSlots: { ...currentSlots, [levelIndex]: { max: newMax, used: newUsed } } });
  };

  const onCastSpellRP = (spell: any) => {
      if (!myCharacter || !onUpdateCharacter) return;
      const level = parseInt(spell.level) || 0;
      if (level > 0) {
          const currentSlots = myCharacter.spellSlots || {};
          const levelData = currentSlots[level] || { max: 0, used: 0 };
          if (levelData.used >= levelData.max) { alert(`Sem espaços para Círculo ${level}!`); return; }
          onUpdateCharacter(myCharacter.id, { spellSlots: { ...currentSlots, [level]: { ...levelData, used: levelData.used + 1 } } });
      }
      onSendMessage(`✨ **${myCharacter.name}** conjurou **${spell.name}**${level > 0 ? ` (Círculo ${level})` : ''}!`);
  };

  const handleAutoFill = (val: string) => {
      if (!val) return;
      const [type, id] = val.split('|');

      if (type === 'weapon') {
          const weapon = equippedWeapons.find(w => w.id === id);
          if (weapon) {
              const wName = weapon.name.toLowerCase();
              const isFinesseOrRanged = weapon.stats?.properties?.some(p => p.toLowerCase().includes('finesse') || p.toLowerCase().includes('distância')) || wName.includes('arco');
              const modType = isFinesseOrRanged ? 'dex' : 'str';
              const propsRaw = weapon.stats?.properties?.join(' ').toLowerCase() || '';
              const fType = ['cortante', 'perfurante', 'contundente'].find(t => propsRaw.includes(t)) || 'Físico';
              const translatedWpnType = translateTerm(fType);

              setActionForm(prev => ({
                  ...prev,
                  name: weapon.name,
                  attackMod: modType,
                  damageExpr: weapon.stats?.damage || '1d4',
                  damageType: translatedWpnType,
                  saveAttr: 'none'
              }));
          }
      } else if (type === 'spell') {
          const spell = knownSpells.find(s => s.id === id);
          if (spell) {
              setActionForm(prev => ({
                  ...prev,
                  name: spell.name,
                  attackMod: spell.isAttack ? 'spell' : 'none',
                  damageExpr: spell.parsedDamage || '',
                  damageType: spell.parsedType || 'Mágico',
                  saveAttr: spell.isSave ? 'DES' : 'none'
              }));
          }
      }
  };

  const handleSaveCustomAction = () => {
      if (!myCharacter || !onUpdateCharacter || !actionForm.name.trim()) return;
      const newAction = { ...actionForm, id: actionForm.id || Date.now().toString() };
      let updatedActions;
      if (actionForm.id) updatedActions = customActions.map((a: any) => a.id === actionForm.id ? newAction : a);
      else updatedActions = [...customActions, newAction];
      
      onUpdateCharacter(myCharacter.id, { customActions: updatedActions } as any);
      setIsEditingAction(false);
  };

  const handleDeleteCustomAction = (id: string) => {
      if (!myCharacter || !onUpdateCharacter) return;
      if (window.confirm("Remover esta ação do painel de batalha?")) {
          const updatedActions = customActions.filter((a: any) => a.id !== id);
          onUpdateCharacter(myCharacter.id, { customActions: updatedActions } as any);
      }
  };

  const executeActionAttack = (action: any) => {
      handleTriggerRoll(myCharacterName, `Ataque: ${action.name}`, action.hitMod || 0, action.damageExpr, action.damageType);
  };

  const executeActionDamage = (action: any) => {
      handleTriggerRoll(myCharacterName, `Dano: ${action.name}`, 0, action.damageExpr, action.damageType);
  };

  const executeActionSave = (action: any) => {
      handleTriggerRoll(myCharacterName, `Resistência (${action.saveAttr}) contra ${action.name}`, 0);
  };

  const openDescription = (termKey: string, actualName?: string) => {
    let content = "";
    if (GENERIC_RULES[termKey as keyof typeof GENERIC_RULES]) content = GENERIC_RULES[termKey as keyof typeof GENERIC_RULES];
    else if (SKILL_MAP[termKey]) content = `Habilidade genérica de ${translateTerm(SKILL_MAP[termKey])} para ${actualName || translateTerm(termKey)}. Seu bônus nesta habilidade representa seu treino.`;
    else if ((charDetails as any)?.background && termKey.toLowerCase() === (charDetails as any).background.toLowerCase()) content = (charDetails as any)?.backgroundDesc || "Descrição do background não disponível.";
    else if (attributes[termKey as keyof typeof attributes]) content = `Pontuação genérica de atributo para ${PT_BR_DICT[termKey.toLowerCase()]}. Define os seus modificadores base.`;
    
    const actionFound = allFilteredActions.find(a => a.id === termKey || a.name === actualName);
    if (actionFound && actionFound.desc) content = actionFound.desc;

    if (!content) content = `Sem descrição detalhada disponível para ${actualName || translateTerm(termKey)}.`;
    
    setDescriptionPanel({ title: actualName || translateTerm(termKey), content: content });
  }

  if (!myCharacter) {
      return (
          <div className={`relative h-full transition-all duration-300 bg-[#1a1510] z-50 ${isCollapsed ? 'w-0' : 'w-[100vw] xl:w-[1200px]'}`}>
              <div className="flex flex-col items-center justify-center h-full text-gray-500"><Scroll size={40} className="mb-2 opacity-20" /><p className="text-xs">Personagem não encontrado.</p></div>
          </div>
      );
  }

  return (
    <>
        {showLevelUpModal && pendingLevelData && (
            <LevelUpModal newLevel={pendingLevelData.newLevel} hpGain={pendingLevelData.hpGain} charClass={myCharacter.classType || 'GUERREIRO'} oldStats={myCharacter.stats || {str:10,dex:10,con:10,int:10,wis:10,cha:10}} onConfirm={(u) => { if(onUpdateCharacter && myCharacter) { onUpdateCharacter(myCharacter.id, {...u, level: pendingLevelData.newLevel, hp: Math.min((myCharacter.hp||0)+pendingLevelData.hpGain, (myCharacter.maxHp||0)+pendingLevelData.hpGain), maxHp: (myCharacter.maxHp||0)+pendingLevelData.hpGain}); setShowLevelUpModal(false);}}} />
        )}

        <div className={`relative h-full transition-all duration-300 ease-in-out flex-shrink-0 z-50 shadow-2xl ${isCollapsed ? 'w-0' : 'w-[100vw] xl:w-[1200px]'}`}>
            
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute top-1/2 -left-8 transform -translate-y-1/2 w-8 h-20 bg-white border-y border-l border-red-800 rounded-l-xl flex items-center justify-center text-red-800 hover:text-red-600 hover:bg-gray-100 cursor-pointer shadow-[-5px_0_15px_rgba(0,0,0,0.5)] z-[200] transition-colors"
            >
                {isCollapsed ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </button>

            <div className="w-full box-border flex flex-col h-full bg-[#f4f1ea] text-[#1a1a1a] overflow-hidden font-sans border-l border-red-800 shadow-[inset_0_0_100px_rgba(0,0,0,0.05)] relative">
                
                {/* ABA DE DESCRIÇÃO (SLIDE-OUT) */}
                {descriptionPanel && <DescriptionPanel title={descriptionPanel.title} description={descriptionPanel.content} onClose={() => setDescriptionPanel(null)} />}

                {/* HEADER D&D BEYOND */}
                <div className="bg-[#242527] text-white p-3 shrink-0 flex items-center gap-4 relative overflow-hidden shadow-lg border-b-4 border-red-800 z-20">
                    <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-bl from-red-500/20 to-transparent mix-blend-overlay"></div>
                    
                    <div className="w-14 h-14 bg-white border border-gray-600 rounded cursor-pointer shrink-0 relative z-10" onClick={() => onSelectEntity && onSelectEntity(myCharacter)}>
                        <img src={myCharacter.image || '/tokens/aliado.png'} alt="Token" className="w-full h-full object-cover rounded-sm" />
                    </div>
                    
                    <div className="flex-1 min-w-0 z-10 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-lg font-black text-white truncate font-serif">{myCharacter.name}</h2>
                            <span className="text-[9px] uppercase font-bold bg-white/10 px-2 py-0.5 rounded border border-white/20 text-gray-300 tracking-wider hidden sm:block">Manejar</span>
                        </div>
                        <div className="flex text-[10px] text-gray-400 gap-2 font-mono">
                            <span>{myCharacter.race}</span>
                            <span>•</span>
                            <span className="text-red-400">{myCharacter.classType?.split(' (')[0]} {savedLevel}</span>
                        </div>
                        <div className="mt-1.5 w-full max-w-sm h-1.5 bg-black rounded overflow-hidden border border-gray-700">
                            <div className="h-full bg-cyan-500" style={{ width: `${xpPercent}%` }}></div>
                        </div>
                        <div className="text-[8px] text-gray-400 mt-1 uppercase font-black tracking-widest">{xpVisivel} / {xpNecessarioNoNivel} XP</div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 z-10 shrink-0">
                        <button onClick={handleShortRest} className="flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-transparent border border-red-600 text-red-500 hover:bg-red-900/30 px-3 py-1.5 rounded transition-colors"><Flame size={12}/> Short Rest</button>
                        <button onClick={handleLongRest} className="flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-transparent border border-red-600 text-red-500 hover:bg-red-900/30 px-3 py-1.5 rounded transition-colors"><Heart size={12}/> Long Rest</button>
                        <button className="flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-white border border-gray-600 text-black hover:bg-gray-100 px-3 py-1.5 rounded transition-colors ml-2"><CheckCircle size={12}/> Inspiração</button>
                    </div>
                </div>

                {/* ROW DE STATUS / ATRIBUTOS NO TOPO */}
                <div className="bg-white border-b border-gray-300 p-2 lg:p-4 shrink-0 flex flex-wrap xl:flex-nowrap gap-2 lg:gap-4 shadow-sm items-start justify-between z-10">
                    <div className="flex gap-2">
                        {['FOR', 'DES', 'CON', 'INT', 'SAB', 'CAR'].map((attr) => {
                            const val = attributes[attr as keyof typeof attributes] || 10;
                            const mod = Math.floor((val - 10) / 2);
                            return (
                                <div key={attr} onClick={(e) => { e.stopPropagation(); handleTriggerRoll(myCharacter.name, attr, mod); }} className="flex flex-col items-center group relative cursor-pointer pb-2">
                                    <div className="w-12 h-14 bg-white border border-gray-300 rounded-lg flex flex-col items-center justify-start shadow-sm group-hover:border-[#c53131] transition-colors z-10 relative pt-1">
                                        <span className="text-[7px] font-black uppercase text-gray-800">{attr}</span>
                                        <span className="text-xl font-black text-black leading-none mt-0.5">{mod >= 0 ? `+${mod}` : mod}</span>
                                        <div className="absolute -bottom-2.5 bg-white border border-gray-300 rounded-xl px-2 py-0.5 text-[9px] font-bold z-20 group-hover:border-[#c53131] transition-colors shadow-sm">
                                            {val}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    <div className="flex gap-2">
                        <div className="bg-white border border-gray-300 rounded-lg flex flex-col items-center justify-center p-1 w-14 shadow-sm">
                            <span className="text-[8px] font-black uppercase text-gray-500">Profic.</span>
                            <span className="text-lg font-black text-black leading-none mt-1">+{proficiencyBonus}</span>
                            <span className="text-[8px] font-black uppercase text-gray-400 mt-1">Bonus</span>
                        </div>
                        <div className="bg-white border border-gray-300 rounded-lg flex flex-col items-center justify-center p-1 w-14 shadow-sm">
                            <span className="text-[8px] font-black uppercase text-gray-500">Walking</span>
                            <span className="text-lg font-black text-black leading-none mt-1">30<span className="text-[9px]">ft</span></span>
                            <span className="text-[8px] font-black uppercase text-gray-400 mt-1">Speed</span>
                        </div>
                        <div className="flex flex-col items-center ml-2">
                            <span className="text-[8px] font-black uppercase text-gray-500">Initiative</span>
                            <div className="bg-white border border-gray-300 rounded-lg w-12 h-10 flex items-center justify-center text-base font-black text-black mt-0.5 shadow-sm gap-1">
                                {dexMod >= 0 ? `+${dexMod}` : dexMod}
                            </div>
                        </div>
                        <div className="flex flex-col items-center">
                            
                            {/* CA ESCUDO REAL */}
                            <div className="w-10 h-[48px] mt-1 relative flex flex-col items-center justify-center shadow-sm cursor-pointer group hover:scale-105 transition-transform" title="Classe de Armadura (CA)">
                                <svg className="absolute inset-0 w-full h-full text-gray-200 drop-shadow-md group-hover:text-gray-100 transition-colors" viewBox="0 0 100 120" preserveAspectRatio="none">
                                    <path d="M50 0 L100 15 L100 60 C100 90 75 110 50 120 C25 110 0 90 0 60 L0 15 Z" fill="currentColor" stroke="#6b7280" strokeWidth="4"/>
                                    <path d="M50 8 L90 20 L90 58 C90 82 70 100 50 108 C30 100 10 82 10 58 L10 20 Z" fill="none" stroke="#ffffff" strokeWidth="2"/>
                                </svg>
                                <span className="text-[6px] font-black uppercase text-gray-500 relative z-10 -mt-1 tracking-widest">Armor</span>
                                <span className="text-lg font-black text-black relative z-10 leading-none">{currentAC}</span>
                            </div>

                        </div>
                    </div>

                    {/* CAIXA DE HP INTERATIVA */}
                    <div className="border-2 border-red-800 rounded-lg bg-white overflow-hidden flex flex-col shadow-sm w-72 shrink-0 relative">
                        {myCharacter.hp <= 0 && (
                            <div className="absolute inset-0 bg-red-900/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center text-white p-2 rounded-lg">
                                <span className="text-[10px] text-red-200 uppercase font-black flex items-center gap-1.5 mb-2"><Skull size={14}/> Death Saves</span>
                                <div className="flex gap-4">
                                    <div className="flex gap-1.5 items-center"><span className="text-[9px] text-green-300 font-bold hidden lg:block">SUC</span>{[1,2,3].map(i => (<div key={i} onClick={() => handleDeathSave('success')} className={`w-3 h-3 rounded-full border border-green-900 cursor-pointer shadow-inner ${i <= deathSaves.successes ? 'bg-green-500' : 'bg-black/50'}`}></div>))}</div>
                                    <div className="flex gap-1.5 items-center"><span className="text-[9px] text-red-300 font-bold hidden lg:block">FAL</span>{[1,2,3].map(i => (<div key={i} onClick={() => handleDeathSave('failure')} className={`w-3 h-3 rounded-full border border-red-900 cursor-pointer shadow-inner ${i <= deathSaves.failures ? 'bg-red-500' : 'bg-black/50'}`}></div>))}</div>
                                </div>
                            </div>
                        )}
                        <div className="flex justify-between items-center px-2 py-1 border-b border-gray-200 bg-gray-50">
                            <div className="flex gap-1">
                                <input type="number" value={hpInput} onChange={e=>setHpInput(e.target.value)} className="w-10 text-center border border-gray-300 rounded text-xs outline-none focus:border-red-500" placeholder="0" />
                                <button onClick={handleHeal} className="text-[9px] font-bold text-green-700 bg-green-100 border border-green-300 rounded px-1.5 hover:bg-green-200 transition-colors">CURAR</button>
                                <button onClick={handleTakeDamage} className="text-[9px] font-bold text-red-700 bg-red-100 border border-red-300 rounded px-1.5 hover:bg-red-200 transition-colors">DANO</button>
                            </div>
                            <div className="flex gap-3 text-[8px] font-black text-gray-500 uppercase tracking-widest text-right">
                                <span>Current</span><span>Max</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 px-4 py-1.5 relative">
                            <div className="absolute bottom-0 left-0 h-1 bg-gray-200 w-full">
                                <div className="h-full bg-red-600 transition-all duration-500" style={{ width: `${hpPercent}%` }}></div>
                            </div>
                            <span className="text-3xl font-black text-red-900 z-10">{myCharacter.hp}</span>
                            <span className="text-xl text-gray-300 font-bold z-10">/</span>
                            <span className="text-2xl font-black text-gray-600 z-10">{myCharacter.maxHp}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-1 min-h-0 relative z-10 bg-white">
                    
                    {/* COLUNA ESQUERDA - SALVES, SENSES, PROFS */}
                    <div className="w-[200px] lg:w-[220px] bg-[#f8f8f8] border-r border-gray-300 flex flex-col h-full overflow-y-auto custom-scrollbar p-2 lg:p-3 shrink-0 shadow-inner">
                        
                        <div className="border-2 border-red-800 rounded-xl bg-white mb-4 shadow-sm relative group cursor-pointer" onClick={() => openDescription('saving throws')}>
                            <div className="absolute top-1 right-2 p-1 text-cyan-600 opacity-60 group-hover:opacity-100 group-hover:text-red-600 transition-opacity"><Zap size={10} /></div>
                            <div className="p-2 border-b border-gray-100 flex items-center justify-between bg-white text-black rounded-t-lg">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-black">Saving Throws</h4>
                                <Edit size={12} className="opacity-50 text-black"/>
                            </div>
                            <div className="flex flex-col bg-[#fcfcfc] p-1.5 space-y-0.5">
                                {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(attr => {
                                    const isProf = proficiencies[`saving_${attr}`];
                                    const rawMod = mods[attr as keyof typeof mods];
                                    const finalMod = rawMod + (isProf ? proficiencyBonus : 0);
                                    return (
                                        <div key={attr} className="flex items-center gap-2.5 p-1 hover:bg-gray-100 cursor-pointer rounded transition-colors group-inner" onClick={(e) => {e.stopPropagation(); handleTriggerRoll(myCharacter.name, `Teste de Resistência (${translateTerm(attr)})`, finalMod)}}>
                                            <div className={`w-3 h-3 rounded-full border border-black ${isProf ? 'bg-black' : 'bg-white'}`}></div>
                                            <span className="text-[10px] font-bold uppercase w-8 group-inner-hover:text-red-700">{translateTerm(attr)}</span>
                                            <span className="text-[10px] font-black w-6 text-right bg-gray-200 rounded px-1 group-inner-hover:bg-red-100 group-inner-hover:text-red-800">{finalMod >= 0 ? `+${finalMod}` : finalMod}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="border border-gray-200 rounded-lg bg-white mb-4 shadow-inner space-y-1 p-2">
                            <div className="flex justify-between items-center bg-gray-50 border border-gray-100 px-2 py-1.5 rounded-sm"><span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Percepção Passiva</span><span className="text-sm font-black text-black bg-gray-100 px-1.5 rounded-sm">{10+wisMod}</span></div>
                            <div className="flex justify-between items-center bg-gray-50 border border-gray-100 px-2 py-1.5 rounded-sm"><span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Investig. Passiva</span><span className="text-sm font-black text-black bg-gray-100 px-1.5 rounded-sm">{10+intMod}</span></div>
                            <div className="flex justify-between items-center bg-gray-50 border border-gray-100 px-2 py-1.5 rounded-sm"><span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Intuição Passiva</span><span className="text-sm font-black text-black bg-gray-100 px-1.5 rounded-sm">{10+wisMod}</span></div>
                        </div>

                        <div className="border border-gray-200 rounded-lg bg-white mb-4 shadow-inner p-2 cursor-pointer group" onClick={() => openDescription('proficiencias e treinamento')}>
                            <div className="border-b border-gray-100 pb-1 mb-1.5 flex justify-between items-center">
                                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Proficiências & Treino</span>
                            </div>
                            <div className="space-y-2">
                                <div><span className="text-[9px] uppercase font-bold block text-gray-400">Armaduras</span><span className="text-[10px] text-gray-800 font-serif leading-tight">Leve, Média, Escudo</span></div>
                                <div><span className="text-[9px] uppercase font-bold block text-gray-400">Armas</span><span className="text-[10px] text-gray-800 font-serif leading-tight">Simples, Marciais</span></div>
                                <div><span className="text-[9px] uppercase font-bold block text-gray-400">Ferramentas</span><span className="text-[10px] text-gray-800 font-serif leading-tight">Kit de Ladrão</span></div>
                                <div><span className="text-[9px] uppercase font-bold block text-gray-400">Idiomas</span><span className="text-[10px] text-gray-800 font-serif leading-tight">Comum, Élfico</span></div>
                            </div>
                        </div>
                    </div>

                    {/* COLUNA ESQUERDA - SKILLS */}
                    <div className="w-[200px] lg:w-[240px] bg-[#fcfcfc] border-r border-gray-300 flex flex-col h-full p-2 shrink-0">
                        <div className="border-2 border-red-800 rounded-xl bg-white shadow-sm flex flex-col flex-1 overflow-hidden">
                            <div className="p-2 border-b border-gray-100 flex items-center justify-between bg-white rounded-t-lg shrink-0">
                                <span className="text-[8px] font-black uppercase tracking-widest text-black flex-1">Perícias</span>
                                <Edit size={12} className="opacity-50 text-black"/>
                            </div>
                            <div className="flex flex-col bg-[#fcfcfc] p-1 flex-1 overflow-y-auto custom-scrollbar">
                                {Object.keys(SKILL_MAP).sort().map(skill => {
                                    const attr = SKILL_MAP[skill];
                                    const isProf = proficiencies[skill];
                                    const rawMod = mods[attr as keyof typeof mods];
                                    const finalMod = rawMod + (isProf ? proficiencyBonus : 0);
                                    
                                    return (
                                        <div key={skill} onClick={(e) => {e.stopPropagation(); handleTriggerRoll(myCharacter.name, translateTerm(skill), finalMod)}} className="flex items-center py-1.5 px-1.5 lg:py-[7px] hover:bg-gray-200 cursor-pointer rounded transition-colors border-b border-gray-100 last:border-0 group-inner">
                                            <div className="w-4 lg:w-5 flex justify-center">
                                                <div className={`w-2 h-2 rounded-full border border-black ${isProf ? 'bg-black' : 'bg-white'}`}></div>
                                            </div>
                                            <span className="text-[8px] lg:text-[9px] font-bold text-gray-400 uppercase w-6 text-center">{translateTerm(attr)}</span>
                                            <span className="text-[10px] lg:text-xs font-bold text-gray-800 flex-1 ml-1 capitalize group-inner-hover:text-red-700 truncate">{translateTerm(skill)}</span>
                                            <span className="text-[10px] lg:text-xs font-black text-black w-6 lg:w-8 text-right bg-gray-200 rounded px-1 py-0.5 group-inner-hover:bg-red-100 group-inner-hover:text-red-800">{finalMod >= 0 ? `+${finalMod}` : finalMod}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col h-full relative bg-white">
                        
                        <div className="flex overflow-x-auto custom-scrollbar border-b-2 border-red-800 bg-gray-50 px-1 shrink-0">
                            {[
                                { id: 'actions', label: 'ACTIONS' },
                                { id: 'inventory', label: 'INVENTORY' },
                                { id: 'features', label: 'FEATURES & TRAITS' },
                                { id: 'background', label: 'BACKGROUND' },
                                { id: 'notes', label: 'NOTES' },
                                { id: 'chat', label: 'CHAT / LOG' },
                            ].map(tab => (
                                <button 
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`px-2 lg:px-3 py-2 text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-colors relative ${activeTab === tab.id ? 'text-red-700 bg-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200'}`}
                                >
                                    {tab.label}
                                    {activeTab === tab.id && <div className="absolute top-0 left-0 w-full h-0.5 bg-red-700"></div>}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-white relative">
                            
                            {activeTab === 'actions' && (
                                <div className="flex flex-col h-full animate-in fade-in duration-300">
                                    <div className="flex gap-2 mb-3 border-b border-gray-200 px-1 shrink-0 bg-white items-center flex-wrap">
                                        {[ { id: 'all', label: 'ALL' }, { id: 'attack', label: 'ATTACK' }, { id: 'action', label: 'ACTION' }, { id: 'bonus action', label: 'BONUS ACTION' }, { id: 'reaction', label: 'REACTION' }, { id: 'other', label: 'OTHER' } ].map(f => (
                                            <button key={f.id} onClick={() => setActionFilter(f.id as any)} className={`px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase rounded transition-colors ${actionFilter === f.id ? 'bg-[#c53131] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{f.label}</button>
                                        ))}
                                        <button onClick={() => { setActionForm({ name: '', attackMod: 'none', damageExpr: '', damageType: 'Físico', saveAttr: 'none' }); setIsEditingAction(!isEditingAction); }} className="pb-1 text-[10px] font-black tracking-widest uppercase transition-colors text-blue-600 hover:text-blue-800 ml-auto flex items-center gap-1"><Plus size={10}/> Macro</button>
                                    </div>

                                    {/* HEADER PARA MAGIAS E MACROS */}
                                    {(actionFilter === 'all' || actionFilter === 'action' || actionFilter === 'bonus action' || actionFilter === 'reaction') && hasSpellSlots && (
                                        <div className="bg-[#f0f5f9] border border-[#d4e4f5] rounded-md p-2.5 mb-4 shadow-sm flex flex-col items-center justify-center shrink-0">
                                            <div className="flex gap-6 items-center justify-center w-full border-b border-[#d4e4f5] pb-2 mb-2">
                                                <span className="text-[11px] font-bold text-[#1d5ea8]">Ataque Mágico: {spellAttackBonus >= 0 ? `+${spellAttackBonus}` : spellAttackBonus}</span>
                                                <span className="text-[11px] font-bold text-[#c53131]">CD Magia: {spellDC}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2 justify-center">
                                                {[1,2,3,4,5,6,7,8,9].map(level => {
                                                    const slots = myCharacter?.spellSlots?.[level];
                                                    if (!slots || slots.max === 0) return null;
                                                    return (
                                                        <div key={level} className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-[#d4e4f5]">
                                                            <span className="text-[8px] font-bold uppercase text-gray-500 mr-1">Nível {level}</span>
                                                            {[...Array(slots.max)].map((_, i) => (
                                                                <div key={i} onClick={() => handleSpellSlotChange(level, 'toggle_used', i)} className={`w-2.5 h-2.5 rounded-full border border-blue-400 cursor-pointer ${i < slots.used ? 'bg-white' : 'bg-blue-400'}`} />
                                                            ))}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {(actionFilter === 'all' || actionFilter === 'action' || actionFilter === 'bonus action' || actionFilter === 'reaction') && !hasSpellSlots && knownSpells.length > 0 && (
                                        <div className="bg-[#f0f5f9] border border-[#d4e4f5] rounded-md p-2.5 mb-4 shadow-sm flex items-center justify-center shrink-0 gap-6 w-full">
                                            <span className="text-[11px] font-bold text-[#1d5ea8]">Ataque Mágico: {spellAttackBonus >= 0 ? `+${spellAttackBonus}` : spellAttackBonus}</span>
                                            <span className="text-[11px] font-bold text-[#c53131]">CD Magia: {spellDC}</span>
                                        </div>
                                    )}

                                    {isEditingAction && (
                                        <div className="bg-white border border-red-800 rounded-lg p-3 shadow-sm mb-3 animate-in slide-in-from-top-4">
                                            <h4 className="text-[10px] text-red-800 font-bold uppercase tracking-widest border-b border-gray-200 pb-1 mb-3">{actionForm.id ? 'Editar Macro' : 'Criar Novo Macro'}</h4>
                                            
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-[9px] text-gray-500 uppercase font-bold mb-1 block">Nome do Macro</label>
                                                    <input type="text" value={actionForm.name} onChange={e => setActionForm({...actionForm, name: e.target.value})} placeholder="Ex: Fúria, Golpe Especial..." className="w-full bg-white border border-gray-300 rounded p-1.5 text-black text-[10px] outline-none focus:border-red-600" />
                                                </div>
                                                <div className="mb-1.5 p-1.5 bg-blue-50 border border-blue-200 rounded-md">
                                                    <label className="text-[8px] text-blue-700 uppercase font-bold mb-1 flex items-center gap-1"><Sparkles size={9}/> Importar (Opcional)</label>
                                                    <select onChange={(e) => handleAutoFill(e.target.value)} value="" className="w-full bg-white border border-blue-300 rounded px-1.5 py-1 text-blue-900 text-[9px] outline-none focus:border-blue-600 cursor-pointer">
                                                        <option value="" disabled>Escolha Arma ou Magia...</option>
                                                        {equippedWeapons.length > 0 && <optgroup label="🗡️ Armas Equipadas">{equippedWeapons.map(w => <option key={`w-${w.id}`} value={`weapon|${w.id}`}>{w.name}</option>)}</optgroup>}
                                                        {knownSpells.length > 0 && <optgroup label="✨ Magias Memorizadas">{knownSpells.map(s => <option key={`s-${s.id}`} value={`spell|${s.id}`}>{s.name}</option>)}</optgroup>}
                                                    </select>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-[9px] text-gray-500 uppercase font-bold mb-1 block">Fórmula de Dano</label>
                                                        <input type="text" value={actionForm.damageExpr} onChange={e => setActionForm({...actionForm, damageExpr: e.target.value})} placeholder="Ex: 8d6" className="w-full bg-white border border-gray-300 rounded p-1.5 text-black text-[10px] outline-none focus:border-red-600 font-mono" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] text-gray-500 uppercase font-bold mb-1 block">Tipo de Dano</label>
                                                        <select value={actionForm.damageType} onChange={e => setActionForm({...actionForm, damageType: e.target.value})} className="w-full bg-white border border-gray-300 rounded p-1.5 text-black text-[10px] outline-none focus:border-red-600">
                                                            <option value="Físico">Físico</option><option value="Cura">Cura</option>
                                                            {Object.keys(PT_BR_DICT).filter(k => PT_BR_DICT[k] !== k && k.length > 3).map(k => <option key={k} value={PT_BR_DICT[k]}>{PT_BR_DICT[k]}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-[9px] text-gray-500 uppercase font-bold mb-1 block">Rolar Ataque?</label>
                                                        <select value={actionForm.attackMod} onChange={e => setActionForm({...actionForm, attackMod: e.target.value})} className="w-full bg-white border border-gray-300 rounded p-1.5 text-black text-[10px] outline-none focus:border-red-600">
                                                            <option value="none">Não</option><option value="str">Sim (FOR)</option><option value="dex">Sim (DES)</option><option value="spell">Sim (Magia)</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] text-gray-500 uppercase font-bold mb-1 block">Resistência?</label>
                                                        <select value={actionForm.saveAttr} onChange={e => setActionForm({...actionForm, saveAttr: e.target.value})} className="w-full bg-white border border-gray-300 rounded p-1.5 text-black text-[10px] outline-none focus:border-red-600">
                                                            <option value="none">Não</option><option value="FOR">FOR</option><option value="DES">DES</option><option value="CON">CON</option><option value="INT">INT</option><option value="SAB">SAB</option><option value="CAR">CAR</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1.5 pt-3 border-t border-gray-200">
                                                    <button onClick={() => setIsEditingAction(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 text-[9px] font-bold py-2 rounded transition-colors">Cancelar</button>
                                                    <button onClick={handleSaveCustomAction} disabled={!actionForm.name.trim()} className="flex-1 bg-red-700 hover:bg-red-800 disabled:bg-gray-400 text-white text-[9px] font-bold py-2 rounded transition-colors shadow-sm">Salvar Macro</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
                                        {allFilteredActions.length === 0 ? (
                                            <p className="text-[9px] text-gray-500 italic text-center py-4 border border-dashed border-gray-300 rounded bg-gray-50">Nenhuma ação encontrada para este filtro.</p>
                                        ) : (
                                            <div className="w-full">
                                                <div className="grid grid-cols-12 gap-2 pb-2 mb-1 border-b-2 border-gray-200 text-[9px] font-black text-gray-500 uppercase tracking-widest items-center">
                                                    <div className="col-span-5 pl-2">ATAQUE</div>
                                                    <div className="col-span-2 text-center">ALCANCE</div>
                                                    <div className="col-span-2 text-center">ACERTO / CD</div>
                                                    <div className="col-span-3 text-right pr-4">DANO / NOTAS</div>
                                                </div>
                                                <div className="flex flex-col">
                                                    {allFilteredActions.map((action: any, idx) => {
                                                        const showHeader = actionFilter === 'all' && (idx === 0 || allFilteredActions[idx-1].typeDetail !== action.typeDetail);
                                                        
                                                        return (
                                                            <React.Fragment key={action.id || action.name}>
                                                                {showHeader && (
                                                                    <div className="flex items-end justify-between border-b border-gray-200 mt-4 pb-1 mb-1">
                                                                        <span className="text-[11px] font-black text-[#c53131] uppercase tracking-wide">{action.typeDetail}</span>
                                                                        {action.type === 'macro' && (
                                                                            <button onClick={(e) => { e.stopPropagation(); setActionForm({ name: '', attackMod: 'none', damageExpr: '', damageType: 'Físico', saveAttr: 'none' }); setIsEditingAction(!isEditingAction); }} className="text-[9px] font-bold text-gray-400 uppercase hover:text-gray-800 transition-colors">
                                                                                MANAGE CUSTOM
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                <div className="grid grid-cols-12 gap-2 py-2.5 items-center group bg-white border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                                                                    <div className="col-span-5 flex items-start gap-2 cursor-pointer pl-1" onClick={(e) => { e.stopPropagation(); toggleActionExpansion(action.id || action.name); }}>
                                                                        <div className="mt-0.5 text-gray-400 group-hover:text-[#c53131] transition-colors">
                                                                            {action.type === 'weapon' ? <Sword size={14}/> : (action.type === 'spell' ? <BookOpen size={14}/> : <CheckCircle size={14}/>)}
                                                                        </div>
                                                                        <div className="flex flex-col min-w-0">
                                                                            <span className="text-[11px] font-bold text-black group-hover:text-[#c53131] transition-colors truncate">{action.name}</span>
                                                                            <span className="text-[9px] text-gray-400 truncate">{translateTerm(action.category)}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="col-span-2 flex flex-col text-center">
                                                                        <span className="text-[11px] font-medium text-black">{action.range?.split(' ')[0] || '--'}</span>
                                                                        <span className="text-[8px] text-gray-400">{action.range?.includes(' ') ? action.range.split(' ').slice(1).join(' ') : 'Alcance'}</span>
                                                                    </div>
                                                                    <div className="col-span-2 flex justify-center">
                                                                        {(action.attackMod && action.attackMod !== 'none') ? (
                                                                            <button onClick={(e) => { e.stopPropagation(); executeActionAttack(action); }} className="border border-gray-300 rounded bg-white hover:border-gray-400 text-black font-normal text-[12px] min-w-[32px] px-1 py-1 flex items-center justify-center shadow-sm transition-colors">
                                                                                {action.hitMod >= 0 ? `+${action.hitMod}` : action.hitMod}
                                                                            </button>
                                                                        ) : (action.saveAttr && action.saveAttr !== 'none') ? (
                                                                            <button onClick={(e) => { e.stopPropagation(); executeActionSave(action); }} className="border border-gray-300 rounded bg-white hover:border-gray-400 text-black font-normal text-[10px] min-w-[32px] px-1 py-1 flex items-center justify-center shadow-sm transition-colors">
                                                                                {action.saveAttr}
                                                                            </button>
                                                                        ) : (
                                                                            <span className="text-gray-300 text-xs">--</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="col-span-3 flex justify-end items-center gap-1.5 pr-2">
                                                                        {action.damageExpr ? (
                                                                            <button onClick={(e) => { e.stopPropagation(); executeActionDamage(action); }} className="border border-gray-300 rounded bg-white hover:border-gray-400 text-black font-normal text-[12px] min-w-[36px] px-1 py-1 flex items-center justify-center shadow-sm transition-colors">
                                                                                {action.damageExpr}
                                                                            </button>
                                                                        ) : (
                                                                            <span className="text-[9px] text-gray-400 italic">--</span>
                                                                        )}
                                                                        
                                                                        {action.type === 'spell' && (
                                                                            <button onClick={(e) => { e.stopPropagation(); onCastSpellRP(action); }} className="text-indigo-400 hover:text-indigo-600 transition-colors ml-1" title="Conjurar no Chat">
                                                                                <Sparkles size={12}/>
                                                                            </button>
                                                                        )}
                                                                        {action.type === 'macro' && (
                                                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteCustomAction(action.id); }} className="text-red-300 hover:text-red-500 transition-colors ml-1" title="Deletar Macro">
                                                                                <Trash2 size={12}/>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    
                                                                    {expandedActionIds[action.id || action.name] && (
                                                                        <div className="col-span-12 mt-2 pl-7 pr-2 text-[10px] text-gray-700 font-serif leading-relaxed whitespace-pre-wrap border-t border-dashed border-gray-200 pt-2 pb-1">
                                                                            <span className="font-bold text-black">{action.name}. </span>
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
                            )}

                            {/* 👉 ABA INVENTORY */}
                            {activeTab === 'inventory' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="bg-white border-2 border-gray-200 rounded-xl p-4 shadow-sm">
                                        <div className="flex justify-between items-center mb-3 border-b border-gray-200 pb-2">
                                            <h3 className="text-xs uppercase font-black text-gray-700 tracking-widest flex items-center gap-2"><Coins size={14} className="text-yellow-600"/> Currency</h3>
                                        </div>
                                        <div className="flex gap-2">
                                            {renderCoin('cp', 'CP', 'bg-orange-50 border-orange-200 text-orange-900')}
                                            {renderCoin('sp', 'SP', 'bg-gray-100 border-gray-300 text-gray-700')}
                                            {renderCoin('ep', 'EP', 'bg-blue-50 border-blue-200 text-blue-900')}
                                            {renderCoin('gp', 'GP', 'bg-yellow-50 border-yellow-300 text-yellow-800')}
                                            {renderCoin('pp', 'PP', 'bg-purple-50 border-purple-200 text-purple-900')}
                                        </div>

                                        <div className="mt-6">
                                            <div className="flex justify-between items-center mb-1.5">
                                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1"><Scale size={12}/> Weight Carried</span>
                                                <span className={`text-xs font-bold ${totalWeight > maxWeight ? 'text-red-600' : 'text-gray-800'}`}>{totalWeight.toFixed(1)} / {maxWeight} lb.</span>
                                            </div>
                                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden border border-gray-300 shadow-inner">
                                                <div className={`h-full transition-all duration-500 ${weightPercent > 100 ? 'bg-red-600' : weightPercent > 80 ? 'bg-orange-500' : 'bg-gray-700'}`} style={{ width: `${Math.min(100, weightPercent)}%` }}></div>
                                            </div>
                                        </div>
                                    </div>

                                    <Inventory items={inventory} ownerId={myCharacter.id} onEquip={handleEquipItem} onDrop={handleDropItem} />
                                </div>
                            )}

                            {/* 👉 ABA FEATURES E TRAITS */}
                            {activeTab === 'features' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="mb-6">
                                        <p className="text-xs text-red-800 uppercase font-black mb-3 tracking-widest border-b-2 border-red-800 pb-2 flex items-center gap-2"><Star size={14}/> Class Features</p>
                                        <div className="flex flex-col gap-3">
                                            {CLASS_ABILITIES[myCharacter.classType?.toUpperCase() || 'GUERREIRO']?.map((ability, idx) => {
                                                if (savedLevel < ability.unlockLevel) return null;
                                                const key = `${myCharacter.name}_${ability.name}`; const used = abilityUsage[key] || 0; const disabled = ability.max !== 99 && used >= ability.max;
                                                return (
                                                    <div key={idx} className="flex flex-col bg-white border-2 border-gray-200 rounded-lg overflow-hidden group hover:border-red-800 transition-colors shadow-sm">
                                                        <div className="flex items-start gap-3 p-4">
                                                            <span className={`text-2xl mt-1 ${ability.color}`}>{ability.icon}</span>
                                                            <div className="flex-grow min-w-0">
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <span className="text-sm font-black text-gray-900">{ability.name}</span>
                                                                    <div className="flex flex-col items-end gap-2">
                                                                        <button onClick={(e)=>{e.stopPropagation(); handleUseAbility(ability.name, ability.max, ability.desc)}} disabled={disabled} className={`text-[10px] uppercase font-bold px-3 py-1 rounded transition-colors ${disabled ? 'bg-gray-200 text-gray-400' : 'bg-red-100 text-red-800 hover:bg-red-800 hover:text-white'}`}>
                                                                            USAR
                                                                        </button>
                                                                        {ability.max!==99&&<div className="flex gap-1">{Array.from({length:ability.max}).map((_,i)=><div key={i} className={`w-2.5 h-2.5 rounded border ${i<used?'bg-white border-gray-300':'bg-gray-800 border-black shadow-inner'}`}></div>)}</div>}
                                                                    </div>
                                                                </div>
                                                                <span className="text-xs text-gray-600 leading-relaxed font-serif block">{ability.desc}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                            {(!CLASS_ABILITIES[myCharacter.classType?.toUpperCase() || ''] || CLASS_ABILITIES[myCharacter.classType?.toUpperCase() || ''].length === 0) && (
                                                <p className="text-xs text-gray-500 italic text-center py-6 border border-dashed border-gray-300 rounded bg-gray-50">Nenhuma habilidade rastreável mapeada para esta classe.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 👉 ABA BACKGROUND E ROLEPLAY */}
                            {activeTab === 'background' && (
                                <div className="animate-in fade-in duration-300 space-y-6">
                                    {charDetails ? (
                                        <>
                                            <div className="bg-white border-2 border-gray-200 rounded-xl p-5 shadow-sm">
                                                <h3 className="text-xs text-red-800 font-black uppercase tracking-widest border-b border-gray-200 pb-2 mb-4">Characteristics</h3>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    <div><span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest block mb-1">Background</span><span className="text-sm font-black text-gray-900">{(charDetails as any).background || 'Unknown'}</span></div>
                                                    <div><span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest block mb-1">Alignment</span><span className="text-sm font-black text-gray-900">{(charDetails as any).alignment || 'Neutral'}</span></div>
                                                    <div><span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest block mb-1">Faith</span><span className="text-sm font-black text-gray-900">{(charDetails as any).faith || 'None'}</span></div>
                                                    <div><span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest block mb-1">Lifestyle</span><span className="text-sm font-black text-gray-900">{(charDetails as any).lifestyle || 'Modest'}</span></div>
                                                </div>
                                            </div>

                                            <div className="bg-white border-2 border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
                                                <h4 className="text-xs text-red-800 uppercase tracking-widest font-black border-b border-gray-200 pb-2 mb-2">Personality</h4>
                                                <IdentityCard title="Personality Traits" content={(charDetails as any).personalityTraits} />
                                                <IdentityCard title="Ideals" content={(charDetails as any).ideals} />
                                                <IdentityCard title="Bonds" content={(charDetails as any).bonds} />
                                                <IdentityCard title="Flaws" content={(charDetails as any).flaws} />
                                                
                                                {(!(charDetails as any).personalityTraits && !(charDetails as any).ideals && !(charDetails as any).bonds && !(charDetails as any).flaws) && (
                                                    <p className="text-xs text-gray-500 text-center italic border border-dashed border-gray-300 rounded p-4 bg-gray-50">No personality details found.</p>
                                                )}
                                            </div>

                                            {(charDetails as any).physical && Object.keys((charDetails as any).physical).some(k => (charDetails as any).physical[k]) && (
                                                <div className="bg-white border-2 border-gray-200 rounded-xl p-5 shadow-sm">
                                                    <h4 className="text-xs text-red-800 uppercase tracking-widest font-black border-b border-gray-200 pb-2 mb-4">Appearance</h4>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                        {(charDetails as any).physical.age && <div><span className="text-[9px] uppercase text-gray-500 font-bold mb-0.5">Age</span><span className="text-sm text-gray-900 font-serif">{(charDetails as any).physical.age}</span></div>}
                                                        {(charDetails as any).physical.gender && <div><span className="text-[9px] uppercase text-gray-500 font-bold block mb-0.5">Gender</span><span className="text-sm text-gray-900 font-serif">{(charDetails as any).physical.gender}</span></div>}
                                                        {(charDetails as any).physical.height && <div><span className="text-[9px] uppercase text-gray-500 font-bold block mb-0.5">Height</span><span className="text-sm text-gray-900 font-serif">{(charDetails as any).physical.height}</span></div>}
                                                        {(charDetails as any).physical.weight && <div><span className="text-[9px] uppercase text-gray-500 font-bold block mb-0.5">Weight</span><span className="text-sm text-gray-900 font-serif">{(charDetails as any).physical.weight}</span></div>}
                                                        {(charDetails as any).physical.eyes && <div><span className="text-[9px] uppercase text-gray-500 font-bold block mb-0.5">Eyes</span><span className="text-sm text-gray-900 font-serif">{(charDetails as any).physical.eyes}</span></div>}
                                                        {(charDetails as any).physical.skin && <div><span className="text-[9px] uppercase text-gray-500 font-bold block mb-0.5">Skin</span><span className="text-sm text-gray-900 font-serif">{(charDetails as any).physical.skin}</span></div>}
                                                        {(charDetails as any).physical.hair && <div className="col-span-2 md:col-span-3"><span className="text-[9px] uppercase text-gray-500 font-bold block mb-0.5">Hair</span><span className="text-sm text-gray-900 font-serif">{(charDetails as any).physical.hair}</span></div>}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-64 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                                            <Fingerprint size={48} className="mb-4 opacity-20" />
                                            <p className="text-sm font-serif">O passado deste herói está em branco.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 👉 ABA DE NOTAS PESSOAIS */}
                            {activeTab === 'notes' && (
                                <div className="h-full flex flex-col animate-in fade-in duration-300 p-2">
                                    <div className="flex items-center gap-2 mb-4 border-b-2 border-red-800 pb-2">
                                        <Scroll size={16} className="text-red-800"/>
                                        <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest">Personal Notes</h3>
                                    </div>
                                    <textarea 
                                        className="flex-1 w-full bg-[#fdfdfd] border-2 border-gray-200 rounded-xl p-5 text-sm text-gray-800 font-serif leading-relaxed outline-none focus:border-red-500 resize-none custom-scrollbar shadow-inner"
                                        placeholder="Jot down important names, locations, and clues here..."
                                        defaultValue={myCharacter.dmNotes || ''}
                                        onBlur={(e) => onUpdateCharacter && onUpdateCharacter(myCharacter.id, { dmNotes: e.target.value })}
                                    />
                                    <p className="text-[9px] text-gray-400 uppercase tracking-widest mt-3 text-center">Auto-saved to the server.</p>
                                </div>
                            )}

                            {/* 👉 ABA CHAT */}
                            {activeTab === 'chat' && (
                                <div className="h-full flex flex-col -m-3">
                                    <Chat messages={chatMessages} onSendMessage={onSendMessage} role="PLAYER" onApplyDamage={onApplyDamageFromChat} />
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

export default SidebarPlayer;