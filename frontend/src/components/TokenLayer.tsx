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
  
  // 👉 ADICIONADO: Precisamos saber quem é o jogador logado!
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
        <style>{`
            @keyframes jitter {
                0% { transform: translate(1px, 1px) rotate(0deg); }
                10% { transform: translate(-1px, -2px) rotate(-1deg); }
                20% { transform: translate(-3px, 0px) rotate(1deg); }
                30% { transform: translate(3px, 2px) rotate(0deg); }
                40% { transform: translate(1px, -1px) rotate(1deg); }
                50% { transform: translate(-1px, 2px) rotate(-1deg); }
                60% { transform: translate(-3px, 1px) rotate(0deg); }
                70% { transform: translate(3px, 1px) rotate(-1deg); }
                80% { transform: translate(-1px, -1px) rotate(1deg); }
                90% { transform: translate(1px, 2px) rotate(0deg); }
                100% { transform: translate(1px, -2px) rotate(-1deg); }
            }
            .animate-jitter {
                animation: jitter 0.3s infinite;
            }
            @keyframes zap {
                0%, 100% { border-color: transparent; box-shadow: none; }
                50% { border-color: #fde047; box-shadow: 0 0 20px #eab308, inset 0 0 15px #ca8a04; }
            }
            .animate-zap {
                animation: zap 0.15s infinite;
            }
        `}</style>

        {floatingTexts.map(ft => (
            <FloatingNumber key={ft.id} text={ft.text} type={ft.type} x={ft.x} y={ft.y} size={ft.size} gridSize={gridSize} />
        ))}

        {entities.map(entity => {
            if (role === 'PLAYER' && entity.visible === false) return null;

            const isMyTurn = activeTurnId === entity.id;
            
            // 👉 LÓGICA DE BLOQUEIO DE MOVIMENTO (TRAVA DE ADAMANTIUM)
            const canMove = role === 'DM' || entity.id === myCharacterId;
            
            const conds = entity.conditions || [];
            const isInvisible = conds.includes('Invisible');
            const isPoisoned = conds.includes('Poisoned');
            const isStunned = conds.includes('Stunned');
            const isCharmed = conds.includes('Charmed');
            const isFrightened = conds.includes('Frightened');
            const isPetrified = conds.includes('Petrified');
            const isParalyzed = conds.includes('Paralyzed');
            const isBlinded = conds.includes('Blinded');
            const isDeafened = conds.includes('Deafened');
            const isExhaustion = conds.includes('Exhaustion');
            const isGrappled = conds.includes('Grappled');
            const isIncapacitated = conds.includes('Incapacitated');
            const isRestrained = conds.includes('Restrained');
            const isUnconscious = conds.includes('Unconscious');
            const isDead = entity.hp <= 0;

            let tokenOpacity = 1;
            let filter = 'none';
            let extraClasses = "relative z-10 transition-all duration-500 ease-in-out";

            if (isInvisible) {
                tokenOpacity = role === 'DM' ? 0.4 : 0.15; 
                filter = 'grayscale(30%) sepia(50%) hue-rotate(180deg)'; 
            }
            
            if (isDead) {
                filter = 'grayscale(100%) brightness(40%) drop-shadow(0 0 5px black)';
            } else if (isPetrified) {
                filter = 'grayscale(100%) contrast(130%) brightness(80%) drop-shadow(0 0 10px rgba(0,0,0,0.8))';
            } else if (isPoisoned) {
                filter = 'sepia(100%) hue-rotate(60deg) saturate(300%)'; 
            } else if (isExhaustion) {
                filter = 'sepia(40%) saturate(60%) brightness(75%)';
            }

            if (isFrightened && !isDead && !isPetrified && !isParalyzed) {
                extraClasses += " animate-jitter";
            }

            return (
                <div key={entity.id} className="pointer-events-auto relative">
                    
                    {isMyTurn && (
                        <div 
                            className="absolute pointer-events-none z-0 flex items-center justify-center mix-blend-screen"
                            style={{ left: entity.x * gridSize, top: entity.y * gridSize, width: (entity.size || 1) * gridSize, height: (entity.size || 1) * gridSize }}
                        >
                            <div className="absolute inset-[-20%] rounded-full bg-yellow-500/30 animate-pulse blur-md"></div>
                            <div className="absolute inset-[-30%] rounded-full border-2 border-dashed border-yellow-400/60 animate-[spin_10s_linear_infinite] drop-shadow-[0_0_10px_#facc15]"></div>
                            <div className="absolute inset-[-10%] rounded-full border-[3px] border-dotted border-yellow-500/80 animate-[spin_6s_linear_infinite_reverse]"></div>
                        </div>
                    )}

                    {!isDead && isCharmed && (
                        <div 
                            className="absolute pointer-events-none z-0 flex items-center justify-center"
                            style={{ left: entity.x * gridSize, top: entity.y * gridSize, width: (entity.size || 1) * gridSize, height: (entity.size || 1) * gridSize }}
                        >
                            <div className="absolute inset-[-15%] rounded-full border-[3px] border-pink-400/70 animate-ping mix-blend-screen"></div>
                        </div>
                    )}

                    {!isDead && isFrightened && (
                        <div 
                            className="absolute pointer-events-none z-0 flex items-center justify-center"
                            style={{ left: entity.x * gridSize, top: entity.y * gridSize, width: (entity.size || 1) * gridSize, height: (entity.size || 1) * gridSize }}
                        >
                            <div className="absolute inset-[-25%] rounded-full bg-indigo-700/40 blur-md animate-pulse"></div>
                        </div>
                    )}

                    {!isDead && isParalyzed && (
                        <div 
                            className="absolute pointer-events-none z-0 flex items-center justify-center"
                            style={{ left: entity.x * gridSize, top: entity.y * gridSize, width: (entity.size || 1) * gridSize, height: (entity.size || 1) * gridSize }}
                        >
                            <div className="absolute inset-[-10%] rounded-full border-4 border-dashed animate-zap mix-blend-screen shadow-[0_0_20px_#eab308]"></div>
                        </div>
                    )}

                    {!isDead && isPoisoned && (
                        <div 
                            className="absolute pointer-events-none z-0 flex items-center justify-center"
                            style={{ left: entity.x * gridSize, top: entity.y * gridSize, width: (entity.size || 1) * gridSize, height: (entity.size || 1) * gridSize }}
                        >
                            <div className="absolute inset-[-10%] rounded-full bg-green-500/30 animate-pulse blur-lg"></div>
                            <div className="absolute inset-0 rounded-full border border-green-400/50 animate-ping"></div>
                        </div>
                    )}

                    <div className={extraClasses} style={{ opacity: tokenOpacity, filter: filter }}>
                        
                        {!isDead && isBlinded && (
                            <div className="absolute inset-0 rounded-full bg-black/60 z-20 pointer-events-none shadow-[inset_0_0_15px_black]"></div>
                        )}

                        {!isDead && isGrappled && !isRestrained && (
                            <div className="absolute inset-[5%] rounded-full border-[4px] border-dashed border-orange-600/90 z-20 pointer-events-none shadow-[inset_0_0_10px_#ea580c]"></div>
                        )}

                        {!isDead && isRestrained && (
                            <div className="absolute inset-[-2%] rounded-full border-[6px] border-double border-red-700/90 z-20 pointer-events-none shadow-[inset_0_0_15px_#b91c1c]"></div>
                        )}

                        {!isDead && isDeafened && (
                            <div className="absolute inset-[-5%] rounded-full border-2 border-dotted border-gray-400/80 z-20 pointer-events-none animate-[spin_8s_linear_infinite]"></div>
                        )}

                        <Token
                            entity={entity}
                            gridSize={gridSize}
                            scale={scale}
                            
                            // 👉 Repassamos a variável de controle caso o Token em si possua uma trava interna
                            isDraggable={canMove}
                            
                            isSelected={false} 
                            isTarget={targetEntityIds.includes(entity.id)}
                            isAttacker={attackerId === entity.id}
                            isActiveTurn={isMyTurn}
                            
                            // 👉 BLOQUEIO APLICADO NO CALLBACK DE MOVIMENTO
                            onMove={(id, x, y) => {
                                if (canMove) {
                                    onMoveToken(id, x, y);
                                }
                            }}
                            
                            onSelect={(e, ent) => onSelectToken(ent, e.shiftKey || e.ctrlKey)}
                            onContextMenu={onTokenContextMenu}
                            onDoubleClick={(e, ent) => onTokenDoubleClick(ent, e.shiftKey || e.ctrlKey)}
                            onDropItemOnToken={onGiveItemToToken}
                        />
                    </div>

                    {!isDead && isStunned && (
                        <div 
                            className="absolute pointer-events-none z-30 flex items-center justify-center"
                            style={{ left: entity.x * gridSize, top: entity.y * gridSize, width: (entity.size || 1) * gridSize, height: (entity.size || 1) * gridSize }}
                        >
                            <span className="absolute -top-6 text-3xl animate-bounce drop-shadow-[0_2px_4px_black]">💫</span>
                        </div>
                    )}

                    {!isDead && isIncapacitated && !isStunned && !isUnconscious && !isParalyzed && !isPetrified && (
                        <div 
                            className="absolute pointer-events-none z-30 flex items-center justify-center"
                            style={{ left: entity.x * gridSize, top: entity.y * gridSize, width: (entity.size || 1) * gridSize, height: (entity.size || 1) * gridSize }}
                        >
                            <span className="absolute -top-4 text-2xl animate-spin drop-shadow-[0_2px_4px_black]">🌀</span>
                        </div>
                    )}

                    {!isDead && isUnconscious && (
                        <div 
                            className="absolute pointer-events-none z-30 flex items-center justify-center"
                            style={{ left: entity.x * gridSize, top: entity.y * gridSize, width: (entity.size || 1) * gridSize, height: (entity.size || 1) * gridSize }}
                        >
                            <span className="absolute -top-6 -right-2 text-2xl animate-pulse drop-shadow-[0_2px_4px_black]">💤</span>
                        </div>
                    )}

                    {entity.type !== 'loot' && entity.classType !== 'Item' && (
                        <div 
                            className="absolute pointer-events-none z-[25] flex items-center justify-center"
                            style={{
                                left: entity.x * gridSize,
                                top: entity.y * gridSize,
                                width: (entity.size || 1) * gridSize,
                                height: (entity.size || 1) * gridSize,
                            }}
                        >
                            <div className="w-1.5 h-1.5 bg-white/80 rounded-full shadow-[0_0_5px_black]"></div>
                        </div>
                    )}
                </div>
            );
        })}
    </div>
  );
};

export default TokenLayer;