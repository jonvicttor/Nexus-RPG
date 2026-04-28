import React from 'react';
import { Entity } from '../App';
import { X, ShieldAlert, Heart, Sword } from 'lucide-react';

interface Props {
  monster: Entity;
  onClose: () => void;
  onRoll: (title: string, subtitle: string, mod: number) => void;
  onUpdateHP: (id: number, change: number) => void;
}

export default function MonsterSheetFloating({ monster, onClose, onRoll, onUpdateHP }: Props) {
  const getMod = (val: number) => Math.floor((val - 10) / 2);
  const formatMod = (val: number) => { const m = getMod(val); return m >= 0 ? `+${m}` : `${m}`; };
  
  const stats = monster.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#1a1510] border-2 border-[#b89f65] rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] w-[400px] max-w-[90vw] max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col relative animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        
        {/* Cabeçalho */}
        <div className="p-5 border-b-4 border-[#8b1111] bg-gradient-to-b from-[#2a2015] to-[#1a1510] relative">
          <button onClick={onClose} className="absolute top-3 right-3 text-[#b89f65] hover:text-white transition-colors"><X size={24} /></button>
          <h2 className="text-3xl font-black text-[#d4af37] tracking-wider uppercase font-serif drop-shadow-md pr-6">{monster.name}</h2>
          <p className="text-[#a09070] italic text-sm font-serif">{monster.size === 1 ? 'Criatura Média' : 'Criatura'}, {monster.classType || 'Monstro'}</p>
        </div>

        <div className="p-5 text-[#d9c8a9] font-serif bg-[#241b14]">          {/* Atributos Principais */}
          <div className="flex gap-6 mb-4 items-center">
            <div className="flex items-center gap-2 text-red-400">
              <Heart size={20} className="fill-red-900/50" />
              <span className="font-bold text-lg">HP {monster.hp} <span className="text-sm font-normal text-[#888]">/ {monster.maxHp}</span></span>
            </div>
            <div className="flex items-center gap-2 text-blue-400">
              <ShieldAlert size={20} />
              <span className="font-bold text-lg">CA {monster.ac}</span>
            </div>
          </div>

          <svg className="w-full h-1 mb-4 opacity-50" preserveAspectRatio="none" viewBox="0 0 100 10"><polyline points="0,5 100,5" stroke="#8b1111" strokeWidth="2" fill="none"/></svg>
          
          {/* Tabela de Status (Roláveis) */}
          <div className="grid grid-cols-6 gap-1 text-center mb-4">
            {Object.entries(stats).map(([k, v]) => (
              <div key={k} className="flex flex-col cursor-pointer hover:bg-white/10 rounded p-1 transition-colors border border-transparent hover:border-[#b89f65]/50" onClick={() => onRoll(`Teste de ${k.toUpperCase()}`, monster.name, getMod(Number(v)))} title={`Rolar Teste de ${k.toUpperCase()}`}>
                <span className="font-bold text-[#b89f65] uppercase text-[10px]">{k}</span>
                <span className="text-lg font-black text-white">{v}</span>
                <span className="text-xs text-[#888]">({formatMod(Number(v))})</span>
              </div>
            ))}
          </div>
          
          <svg className="w-full h-1 mb-4 opacity-50" preserveAspectRatio="none" viewBox="0 0 100 10"><polyline points="0,5 100,5" stroke="#8b1111" strokeWidth="2" fill="none"/></svg>

          {/* Vulnerabilidades/Resistências */}
          {(monster.vulnerabilities?.length || monster.resistances?.length || monster.immunities?.length) ? (
            <div className="space-y-1 text-xs mb-4">
              {monster.vulnerabilities && monster.vulnerabilities.length > 0 && <p><strong className="text-red-400">Vulnerabilidades:</strong> <span className="uppercase">{monster.vulnerabilities.join(', ')}</span></p>}
              {monster.resistances && monster.resistances.length > 0 && <p><strong className="text-blue-400">Resistências:</strong> <span className="uppercase">{monster.resistances.join(', ')}</span></p>}
              {monster.immunities && monster.immunities.length > 0 && <p><strong className="text-green-400">Imunidades:</strong> <span className="uppercase">{monster.immunities.join(', ')}</span></p>}
            </div>
          ) : null}

          {/* Ações e Ataques */}
          <h3 className="text-xl font-black text-[#8b1111] border-b border-[#8b1111]/30 pb-1 mb-3 font-serif uppercase tracking-widest mt-6">Ações</h3>
          
          {monster.actions && monster.actions.length > 0 ? (
            <div className="space-y-4">
              {monster.actions.map((act: any, idx: number) => (
                <div key={idx} className="bg-black/40 p-3 rounded border border-[#b89f65]/20 hover:border-[#b89f65]/50 transition-colors shadow-inner">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-[#d4af37] text-sm flex items-center gap-2 cursor-pointer hover:text-white transition-colors" onClick={() => onRoll(`Ataque: ${act.name}`, `${monster.name} ataca!`, act.attackBonus || 0)} title={`Rolar Ataque (${act.name})`}>
                      <Sword size={14} className="text-[#8b1111]" /> <span className="underline decoration-dashed decoration-[#b89f65]/50 underline-offset-2">{act.name}</span>
                    </h4>
                    <button 
                        onClick={() => onRoll(`Dano: ${act.name}`, `Tipo: ${act.damageType}`, 0)} 
                        className="text-[10px] bg-red-900/40 border border-red-900/50 text-red-300 px-2 py-1 rounded hover:bg-red-800 transition-colors uppercase tracking-wider font-bold shadow-md active:scale-95"
                        title="Rolar Dano avulso"
                    >
                      Dano {act.damage}
                    </button>
                  </div>
                  <p className="text-xs text-[#a09070] italic mb-1">
                    Ataque Corpo-a-Corpo: <strong className="text-white">+{act.attackBonus}</strong> para acertar. Dano: <strong className="text-white">{act.damage}</strong> dano {act.damageType}.
                  </p>
                  {act.description && <p className="text-xs text-gray-300 mt-2 leading-relaxed">{act.description}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic">Nenhuma ação catalogada para esta criatura no bestiário.</p>
          )}

          {monster.dmNotes && (
             <div className="mt-6 pt-4 border-t border-dashed border-[#b89f65]/30">
               <h4 className="text-[10px] text-[#b89f65] uppercase tracking-widest font-bold mb-2">Anotações do Mestre</h4>
               <p className="text-xs text-gray-400 whitespace-pre-wrap font-sans">{monster.dmNotes}</p>
             </div>
          )}

        </div>
      </div>
    </div>
  );
}