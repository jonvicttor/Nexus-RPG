import React, { useState, useEffect, useRef } from 'react';
import { Entity, Item } from '../App';

interface TokenProps {
  entity: Entity;
  gridSize: number;
  scale: number;
  
  // 👉 NOVO: Define se este token pode ser arrastado
  isDraggable?: boolean;
  
  isSelected: boolean;
  isTarget: boolean;
  isAttacker: boolean;
  isActiveTurn: boolean;

  onMove: (id: number, x: number, y: number) => void;
  onSelect: (e: React.MouseEvent, entity: Entity) => void;
  onContextMenu: (e: React.MouseEvent, entity: Entity) => void;
  onDoubleClick: (e: React.MouseEvent, entity: Entity) => void;
  onDropItemOnToken: (item: Item, sourceId: number, targetId: number) => void;
}

const CONDITIONS_ICONS: Record<string, string> = {
    'Blinded': '🦇', 
    'Charmed': '💕', 
    'Deafened': '🔇', 
    'Exhaustion': '😩', 
    'Frightened': '😱', 
    'Grappled': '🤼', 
    'Incapacitated': '😵', 
    'Invisible': '👻', 
    'Paralyzed': '⚡', 
    'Petrified': '🗿', 
    'Poisoned': '🤢', 
    'Prone': '⏬', 
    'Restrained': '⛓️', 
    'Stunned': '💫', 
    'Unconscious': '💤'
};

