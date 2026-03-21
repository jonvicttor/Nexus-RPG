import React from 'react';
import { Entity } from '../App';
import { Shield, Eye, EyeOff, Target, Swords, HeartPulse, Skull, MessageSquare, FileText } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  entity: Entity;
  role: 'DM' | 'PLAYER';
  onClose: () => void;
  onAction: (action: string, entity: Entity) => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, entity, role, onClose, onAction }) => {
  // Ajusta a posição para o menu não sair da tela
  const menuX = x + 200 > window.innerWidth ? x - 200 : x;
  const menuY = y + 300 > window.innerHeight ? y - 300 : y;

  return (
    <div 
      className="fixed z-[9999] bg-gray-900/95 backdrop-blur-md border border-cyan-900/50 rounded-xl shadow-2xl py-2 w-56 text-sm text-gray-200 overflow-hidden"
      style={{ top: menuY, left: menuX }}
      onMouseLeave={onClose}
    >
      {/* 👇 NOVA MAGIA AQUI: Botão de Ver Status / Ficha 👇 */}
      <button onClick={() => onAction('VIEW_STATUS', entity)} className="w-full text-left px-4 py-2.5 hover:bg-cyan-900/40 flex items-center gap-3 transition-colors border-b border-white/5">
        <FileText size={16} className="text-cyan-400" /> Ver Ficha / Status
      </button>
      
      {role === 'DM' && (
        <button onClick={() => onAction('VIEW_SHEET', entity)} className="w-full text-left px-4 py-2.5 hover:bg-yellow-900/40 flex items-center gap-3 transition-colors border-b border-white/5">
          <Shield size={16} className="text-yellow-500" /> Editar Atributos
        </button>
      )}
      
      <button onClick={() => onAction('WHISPER', entity)} className="w-full text-left px-4 py-2.5 hover:bg-pink-900/40 flex items-center gap-3 transition-colors border-b border-white/5">
        <MessageSquare size={16} className="text-pink-400" /> Sussurrar
      </button>

      <button onClick={() => onAction('SET_TARGET', entity)} className="w-full text-left px-4 py-2.5 hover:bg-red-900/40 flex items-center gap-3 transition-colors border-b border-white/5">
        <Target size={16} className="text-red-400" /> Marcar como Alvo
      </button>

      {role === 'DM' && (
        <>
          <button onClick={() => onAction('SET_ATTACKER', entity)} className="w-full text-left px-4 py-2.5 hover:bg-orange-900/40 flex items-center gap-3 transition-colors">
            <Swords size={16} className="text-orange-400" /> Definir Atacante
          </button>
          <button onClick={() => onAction('TOGGLE_VISIBILITY', entity)} className="w-full text-left px-4 py-2.5 hover:bg-gray-800 flex items-center gap-3 transition-colors">
            {entity.visible ? <EyeOff size={16} className="text-gray-400" /> : <Eye size={16} className="text-gray-300" />} {entity.visible ? 'Ocultar' : 'Revelar'}
          </button>
          <button onClick={() => onAction('HEAL_FULL', entity)} className="w-full text-left px-4 py-2.5 hover:bg-green-900/40 flex items-center gap-3 transition-colors">
            <HeartPulse size={16} className="text-green-400" /> Curar 100%
          </button>
          <button onClick={() => onAction('TOGGLE_DEAD', entity)} className="w-full text-left px-4 py-2.5 hover:bg-purple-900/40 flex items-center gap-3 transition-colors">
            <Skull size={16} className="text-purple-400" /> {entity.hp > 0 ? 'Matar (0 HP)' : 'Ressuscitar (1 HP)'}
          </button>
        </>
      )}
    </div>
  );
};

export default ContextMenu;