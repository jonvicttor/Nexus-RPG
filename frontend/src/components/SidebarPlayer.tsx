import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Chat, { ChatMessage } from './Chat';
import { Entity, Item } from '../App';
import LevelUpModal from './LevelUpModal';
import { getLevelFromXP, getProficiencyBonus, calculateHPGain, XP_TABLE } from '../utils/gameRules';
import Inventory from './Inventory';
import { mapEntityStatsToAttributes } from '../utils/attributeMapping';
import { 
  Sword, Sparkles, ChevronRight, ChevronLeft, Info, Hourglass, Crosshair
} from 'lucide-react';

export interface InitiativeItem { id: number; name: string; value: number; }

const EMPTY_ARRAY: any[] = [];

const ATTR_COLORS: Record<string, string> = {
  STR: "#e07b54",
  DEX: "#5b9bd5",
  CON: "#7ab87a",
  INT: "#c47ed4",
  WIS: "#d4a843",
  CHA: "#d46b8a",
};

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
    "saving throws": "Uma jogada de salvaguarda (também chamada de salvamento) representa uma tentativa de resistir a um feitiço, uma armadilha, um veneno, uma doença ou uma ameaça semelhante. Normalmente, você não decide fazer uma jogada de salvaguarda; você é forçado a fazer uma porque seu personagem ou monstro está em risco de sofrer dano.",
    "proficiencias e treinamento": "As proficiências cobrem o treinamento com armaduras, armas, ferramentas e habilidades. Seu Bônus de Proficiência é adicionado a testes envolvendo esses itens.",
    "skills": "Perícias representam um aspecto específico da pontuação de habilidade, e a proficiência de um personagem demonstra um foco nesse aspecto."
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
    "heal": "Cura", "healing": "Cura", "all": "TODAS", "attack": "ATAQUE", "action": "AÇÃO", "bonus action": "AÇÃO BÔNUS", "reaction": "REAÇÃO", "other": "OUTRO",
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

const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

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

const getExhaustionText = (level: number) => {
    switch(level) {
        case 1: return "Desv. Habilidade";
        case 2: return "Mov. Metade";
        case 3: return "Desv. Ataques";
        case 4: return "PV Max Metade";
        case 5: return "Mov. Zero";
        case 6: return "Morte";
        default: return "";
    }
}

const IdentityCard = ({ title, content }: { title: string, content: string | undefined }) => {
    if (!content || content.trim() === '') return null;
    return (
        <div className="mb-4">
            <h4 className="text-[10px] text-amber-500 uppercase tracking-[0.1em] font-black mb-1 border-b border-white/10 pb-1">{title}</h4>
            <p className="text-[13px] text-gray-300 font-serif leading-relaxed whitespace-pre-wrap">{content}</p>
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
        <div className="absolute top-0 right-0 h-full w-[360px] bg-[#151515] border-l border-amber-500/30 z-[210] flex flex-col transform transition-transform animate-in slide-in-from-right duration-300 shadow-2xl">
            <div className="bg-[#111] p-4 shrink-0 flex items-center justify-between border-b border-amber-500/20">
                <h3 className="text-lg font-black text-amber-500 font-serif truncate flex items-center gap-2"><Info size={18}/> {title}</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-amber-400 hover:bg-white/5 p-1.5 rounded transition-colors"><ChevronRight size={20}/></button>
            </div>
            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
                <div className="space-y-4 font-serif leading-relaxed text-sm text-gray-300">
                    {description ? description.split('\n\n').map((para, i) => <p key={i} className="whitespace-pre-wrap">{para}</p>) : "Nenhuma descrição disponível."}
                </div>
            </div>
            <div className="bg-[#0a0a0a] p-3 text-center border-t border-amber-500/20 shrink-0 shadow-inner">
                <span className="text-[10px] text-amber-900 uppercase tracking-widest font-bold">Nexus VTT Codex</span>
            </div>
        </div>
    )
}

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=DM+Sans:wght@400;500;700&display=swap');

:root {
  --bg:          #08080a;
  --surface:     #111114;
  --elevated:    #18181d;
  --elevated2:   #24242c; 
  --accent:      #e5b451; 
  --accent-dim:  rgba(229,180,81,0.15);
  --accent-red:  #e04538; 
  
  --t1:          #ffffff; 
  --t2:          #d1cfc7; 
  --t3:          #9e9c96; 
  
  --border:      rgba(255,255,255,0.12);
  --border-md:   rgba(255,255,255,0.25);
  
  --ff:          'Cinzel', serif;
  --fb:          'DM Sans', sans-serif;
  --sb-width:    360px;
}

.sb-container {
  font-family: var(--fb);
  color: var(--t1);
  background: var(--bg);
}

.sb-scroll {
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(229,180,81,0.25) transparent;
}

.view-enter { animation: viewIn .22s ease both; }
@keyframes viewIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0);     }
}

