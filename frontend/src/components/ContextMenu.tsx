import React, { useEffect, useRef } from 'react';
import { Entity } from '../App';
import { Skull, MessageSquare, Shield, Sword, User, Eye, EyeOff, Heart } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  entity: Entity;
  role: 'DM' | 'PLAYER';
  onClose: () => void;
  onAction: (action: string, entity: Entity) => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, entity, role, onClose, onAction }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Fecha se clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Ajusta posição se sair da tela (Básico)
  const style = {
    top: Math.min(y, window.innerHeight - 300),
    left: Math.min(x, window.innerWidth - 200),
  };

  const MenuItem = ({ icon: Icon, label, action, danger = false, color = "text-gray-300" }: any) => (
    <button 
      onClick={() => { onAction(action, entity); onClose(); }}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-colors text-left ${danger ? 'text-red-400 hover:text-red-300' : color}`}
    >
      <Icon size={14} />
      {label}
    </button>
  );

  return (
    <div 
      ref={menuRef}
      className="fixed z-[9999] w-48 bg-[#1a1a1a] border border-[#d4af37]/30 rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col py-1 animate-in fade-in zoom-in duration-100"
      style={style}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-4 py-2 border-b border-white/10 mb-1">
        <span className="text-[#d4af37] font-serif font-bold text-sm truncate block">{entity.name}</span>
        <span className="text-[9px] text-gray-500 uppercase">{entity.classType || 'Desconhecido'}</span>
      </div>

      <MenuItem icon={User} label="Ver Ficha" action="VIEW_SHEET" color="text-blue-300" />
      <MenuItem icon={MessageSquare} label="Sussurrar" action="WHISPER" />
      
      {role === 'DM' && (
        <>
          <div className="h-px w-full bg-white/10 my-1"></div>
          <MenuItem icon={Sword} label="Definir Atacante" action="SET_ATTACKER" color="text-blue-400" />
          <MenuItem icon={Shield} label="Definir Alvo" action="SET_TARGET" color="text-red-400" />
          <div className="h-px w-full bg-white/10 my-1"></div>
          <MenuItem icon={entity.visible ? EyeOff : Eye} label={entity.visible ? "Ocultar Token" : "Revelar Token"} action="TOGGLE_VISIBILITY" />
          <MenuItem icon={Heart} label="Curar Total" action="HEAL_FULL" color="text-green-400" />
          <MenuItem icon={Skull} label={entity.hp > 0 ? "Matar" : "Reviver"} action="TOGGLE_DEAD" danger={entity.hp > 0} />
        </>
      )}
    </div>
  );
};

export default ContextMenu;