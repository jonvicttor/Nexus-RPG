import React, { useState, useCallback, useEffect, useRef } from 'react';
import CanvasMap, { AoEData } from './CanvasMap'; 
import TokenLayer from './TokenLayer';
import { Entity, Item } from '../App';
import { Keyboard, X } from 'lucide-react'; 

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
        onResizeToken, targetEntityIds, attackerId,
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
    const rulerLineRef = useRef<SVGLineElement>(null);
    const rulerTextRef = useRef<SVGTextElement>(null);
    const isMPressed = useRef(false);
    
    const isMapMouseDown = useRef(false);
    const mapMouseDownPos = useRef({ x: 0, y: 0 });

    useEffect(() => { targetIdsRef.current = targetEntityIds; }, [targetEntityIds]);
    useEffect(() => { attackerIdRef.current = attackerId; }, [attackerId]);

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
        const container = containerRef.current;
        if (!container) return;

        const preventBrowserZoom = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault(); 
            }
        };

        container.addEventListener('wheel', preventBrowserZoom, { passive: false });
        return () => container.removeEventListener('wheel', preventBrowserZoom);
    }, []);

    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.key.toLowerCase() === 'm') isMPressed.current = true;
            
            if (e.key === 'Escape') {
                if (activeAoE) onAoEComplete();
                if (targetEntityIds.length > 0) onSetTarget(null);
                if (attackerId !== null) onSetAttacker(null);
                if (isMeasuring) {
                    setIsMeasuring(false);
                    setRulerStart(null);
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
            if (e.key.toLowerCase() === 'm') {
                isMPressed.current = false;
                if (isMeasuring) {
                    setIsMeasuring(false);
                    setRulerStart(null);
                }
            }
        };

        const handleGlobalWheel = (e: WheelEvent) => {
            if (role !== 'DM') return;
            if (e.shiftKey || e.altKey) {
                const primaryTarget = attackerIdRef.current !== null ? attackerIdRef.current : targetIdsRef.current[0];
                if (!primaryTarget) return;

                const entity = entities.find(ent => ent.id === primaryTarget);
                if (entity) {
                    if (e.shiftKey) onRotateToken(primaryTarget, (entity.rotation || 0) + (e.deltaY > 0 ? 15 : -15));
                    if (e.altKey) onResizeToken(primaryTarget, parseFloat(Math.max(0.1, (entity.size || 1) + (e.deltaY > 0 ? -0.1 : 0.1)).toFixed(1)));
                }
            }
        };
        
        window.addEventListener('wheel', handleGlobalWheel, { passive: false });
        window.addEventListener('keydown', handleGlobalKeyDown);
        window.addEventListener('keyup', handleGlobalKeyUp);
        
        return () => { 
            window.removeEventListener('wheel', handleGlobalWheel); 
            window.removeEventListener('keydown', handleGlobalKeyDown); 
            window.removeEventListener('keyup', handleGlobalKeyUp); 
        };
    }, [role, entities, onRotateToken, onResizeToken, onFlipToken, isMeasuring, activeAoE, targetEntityIds, attackerId, onAoEComplete, onSetTarget, onSetAttacker]);

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
        isMapMouseDown.current = true;
        mapMouseDownPos.current = { x: e.clientX, y: e.clientY };

        if (isMPressed.current && e.button === 0) { 
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            setIsMeasuring(true);
            setRulerStart({ x: mouseX, y: mouseY });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isMeasuring && rulerStart && rulerLineRef.current) {
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            rulerLineRef.current.setAttribute('x2', mouseX.toString());
            rulerLineRef.current.setAttribute('y2', mouseY.toString());

            if (rulerTextRef.current) {
                const distPx = Math.hypot(mouseX - rulerStart.x, mouseY - rulerStart.y);
                const distSquares = distPx / (gridSize * scale);
                const distMeters = (distSquares * 1.5).toFixed(1); 
                
                rulerTextRef.current.setAttribute('x', (mouseX + 15).toString());
                rulerTextRef.current.setAttribute('y', (mouseY + 20).toString());
                rulerTextRef.current.textContent = `${distMeters}m`;
            }
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (isMeasuring) {
            setIsMeasuring(false);
            setRulerStart(null);
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
            if (ent.classType === 'Item' || ent.visible === false) return;

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
            className="w-full h-full bg-[#1a1a1a] overflow-hidden relative"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
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
                onMapTransform={(newOff, newSc) => { if(!isMeasuring) handleMapTransform(newOff, newSc) }}
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

            {isMeasuring && rulerStart && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-[150]">
                    <line 
                        ref={rulerLineRef}
                        x1={rulerStart.x} y1={rulerStart.y} 
                        x2={rulerStart.x} y2={rulerStart.y} 
                        stroke="yellow" strokeWidth="3" strokeDasharray="6,4" 
                        className="drop-shadow-[0_0_2px_black]"
                    />
                    <text 
                        ref={rulerTextRef}
                        x={rulerStart.x + 15} y={rulerStart.y + 20} 
                        fill="yellow" fontSize="16" fontWeight="900"
                        className="drop-shadow-[0_0_4px_black] font-mono"
                    >
                        0m
                    </text>
                </svg>
            )}

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
                
                // --- A MAGIA OCORRE AQUI: Jogadores agora podem selecionar! ---
                onSelectToken={(entity, multi) => {
                    if (!entity || entity.classType === 'Item') return; 
                    
                    // Todos (Mestre e Jogador) podem ver os atributos básicos, o Mestre vê tudo.
                    onSelectEntity(entity, 0, 0); 
                    
                    if (attackerId === entity.id) {
                        onSetAttacker(null); 
                    } else {
                        onSetAttacker(entity.id); 
                    }
                }}
                
                onTokenDoubleClick={(entity, multi) => {
                    if (!entity || entity.classType === 'Item') return; 
                    
                    // MESTRE E JOGADOR AGORA PODEM DEFINIR ALVOS!
                    if (targetEntityIds.includes(entity.id)) {
                        if (multi) { 
                            onSetTarget(targetEntityIds.filter(id => id !== entity.id));
                        } else {
                            onSetTarget(null); 
                        }
                    } else {
                        onSetTarget(entity.id, multi); 
                    }
                }}
                
                onTokenContextMenu={(e, ent) => { 
                    e.preventDefault(); 
                    if (onContextMenu) onContextMenu(e, ent);
                }}
                onGiveItemToToken={onGiveItemToToken || (() => {})} 
            />

            <div className="absolute top-4 right-4 z-[250] flex flex-col items-end">
                {isFogMode && (
                    <div className="bg-yellow-900/80 border border-yellow-500 text-yellow-300 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg mb-3">
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
                            <li className="flex justify-between items-center">
                                <span className="font-medium">Sinalizar no Mapa</span> 
                                <kbd className="bg-white/10 border border-white/5 px-2 py-0.5 rounded text-cyan-300 text-[10px] font-mono shadow-inner">Alt + Clique</kbd>
                            </li>
                            <li className="flex justify-between items-center">
                                <span className="font-medium">Régua (Medir)</span> 
                                <kbd className="bg-white/10 border border-white/5 px-2 py-0.5 rounded text-cyan-300 text-[10px] font-mono shadow-inner">Segure 'M' + Arraste</kbd>
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
                                        <kbd className="bg-white/10 border border-white/5 px-2 py-0.5 rounded text-yellow-400 text-[10px] font-mono shadow-inner">Ctrl + Scroll</kbd>
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

        </div>
    );
};

export default GameMap;