.nav-overlay { animation: overlayIn .18s ease both; }
@keyframes overlayIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* CARDS DE ATRIBUTOS (FOR, DES, etc) */
.ability-card {
  background: linear-gradient(145deg, #1f1f26 0%, #15151a 100%);
  border: 1px solid var(--border);
  border-radius: 8px; 
  padding: 12px 6px; 
  text-align: center;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 6px rgba(0,0,0,0.3);
  transition: all 0.2s ease; 
  cursor: pointer;
  position: relative;
  overflow: hidden;
}
.ability-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
}
.ability-card:hover { 
  background: linear-gradient(145deg, #2a2a35 0%, #1a1a20 100%);
  border-color: rgba(229,180,81,0.4); 
  transform: translateY(-2px);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 6px 12px rgba(0,0,0,0.4);
}

/* CAIXAS DE ESTATÍSTICAS (Prof, Init, AC, Speed) */
.stat-box {
  background: linear-gradient(180deg, #1f1f26 0%, #111114 100%);
  border: 1px solid var(--border);
  border-radius: 8px; 
  padding: 8px 4px; 
  text-align: center;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 4px rgba(0,0,0,0.2);
}

/* HP CONTAINER */
.hp-display {
  background: #060608;
  border: 1px solid #27272a;
  border-radius: 8px;
  padding: 8px 10px;
  box-shadow: inset 0 2px 10px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.05);
  display: flex;
  align-items: center;
  gap: 8px;
}

/* BOTÕES DE DESCANSO E AÇÕES */
.premium-btn {
  flex: 1; 
  padding: 8px 0; 
  background: linear-gradient(180deg, #24242c 0%, #18181d 100%);
  border: 1px solid var(--border);
  border-radius: 6px; 
  color: var(--t2); 
  font-family: var(--fb); 
  font-weight: 600; 
  font-size: 11px; 
  cursor: pointer; 
  letter-spacing: .04em; 
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05);
}
.premium-btn:hover { 
  background: linear-gradient(180deg, #2a2a35 0%, #1e1e24 100%);
  border-color: rgba(229,180,81,0.5); 
  color: var(--accent); 
  transform: translateY(-1px);
}

/* CHIPS (Proficiências) */
.chip {
  display: inline-flex; align-items: center; gap: 4px;
  background: linear-gradient(145deg, var(--elevated2) 0%, var(--elevated) 100%); 
  border: 1px solid var(--border);
  border-radius: 20px; 
  padding: 3px 10px 3px 8px;
  font-size: 11px; 
  font-weight: 600; 
  color: var(--t1); 
  white-space: nowrap; 
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
.chip:hover { border-color: var(--accent); background: var(--accent-dim); transform: translateY(-1px); }

/* TITULOS DE SEÇÃO */
.sec-title {
  font-family: var(--ff); 
  font-size: 11px; 
  font-weight: 700; 
  letter-spacing: .16em; 
  color: var(--accent); 
  text-transform: uppercase;
  padding-bottom: 8px; 
  border-bottom: 1px solid var(--border-md);
  margin: 24px 0 14px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}
.sec-title:first-child { margin-top: 0; }

.sk-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px; border-radius: 6px;
  transition: background .15s;
  cursor: pointer;
}
.sk-row:hover { background: var(--accent-dim); }

.feat-card {
  background: linear-gradient(180deg, var(--elevated) 0%, #141419 100%); 
  border: 1px solid var(--border);
  border-radius: 8px; 
  padding: 14px 16px; 
  margin-bottom: 10px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
}

.nav-item {
  background: var(--elevated); border: 1px solid var(--border);
  border-radius: 10px; padding: 14px 12px; cursor: pointer;
  transition: border-color .18s, background .18s;
  display: flex; align-items: center; gap: 10px;
  text-align: left;
}
.nav-item:hover,
.nav-item.active { background: var(--accent-dim); border-color: rgba(229,180,81,.5); }

.atk-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.atk-table th {
  color: var(--t2); font-weight: 700; font-size: 10px; text-transform: uppercase;
  letter-spacing: .08em; padding: 6px 8px; text-align: left;
}
.atk-table td { padding: 8px 8px; color: var(--t1); border-top: 1px solid var(--border); }
.atk-table tr.active-row td { background: var(--accent-dim); }
.atk-table tr:hover td { background: rgba(255,255,255,0.08); }

.ctag {
  background: var(--elevated2); border: 1px solid var(--border);
  border-radius: 4px; padding: 4px 10px; font-size: 10px; font-weight: 700; color: var(--t2); 
  cursor: pointer; transition: color .2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
.ctag:hover { color: var(--accent); border-color: var(--accent); }

.combat-hud {
  position: absolute; top: 80px; left: calc(var(--sb-width) + 20px);
  width: 300px; z-index: 50; display: flex; flex-direction: column; gap: 12px;
  animation: slideInLeft .3s ease;
}
@keyframes slideInLeft { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
`;

interface SidebarPlayerProps {
  entities: Entity[];
  myCharacterName: string; 
  myCharacterId: number;
  initiativeList: InitiativeItem[];
  activeTurnId: number | null;
  chatMessages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onRollAttribute: (charName: string, attrName: string, mod: number, damageExpression?: string, damageType?: string, rollType?: 'normal'|'advantage'|'disadvantage') => void;
  onUpdateCharacter?: (id: number, updates: Partial<Entity>) => void;
  onSelectEntity?: (entity: Entity) => void;
  onApplyDamageFromChat: (targetId: number, damageExpression: string) => void;
  availableSpells?: any[]; 
  actionsData?: any[]; 
  conditionsData?: any[];
  onNextTurn: () => void;
  onPlayerRequestSkill: (skillName: string, mod: number) => void;
}

const SidebarPlayer: React.FC<SidebarPlayerProps> = ({ 
  entities, myCharacterName, myCharacterId, initiativeList, activeTurnId, chatMessages, onSendMessage, onRollAttribute, onUpdateCharacter, onSelectEntity, onApplyDamageFromChat, availableSpells, actionsData, conditionsData, onNextTurn, onPlayerRequestSkill
}) => {
  const [activeTab, setActiveTab] = useState<'abilities' | 'actions' | 'spells' | 'inventory' | 'features' | 'background' | 'notes' | 'chat'>('abilities');
  const [actionFilter, setActionFilter] = useState<'all' | 'attack' | 'action' | 'bonus action' | 'reaction' | 'other'>('all');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
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
  
  const tempHp = charDetails?.tempHp || 0;
  const exhaustionLevel = charDetails?.exhaustion || 0;
  const isConcentrating = charDetails?.isConcentrating || false;

  const totalWeight = inventory.reduce((acc, item) => acc + (item.weight || 0) * item.quantity, 0);
  const maxWeight = (attributes.FOR || 10) * 7.5; 
  const weightPercent = Math.min(100, (totalWeight / maxWeight) * 100);

  const isBloodied = hpPercent <= 30 && hpPercent > 0;

  const inCombat = initiativeList.length > 0;
  const isMyTurn = !inCombat || activeTurnId === myCharacterId;
  const visibleEnemies = entities.filter(e => e.type === 'enemy' && e.hp > 0 && e.visible !== false);

  const isStealthy = myCharacter?.conditions?.includes('Furtivo');
  const isRogue = myCharacter?.classType?.toLowerCase().includes('ladino') || myCharacter?.classType?.toLowerCase().includes('rogue');
  const sneakAttackDmg = isRogue ? `${Math.ceil(savedLevel / 2)}d6` : '';

  const handleTriggerRoll = useCallback((charName: string, attrName: string, mod: number, damageExpr?: string, damageType?: string) => {
      onRollAttribute(charName, attrName, mod, damageExpr, damageType);
  }, [onRollAttribute]);
  
  const handleIntentToDamage = useCallback((actionName: string, damageExpr: string, damageType: string) => {
      let finalDamageExpr = damageExpr;
      if (isStealthy && isRogue) finalDamageExpr = `${damageExpr} + ${sneakAttackDmg}`;
      onRollAttribute(myCharacterName, `Dano: ${actionName}`, 0, finalDamageExpr, damageType);
  }, [onRollAttribute, myCharacterName, isStealthy, isRogue, sneakAttackDmg]);

  const executeActionAttack = (action: any) => {
      let finalDamageExpr = action.damageExpr;
      let rollType: 'normal' | 'advantage' | 'disadvantage' = 'normal';
      if (isStealthy) {
          rollType = 'advantage';
          if (isRogue) finalDamageExpr = `${action.damageExpr} + ${sneakAttackDmg}`;
      }
      onRollAttribute(myCharacterName, `Ataque: ${action.name}`, action.hitMod || 0, finalDamageExpr, action.damageType, rollType);
  };

  const executeActionDamage = (action: any) => {
      let finalDamageExpr = action.damageExpr;
      if (isStealthy && isRogue) finalDamageExpr = `${action.damageExpr} + ${sneakAttackDmg}`;
      onRollAttribute(myCharacterName, `Dano: ${action.name}`, 0, finalDamageExpr, action.damageType);
  };

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

    // 1. Armas Equipadas
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

    // 2. Magias Memorizadas
    list.push(...knownSpells.map(s => {
        const meta = getSpellMeta(s);
        const metaText = `Tempo de Conjuração: ${meta.time} | Alcance: ${meta.range} | Componentes: ${meta.comps}`;
        return {
            ...s, category: s.isAttack ? 'attack' : 'action', type: 'spell', typeDetail: `Magias Nível ${s.level}`, range: meta.range,
            desc: `${metaText}\n\n${s.cleanDescription}`
        }
    }));
    
    // 3. Macros Customizados
    customActions.forEach((action: any) => {
        list.push({ ...action, category: action.attackMod !== 'none' ? 'attack' : (action.type === 'bonus action' ? 'bonus action' : 'action'), type: 'macro', typeDetail: 'Ações Customizadas', range: '--', desc: "Ação customizada criada pelo jogador." });
    });

    // 4. Habilidades de Classe
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
          <div className={`flex-1 flex flex-col items-center justify-center p-1.5 rounded-lg border ${colorClass} relative group overflow-hidden shadow-inner bg-[var(--elevated)] transition-colors`}>
              <span className="text-[9px] font-bold opacity-60 mb-0.5">{label}</span>
              <span className="font-black text-sm">{val}</span>
              <div className="absolute inset-0 flex items-center justify-between px-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm">
                  <button onClick={() => handleCoinChange(type, -1)} className="text-red-400 hover:text-red-300 font-black px-1.5 hover:bg-white/10 rounded transition-colors">-</button>
                  <button onClick={() => handleCoinChange(type, 1)} className="text-green-400 hover:text-green-300 font-black px-1.5 hover:bg-white/10 rounded transition-colors">+</button>
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
          let remainingDamage = val;
          let newTemp = tempHp;

          if (tempHp > 0) {
              if (tempHp >= val) {
                  newTemp -= val;
                  remainingDamage = 0;
              } else {
                  remainingDamage -= tempHp;
                  newTemp = 0;
              }
          }

          const newHp = Math.max(0, (myCharacter.hp || 0) - remainingDamage);

          let logMsg = `🩸 **${myCharacter.name}** sofreu **${val} de dano**`;
          if (tempHp > 0) { logMsg += ` *(Absorveu ${val - remainingDamage} com PV Temporário)*`; }
          logMsg += `.`;
          onSendMessage(logMsg);

          if (isConcentrating && val > 0) {
              const cd = Math.max(10, Math.floor(val / 2));
              onSendMessage(`⚠️ **QUEBRA DE CONCENTRAÇÃO:** ${myCharacter.name} tomou dano e precisa rolar Resistência de **Constituição (CD ${cd})** para manter a magia!`);
          }

          onUpdateCharacter(myCharacter.id, { hp: newHp, details: { ...myCharacter.details, tempHp: newTemp } });
          setHpInput('');
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
        
        const newExhaustion = Math.max(0, exhaustionLevel - 1);
        
        onUpdateCharacter(myCharacter.id, { 
            hp: myCharacter.maxHp, 
            spellSlots: clearedSlots,
            details: { ...myCharacter.details, tempHp: 0, exhaustion: newExhaustion }
        });
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
  };

  const navItems = [
    { id: "abilities", label: "ABILITIES & SKILLS", icon: "⚔" },
    { id: "actions",   label: "ACTIONS",          icon: "🗡" },
    { id: "spells",    label: "SPELLS",           icon: "✨" },
    { id: "inventory", label: "INVENTORY",        icon: "⬡" },
    { id: "features",  label: "FEATURES & TRAITS", icon: "✦" },
    { id: "background",label: "BACKGROUND",       icon: "📜" },
    { id: "notes",     label: "NOTES",            icon: "✎" },
    { id: "chat",      label: "CHAT",             icon: "💬" },
  ];

  if (!myCharacter) {
      return (
          <div className={`relative h-full transition-all duration-300 bg-[#111111] z-50 ${isCollapsed ? 'w-0' : 'w-[var(--sb-width)]'}`}>
              <div className="flex flex-col items-center justify-center h-full text-gray-600"><p className="text-xs">Personagem não encontrado.</p></div>
          </div>
      );
  }

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      {showLevelUpModal && pendingLevelData && (
          <LevelUpModal newLevel={pendingLevelData.newLevel} hpGain={pendingLevelData.hpGain} charClass={myCharacter.classType || 'GUERREIRO'} oldStats={myCharacter.stats || {str:10,dex:10,con:10,int:10,wis:10,cha:10}} onConfirm={(u) => { if(onUpdateCharacter && myCharacter) { onUpdateCharacter(myCharacter.id, {...u, level: pendingLevelData.newLevel, hp: Math.min((myCharacter.hp||0)+pendingLevelData.hpGain, (myCharacter.maxHp||0)+pendingLevelData.hpGain), maxHp: (myCharacter.maxHp||0)+pendingLevelData.hpGain}); setShowLevelUpModal(false);}}} />
      )}

      {/* Nav Overlay (Floating Menu) */}
      {navOpen && (
        <div className="nav-overlay" onClick={() => setNavOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(6,6,8,.93)", backdropFilter: "blur(6px)", zIndex: 600, display: "flex", flexDirection: "column", alignItems: "center", justifyItems: "center", padding: 20 }}>
            <button onClick={() => setNavOpen(false)} style={{ position: "absolute", top: 14, right: 18, background: "none", border: "none", color: "var(--t2)", fontSize: 20, cursor: "pointer" }}>✕</button>
            <div style={{ fontFamily: "var(--ff)", fontSize: 10, color: "var(--t3)", letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 16 }}>Character Sheet</div>
            <div onClick={(e) => e.stopPropagation()} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%", maxWidth: 480 }}>
                {navItems.map((item, idx) => (
                    <button key={item.id} className={`nav-item ${activeTab === item.id ? 'active' : ''}`} style={idx === 0 ? { gridColumn: "1/-1" } : {}} onClick={() => { setActiveTab(item.id as any); setNavOpen(false); }}>
                        <div style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(255,255,255,.04)", display: "flex", alignItems: "center", justifyItems: "center", fontSize: 15, flexShrink: 0 }}>{item.icon}</div>
                        <div style={{ fontSize: 10.5, color: "var(--t1)", letterSpacing: ".03em", lineHeight: 1.3 }}>{item.label}</div>
                    </button>
                ))}
            </div>
        </div>
      )}

      <div className={`sb-container relative h-full transition-all duration-300 ease-in-out flex-shrink-0 z-50 shadow-2xl border-r border-[var(--border)] bg-[var(--bg)] flex flex-col ${isCollapsed ? 'w-0' : 'w-[var(--sb-width)]'}`}>
          
          {isBloodied && (
              <div className="absolute inset-0 pointer-events-none z-[40] shadow-[inset_0_0_120px_rgba(220,38,38,0.4)] animate-pulse mix-blend-multiply" />
          )}

          {!isMyTurn && !isCollapsed && (
              <div className="absolute inset-0 z-[42] bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-start pt-32 pointer-events-auto">
                  <div className="bg-[#111111] border-2 border-amber-900/50 text-gray-200 px-6 py-3 rounded shadow-lg flex items-center gap-3 animate-pulse">
                      <Hourglass size={20} className="text-amber-500" />
                      <span className="font-bold uppercase tracking-widest text-sm text-amber-500">Aguardando seu turno...</span>
                  </div>
              </div>
          )}

          {/* Combat HUD Overlay */}
          {inCombat && isMyTurn && !isCollapsed && (
              <div className="combat-hud">
                  <div className="bg-[#111111] border border-amber-500/50 rounded shadow-[0_0_20px_rgba(245,158,11,0.15)] flex flex-col relative overflow-hidden backdrop-blur-md">
                      {isStealthy && <div className="absolute inset-0 bg-[#1a1a1a] pointer-events-none border-4 border-dashed border-purple-500/30"></div>}
                      <div className="p-4 relative z-10">
                          <h3 className={`${isStealthy ? 'text-purple-400 border-purple-900/50' : 'text-amber-500 border-amber-900/50'} font-black uppercase tracking-widest mb-3 flex items-center justify-between text-lg border-b pb-2`}>
                              <span className="flex items-center gap-2">
                                  {isStealthy ? <Sparkles size={20} className="text-purple-400" /> : <Sword size={20} className="text-amber-500" />} 
                                  {isStealthy ? 'Você está Oculto!' : 'É a sua vez!'}
                              </span>
                              <button onClick={onNextTurn} className="bg-red-900 hover:bg-red-800 border border-red-500/50 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded transition-all shadow-sm active:scale-95">Encerrar</button>
                          </h3>
                          {isStealthy && (
                              <p className="text-[10px] text-purple-200 mb-3 text-center uppercase tracking-widest border border-purple-500/30 bg-purple-900/30 p-1.5 rounded shadow-inner">
                                  Próximo ataque terá <strong>Vantagem</strong>{isRogue ? ' e Ataque Furtivo (+'+sneakAttackDmg+')' : ''}!
                              </p>
                          )}
                          <div className="text-[10px] text-amber-500 mb-2 font-black uppercase tracking-[0.1em] flex justify-between items-center"><span>Alvos Visíveis</span><Crosshair size={12} /></div>
                          <div className="flex gap-2 overflow-x-auto pb-3 mb-2 custom-scrollbar">
                              {visibleEnemies.length === 0 ? (
                                  <span className="text-xs text-gray-500 italic">Nenhum inimigo à vista.</span>
                              ) : (
                                  visibleEnemies.map(enemy => {
                                      const dist = Math.round(Math.hypot(enemy.x - myCharacter.x, enemy.y - myCharacter.y) * 5);
                                      return (
                                          <div key={enemy.id} className="flex flex-col items-center bg-black/50 p-2 rounded border border-white/5 shrink-0 min-w-[70px]">
                                              <div className={`w-10 h-10 rounded-full overflow-hidden border-2 mb-1 ${dist <= 5 ? 'border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'border-gray-700'}`}>
                                                  <img src={enemy.tokenImage || enemy.image} className="w-full h-full object-cover" alt={enemy.name} />
                                              </div>
                                              <span className="text-[10px] font-bold text-gray-300 truncate max-w-[60px]">{enemy.name}</span>
                                              <span className={`text-[9px] font-bold ${dist <= 5 ? 'text-amber-500' : 'text-gray-500'}`}>{dist} ft</span>
                                          </div>
                                      )
                                  })
                              )}
                          </div>
                          <div className="text-[10px] text-amber-500 mb-2 mt-2 font-black uppercase tracking-[0.1em] border-t border-white/10 pt-3">Ataques Rápidos</div>
                          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                              {equippedWeapons.map(w => {
                                  const isFinesseOrRanged = w.stats?.properties?.some(p => p.toLowerCase().includes('finesse') || p.toLowerCase().includes('distância')) || w.name.toLowerCase().includes('arco');
                                  const totalHitMod = (isFinesseOrRanged ? dexMod : strMod) + proficiencyBonus;
                                  const wpnType = translateTerm(['cortante', 'perfurante', 'contundente'].find(t => (w.stats?.properties?.join(' ').toLowerCase() || '').includes(t)) || 'Físico');
                                  return (
                                      <button key={w.id} onClick={() => executeActionAttack({name: w.name, hitMod: totalHitMod, damageExpr: w.stats?.damage || '1d4', damageType: wpnType})} className="w-full bg-black/40 hover:bg-white/5 border border-white/10 rounded p-2 text-left flex justify-between items-center transition-colors group">
                                          <span className="text-gray-200 text-[11px] font-bold truncate group-hover:text-amber-400 transition-colors">{w.name} <span className="text-gray-500 text-[9px] font-normal">({totalHitMod >= 0 ? `+${totalHitMod}` : totalHitMod})</span></span>
                                          <span className="text-amber-500 text-[10px] font-bold shrink-0">{w.stats?.damage}{isStealthy && isRogue ? `+${sneakAttackDmg}` : ''}</span>
                                      </button>
                                  )
                              })}
                              {knownSpells.filter(s => s.level === 0 && s.isAttack).map(s => (
                                  <button key={s.id} onClick={() => executeActionAttack({name: s.name, hitMod: spellAttackBonus, damageExpr: s.parsedDamage, damageType: s.parsedType})} className="w-full bg-black/40 hover:bg-white/5 border border-white/10 rounded p-2 text-left flex justify-between items-center transition-colors group">
                                      <span className="text-gray-200 text-[11px] font-bold truncate group-hover:text-blue-400 transition-colors">✨ {s.name}</span>
                                      <span className="text-amber-500 text-[10px] font-bold shrink-0">{s.parsedDamage}{isStealthy && isRogue ? `+${sneakAttackDmg}` : ''}</span>
                                  </button>
                              ))}
                              {equippedWeapons.length === 0 && knownSpells.filter(s => s.level === 0 && s.isAttack).length === 0 && (
                                  <span className="text-xs text-gray-600 italic">Nenhum ataque rápido.</span>
                              )}
                          </div>
                      </div>
                  </div>
              </div>
          )}

          <button onClick={() => setIsCollapsed(!isCollapsed)} className="absolute top-1/2 -right-6 transform -translate-y-1/2 w-6 h-16 bg-[#111] border border-amber-900/50 rounded-r-lg flex items-center justify-center text-amber-500 hover:text-amber-400 hover:bg-black cursor-pointer shadow-lg z-[200] transition-colors">
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          {!isCollapsed && (
            <div className="flex flex-col h-full overflow-hidden w-full relative z-[45]">
                {descriptionPanel && <DescriptionPanel title={descriptionPanel.title} description={descriptionPanel.content} onClose={() => setDescriptionPanel(null)} />}
                
                {/* Premium Header */}
<div style={{
  background: "linear-gradient(180deg, #0e0e13 0%, var(--surface) 100%)",
  borderBottom: "1px solid var(--border-md)",
  padding: "20px 18px 16px",
  flexShrink: 0,
  boxShadow: "0 4px 20px rgba(0,0,0,0.5)"
}}>

  {/* Row 1: Avatar + Identity */}
  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
    <div
      onClick={() => onSelectEntity && onSelectEntity(myCharacter)}
      style={{
        width: 64, height: 64, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
        border: `2.5px solid ${myCharacter.inspiration ? 'var(--accent)' : 'rgba(255,255,255,0.15)'}`,
        boxShadow: myCharacter.inspiration ? '0 0 18px rgba(229,180,81,0.55)' : '0 4px 12px rgba(0,0,0,0.6)',
        position: "relative", overflow: "hidden", background: "#0d0d0f"
      }}
    >
      <img src={myCharacter.image || '/tokens/aliado.png'} alt="Token" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      {isConcentrating && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "rgba(59,130,246,0.85)", textAlign: "center",
          fontSize: 8, fontWeight: 700, color: "#fff", letterSpacing: ".05em", padding: "2px 0"
        }}>CONC.</div>
      )}
    </div>

    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontFamily: "var(--ff)", fontSize: 20, fontWeight: 700, color: "var(--t1)",
        letterSpacing: ".02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        textShadow: "0 2px 6px rgba(0,0,0,0.8)", lineHeight: 1.2, marginBottom: 4
      }}>{myCharacter.name}</div>
      <div style={{
        fontSize: 11, color: "var(--t3)", fontWeight: 600,
        letterSpacing: ".07em", textTransform: "uppercase"
      }}>{myCharacter.race} · {myCharacter.classType?.split(' (')[0]}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
        <span style={{
          background: "var(--accent-dim)", border: "1px solid rgba(229,180,81,0.4)",
          borderRadius: 4, padding: "2px 10px", fontSize: 10, fontWeight: 700,
          color: "var(--accent)", letterSpacing: ".06em", textTransform: "uppercase"
        }}>Nível {savedLevel}</span>
        {myCharacter.inspiration && (
          <span style={{
            background: "rgba(229,180,81,0.12)", border: "1px solid rgba(229,180,81,0.5)",
            borderRadius: 4, padding: "2px 10px", fontSize: 10, fontWeight: 700,
            color: "var(--accent)", letterSpacing: ".06em"
          }}>✦ Inspirado</span>
        )}
      </div>
    </div>
  </div>

  {/* Row 2: HP Card */}
  <div style={{
    background: "#060608", border: "1px solid #27272a",
    borderRadius: 10, padding: "12px 16px", marginBottom: 16,
    boxShadow: "inset 0 2px 12px rgba(0,0,0,0.9), 0 1px 0 rgba(255,255,255,0.04)"
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 }}>Pontos de Vida</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <input
            type="number" value={hpInput} min={0} max={myCharacter.maxHp}
            onChange={(e) => setHpInput(e.target.value)}
            placeholder={myCharacter.hp.toString()}
            style={{
              width: 56, background: "transparent", border: "none", outline: "none",
              fontFamily: "var(--ff)", fontSize: 32, fontWeight: 700, textAlign: "left",
              color: myCharacter.hp <= myCharacter.maxHp * .3 ? "var(--accent-red)" : "var(--t1)",
              MozAppearance: "textfield", textShadow: "0 2px 6px rgba(0,0,0,0.6)", padding: 0
            }}
          />
          <span style={{ fontFamily: "var(--ff)", fontSize: 16, fontWeight: 600, color: "var(--t3)" }}>/ {myCharacter.maxHp}</span>
          {tempHp > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, color: "#60a5fa", marginLeft: 6 }}>+{tempHp} temp</span>
          )}
        </div>
        <div style={{ marginTop: 8, height: 4, background: "#1a1a1f", borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            width: `${hpPercent}%`, height: "100%", borderRadius: 2, transition: "width .3s ease",
            background: hpPercent > 50 ? "#4ade80" : hpPercent > 25 ? "#f59e0b" : "var(--accent-red)"
          }} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button onClick={handleHeal} style={{
          background: "rgba(74,222,128,0.1)", color: "#4ade80",
          border: "1px solid rgba(74,222,128,0.35)", padding: "6px 14px",
          borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: "pointer",
          letterSpacing: ".06em", transition: "all .18s", textTransform: "uppercase"
        }}>+ Curar</button>
        <button onClick={handleTakeDamage} style={{
          background: "rgba(224,69,56,0.1)", color: "var(--accent-red)",
          border: "1px solid rgba(224,69,56,0.35)", padding: "6px 14px",
          borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: "pointer",
          letterSpacing: ".06em", transition: "all .18s", textTransform: "uppercase"
        }}>− Dano</button>
      </div>
    </div>
  </div>

  {/* Exhaustion warning */}
  {exhaustionLevel > 0 && (
    <div style={{
      background: "rgba(224,69,56,0.08)", border: "1px solid rgba(224,69,56,0.25)",
      color: "var(--accent-red)", padding: "8px 12px", borderRadius: 8, fontSize: 11,
      textAlign: "center", marginBottom: 14, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: ".05em"
    }}>
      ⚠ Exaustão {exhaustionLevel}: {getExhaustionText(exhaustionLevel)}
    </div>
  )}

  {/* Death saves */}
  {myCharacter.hp <= 0 && (
    <div style={{
      background: "rgba(224,69,56,0.08)", border: "1px solid rgba(224,69,56,0.25)",
      borderRadius: 8, padding: "12px 16px", marginBottom: 14,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 10
    }}>
      <span style={{ fontSize: 10, color: "var(--accent-red)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em" }}>Death Saves</span>
      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "#7ab87a", fontWeight: 700 }}>SUC</span>
          {[1,2,3].map(i => <div key={i} onClick={() => handleDeathSave('success')} style={{ width: 14, height: 14, borderRadius: "50%", background: i <= deathSaves.successes ? "#7ab87a" : "transparent", border: "1.5px solid #7ab87a", cursor: "pointer" }} />)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "var(--accent-red)", fontWeight: 700 }}>FAL</span>
          {[1,2,3].map(i => <div key={i} onClick={() => handleDeathSave('failure')} style={{ width: 14, height: 14, borderRadius: "50%", background: i <= deathSaves.failures ? "var(--accent-red)" : "transparent", border: "1.5px solid var(--accent-red)", cursor: "pointer" }} />)}
        </div>
      </div>
    </div>
  )}

  {/* XP Bar */}
  <div style={{ marginBottom: 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
      <span style={{ fontSize: 10, color: "var(--t3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>Experiência</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--t2)" }}>
        <strong style={{ color: "var(--accent)" }}>{xpVisivel.toLocaleString()}</strong>
        <span style={{ color: "var(--t3)", fontWeight: 400 }}> / {xpNecessarioNoNivel.toLocaleString()}</span>
      </span>
    </div>
    <div style={{ height: 6, background: "var(--elevated2)", borderRadius: 3, overflow: "hidden", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.6)" }}>
      <div style={{
        width: `${xpPercent}%`, height: "100%", borderRadius: 3, transition: "width .4s ease",
        background: "linear-gradient(90deg, #b8843a 0%, var(--accent) 100%)",
        boxShadow: "0 0 10px rgba(229,180,81,0.4)"
      }} />
    </div>
  </div>

  {/* Descanso buttons */}
  <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
    <button className="premium-btn" onClick={handleShortRest} style={{ fontSize: 12, padding: "10px 0" }}>⟳ Descanso Curto</button>
    <button className="premium-btn" onClick={handleLongRest} style={{ fontSize: 12, padding: "10px 0" }}>☽ Descanso Longo</button>
  </div>

  {/* Inspiration + Concentração */}
  <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
    <button
      onClick={() => { const n = !myCharacter.inspiration; if(onUpdateCharacter) onUpdateCharacter(myCharacter.id, { inspiration: n }); onSendMessage(n ? `🌟 **${myCharacter.name}** ganhou Inspiração!` : `✨ **${myCharacter.name}** usou sua Inspiração.`); }}
      style={{
        flex: 1, padding: "9px 0",
        background: myCharacter.inspiration ? "var(--accent-dim)" : "linear-gradient(180deg, #1f1f26 0%, #15151a 100%)",
        border: `1px solid ${myCharacter.inspiration ? 'rgba(229,180,81,0.6)' : 'var(--border)'}`,
        borderRadius: 8, fontSize: 11, fontWeight: 700,
        color: myCharacter.inspiration ? "var(--accent)" : "var(--t2)",
        letterSpacing: ".05em", textTransform: "uppercase", cursor: "pointer",
        boxShadow: myCharacter.inspiration ? "0 0 12px rgba(229,180,81,0.2), inset 0 1px 0 rgba(255,255,255,0.05)" : "inset 0 1px 0 rgba(255,255,255,0.04)"
      }}>✦ Inspiração</button>
    <button
      onClick={() => { const n = !isConcentrating; if(onUpdateCharacter) onUpdateCharacter(myCharacter.id, { details: { ...myCharacter.details, isConcentrating: n } }); onSendMessage(n ? `🌀 **${myCharacter.name}** está concentrando.` : `💨 **${myCharacter.name}** encerrou a concentração.`); }}
      style={{
        flex: 1, padding: "9px 0",
        background: isConcentrating ? "rgba(59,130,246,0.12)" : "linear-gradient(180deg, #1f1f26 0%, #15151a 100%)",
        border: `1px solid ${isConcentrating ? 'rgba(96,165,250,0.5)' : 'var(--border)'}`,
        borderRadius: 8, fontSize: 11, fontWeight: 700,
        color: isConcentrating ? "#60a5fa" : "var(--t2)",
        letterSpacing: ".05em", textTransform: "uppercase", cursor: "pointer",
        boxShadow: isConcentrating ? "0 0 12px rgba(59,130,246,0.15), inset 0 1px 0 rgba(255,255,255,0.05)" : "inset 0 1px 0 rgba(255,255,255,0.04)"
      }}>🌀 Concentração</button>
  </div>

  {/* Stats grid: 5 colunas */}
  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
    {[
      { val: `+${proficiencyBonus}`, lbl: "Prof." },
      { val: sign(dexMod), lbl: "Init." },
      { val: currentAC, lbl: "CA" },
      { val: "30ft", lbl: "Mov." },
      { val: spellDC, lbl: "Magia CD" },
    ].map(({ val, lbl }) => (
      <div key={lbl} className="stat-box" style={{ padding: "10px 4px" }}>
        <div style={{ fontFamily: "var(--ff)", fontSize: 18, fontWeight: 700, color: "var(--t1)", textShadow: "0 2px 4px rgba(0,0,0,0.5)", lineHeight: 1 }}>{val}</div>
        <div style={{ fontSize: 9, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".05em", marginTop: 5 }}>{lbl}</div>
      </div>
    ))}
  </div>

</div>

                {/* Main View Area */}
                <div className="sb-scroll relative" style={{ flex: 1, overflow: "hidden auto", paddingBottom: "80px" }}>
                    <div key={activeTab} className="view-enter h-full">
                        
                        {activeTab === 'abilities' && (
                            <div style={{ padding: "16px 14px" }}>
                               <div className="sec-title">Atributos Principais</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "16px", padding: "0 2px" }}>
    {['FOR', 'DES', 'CON', 'INT', 'SAB', 'CAR'].map((attr) => {
        const val = attributes[attr as keyof typeof attributes] || 10;
        const mod = Math.floor((val - 10) / 2);
        
        // Pega a cor temática do atributo (ou usa o dourado como fallback)
        const enKey = Object.keys(PT_BR_DICT).find(k => PT_BR_DICT[k] === attr && k.length === 3)?.toUpperCase() || attr;
        const themeColor = ATTR_COLORS[enKey] || "var(--accent)";

        return (
            <div 
                key={attr} 
                onClick={() => handleTriggerRoll(myCharacter.name, attr, mod)} 
                style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(180deg, #18181b 0%, #0d0d0f 100%)',
                    border: '1px solid #2a2a30',
                    borderTop: `2px solid ${themeColor}`, // Destaque sutil na cor do atributo
                    borderRadius: '8px',
                    padding: '10px 0 14px 0',
                    cursor: 'pointer',
                    boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.6)', // Efeito encravado
                    transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => {
                    e.currentTarget.style.borderColor = themeColor;
                    e.currentTarget.style.boxShadow = `0 4px 12px ${themeColor}33, inset 0 2px 10px rgba(0,0,0,0.6)`;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#2a2a30';
                    e.currentTarget.style.borderTop = `2px solid ${themeColor}`;
                    e.currentTarget.style.boxShadow = 'inset 0 2px 10px rgba(0,0,0,0.6)';
                    e.currentTarget.style.transform = 'translateY(0)';
                }}
            >
                <span style={{ fontSize: '9px', fontWeight: 800, color: themeColor, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>
                    {attr}
                </span>
                
                <span style={{ fontFamily: 'var(--ff)', fontSize: '24px', fontWeight: 700, color: 'var(--t1)', textShadow: '0 2px 4px rgba(0,0,0,0.8)', lineHeight: 1 }}>
                    {sign(mod)}
                </span>

                {/* Valor base como uma "pílula" cortando a borda inferior */}
                <div style={{
                    position: 'absolute',
                    bottom: '-10px',
                    background: '#0d0d0f',
                    border: '1px solid #3f3f46',
                    borderRadius: '12px',
                    padding: '2px 10px',
                    fontSize: '10px',
                    fontWeight: 800,
                    color: 'var(--t3)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                }}>
                    {val}
                </div>
            </div>
        )
    })}
</div>

                                <div className="sec-title">Salvaguardas (Saves)</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                                    {['str', 'dex', 'con', 'int', 'wis', 'cha'].map((attr) => {
                                        const isProf = proficiencies[`saving_${attr}`];
                                        const finalMod = mods[attr as keyof typeof mods] + (isProf ? proficiencyBonus : 0);
                                        return (
                                            <div key={attr} onClick={() => handleTriggerRoll(myCharacter.name, `Teste de Resistência (${translateTerm(attr)})`, finalMod)} className="chip" style={isProf ? { borderColor: "var(--accent)", background: "var(--accent-dim)" } : {}}>
                                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: isProf ? "var(--accent)" : "transparent", border: `1.5px solid ${isProf ? "var(--accent)" : "var(--t3)"}`, flexShrink: 0, boxShadow: isProf ? "0 0 6px rgba(229,180,81,0.6)" : "none" }} />
                                                <span style={{ color: ATTR_COLORS[attr.toUpperCase()], fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>{translateTerm(attr)}</span>
                                                <span style={{ fontFamily: "var(--ff)", fontSize: 13, fontWeight: 700, color: isProf ? "var(--accent)" : "var(--t1)" }}>{sign(finalMod)}</span>
                                            </div>
                                        )
                                    })}
                                </div>

                                <div className="sec-title">Sentidos Passivos</div>
                                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                                    {[ { val: 10 + wisMod, lbl: "Percepção" }, { val: 10 + intMod, lbl: "Investigação"}, { val: 10 + wisMod, lbl: "Intuição" } ].map(({ val, lbl }) => (
                                        <div key={lbl} style={{ flex: 1, background: "linear-gradient(180deg, #1f1f26 0%, #111114 100%)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 4px", textAlign: "center", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}>
                                            <div style={{ fontFamily: "var(--ff)", fontSize: 18, fontWeight: 700, color: "var(--t1)", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>{val}</div>
                                            <div style={{ fontSize: 9, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".04em", marginTop: 2 }}>{lbl}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className="sec-title">Perícias (Skills)</div>
                                <div style={{ background: "var(--elevated)", borderRadius: "8px", border: "1px solid var(--border)", padding: "4px" }}>
                                    {Object.keys(SKILL_MAP).sort().map((skill) => {
                                        const attr = SKILL_MAP[skill];
                                        const isProf = proficiencies[skill];
                                        const finalMod = mods[attr as keyof typeof mods] + (isProf ? proficiencyBonus : 0);
                                        return (
                                            <div key={skill} onClick={() => handleTriggerRoll(myCharacter.name, translateTerm(skill), finalMod)} className="sk-row">
                                                <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: isProf ? "var(--accent)" : "transparent", border: `1.5px solid ${isProf ? "var(--accent)" : "var(--t3)"}`, boxShadow: isProf ? "0 0 6px rgba(229,180,81,0.6)" : "none" }} />
                                                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: ATTR_COLORS[attr.toUpperCase()], width: 26, flexShrink: 0 }}>{translateTerm(attr)}</span>
                                                <span style={{ flex: 1, fontSize: 12, color: isProf ? "var(--t1)" : "var(--t2)", fontWeight: isProf ? 600 : 400 }}>{translateTerm(skill)}</span>
                                                <span style={{ fontFamily: "var(--ff)", fontSize: 14, fontWeight: 700, color: finalMod > 0 ? "var(--accent)" : finalMod < 0 ? "var(--accent-red)" : "var(--t3)", minWidth: 26, textAlign: "right" }}>{sign(finalMod)}</span>
                                            </div>
                                        )
                                    })}
                                </div>

                                <div className="sec-title" onClick={() => openDescription('proficiencias e treinamento')} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
                                    <span>Proficiências &amp; Treino</span>
                                    <span style={{ fontSize: 12, color: "var(--accent)" }}><Info size={14}/></span>
                                </div>
                                <div style={{ background: "var(--elevated)", borderRadius: "8px", border: "1px solid var(--border)", padding: "16px" }}>
                                    {[ { key: "ARMOR", items: ["Light", "Medium", "Shields"] }, { key: "WEAPONS", items: ["Simple", "Martial"] }, { key: "TOOLS", items: ["Thieves' Tools"] }, { key: "LANGUAGES", items: ["Common", "Elvish"] } ].map(({ key, items }) => (
                                        <div key={key} style={{ marginBottom: 12, borderBottom: key !== "LANGUAGES" ? "1px solid var(--border)" : "none", paddingBottom: key !== "LANGUAGES" ? 12 : 0 }}>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                                                <span style={{ fontSize: 12, color: "var(--t2)" }}>{key === "ARMOR" ? "🛡" : key === "WEAPONS" ? "⚔" : key === "TOOLS" ? "🔧" : "💬"}</span>{key}
                                            </div>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                                {items.map((item) => <span key={item} className="chip">{item}</span>)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'actions' && (
                            <div style={{ padding: "16px 14px" }}>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                                    {[ { id: 'all', label: 'ALL' }, { id: 'attack', label: 'ATQ' }, { id: 'action', label: 'AÇÃO' }, { id: 'bonus action', label: 'BÔNUS' }, { id: 'reaction', label: 'REAÇÃO' } ].map(f => (
                                        <span key={f.id} onClick={() => setActionFilter(f.id as any)} className="ctag" style={{ background: actionFilter === f.id ? 'var(--accent-dim)' : 'var(--elevated2)', color: actionFilter === f.id ? 'var(--accent)' : 'var(--t3)', borderColor: actionFilter === f.id ? 'var(--accent)' : 'var(--border)' }}>{f.label}</span>
                                    ))}
                                    <span onClick={() => { setActionForm({ name: '', attackMod: 'none', damageExpr: '', damageType: 'Físico', saveAttr: 'none' }); setIsEditingAction(!isEditingAction); }} className="ctag" style={{ marginLeft: 'auto', color: '#60a5fa', borderColor: 'rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.1)' }}>+ MACRO</span>
                                </div>

                                {isEditingAction && (
                                    <div className="feat-card" style={{ marginBottom: 20, borderColor: "rgba(96,165,250,0.4)", boxShadow: "0 4px 12px rgba(59,130,246,0.15)" }}>
                                        <h4 style={{ fontSize: 12, fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 12 }}>Criar/Editar Macro</h4>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                            <input type="text" value={actionForm.name} onChange={e => setActionForm({...actionForm, name: e.target.value})} placeholder="Nome (Ex: Golpe Especial)" style={{ background: "var(--bg)", border: "1px solid var(--border-md)", color: "var(--t1)", padding: 8, borderRadius: 6, fontSize: 12, fontWeight: 500 }} />
                                            <select onChange={(e) => handleAutoFill(e.target.value)} value="" style={{ background: "var(--bg)", border: "1px solid var(--border-md)", color: "var(--t2)", padding: 8, borderRadius: 6, fontSize: 12, fontWeight: 500 }}>
                                                <option value="" disabled>Importar Dados de...</option>
                                                {equippedWeapons.length > 0 && <optgroup label="Armas Equipadas">{equippedWeapons.map(w => <option key={w.id} value={`weapon|${w.id}`}>{w.name}</option>)}</optgroup>}
                                                {knownSpells.length > 0 && <optgroup label="Magias">{knownSpells.map(s => <option key={s.id} value={`spell|${s.id}`}>{s.name}</option>)}</optgroup>}
                                            </select>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                                <input type="text" value={actionForm.damageExpr} onChange={e => setActionForm({...actionForm, damageExpr: e.target.value})} placeholder="Dano (Ex: 1d8)" style={{ background: "var(--bg)", border: "1px solid var(--border-md)", color: "var(--t1)", padding: 8, borderRadius: 6, fontSize: 12, fontFamily: "var(--fb)", fontWeight: 500 }} />
                                                <select value={actionForm.damageType} onChange={e => setActionForm({...actionForm, damageType: e.target.value})} style={{ background: "var(--bg)", border: "1px solid var(--border-md)", color: "var(--t1)", padding: 8, borderRadius: 6, fontSize: 12, fontWeight: 500 }}>
                                                    <option value="Físico">Físico</option><option value="Cura">Cura</option>
                                                    {Object.keys(PT_BR_DICT).filter(k => PT_BR_DICT[k] !== k && k.length > 3).map(k => <option key={k} value={PT_BR_DICT[k]}>{PT_BR_DICT[k]}</option>)}
                                                </select>
                                            </div>
                                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                                <select value={actionForm.attackMod} onChange={e => setActionForm({...actionForm, attackMod: e.target.value})} style={{ background: "var(--bg)", border: "1px solid var(--border-md)", color: "var(--t1)", padding: 8, borderRadius: 6, fontSize: 12, fontWeight: 500 }}>
                                                    <option value="none">Sem Ataque</option><option value="str">Atq: FOR</option><option value="dex">Atq: DES</option><option value="spell">Atq: Magia</option>
                                                </select>
                                                <select value={actionForm.saveAttr} onChange={e => setActionForm({...actionForm, saveAttr: e.target.value})} style={{ background: "var(--bg)", border: "1px solid var(--border-md)", color: "var(--t1)", padding: 8, borderRadius: 6, fontSize: 12, fontWeight: 500 }}>
                                                    <option value="none">Sem Resistência</option><option value="FOR">Res: FOR</option><option value="DES">Res: DES</option><option value="CON">Res: CON</option><option value="INT">Res: INT</option><option value="SAB">Res: SAB</option><option value="CAR">Res: CAR</option>
                                                </select>
                                            </div>
                                            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                                                <button onClick={() => setIsEditingAction(false)} style={{ flex: 1, padding: "8px", background: "transparent", border: "1px solid var(--border-md)", color: "var(--t2)", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "uppercase" }}>Cancelar</button>
                                                <button onClick={handleSaveCustomAction} disabled={!actionForm.name.trim()} style={{ flex: 2, padding: "8px", background: "#3b82f6", border: "none", color: "#fff", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", opacity: actionForm.name.trim() ? 1 : 0.5, boxShadow: "0 2px 8px rgba(59,130,246,0.4)" }}>Salvar Macro</button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="sec-title" style={{ borderColor: "var(--accent-red)" }}>Ações de Combate</div>
                                <div style={{ background: "var(--elevated)", borderRadius: 8, overflow: "hidden", marginBottom: 16, border: "1px solid var(--border)", boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }}>
                                    <table className="atk-table">
                                        <thead>
                                            <tr style={{ background: "rgba(0,0,0,0.3)" }}>
                                                <th style={{ paddingLeft: 12 }}>Ação</th>
                                                <th style={{textAlign: 'center'}}>Hit/DC</th>
                                                <th style={{textAlign: 'right', paddingRight: 12}}>Dano/Efeito</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {allFilteredActions.filter(a => a.type !== 'spell').length === 0 ? (
                                                <tr><td colSpan={3} style={{textAlign: 'center', fontStyle: 'italic', padding: "20px 0"}}>Nenhuma ação mapeada.</td></tr>
                                            ) : (
                                                allFilteredActions.filter(a => a.type !== 'spell').map((action) => (
                                                    <React.Fragment key={action.id || action.name}>
                                                        <tr className={expandedActionIds[action.id || action.name] ? 'active-row' : ''} style={{ cursor: "pointer" }} onClick={() => toggleActionExpansion(action.id || action.name)}>
                                                            <td style={{ color: "var(--t1)", paddingLeft: 12 }}>
                                                                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{action.name}</div>
                                                                <div style={{ fontSize: 9, color: "var(--t3)", textTransform: "uppercase", fontWeight: 600 }}>{translateTerm(action.category)}</div>
                                                            </td>
                                                            <td style={{ textAlign: "center" }}>
                                                                {(action.attackMod && action.attackMod !== 'none') ? (
                                                                    <span onClick={(e) => { e.stopPropagation(); executeActionAttack(action); }} className="chip" style={{ color: "var(--t1)", border: "1px solid var(--border-md)", fontWeight: 700, fontFamily: "var(--ff)", fontSize: 13, padding: "2px 10px" }}>{sign(action.hitMod)}</span>
                                                                ) : (action.saveAttr && action.saveAttr !== 'none') ? (
                                                                    <span onClick={(e) => { e.stopPropagation(); executeActionSave(action); }} className="chip" style={{ color: "var(--t1)", border: "1px solid var(--border-md)", fontWeight: 700, fontSize: 11, padding: "3px 10px" }}>{action.saveAttr}</span>
                                                                ) : <span style={{color: "var(--t3)", fontWeight: 700}}>—</span>}
                                                            </td>
                                                            <td style={{ textAlign: "right", paddingRight: 12 }}>
                                                                {action.damageExpr ? (
                                                                    <span onClick={(e) => { e.stopPropagation(); executeActionDamage(action); }} className="chip" style={{ color: "var(--accent)", borderColor: "var(--accent)", background: "var(--accent-dim)", fontWeight: 700, fontFamily: "var(--ff)", fontSize: 13, padding: "2px 10px" }}>{action.damageExpr}</span>
                                                                ) : action.type === 'macro' ? (
                                                                    <span onClick={(e) => { e.stopPropagation(); handleDeleteCustomAction(action.id); }} className="chip" style={{ color: "var(--accent-red)", borderColor: "rgba(224,69,56,0.5)", background: "rgba(224,69,56,0.1)", fontWeight: 700 }}>Del</span>
                                                                ) : <span style={{color: "var(--t3)", fontWeight: 700}}>—</span>}
                                                            </td>
                                                        </tr>
                                                        {expandedActionIds[action.id || action.name] && (
                                                            <tr style={{ background: "var(--bg)" }}>
                                                                <td colSpan={3} style={{ padding: "12px 16px", fontSize: 12, color: "var(--t2)", lineHeight: 1.6, borderTop: "1px solid var(--border)" }}>
                                                                    <strong style={{ color: "var(--t1)" }}>Alcance: </strong> {action.range || '—'}<br/>
                                                                    <div style={{ marginTop: 6 }}>{action.desc}</div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'spells' && (
                            <div style={{ padding: "16px 14px" }}>
                                {hasSpellSlots && (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
                                        {[1,2,3,4,5,6,7,8,9].map(level => {
                                            const slots = myCharacter?.spellSlots?.[level];
                                            if (!slots || slots.max === 0) return null;
                                            return (
                                                <div key={level} style={{ background: "linear-gradient(180deg, #1f1f26 0%, #15151a 100%)", padding: "10px", borderRadius: 8, textAlign: "center", border: "1px solid var(--border)", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}>
                                                    <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>Círculo {level}</span>
                                                    <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                                                        {[...Array(slots.max)].map((_, i) => (
                                                            <div key={i} onClick={() => handleSpellSlotChange(level, 'toggle_used', i)} style={{ width: 12, height: 12, borderRadius: "50%", border: "1.5px solid #60a5fa", background: i < slots.used ? "transparent" : "#3b82f6", cursor: "pointer", boxShadow: i < slots.used ? "inset 0 2px 4px rgba(0,0,0,0.8)" : "0 0 8px rgba(59,130,246,0.6)" }} />
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                <div style={{ display: "flex", gap: 12, marginBottom: 24, background: "linear-gradient(145deg, #1a2333 0%, #111115 100%)", padding: "14px", borderRadius: 8, border: "1px solid rgba(96,165,250,0.3)", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
                                    <div style={{ flex: 1, textAlign: "center" }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 }}>Ataque Mágico</div>
                                        <div style={{ fontFamily: "var(--ff)", fontSize: 22, fontWeight: 700, color: "var(--t1)", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>{sign(spellAttackBonus)}</div>
                                    </div>
                                    <div style={{ width: 1, background: "rgba(96,165,250,0.2)" }}></div>
                                    <div style={{ flex: 1, textAlign: "center" }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 }}>CD (Resist.)</div>
                                        <div style={{ fontFamily: "var(--ff)", fontSize: 22, fontWeight: 700, color: "var(--t1)", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>{spellDC}</div>
                                    </div>
                                </div>

                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => {
                                    const spellsOfLevel = knownSpells.filter(s => s.level === level);
                                    if (spellsOfLevel.length === 0) return null;
                                    
                                    return (
                                        <div key={`spell-lvl-${level}`} style={{ marginBottom: 20 }}>
                                            <div className="sec-title" style={{ borderColor: "#3b82f6", color: "#60a5fa", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>{level === 0 ? 'Truques (Cantrips)' : `Magias de Círculo ${level}`}</div>
                                            <div style={{ background: "var(--elevated)", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)", boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }}>
                                                <table className="atk-table">
                                                    <tbody>
                                                        {spellsOfLevel.map((spell: any) => {
                                                            const meta = getSpellMeta(spell);
                                                            return (
                                                                <React.Fragment key={spell.id}>
                                                                    <tr className={expandedActionIds[spell.id || spell.name] ? 'active-row' : ''} style={{ cursor: "pointer" }} onClick={() => toggleActionExpansion(spell.id || spell.name)}>
                                                                        <td style={{ color: "var(--t1)", paddingLeft: 12 }}>
                                                                            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{spell.name}</div>
                                                                            <div style={{ fontSize: 9, color: "var(--t3)", fontWeight: 600, textTransform: "uppercase" }}>{meta.time}</div>
                                                                        </td>
                                                                        <td style={{ textAlign: "center" }}>
                                                                            {spell.isAttack ? (
                                                                                <span onClick={(e) => { e.stopPropagation(); handleTriggerRoll(myCharacterName, `Ataque Mágico: ${spell.name}`, spellAttackBonus, spell.parsedDamage, spell.parsedType); }} className="chip" style={{ color: "var(--t1)", border: "1px solid var(--border-md)", fontWeight: 700, fontFamily: "var(--ff)", fontSize: 13 }}>{sign(spellAttackBonus)}</span>
                                                                            ) : spell.isSave ? (
                                                                                <span onClick={(e) => { e.stopPropagation(); handleTriggerRoll(myCharacterName, `Resistência contra ${spell.name}`, 0); }} className="chip" style={{ color: "var(--t1)", border: "1px solid var(--border-md)", fontWeight: 700, fontSize: 11 }}>CD {spellDC}</span>
                                                                            ) : <span style={{color: "var(--t3)", fontWeight: 700}}>—</span>}
                                                                        </td>
                                                                        <td style={{ textAlign: "right", paddingRight: 12 }}>
                                                                            {spell.parsedDamage ? (
                                                                                <span onClick={(e) => { e.stopPropagation(); handleIntentToDamage(spell.name, spell.parsedDamage, spell.parsedType); }} className="chip" style={{ color: "var(--accent)", borderColor: "var(--accent)", background: "var(--accent-dim)", fontWeight: 700, fontFamily: "var(--ff)", fontSize: 13 }}>{spell.parsedDamage}</span>
                                                                            ) : (
                                                                                <span onClick={(e) => { e.stopPropagation(); onCastSpellRP(spell); }} className="chip" style={{ color: "#fff", borderColor: "#3b82f6", background: "#2563eb", fontWeight: 700, boxShadow: "0 2px 4px rgba(37,99,235,0.4)" }}>Usar</span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                    {expandedActionIds[spell.id || spell.name] && (
                                                                        <tr style={{ background: "var(--bg)" }}>
                                                                            <td colSpan={3} style={{ padding: "12px 16px", fontSize: 12, color: "var(--t2)", lineHeight: 1.6, borderTop: "1px solid var(--border)" }}>
                                                                                <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 10, color: "var(--t3)", textTransform: "uppercase", fontWeight: 700 }}>
                                                                                    <span><strong>Alcance:</strong> {meta.range}</span>
                                                                                    <span><strong>Comp:</strong> {meta.comps}</span>
                                                                                </div>
                                                                                {spell.cleanDescription}
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </React.Fragment>
                                                            )
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )
                                })}
                                {knownSpells.length === 0 && <div style={{ background: "var(--elevated)", border: "1px dashed var(--border-md)", borderRadius: 8, padding: 30, textAlign: "center", marginTop: 20 }}><p style={{ fontSize: 12, color: "var(--t3)", fontWeight: 600 }}>Seu grimório está vazio.</p></div>}
                            </div>
                        )}

                        {activeTab === 'inventory' && (
                            <div style={{ padding: "16px 14px" }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", marginBottom: 6, display: "flex", justifyContent: "space-between", textTransform: "uppercase", letterSpacing: ".05em" }}>
                                    <span>Peso Carregado</span>
                                    <strong style={{ color: totalWeight > maxWeight ? 'var(--accent-red)' : 'var(--t1)' }}>{totalWeight.toFixed(1)} / {maxWeight} lb</strong>
                                </div>
                                <div style={{ height: 6, background: "var(--elevated2)", borderRadius: 3, overflow: "hidden", marginBottom: 20, boxShadow: "inset 0 1px 3px rgba(0,0,0,0.8)" }}>
                                    <div style={{ width: `${Math.min(100, weightPercent)}%`, height: "100%", background: totalWeight > maxWeight ? "var(--accent-red)" : "linear-gradient(90deg, #7ab87a 0%, #5b9bd5 100%)", borderRadius: 3 }} />
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 24 }}>
                                    {renderCoin('cp', 'PC', 'border-orange-500/30 text-orange-300')}
                                    {renderCoin('sp', 'PP', 'border-gray-500/50 text-gray-300')}
                                    {renderCoin('ep', 'PE', 'border-blue-500/30 text-blue-300')}
                                    {renderCoin('gp', 'PO', 'border-yellow-500/50 text-yellow-400')}
                                    {renderCoin('pp', 'PL', 'border-purple-500/40 text-purple-300')}
                                </div>
                                <Inventory items={inventory} ownerId={myCharacter.id} onEquip={handleEquipItem} onDrop={handleDropItem} />
                            </div>
                        )}

                        {activeTab === 'features' && (
                            <div style={{ padding: "16px 14px" }}>
                                <div className="sec-title">Características da Classe</div>
                                {CLASS_ABILITIES[myCharacter.classType?.toUpperCase() || 'GUERREIRO']?.map((ability, idx) => {
                                    if (savedLevel < ability.unlockLevel) return null;
                                    const key = `${myCharacter.name}_${ability.name}`; const used = abilityUsage[key] || 0; const disabled = ability.max !== 99 && used >= ability.max;
                                    return (
                                        <div key={idx} className="feat-card">
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                                                <div style={{ fontFamily: "var(--ff)", fontSize: 14, fontWeight: 700, color: "var(--t1)", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>{ability.icon} {ability.name}</div>
                                                <button onClick={()=>{handleUseAbility(ability.name, ability.max, ability.desc)}} disabled={disabled} style={{ background: disabled ? "var(--bg)" : "var(--accent)", color: disabled ? "var(--t3)" : "#000", border: `1px solid ${disabled ? "var(--border)" : "var(--accent)"}`, borderRadius: 4, padding: "4px 12px", fontSize: 10, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", boxShadow: disabled ? "none" : "0 2px 6px rgba(229,180,81,0.4)" }}>USAR</button>
                                            </div>
                                            <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>{ability.desc}</div>
                                            {ability.max !== 99 && (
                                                <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                                                    {Array.from({length: ability.max}).map((_, i) => (
                                                        <span key={i} className="choice-badge" style={i < used ? { background: "var(--bg)", borderColor: "var(--border)", color: "var(--t3)" } : { borderColor: "var(--accent)", color: "var(--accent)", background: "var(--accent-dim)", fontWeight: 700, boxShadow: "0 0 6px rgba(229,180,81,0.2)" }}>Carga {i+1}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                                {(!CLASS_ABILITIES[myCharacter.classType?.toUpperCase() || ''] || CLASS_ABILITIES[myCharacter.classType?.toUpperCase() || ''].length === 0) && (
                                    <div style={{ background: "var(--elevated)", border: "1px dashed var(--border-md)", borderRadius: 8, padding: 30, textAlign: "center", marginTop: 20 }}><p style={{ fontSize: 12, color: "var(--t3)", fontWeight: 600 }}>Nenhuma habilidade mapeada para seu nível.</p></div>
                                )}
                            </div>
                        )}

                        {activeTab === 'background' && (
                            <div style={{ padding: "16px 14px" }}>
                                <div className="sec-title">Identidade</div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, marginBottom: 24, background: "var(--elevated)", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
                                    {[ { lbl: "Background", val: (charDetails as any)?.background || "—" }, { lbl: "Tendência", val: (charDetails as any)?.alignment || "—" }, { lbl: "Fé", val: (charDetails as any)?.faith || "—" }, { lbl: "Estilo de Vida", val: (charDetails as any)?.lifestyle || "—" } ].map(({ lbl, val }, idx) => (
                                        <div key={lbl} style={{ display: "flex", flexDirection: "column", padding: "10px 12px", borderBottom: idx < 2 ? "1px solid var(--border)" : "none", borderRight: idx % 2 === 0 ? "1px solid var(--border)" : "none", background: "rgba(255,255,255,0.02)" }}>
                                            <span style={{ fontSize: 9, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>{lbl}</span>
                                            <span style={{ color: val === "—" ? "var(--t3)" : "var(--t1)", fontWeight: 600, fontSize: 12 }}>{val}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="sec-title">Personalidade</div>
                                <div style={{ background: "var(--elevated)", borderRadius: 8, border: "1px solid var(--border)", padding: "16px", marginBottom: 24 }}>
                                    <IdentityCard title="Traços de Personalidade" content={(charDetails as any)?.personalityTraits} />
                                    <IdentityCard title="Ideais" content={(charDetails as any)?.ideals} />
                                    <IdentityCard title="Vínculos (Bonds)" content={(charDetails as any)?.bonds} />
                                    <IdentityCard title="Fraquezas (Flaws)" content={(charDetails as any)?.flaws} />
                                </div>

                                <div className="sec-title">Aparência</div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, background: "var(--elevated)", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
                                    {[
                                        {lbl: 'Idade', k: 'age'}, {lbl: 'Gênero', k: 'gender'}, 
                                        {lbl: 'Altura', k: 'height'}, {lbl: 'Peso', k: 'weight'}, 
                                        {lbl: 'Olhos', k: 'eyes'}, {lbl: 'Pele', k: 'skin'}
                                    ].map(({lbl, k}, idx) => {
                                        const val = (charDetails as any)?.physical?.[k] || "—";
                                        return (
                                            <div key={k} style={{ display: "flex", flexDirection: "column", padding: "10px 12px", borderBottom: idx < 4 ? "1px solid var(--border)" : "none", borderRight: idx % 2 === 0 ? "1px solid var(--border)" : "none", background: "rgba(255,255,255,0.02)" }}>
                                                <span style={{ fontSize: 9, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>{lbl}</span>
                                                <span style={{ color: val === "—" ? "var(--t3)" : "var(--t1)", fontWeight: 600, fontSize: 12 }}>{val}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {activeTab === 'notes' && (
                            <div style={{ padding: "16px 14px", height: "100%", display: "flex", flexDirection: "column" }}>
                                <div className="sec-title">Anotações do Jogador</div>
                                <textarea 
                                    className="sb-scroll"
                                    style={{ flex: 1, width: '100%', minHeight: "400px", background: 'var(--elevated)', border: '1px solid var(--border-md)', borderRadius: '8px', padding: '16px', color: 'var(--t1)', fontSize: '13px', lineHeight: '1.7', fontFamily: 'var(--fb)', outline: 'none', resize: 'none', boxShadow: "inset 0 2px 8px rgba(0,0,0,0.5)" }}
                                    placeholder="Anote pistas, nomes, locais e segredos da campanha aqui..."
                                    defaultValue={myCharacter.dmNotes || ''}
                                    onBlur={(e) => onUpdateCharacter && onUpdateCharacter(myCharacter.id, { dmNotes: e.target.value })}
                                />
                            </div>
                        )}

                        {activeTab === 'chat' && (
                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <Chat messages={chatMessages} onSendMessage={onSendMessage} role="PLAYER" onApplyDamage={onApplyDamageFromChat} />
                            </div>
                        )}

                    </div>
                </div>

            </div>
          )}
          
          {/* FAB fora da sidebar, posicionado ao lado do dado no mapa */}
          {!isCollapsed && (
            <button
              onClick={() => setNavOpen(true)}
              title="Menu da Ficha"
              style={{
                position: "fixed",
                bottom: 24,
                right: `calc(var(--sb-width) + 30px)`,
                width: 50,
                height: 50,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #f5c462 0%, var(--accent) 100%)",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 18px rgba(229,180,81,.45)",
                transition: "transform .2s, box-shadow .2s",
                zIndex: 300,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "scale(1.1)";
                e.currentTarget.style.boxShadow = "0 6px 24px rgba(229,180,81,.6)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "0 4px 18px rgba(229,180,81,.45)";
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#000">
                <path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z"/>
              </svg>
            </button>
          )}
      </div>
    </>
  );
};

export default SidebarPlayer;