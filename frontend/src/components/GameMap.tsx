import React, { useState, useCallback, useEffect, useRef } from 'react';
import CanvasMap, { AoEData } from './CanvasMap'; 
import TokenLayer from './TokenLayer';
import { Entity, Item } from '../App';
import { Keyboard, X } from 'lucide-react'; 
import socket from '../services/socket'; 

export interface MapPing {
  id: string;
  x: number;
  y: number;
  color: string;
}

interface GameMapProps {
  mapUrl: string;
  gridSize?: number;
  entities: Entity[];
  role: 'DM' | 'PLAYER';
  fogGrid: boolean[][];
  isFogMode: boolean;
  fogTool: 'reveal' | 'hide';
  onFogUpdate: (x: number, y: number, shouldReveal: boolean) => void;
  
  fogShape?: 'brush' | 'rect' | 'line';
  onFogBulkUpdate?: (cells: {x: number, y: number}[], shouldReveal: boolean) => void;

  activeTurnId: number | null; 
  onMoveToken: (id: number, x: number, y: number) => void;
  onAddToken?: (type: string, x: number, y: number) => void; 
  onRotateToken: (id: number, angle: number) => void;
  onResizeToken: (id: number, size: number) => void;
  onTokenDoubleClick: (entity: Entity, multi?: boolean) => void; 
  targetEntityIds: number[]; 
  attackerId: number | null;
  onSetTarget: (id: number | number[] | null, multiSelect?: boolean) => void;
  onSetAttacker: (id: number | null) => void;
  onFlipToken: (id: number) => void; 
  activeAoE: 'circle' | 'cone' | 'cube' | null;
  onAoEComplete: () => void;
  aoeColor: string;
  onSelectEntity: (entity: Entity, x: number, y: number) => void;
  externalOffset?: { x: number, y: number };
  externalScale?: number;
  onMapChange?: (offset: { x: number, y: number }, scale: number) => void;
  focusEntity?: Entity | null;
  globalBrightness?: number; 
  
  onDropItem?: (item: Item, sourceId: number, x: number, y: number) => void;
  onGiveItemToToken?: (item: Item, sourceId: number, targetId: number) => void;
  onContextMenu?: (e: React.MouseEvent, entity: Entity) => void;
  
  pings?: MapPing[];
  onPing?: (x: number, y: number) => void;
}