const Token: React.FC<TokenProps> = ({ 
  entity, gridSize, scale,
  isDraggable = true, // Por padrão pode mover (caso o DM não passe isso)
  isSelected, isTarget, isAttacker, isActiveTurn,
  onMove, onSelect, onContextMenu, onDoubleClick,
  onDropItemOnToken
}) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: entity.x * gridSize, y: entity.y * gridSize });
  
  const isDragging = useRef(false);
  const startMouse = useRef({ x: 0, y: 0 });
  const isAltPressed = useRef(false); 

  useEffect(() => {
    if (!isDragging.current) {
        setPosition({ x: entity.x * gridSize, y: entity.y * gridSize });
    }
  }, [entity.x, entity.y, gridSize]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Alt') isAltPressed.current = true; };
      const handleKeyUp = (e: KeyboardEvent) => { if (e.key === 'Alt') isAltPressed.current = false; };
      
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
      };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; 
    e.preventDefault();
    e.stopPropagation(); 

    onSelect(e, entity);

    // 👉 AQUI A TRAVA FUNCIONA: Se não for Draggable, não inicia o Drag!
    if (!isDraggable) return;

    isDragging.current = true;
    startMouse.current = { x: e.clientX, y: e.clientY };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    if (elementRef.current) {
        elementRef.current.style.zIndex = '1000';
        elementRef.current.style.cursor = 'grabbing';
        elementRef.current.style.transition = 'none'; 
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current || !elementRef.current) return;
    
    e.preventDefault();

    const parentRect = elementRef.current.parentElement?.getBoundingClientRect();
    if (!parentRect) return;

    const relativeX = (e.clientX - parentRect.left) / scale;
    const relativeY = (e.clientY - parentRect.top) / scale;

    const size = (entity.size || 1) * gridSize;
    let newX = relativeX - (size / 2); 
    let newY = relativeY - (size / 2);

    if (!isAltPressed.current) {
        newX = Math.round(newX / gridSize) * gridSize;
        newY = Math.round(newY / gridSize) * gridSize;
    }

    elementRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
    elementRef.current.dataset.x = newX.toString();
    elementRef.current.dataset.y = newY.toString();
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (!isDragging.current || !elementRef.current) return;
    
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);

    const dist = Math.hypot(e.clientX - startMouse.current.x, e.clientY - startMouse.current.y);
    let finalX = parseFloat(elementRef.current.dataset.x || position.x.toString());
    let finalY = parseFloat(elementRef.current.dataset.y || position.y.toString());
    
    let gridX, gridY;

    if (isAltPressed.current) {
        gridX = finalX / gridSize;
        gridY = finalY / gridSize;
    } else {
        gridX = Math.round(finalX / gridSize);
        gridY = Math.round(finalY / gridSize);
        finalX = gridX * gridSize;
        finalY = gridY * gridSize;
    }

    if (dist > 5) {
        onMove(entity.id, gridX, gridY);
        setPosition({ x: finalX, y: finalY });
    } else {
        elementRef.current.style.transform = `translate(${position.x}px, ${position.y}px)`;
    }

    elementRef.current.style.zIndex = isActiveTurn ? '150' : (isSelected ? '100' : '10');
    elementRef.current.style.cursor = isDraggable ? 'grab' : 'pointer';
    elementRef.current.style.transition = 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)';
    elementRef.current.style.transform = `translate(${finalX}px, ${finalY}px)`;
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation(); 
      if (elementRef.current) {
          elementRef.current.style.filter = "brightness(1.5)";
      }
  };

  const handleDragLeave = () => {
      if (elementRef.current) {
          elementRef.current.style.filter = "none";
      }
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation(); 
      
      if (elementRef.current) elementRef.current.style.filter = "none";

      try {
          const data = e.dataTransfer.getData('application/json');
          if (data) {
              const parsed = JSON.parse(data);
              if (parsed.type === 'LOOT_DROP') {
                  onDropItemOnToken(parsed.item, parsed.sourceId, entity.id);
              }
          }
      } catch (err) {
          console.error("Drop falhou", err);
      }
  };

  const size = (entity.size || 1) * gridSize;
  const isDead = entity.hp <= 0;
  const isLoot = entity.type === 'loot'; 
  
  const isProne = entity.conditions?.includes('Prone') || entity.conditions?.includes('Unconscious');

  let ringColor = 'transparent';
  let glowEffect = 'none';

  if (isActiveTurn) {
      ringColor = '#facc15'; 
      glowEffect = '0 0 25px rgba(250, 204, 21, 0.8), inset 0 0 10px rgba(250, 204, 21, 0.5)';
  } else if (isAttacker) {
      ringColor = '#3b82f6'; 
      glowEffect = '0 0 15px rgba(59, 130, 246, 0.6)';
  } else if (isTarget) {
      ringColor = '#ef4444'; 
      glowEffect = '0 0 20px rgba(239, 68, 68, 0.7)';
  } else if (isSelected) {
      ringColor = '#ffffff'; 
      glowEffect = '0 0 10px rgba(255, 255, 255, 0.5)';
  }

  return (
    <div
      ref={elementRef}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, entity); }} 
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(e, entity); }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="absolute select-none"
      style={{
        top: 0, left: 0,
        width: size, height: size,
        transform: `translate(${position.x}px, ${position.y}px)`,
        zIndex: isActiveTurn ? 150 : (isSelected ? 100 : 10), 
        cursor: isDraggable ? 'grab' : 'pointer', // 👉 MUDA O CURSOR SE NÃO PUDER MOVER
        transition: isDragging.current ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
        willChange: 'transform'
      }}
    >
      {(isSelected || isTarget || isAttacker || isActiveTurn) && (
        <div 
            className={`absolute bottom-0 left-[10%] w-[80%] h-[30%] rounded-[100%] border-[2px] pointer-events-none transition-all duration-300 ${isActiveTurn ? 'animate-pulse' : ''}`}
            style={{ 
                borderColor: ringColor,
                boxShadow: glowEffect,
                backgroundColor: 'rgba(0,0,0,0.2)' 
            }}
        ></div>
      )}

      {!isDead && !isLoot && (
          <div className="absolute bottom-[5%] left-[20%] w-[60%] h-[20%] bg-black/50 blur-md rounded-[100%] pointer-events-none"></div>
      )}

      <div 
        className="absolute bottom-0 left-0 w-full h-[140%] flex items-end justify-center pointer-events-none"
        style={{
          transform: `rotate(${entity.rotation || 0}deg) scaleX(${entity.mirrored ? -1 : 1}) ${(isProne || isDead) ? 'rotate(90deg) scale(0.8)' : ''}`,
          transformOrigin: 'bottom center',
          transition: 'transform 0.2s ease-out',
          filter: isDead ? 'grayscale(100%) brightness(40%) contrast(150%)' : 'none' 
        }}
      >
        {entity.image ? (
          <img src={entity.image} alt={entity.name} className="max-w-full max-h-full object-contain object-bottom drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]" draggable={false} />
        ) : (
          <div className="w-[80%] h-[80%] mb-[10%] flex items-center justify-center rounded-full border-2 border-white shadow-lg" style={{ backgroundColor: entity.color }}>
            <span className="font-bold text-white drop-shadow-md text-lg">{entity.name.substring(0, 2).toUpperCase()}</span>
          </div>
        )}
      </div>

      {isDead && !isLoot && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <span className="text-[50px] drop-shadow-[0_0_10px_rgba(0,0,0,1)] filter grayscale">💀</span>
          </div>
      )}

      {entity.visible === false && (
        <div className="absolute top-0 -right-2 bg-black/90 rounded-full w-7 h-7 flex items-center justify-center text-sm text-cyan-400 border border-cyan-500/50 z-30 shadow-[0_0_8px_rgba(34,211,238,0.5)]">
            Ø
        </div>
      )}
      
      {!isLoot && (
          <div className="absolute left-1/2 pointer-events-none z-30 flex flex-col items-center"
               style={{ 
                   bottom: '145%', 
                   transform: `translateX(-50%) scale(${1/Math.max(scale, 0.5)})`, 
                   transformOrigin: 'bottom center' 
               }}>
            <div className="flex items-center bg-black/80 text-white text-[11px] px-2.5 py-1 rounded border border-white/20 shadow-[0_4px_4px_rgba(0,0,0,0.5)] backdrop-blur-sm gap-2 whitespace-nowrap">
                <span className="text-yellow-400 font-black border-r border-white/20 pr-2 mr-0.5 drop-shadow-md">
                    Nv.{entity.level || 1}
                </span>
                <span className="font-bold tracking-wide text-gray-100">
                    {entity.name}
                </span>
            </div>
            <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-black/80 mt-[-1px]"></div>
          </div>
      )}

      {entity.conditions && entity.conditions.length > 0 && !isDead && !isLoot && (
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none z-30 bg-black/50 px-2 py-1 rounded-full border border-white/10 backdrop-blur-md">
           {entity.conditions.map((c, index) => (
               <div 
                  key={`${c}-${index}`} 
                  className="w-5 h-5 flex items-center justify-center animate-bounce" 
                  style={{ animationDuration: '1.5s', animationDelay: `${index * 0.2}s` }}
                  title={c}
               >
                   <span className="text-[14px] drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">{CONDITIONS_ICONS[c] || '❓'}</span>
               </div>
           ))}
        </div>
      )}
    </div>
  );
};

export default Token;