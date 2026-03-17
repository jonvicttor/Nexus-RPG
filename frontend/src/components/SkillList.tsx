// src/components/SkillList.tsx
import React from 'react';
// CORREÇÃO: Agora ele busca na pasta 'utils' onde seu arquivo realmente está
import { SKILLS, getAttributeModifier, Attribute } from '../utils/gameRules';

interface SkillListProps {
  attributes: Record<Attribute, number>;
  proficiencyBonus: number;
  profs: string[];
  onRoll: (skillName: string, modifier: number, attributeUsed: Attribute) => void;
  isDmMode?: boolean; 
}

const SkillList: React.FC<SkillListProps> = ({ attributes, proficiencyBonus, profs, onRoll, isDmMode = false }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
      {SKILLS.map((skill) => {
        const isProficient = profs.includes(skill.id);
        
        // Proteção: Se atributos não existirem, usa 10
        const score = attributes ? attributes[skill.attribute] : 10;
        const attrMod = getAttributeModifier(score);
        
        const totalMod = attrMod + (isProficient ? proficiencyBonus : 0);
        const sign = totalMod >= 0 ? '+' : '';

        return (
          <button
            key={skill.id}
            onClick={() => onRoll(skill.name, totalMod, skill.attribute)}
            className={`group flex items-center justify-between p-2 rounded border transition-all cursor-pointer ${
              isDmMode 
                ? 'bg-purple-900/20 border-purple-700/50 hover:bg-purple-900/40 hover:border-purple-500' 
                : 'bg-gray-900/50 border-gray-700 hover:bg-gray-800 hover:border-yellow-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full border ${isProficient ? 'bg-yellow-500 border-yellow-500' : 'border-gray-500'}`}></div>
              <div className="text-left">
                <span className={`block font-bold text-sm ${isDmMode ? 'text-purple-200 group-hover:text-white' : 'text-gray-200 group-hover:text-yellow-400'}`}>
                    {skill.name}
                </span>
                <span className="text-[9px] text-gray-500 uppercase tracking-widest">{skill.attribute}</span>
              </div>
            </div>
            <span className={`text-lg font-serif font-bold ${isDmMode ? 'text-purple-300' : 'text-gray-400 group-hover:text-white'}`}>
              {sign}{totalMod}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default SkillList;