const GameMap: React.FC<GameMapProps> = (props) => {
    const { 
        mapUrl, gridSize = 70, entities, role, fogGrid, isFogMode, fogTool,
        fogShape, onFogBulkUpdate,
        activeTurnId, onFogUpdate, onMoveToken, onAddToken, onRotateToken,
        onResizeToken, targetEntityIds, attackerId, onTokenDoubleClick,
        onSetTarget, onSetAttacker, onFlipToken, activeAoE, onAoEComplete,
        aoeColor, onSelectEntity, externalOffset, externalScale, onMapChange,
        focusEntity, globalBrightness, onDropItem, onGiveItemToToken,
        onContextMenu, pings = [], onPing 
    } = props;

    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [scale, setScale] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);
    
    const [showShortcuts, setShowShortcuts] = useState(false);

    const targetIdsRef = useRef<number[]>([]);
    const attackerIdRef = useRef<number | null>(null);

    const [isMeasuring, setIsMeasuring] = useState(false);
    const [rulerStart, setRulerStart] = useState<{ x: number, y: number } | null>(null);
    const [rulerEnd, setRulerEnd] = useState<{ x: number, y: number, distance: number, isCapped: boolean } | null>(null);
    
    const [isRulerKeyHeld, setIsRulerKeyHeld] = useState(false);
    const isMeasuringMode = useRef<'free' | 'movement' | null>(null);

    const isPanning = useRef(false);
    const panStartPos = useRef({ x: 0, y: 0 });
    const offsetOnPanStart = useRef({ x: 0, y: 0 });
    
    const isMapMouseDown = useRef(false);
    const mapMouseDownPos = useRef({ x: 0, y: 0 });

    const [combatAnimation, setCombatAnimation] = useState<{
        attackerName: string;
        targetId: number;
        attackType: string;
        id: string; 
    } | null>(null);

    // Refs para acessar os valores atuais dentro dos event listeners sem closures antigas
    const scaleRef = useRef(scale);
    const offsetRef = useRef(offset);
    
    useEffect(() => {
        scaleRef.current = scale;
        offsetRef.current = offset;
    }, [scale, offset]);

    useEffect(() => { targetIdsRef.current = targetEntityIds; }, [targetEntityIds]);
    useEffect(() => { attackerIdRef.current = attackerId; }, [attackerId]);

    useEffect(() => {
        const handleCombatAnimation = (data: any) => {
            const targetExists = entities.some(e => e.id === data.targetId);
            if (targetExists) {
                setCombatAnimation({
                    attackerName: data.attackerName,
                    targetId: data.targetId,
                    attackType: data.attackType,
                    id: Date.now().toString()
                });

                setTimeout(() => {
                    setCombatAnimation(null);
                }, 1500);
            }
        };

        socket.on('triggerCombatAnimation', handleCombatAnimation);
        return () => {
            socket.off('triggerCombatAnimation', handleCombatAnimation);
        };
    }, [entities]);

    useEffect(() => {
        if (role === 'PLAYER' && externalOffset && externalScale) {
            setOffset(externalOffset);
            setScale(externalScale);
        }
    }, [externalOffset, externalScale, role]);

    useEffect(() => {
        if (focusEntity) {
            const screenW = window.innerWidth;
            const screenH = window.innerHeight;
            const entityX = focusEntity.x * gridSize;
            const entityY = focusEntity.y * gridSize;
            const newOffsetX = (screenW / 2) - (entityX * scale);
            const newOffsetY = (screenH / 2) - (entityY * scale);
            setOffset({ x: newOffsetX, y: newOffsetY });
        }
    }, [focusEntity, scale, gridSize]);

    const handleMapTransform = useCallback((newOffset: {x: number, y: number}, newScale: number) => {
        setOffset(newOffset);
        setScale(newScale);
        if (role === 'DM' && onMapChange) {
            onMapChange(newOffset, newScale);
        }
    }, [role, onMapChange]);

    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            const key = e.key.toLowerCase();
            
            if (key === 'm' && !isMeasuringMode.current) { 
                isMeasuringMode.current = 'free'; 
                setIsRulerKeyHeld(true);
            }
            if (key === 'n' && !isMeasuringMode.current) { 
                isMeasuringMode.current = 'movement'; 
                setIsRulerKeyHeld(true);
            }
            
            if (e.key === 'Escape') {
                if (activeAoE) onAoEComplete();
                if (targetEntityIds.length > 0) onSetTarget(null);
                if (attackerId !== null) onSetAttacker(null);
                if (isMeasuring) {
                    setIsMeasuring(false);
                    setRulerStart(null);
                    setRulerEnd(null);
                }
            }

            if (role !== 'DM') return;
            
            if (e.key.toLowerCase() === 'f') {
                const primaryTarget = attackerIdRef.current !== null ? attackerIdRef.current : targetIdsRef.current[0];
                if (primaryTarget) {
                    onFlipToken(primaryTarget);
                }
            }
        };

        const handleGlobalKeyUp = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if ((key === 'm' || key === 'n')) {
                isMeasuringMode.current = null;
                setIsRulerKeyHeld(false);
                if (isMeasuring) {
                    setIsMeasuring(false);
                    setRulerStart(null);
                    setRulerEnd(null);
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        window.addEventListener('keyup', handleGlobalKeyUp);
        
        return () => { 
            window.removeEventListener('keydown', handleGlobalKeyDown); 
            window.removeEventListener('keyup', handleGlobalKeyUp); 
        };
    }, [role, entities, onFlipToken, isMeasuring, activeAoE, targetEntityIds, attackerId, onAoEComplete, onSetTarget, onSetAttacker]);

    // 👉 ZOOM SUPREMO COM SCROLL NO MOUSE
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault(); 
            
            if (e.shiftKey || e.altKey) {
                if (role !== 'DM') return;
                const primaryTarget = attackerIdRef.current !== null ? attackerIdRef.current : targetIdsRef.current[0];
                if (!primaryTarget) return;

                const entity = entities.find(ent => ent.id === primaryTarget);
                if (entity) {
                    if (e.shiftKey) onRotateToken(primaryTarget, (entity.rotation || 0) + (e.deltaY > 0 ? 15 : -15));
                    if (e.altKey) onResizeToken(primaryTarget, parseFloat(Math.max(0.1, (entity.size || 1) + (e.deltaY > 0 ? -0.1 : 0.1)).toFixed(1)));
                }
                return;
            }

            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const currentScale = scaleRef.current;
            const currentOffset = offsetRef.current;

            // Determina onde o mouse está no "mundo real" do mapa antes do zoom
            const worldX = (mouseX - currentOffset.x) / currentScale;
            const worldY = (mouseY - currentOffset.y) / currentScale;

            // Aplica o zoom
            const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
            let newScale = currentScale * zoomFactor;
            newScale = Math.min(Math.max(0.2, newScale), 5); // Aumentado o zoom in máximo para 5x

            if (newScale === currentScale) return;

            // Reposiciona o mapa para que o "mundo real" continue exatamente embaixo do ponteiro
            const newOffsetX = mouseX - (worldX * newScale);
            const newOffsetY = mouseY - (worldY * newScale);

            const newOffset = { x: newOffsetX, y: newOffsetY };

            setScale(newScale);
            setOffset(newOffset);
            
            if (role === 'DM' && onMapChange) {
                onMapChange(newOffset, newScale);
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [role, entities, onRotateToken, onResizeToken, onMapChange]);


    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); 
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = (mouseX - offset.x) / scale;
        const worldY = (mouseY - offset.y) / scale;
        const gridX = Math.floor(worldX / gridSize);
        const gridY = Math.floor(worldY / gridSize);

        try {
            const data = e.dataTransfer.getData('application/json');
            if (data) {
                const parsed = JSON.parse(data);
                if (parsed.type === 'LOOT_DROP' && onDropItem) {
                    onDropItem(parsed.item, parsed.sourceId, gridX, gridY);
                    return; 
                }
            }
        } catch (err) {}

        const entityType = e.dataTransfer.getData("entityType");
        if (entityType && onAddToken) {
            onAddToken(entityType, gridX, gridY);
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        const isToolActive = isFogMode || activeAoE || isMeasuringMode.current !== null || e.altKey;

        // Se usar qualquer botão e não houver ferramenta, arrasta o mapa
        if (e.button === 1 || e.button === 2 || (e.button === 0 && !isToolActive)) {
            e.preventDefault();
            isPanning.current = true;
            panStartPos.current = { x: e.clientX, y: e.clientY };
            offsetOnPanStart.current = { ...offset };
            if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
            return;
        }
        
        if (e.button !== 0 && e.button !== 2) return;
        
        isMapMouseDown.current = true;
        mapMouseDownPos.current = { x: e.clientX, y: e.clientY };

        if (isMeasuringMode.current !== null && e.button === 0) { 
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            setIsMeasuring(true);
            setRulerStart({ x: mouseX, y: mouseY });
            setRulerEnd({ x: mouseX, y: mouseY, distance: 0, isCapped: false });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning.current) {
            const dx = e.clientX - panStartPos.current.x;
            const dy = e.clientY - panStartPos.current.y;
            
            const newOffset = {
                x: offsetOnPanStart.current.x + dx,
                y: offsetOnPanStart.current.y + dy
            };

            setOffset(newOffset);
            if (role === 'DM' && onMapChange) onMapChange(newOffset, scale);
            return;
        }

        if (isMeasuring && rulerStart) {
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const dx = mouseX - rulerStart.x;
            const dy = mouseY - rulerStart.y;
            const rawDistancePx = Math.hypot(dx, dy);
            
            const distSquares = rawDistancePx / (gridSize * scale);
            const currentMeters = distSquares * 1.5;
            
            let finalX = mouseX;
            let finalY = mouseY;
            let isCapped = false;

            if (isMeasuringMode.current === 'movement' && currentMeters > 9) {
                isCapped = true;
                const maxSquares = 9 / 1.5; 
                const maxPx = maxSquares * (gridSize * scale);
                
                const angle = Math.atan2(dy, dx);
                finalX = rulerStart.x + Math.cos(angle) * maxPx;
                finalY = rulerStart.y + Math.sin(angle) * maxPx;
            }

            setRulerEnd({ 
                x: finalX, 
                y: finalY, 
                distance: isCapped ? 9.0 : currentMeters, 
                isCapped 
            });
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (isPanning.current) {
            isPanning.current = false;
            if (containerRef.current) containerRef.current.style.cursor = activeAoE ? 'crosshair' : (isFogMode ? 'cell' : 'grab');
            return;
        }

        if (isMeasuring) {
            setIsMeasuring(false);
            setRulerStart(null);
            setRulerEnd(null);
        }

        if (!isMapMouseDown.current) return;
        isMapMouseDown.current = false;

        const dist = Math.hypot(e.clientX - mapMouseDownPos.current.x, e.clientY - mapMouseDownPos.current.y);
        
        if (dist < 5) {
            if (e.altKey && onPing) {
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect) return;
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const worldX = (mouseX - offset.x) / scale;
                const worldY = (mouseY - offset.y) / scale;
                onPing(worldX, worldY);
            } 
        }
    };

    const handleAoECompleted = (data?: AoEData) => {
        if (role !== 'DM' || !data) return;

        const capturedTargets: number[] = [];

        entities.forEach(ent => {
            if (ent.classType === 'Item' || ent.type === 'loot' || ent.visible === false) return;

            const sizeInPixels = (ent.size || 1) * gridSize;
            const entCenterX = (ent.x * gridSize) + (sizeInPixels / 2);
            const entCenterY = (ent.y * gridSize) + (sizeInPixels / 2);

            let isInside = false;

            if (data.type === 'circle') {
                const midX = (data.startX + data.endX) / 2;
                const midY = (data.startY + data.endY) / 2;
                const radius = Math.hypot(data.endX - data.startX, data.endY - data.startY) / 2;
                const distance = Math.hypot(entCenterX - midX, entCenterY - midY);
                if (distance <= radius) isInside = true;
            } 
            else if (data.type === 'cube') {
                const sideX = data.endX - data.startX;
                const sideY = data.endY - data.startY;
                const s = Math.max(Math.abs(sideX), Math.abs(sideY));
                const dirX = sideX >= 0 ? 1 : -1;
                const dirY = sideY >= 0 ? 1 : -1;
                
                const minX = Math.min(data.startX, data.startX + s * dirX);
                const maxX = Math.max(data.startX, data.startX + s * dirX);
                const minY = Math.min(data.startY, data.startY + s * dirY);
                const maxY = Math.max(data.startY, data.startY + s * dirY);

                if (entCenterX >= minX && entCenterX <= maxX && entCenterY >= minY && entCenterY <= maxY) {
                    isInside = true;
                }
            }
            else if (data.type === 'cone') {
                const radius = Math.hypot(data.endX - data.startX, data.endY - data.startY);
                const distanceToTarget = Math.hypot(entCenterX - data.startX, entCenterY - data.startY);
                
                if (distanceToTarget <= radius) {
                    const angleToToken = Math.atan2(entCenterY - data.startY, entCenterX - data.startX);
                    const angleToMouse = Math.atan2(data.endY - data.startY, data.endX - data.startX);
                    let angleDiff = angleToToken - angleToMouse;
                    while (angleDiff <= -Math.PI) angleDiff += Math.PI * 2;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                    if (Math.abs(angleDiff) <= Math.PI / 6) {
                        isInside = true;
                    }
                }
            }

            if (isInside) capturedTargets.push(ent.id);
        });

        if (capturedTargets.length > 0) {
            onSetTarget(capturedTargets, false); 
        } else {
            onSetTarget(null); 
        }
    };

    return (
        <div 
            ref={containerRef}
            className={`w-full h-full bg-[#1a1a1a] overflow-hidden relative transition-colors ${activeAoE ? 'cursor-crosshair' : (isFogMode ? 'cursor-cell' : 'cursor-grab')}`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp} 
            onContextMenu={(e) => e.preventDefault()} 
        >
            <CanvasMap 
                mapUrl={mapUrl}
                gridSize={gridSize}
                offset={offset}
                scale={scale}
                fogGrid={fogGrid}
                isFogMode={isFogMode}
                fogTool={fogTool}
                fogShape={fogShape}
                onFogBulkUpdate={onFogBulkUpdate}
                onFogUpdate={onFogUpdate}
                onMapTransform={(newOff, newSc) => { 
                    if(!isMeasuring && !isMapMouseDown.current && !isPanning.current) {
                        handleMapTransform(newOff, newSc);
                    }
                }}
                activeAoE={activeAoE}
                aoeColor={aoeColor}
                onAoEComplete={handleAoECompleted}
                role={role}
                globalBrightness={globalBrightness}
            />

            {pings.map(ping => (
                <div 
                    key={ping.id} 
                    className="absolute pointer-events-none z-[200] transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                    style={{ left: ping.x * scale + offset.x, top: ping.y * scale + offset.y }}
                >
                    <div className="absolute w-16 h-16 rounded-full animate-ping opacity-75" style={{ backgroundColor: ping.color }}></div>
                    <div className="w-4 h-4 rounded-full border-2 border-white shadow-[0_0_10px_rgba(0,0,0,0.8)]" style={{ backgroundColor: ping.color }}></div>
                </div>
            ))}

            {combatAnimation && (() => {
                const targetEnt = entities.find(e => e.id === combatAnimation.targetId);
                if (!targetEnt) return null;

                const tokenSizeInPx = (targetEnt.size || 1) * gridSize * scale;
                const tokenScreenX = (targetEnt.x * gridSize * scale) + offset.x;
                const tokenScreenY = (targetEnt.y * gridSize * scale) + offset.y;

                const isMagic = combatAnimation.attackType.toLowerCase().includes('conjurou');
                
                return (
                    <div 
                        key={combatAnimation.id}
                        className="absolute pointer-events-none z-[300] flex items-center justify-center mix-blend-screen"
                        style={{ 
                            left: tokenScreenX, 
                            top: tokenScreenY,
                            width: tokenSizeInPx,
                            height: tokenSizeInPx
                        }}
                    >
                        {isMagic ? (
                            <div className="relative w-[150%] h-[150%] animate-in zoom-in duration-300 flex items-center justify-center">
                                <div className="absolute inset-0 bg-purple-600 rounded-full animate-ping opacity-60 blur-md"></div>
                                <div className="absolute w-full h-full border-4 border-cyan-400 rounded-full animate-[spin_1s_linear_infinite] border-t-transparent border-b-transparent shadow-[0_0_30px_#22d3ee]"></div>
                                <div className="absolute w-3/4 h-3/4 bg-white rounded-full animate-pulse blur-sm"></div>
                            </div>
                        ) : (
                            <div className="relative w-[120%] h-[120%] animate-in zoom-in fade-in duration-200">
                                <div className="absolute inset-0 bg-red-600 rounded-full animate-ping opacity-40"></div>
                                <svg viewBox="0 0 100 100" className="absolute w-full h-full text-red-500 transform -rotate-45 drop-shadow-[0_0_15px_#ef4444]">
                                    <path d="M10,90 Q50,10 90,10" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" className="animate-[dash_0.3s_ease-out_forwards]"/>
                                </svg>
                            </div>
                        )}
                    </div>
                );
            })()}

            {isMeasuring && rulerStart && rulerEnd && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-[150]">
                    <line 
                        x1={rulerStart.x} y1={rulerStart.y} 
                        x2={rulerEnd.x} y2={rulerEnd.y} 
                        stroke={rulerEnd.isCapped ? "red" : "yellow"} 
                        strokeWidth="3" 
                        strokeDasharray="6,4" 
                        className="drop-shadow-[0_0_2px_black] transition-colors"
                    />
                    <text 
                        x={rulerEnd.x + 15} y={rulerEnd.y + 20} 
                        fill={rulerEnd.isCapped ? "red" : "yellow"} 
                        fontSize="16" fontWeight="900"
                        className="drop-shadow-[0_0_4px_black] font-mono transition-colors"
                    >
                        {rulerEnd.distance.toFixed(1)}m
                    </text>
                </svg>
            )}

            {isRulerKeyHeld && (
                <style>{`
                    .token-layer-container * {
                        pointer-events: none !important;
                    }
                `}</style>
            )}
            
            <div className="token-layer-container absolute inset-0 z-[100]" style={{ pointerEvents: isRulerKeyHeld ? 'none' : 'auto' }}>
                <TokenLayer 
                    entities={entities}
                    gridSize={gridSize}
                    offset={offset}
                    scale={scale}
                    role={role}
                    activeTurnId={activeTurnId}
                    attackerId={attackerId}
                    targetEntityIds={targetEntityIds}
                    onMoveToken={onMoveToken}
                    
                    onSelectToken={(entity) => {
                        if (!entity) return; 
                        if (entity.classType === 'Item' || entity.type === 'loot') {
                            onSelectEntity(entity, 0, 0); 
                            return; 
                        }
                        
                        if (attackerId === entity.id) {
                            onSetAttacker(null); 
                        } else {
                            onSetAttacker(entity.id); 
                        }
                    }} 
                    
                    onTokenDoubleClick={(entity) => {
                        if (entity.classType === 'Item' || entity.type === 'loot') {
                            onSelectEntity(entity, 0, 0); 
                        } else {
                            onTokenDoubleClick(entity);
                        }
                    }} 

                    onTokenContextMenu={(e, entity) => { 
                        e.preventDefault(); 
                        if (entity.classType === 'Item' || entity.type === 'loot') {
                            onSelectEntity(entity, 0, 0); 
                        } else if (onContextMenu) {
                            onContextMenu(e, entity); 
                        }
                    }} 
                    
                    onGiveItemToToken={onGiveItemToToken || (() => {})} 
                />
            </div>
            
            <div className="absolute top-4 right-4 z-[250] flex flex-col items-end gap-3">
                {isFogMode && (
                    <div className="bg-yellow-900/80 border border-yellow-500 text-yellow-300 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                        Neblina: {fogTool === 'reveal' ? 'REVELAR' : 'ESCONDER'}
                    </div>
                )}
                
                <button 
                    onClick={() => setShowShortcuts(!showShortcuts)}
                    className={`p-2.5 rounded-full transition-all shadow-[0_0_15px_rgba(0,0,0,0.8)] border ${showShortcuts ? 'bg-cyan-900 border-cyan-400 text-white' : 'bg-black/80 hover:bg-black border-white/20 text-gray-400 hover:text-white'}`}
                    title="Teclas de Atalho"
                >
                    <Keyboard size={20} />
                </button>

                {showShortcuts && (
                    <div className="mt-3 bg-black/90 border border-white/10 rounded-xl p-5 shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4 fade-in duration-200 w-80 text-sm text-gray-300">
                        <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-3">
                            <h4 className="font-black text-cyan-400 uppercase tracking-widest text-xs flex items-center gap-2">
                                <Keyboard size={14} /> Guia de Comandos
                            </h4>
                            <button onClick={() => setShowShortcuts(false)} className="text-gray-500 hover:text-white transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                        
                        <ul className="space-y-2.5">
                            <li className="flex justify-between items-center bg-white/5 p-2 rounded">
                                <span className="font-medium text-cyan-200">Mover Câmera</span> 
                                <div className="flex flex-col items-end gap-1">
                                    <kbd className="bg-black/50 border border-white/10 px-2 py-0.5 rounded text-cyan-400 text-[10px] font-mono shadow-inner text-center whitespace-nowrap">Clique + Arrastar</kbd>
                                    <span className="text-[9px] text-gray-500 font-bold uppercase">(No fundo do mapa)</span>
                                </div>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium">Sinalizar no Mapa</span> 
                                <kbd className="bg-white/10 border border-white/5 px-2 py-0.5 rounded text-cyan-300 text-[10px] font-mono shadow-inner">Alt + Clique</kbd>
                            </li>

                            <li className="flex justify-between items-center">
                                <span className="font-medium">Medir (Livre)</span> 
                                <kbd className="bg-white/10 border border-white/5 px-2 py-0.5 rounded text-cyan-300 text-[10px] font-mono shadow-inner">Segure 'M' + Arraste</kbd>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium text-yellow-400">Deslocamento (9m)</span> 
                                <kbd className="bg-yellow-900/30 border border-yellow-500/30 px-2 py-0.5 rounded text-yellow-300 text-[10px] font-mono shadow-inner">Segure 'N' + Arraste</kbd>
                            </li>
                            
                            <li className="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
                                <span className="font-medium">Atacante <span className="text-[10px] text-blue-400 font-bold">(Azul)</span></span> 
                                <kbd className="bg-blue-900/30 border border-blue-500/30 px-2 py-0.5 rounded text-blue-300 text-[10px] font-mono">1 Clique</kbd>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium">Alvo <span className="text-[10px] text-red-400 font-bold">(Vermelho)</span></span> 
                                <kbd className="bg-red-900/30 border border-red-500/30 px-2 py-0.5 rounded text-red-300 text-[10px] font-mono">2 Cliques</kbd>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium">Limpar Seleção</span> 
                                <kbd className="bg-purple-900/30 border border-purple-500/30 px-2 py-0.5 rounded text-purple-300 text-[10px] font-mono animate-pulse">ESC</kbd>
                            </li>

                            {role === 'DM' && (
                                <>
                                    <li className="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
                                        <span className="font-medium">Zoom no Mapa</span> 
                                        <kbd className="bg-white/10 border border-white/5 px-2 py-0.5 rounded text-yellow-400 text-[10px] font-mono shadow-inner">Scroll do Mouse</kbd>
                                    </li>
                                    <li className="flex justify-between items-center">
                                        <span className="font-medium">Rotacionar Token</span> 
                                        <kbd className="bg-white/10 border border-white/5 px-2 py-0.5 rounded text-yellow-400 text-[10px] font-mono shadow-inner">Shift + Scroll</kbd>
                                    </li>
                                    <li className="flex justify-between items-center">
                                        <span className="font-medium">Mudar Tamanho</span> 
                                        <kbd className="bg-white/10 border border-white/5 px-2 py-0.5 rounded text-yellow-400 text-[10px] font-mono shadow-inner">Alt + Scroll</kbd>
                                    </li>
                                    <li className="flex justify-between items-center">
                                        <span className="font-medium">Espelhar (Virar)</span> 
                                        <kbd className="bg-white/10 border border-white/5 px-2 py-0.5 rounded text-yellow-400 text-[10px] font-mono shadow-inner">Selecione + 'F'</kbd>
                                    </li>
                                </>
                            )}
                        </ul>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes dash {
                    to {
                        stroke-dashoffset: 0;
                    }
                }
            `}</style>
        </div>
    );
};

export default GameMap;