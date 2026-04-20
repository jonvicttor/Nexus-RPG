import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Entity, Item } from '../App';

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

interface TokenProps {
  entity: Entity;
  gridSize: number;
  scale: number;
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
  isDraggable = true,
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
    onSelect(e, entity);
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
          elementRef.current.style.filter = "brightness(1.2)";
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
      } catch (err) {}
  };

  const size = (entity.size || 1) * gridSize;
  const isDead = entity.hp <= 0;
  const isLoot = entity.type === 'loot'; 
  
  const { filterStyle, isProne } = useMemo(() => {
      if (isDead) return { filterStyle: 'grayscale(100%) brightness(40%) contrast(150%)', isProne: true };
      
      const conds = entity.conditions || [];
      let currentFilter = '';
      let isTokenProne = false;

      if (conds.includes('Petrified')) currentFilter = 'grayscale(100%) contrast(120%)';
      if (conds.includes('Poisoned')) currentFilter += ' sepia(100%) hue-rotate(50deg) saturate(150%)';
      if (conds.includes('Blinded')) currentFilter += ' brightness(40%) contrast(120%)';
      if (conds.includes('Invisible')) currentFilter += ' opacity(30%) drop-shadow(0 0 5px rgba(255,255,255,0.5))';
      if (conds.includes('Frightened')) currentFilter += ' saturate(40%) hue-rotate(180deg)'; 

      if (conds.includes('Prone') || conds.includes('Unconscious')) isTokenProne = true;

      return { filterStyle: currentFilter.trim() || 'none', isProne: isTokenProne };
  }, [entity.conditions, isDead]);

  let ringColor = 'transparent';
  let glowEffect = 'none';
  if (isActiveTurn) { ringColor = '#facc15'; glowEffect = '0 0 25px rgba(250, 204, 21, 0.8)'; }
  else if (isAttacker) { ringColor = '#3b82f6'; glowEffect = '0 0 15px rgba(59, 130, 246, 0.6)'; }
  else if (isTarget) { ringColor = '#ef4444'; glowEffect = '0 0 20px rgba(239, 68, 68, 0.7)'; }
  else if (isSelected) { ringColor = '#ffffff'; glowEffect = '0 0 10px rgba(255, 255, 255, 0.5)'; }

  const renderConditionAura = () => {
      const conds = entity.conditions || [];
      if (isDead || isLoot) return null;

      if (conds.includes('Paralyzed') || conds.includes('Stunned')) {
          return (
              <div className="absolute inset-[-10%] rounded-full pointer-events-none animate-ping opacity-75 border-2 border-yellow-400 mix-blend-screen" style={{ animationDuration: '2s' }}></div>
          );
      }
      if (conds.includes('Grappled') || conds.includes('Restrained')) {
          return (
              <div className="absolute inset-[-5%] rounded-full pointer-events-none border-[4px] border-orange-600/80 border-dashed animate-[spin_10s_linear_infinite]"></div>
          );
      }
      if (conds.includes('Charmed')) {
          return (
              <div className="absolute inset-[-20%] rounded-full pointer-events-none bg-pink-500/20 blur-md animate-pulse mix-blend-screen"></div>
          );
      }
      return null;
  };

  return (
    <>
      {entity.conditions?.includes('Frightened') && (
          <style>{`
              @keyframes token-shiver {
                  0%, 100% { transform: translate(0, 0) rotate(0deg); }
                  25% { transform: translate(-1px, 1px) rotate(-1deg); }
                  50% { transform: translate(1px, -1px) rotate(1deg); }
                  75% { transform: translate(-1px, -1px) rotate(-1deg); }
              }
              .animate-token-shiver {
                  animation: token-shiver 0.4s infinite ease-in-out;
              }
          `}</style>
      )}

      {/* RAIZ DO TOKEN */}
      <div
        ref={elementRef}
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, entity); }} 
        onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); onDoubleClick(e, entity); }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="absolute select-none token"
        style={{
          top: 0, left: 0,
          width: size, height: size,
          transform: `translate(${position.x}px, ${position.y}px)`,
          zIndex: isActiveTurn ? 150 : (isSelected ? 100 : 10), 
          cursor: isDraggable ? 'grab' : 'pointer',
          transition: isDragging.current ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)'
          // 👉 REMOVIDO o willChange: 'transform' que quebrava a resolução!
        }}
      >
        {renderConditionAura()}

        {/* Círculo Mágico Base Centralizado */}
        {(isSelected || isTarget || isAttacker || isActiveTurn) && (
          <div className={`absolute inset-[-5%] rounded-[100%] border-[3px] pointer-events-none transition-all duration-300 ${isActiveTurn ? 'animate-pulse' : ''}`} style={{ borderColor: ringColor, boxShadow: glowEffect, backgroundColor: 'rgba(0,0,0,0.2)' }}></div>
        )}

        {/* Sombra de Chão Centralizada */}
        {!isDead && !isLoot && (
            <div className="absolute inset-[15%] bg-black/60 blur-md rounded-full pointer-events-none"></div>
        )}

        {/* Rotação Top-Down a partir do CENTRO EXATO (origin-center) */}
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none origin-center"
          style={{
            transform: `rotate(${entity.rotation || 0}deg) scaleX(${entity.mirrored ? -1 : 1}) ${isProne ? 'rotate(90deg) scale(0.8)' : ''}`,
            transition: 'transform 0.3s ease-out, filter 0.5s ease-in-out',
            filter: filterStyle 
          }}
        >
            <div className={`w-full h-full flex items-center justify-center origin-center ${entity.conditions?.includes('Frightened') ? 'animate-token-shiver' : ''}`}>
                <div className={`w-full h-full flex items-center justify-center origin-center ${entity.conditions?.includes('Poisoned') ? 'animate-pulse' : ''}`}>
                    {entity.image ? (
                        <img 
                        src={entity.image} 
                        alt={entity.name} 
                        className="w-full h-full object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)]" 
                        draggable={false} 
                        />
                    ) : (
                        <div className="w-[80%] h-[80%] flex items-center justify-center rounded-full border-2 border-white shadow-lg" style={{ backgroundColor: entity.color }}>
                        <span className="font-bold text-white drop-shadow-md text-lg">{entity.name.substring(0, 2).toUpperCase()}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {isDead && !isLoot && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <span className="text-[50px] drop-shadow-[0_0_10px_rgba(0,0,0,1)] filter grayscale">💀</span>
            </div>
        )}

        {entity.visible === false && (
          <div className="absolute top-0 -right-2 bg-black/90 rounded-full w-7 h-7 flex items-center justify-center text-sm text-cyan-400 border border-cyan-500/50 z-30 shadow-[0_0_8px_rgba(34,211,238,0.5)]">Ø</div>
        )}
        
        {/* Placa de Nome reajustada para acompanhar o formato centrado */}
        {!isLoot && (
            <div className="absolute left-1/2 pointer-events-none z-30 flex flex-col items-center"
                 style={{ bottom: '110%', transform: `translateX(-50%) scale(${1/Math.max(scale, 0.5)})`, transformOrigin: 'bottom center' }}>
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
    </>
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
  myCharacterId?: number;
  onMoveToken: (id: number, x: number, y: number) => void;
  onSelectToken: (entity: Entity, multi?: boolean) => void;
  onTokenContextMenu: (e: React.MouseEvent, entity: Entity) => void;
  onTokenDoubleClick: (entity: Entity, multi?: boolean) => void; 
  onGiveItemToToken: (item: Item, sourceId: number, targetId: number) => void;
}

const TokenLayer: React.FC<TokenLayerProps> = ({
  entities, gridSize, offset, scale, role,
  activeTurnId, attackerId, targetEntityIds, myCharacterId,
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
              newTexts.push({ id: Math.random().toString(), text: diff > 0 ? `+${diff}` : `${diff}`, type: diff > 0 ? 'heal' : 'damage', x: ent.x, y: ent.y, size: ent.size || 1 });
          }
          prevHpRef.current[ent.id] = ent.hp; 
      });

      if (newTexts.length > 0) {
          setFloatingTexts(prev => [...prev, ...newTexts]);
          setTimeout(() => { setFloatingTexts(prev => prev.filter(ft => !newTexts.find(n => n.id === ft.id))); }, 1500);
      }
  }, [entities]); 

  return (
    <div 
        className="absolute top-0 left-0 w-0 h-0 pointer-events-none overflow-visible"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: 'top left' }}
    >
        <style>{`
            @keyframes zap {
                0%, 100% { border-color: transparent; box-shadow: none; }
                50% { border-color: #fde047; box-shadow: 0 0 20px #eab308, inset 0 0 15px #ca8a04; }
            }
            .animate-zap { animation: zap 0.15s infinite; }
        `}</style>

        {floatingTexts.map(ft => (
            <FloatingNumber key={ft.id} text={ft.text} type={ft.type} x={ft.x} y={ft.y} size={ft.size} gridSize={gridSize} />
        ))}

        {entities.map(entity => {
            if (role === 'PLAYER' && entity.visible === false) return null;

            const isMyTurn = activeTurnId === entity.id;
            const canMove = role === 'DM' || entity.id === myCharacterId;
            
            const conds = entity.conditions || [];
            const isIncapacitated = conds.includes('Incapacitated');
            const isStunned = conds.includes('Stunned');
            const isUnconscious = conds.includes('Unconscious');
            const isParalyzed = conds.includes('Paralyzed');
            const isDead = entity.hp <= 0;

            return (
                <div key={entity.id} className="pointer-events-auto relative">
                    {isMyTurn && (
                        <div className="absolute pointer-events-none z-0 flex items-center justify-center mix-blend-screen" style={{ left: entity.x * gridSize, top: entity.y * gridSize, width: (entity.size || 1) * gridSize, height: (entity.size || 1) * gridSize }}>
                            <div className="absolute inset-[-20%] rounded-full bg-yellow-500/30 animate-pulse blur-md"></div>
                            <div className="absolute inset-[-30%] rounded-full border-2 border-dashed border-yellow-400/60 animate-[spin_10s_linear_infinite] drop-shadow-[0_0_10px_#facc15]"></div>
                        </div>
                    )}

                    {!isDead && isParalyzed && (
                        <div className="absolute pointer-events-none z-0 flex items-center justify-center" style={{ left: entity.x * gridSize, top: entity.y * gridSize, width: (entity.size || 1) * gridSize, height: (entity.size || 1) * gridSize }}>
                            <div className="absolute inset-[-10%] rounded-full border-4 border-dashed animate-zap mix-blend-screen shadow-[0_0_20px_#eab308]"></div>
                        </div>
                    )}

                    <Token
                        entity={entity}
                        gridSize={gridSize}
                        scale={scale}
                        isDraggable={canMove}
                        isSelected={false} 
                        isTarget={targetEntityIds.includes(entity.id)}
                        isAttacker={attackerId === entity.id}
                        isActiveTurn={isMyTurn}
                        onMove={(id, x, y) => { if (canMove) { onMoveToken(id, x, y); } }}
                        onSelect={(e, ent) => onSelectToken(ent, e.shiftKey || e.ctrlKey)}
                        onContextMenu={onTokenContextMenu}
                        onDoubleClick={(e, ent) => onTokenDoubleClick(ent, e.shiftKey || e.ctrlKey)}
                        onDropItemOnToken={onGiveItemToToken}
                    />

                    {!isDead && isStunned && (
                        <div className="absolute pointer-events-none z-30 flex items-center justify-center" style={{ left: entity.x * gridSize, top: entity.y * gridSize, width: (entity.size || 1) * gridSize, height: (entity.size || 1) * gridSize }}>
                            <span className="absolute -top-6 text-3xl animate-bounce drop-shadow-[0_2px_4px_black]">💫</span>
                        </div>
                    )}

                    {!isDead && isIncapacitated && !isStunned && !isUnconscious && !isParalyzed && !conds.includes('Petrified') && (
                        <div className="absolute pointer-events-none z-30 flex items-center justify-center" style={{ left: entity.x * gridSize, top: entity.y * gridSize, width: (entity.size || 1) * gridSize, height: (entity.size || 1) * gridSize }}>
                            <span className="absolute -top-4 text-2xl animate-spin drop-shadow-[0_2px_4px_black]">🌀</span>
                        </div>
                    )}

                    {!isDead && isUnconscious && (
                        <div className="absolute pointer-events-none z-30 flex items-center justify-center" style={{ left: entity.x * gridSize, top: entity.y * gridSize, width: (entity.size || 1) * gridSize, height: (entity.size || 1) * gridSize }}>
                            <span className="absolute -top-6 -right-2 text-2xl animate-pulse drop-shadow-[0_2px_4px_black]">💤</span>
                        </div>
                    )}
                </div>
            );
        })}
    </div>
  );
};

export default TokenLayer;