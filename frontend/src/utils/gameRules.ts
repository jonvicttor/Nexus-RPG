// src/data/gameRules.ts

// --- PARTE 1: XP E NÍVEIS ---
export const XP_TABLE = [
    0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 
    85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
];

export const getLevelFromXP = (xp: number): number => {
    let level = 1;
    for (let i = 0; i < XP_TABLE.length; i++) {
        if (xp >= XP_TABLE[i]) level = i + 1;
        else break;
    }
    return level;
};

export const getProficiencyBonus = (level: number): number => {
    return Math.ceil(1 + (level / 4));
};

// Renomeei para ser usado tanto pelo XP quanto pelas Perícias
export const getAttributeModifier = (score: number): number => {
    return Math.floor((score - 10) / 2);
};

export const getNextLevelXP = (currentLevel: number): number => {
    if (currentLevel >= 20) return XP_TABLE[19];
    return XP_TABLE[currentLevel];
};

export const CLASS_HIT_DICE: Record<string, number> = {
    'bárbaro': 12, 'barbaro': 12, 'bardo': 8, 'clérigo': 8, 'clerigo': 8,
    'druida': 8, 'guerreiro': 10, 'monge': 8, 'paladino': 10,
    'patrulheiro': 10, 'ranger': 10, 'ladino': 8, 'feiticeiro': 6,
    'bruxo': 8, 'mago': 6, 'artífice': 8, 'artifice': 8, 'npc': 8
};

export const calculateHPGain = (className: string, conScore: number): number => {
    const key = (className || 'npc').toLowerCase().trim();
    const hitDie = CLASS_HIT_DICE[key] || 8;
    const avg = (hitDie / 2) + 1;
    const conMod = getAttributeModifier(conScore);
    return Math.max(1, avg + conMod);
};

// --- PARTE 2: PERÍCIAS E ATRIBUTOS (ESSENCIAL PARA O SkillList) ---

export type Attribute = 'FOR' | 'DES' | 'CON' | 'INT' | 'SAB' | 'CAR';

export interface Skill {
  id: string;
  name: string;
  attribute: Attribute;
}

export const ATTRIBUTES: Attribute[] = ['FOR', 'DES', 'CON', 'INT', 'SAB', 'CAR'];

export const SKILLS: Skill[] = [
  { id: 'acrobatics', name: 'Acrobacia', attribute: 'DES' },
  { id: 'animal_handling', name: 'Adestrar Animais', attribute: 'SAB' },
  { id: 'arcana', name: 'Arcanismo', attribute: 'INT' },
  { id: 'athletics', name: 'Atletismo', attribute: 'FOR' },
  { id: 'deception', name: 'Enganação', attribute: 'CAR' },
  { id: 'history', name: 'História', attribute: 'INT' },
  { id: 'insight', name: 'Intuição', attribute: 'SAB' },
  { id: 'intimidation', name: 'Intimidação', attribute: 'CAR' },
  { id: 'investigation', name: 'Investigação', attribute: 'INT' },
  { id: 'medicine', name: 'Medicina', attribute: 'SAB' },
  { id: 'nature', name: 'Natureza', attribute: 'INT' },
  { id: 'perception', name: 'Percepção', attribute: 'SAB' },
  { id: 'performance', name: 'Performance', attribute: 'CAR' },
  { id: 'persuasion', name: 'Persuasão', attribute: 'CAR' },
  { id: 'religion', name: 'Religião', attribute: 'INT' },
  { id: 'sleight_of_hand', name: 'Prestidigitação', attribute: 'DES' },
  { id: 'stealth', name: 'Furtividade', attribute: 'DES' },
  { id: 'survival', name: 'Sobrevivência', attribute: 'SAB' },
];