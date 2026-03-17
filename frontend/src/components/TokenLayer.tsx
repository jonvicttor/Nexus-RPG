import React, { useState, useEffect, useRef } from 'react';
import { Entity, Item } from '../App';
import Token from './Token';

const FloatingNumber = ({ text, type, x, y, size, gridSize }: any) => {
    const [styles, setStyles] = useState({
        transform: 'translate(-50%, 0px) scale(0.5)',
        opacity: 1
    });

    useEffect(() => {
        const timer = setTimeout(() => {
            setStyles({
                transform: 'translate(-50%, -80px) scale(1.2)', 
                opacity: 0
            });
        }, 50); 
        return () => clearTimeout(timer);
    }, []);

    const color = type === 'heal' ? 'text-green-400' : 'text-red-500';
    
    return (
        <div
            className={`absolute pointer-events-none font-black text-5xl drop-shadow-[0_4px_4px_rgba(0,0,0,1)] ${color} z-[300]`}
            style={{
                left: x * gridSize + ((size * gridSize) / 2),
                top: y * gridSize, 
                transition: 'all 1.5s cubic-bezier(0.2, 0.8, 0.2, 1)', 
                textShadow: '0 0 10px rgba(0,0,0,1), 2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000', 
                ...styles
            }}
        >
            {text}
        </div>
    );
};

interface TokenLayerProps {
  entities: Entity[];
  gridSize: number;
  scale: number;
  offset: { x: number, y: number };
  role: 'DM' | 'PLAYER';
  
  activeTurnId: number | null;
  attackerId: number | null;
  targetEntityIds: number[];
  
  onMoveToken: (id: number, x: number, y: number) => void;
  onSelectToken: (entity: Entity, multi?: boolean) => void;
  onTokenContextMenu: (e: React.MouseEvent, entity: Entity) => void;
  // --- ATUALIZADO: Agora passa a flag de Múltiplos Alvos (Shift) ---
  onTokenDoubleClick: (entity: Entity, multi?: boolean) => void; 
  
  onGiveItemToToken: (item: Item, sourceId: number, targetId: number) => void;
}

const TokenLayer: React.FC<TokenLayerProps> = ({
  entities, gridSize, offset, scale, role,
  activeTurnId, attackerId, targetEntityIds,
  onMoveToken, onSelectToken, onTokenContextMenu, onTokenDoubleClick,
  onGiveItemToToken
}) => {
  
  const [floatingTexts, setFloatingTexts] = useState<any[]>([]);
  const prevHpRef = useRef<Record<number, number>>({});
  const isInitialized = useRef(false);

  useEffect(() => {
      if (!isInitialized.current && entities.length > 0) {
          entities.forEach(ent => { prevHpRef.current[ent.id] = ent.hp; });
          isInitialized.current = true;
          return;
      }

      const newTexts: any[] = [];
      entities.forEach(ent => {
          const prevHp = prevHpRef.current[ent.id];
          
          if (prevHp !== undefined && prevHp !== ent.hp) {
              const diff = ent.hp - prevHp;
              newTexts.push({
                  id: Math.random().toString(), 
                  text: diff > 0 ? `+${diff}` : `${diff}`,
                  type: diff > 0 ? 'heal' : 'damage',
                  x: ent.x,
                  y: ent.y,
                  size: ent.size || 1
              });
          }
          prevHpRef.current[ent.id] = ent.hp; 
      });

      if (newTexts.length > 0) {
          setFloatingTexts(prev => [...prev, ...newTexts]);
          
          setTimeout(() => {
              setFloatingTexts(prev => prev.filter(ft => !newTexts.find(n => n.id === ft.id)));
          }, 1500);
      }
  }, [entities]); 

  return (
    <div 
        className="absolute top-0 left-0 w-0 h-0 pointer-events-none overflow-visible"
        style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: 'top left' 
        }}
    >
        {floatingTexts.map(ft => (
            <FloatingNumber key={ft.id} text={ft.text} type={ft.type} x={ft.x} y={ft.y} size={ft.size} gridSize={gridSize} />
        ))}

        {entities.map(entity => {
            if (role === 'PLAYER' && entity.visible === false) return null;

            return (
                <div key={entity.id} className="pointer-events-auto">
                    <Token
                        entity={entity}
                        gridSize={gridSize}
                        scale={scale}
                        
                        isSelected={false} 
                        isTarget={targetEntityIds.includes(entity.id)}
                        isAttacker={attackerId === entity.id}
                        isActiveTurn={activeTurnId === entity.id}
                        
                        onMove={onMoveToken}
                        onSelect={(e, ent) => onSelectToken(ent, e.shiftKey || e.ctrlKey)}
                        onContextMenu={onTokenContextMenu}
                        // --- ATUALIZADO: Passa o Shift/Ctrl para múltiplos alvos ---
                        onDoubleClick={(e, ent) => onTokenDoubleClick(ent, e.shiftKey || e.ctrlKey)}
                        onDropItemOnToken={onGiveItemToToken}
                    />
                </div>
            );
        })}
    </div>
  );
};

export default TokenLayer;