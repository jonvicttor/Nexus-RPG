import React, { useState, useEffect, useRef } from 'react';
import CanvasMap from './CanvasMap'; 
import TokenLayer from './TokenLayer';
import { Entity, Item, FogRoom, Wall } from '../App';
import { Keyboard, X } from 'lucide-react'; 

export interface MapPing {
  id: string;
  x: number;
  y: number;
  color: string;
}

export interface AoEData {
  type: 'circle' | 'cone' | 'cube';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface GameMapProps {
  mapUrl: string;
  gridSize?: number;
  entities: Entity[];
  role: 'DM' | 'PLAYER';
  fogGrid: boolean[][];
  isFogMode: boolean;
  fogTool: string; 
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
  myCharacterId?: number;
  fogRooms?: FogRoom[];
  onAddFogRoomRequest?: (cells: {x: number, y: number}[]) => void;
  walls?: Wall[];
  onAddWall?: (wall: Wall) => void;
  onDeleteWall?: (id: string) => void;
}

const GameMap: React.FC<GameMapProps> = (props) => {
    const { 
        mapUrl, gridSize = 70, entities, role, fogGrid, isFogMode, fogTool,
        fogShape, onFogBulkUpdate,
        activeTurnId, onMoveToken, onAddToken, onRotateToken,
        onResizeToken, targetEntityIds, attackerId, onTokenDoubleClick,
        onSetTarget, onSetAttacker, onFlipToken, activeAoE, onAoEComplete,
        aoeColor, onSelectEntity, externalOffset, externalScale, onMapChange,
        focusEntity, globalBrightness, onDropItem, onGiveItemToToken,
        onContextMenu, pings = [], onPing, myCharacterId,
        fogRooms = [], onAddFogRoomRequest,
        walls = [], onAddWall, onDeleteWall
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

    const isPanningRef = useRef(false);
    const panStartPos = useRef({ x: 0, y: 0 });
    
    const isMapMouseDown = useRef(false);
    const mapMouseDownPos = useRef({ x: 0, y: 0 });

    const [fogDrawStart, setFogDrawStart] = useState<{x: number, y: number} | null>(null);
    const [wallDrawStart, setWallDrawStart] = useState<{x: number, y: number} | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const [aoeStart, setAoeStart] = useState<{x: number, y: number} | null>(null);

    const [combatAnimation, setCombatAnimation] = useState<{ attackerName: string; targetId: number; attackType: string; id: string; } | null>(null);

    const scaleRef = useRef(scale);

    useEffect(() => {
        scaleRef.current = scale;
    }, [scale, offset]);

    useEffect(() => { targetIdsRef.current = targetEntityIds; }, [targetEntityIds]);
    useEffect(() => { attackerIdRef.current = attackerId; }, [attackerId]);

    useEffect(() => {
        const handleEvent = (e: Event) => {
            const customEvent = e as CustomEvent;
            setCombatAnimation(customEvent.detail);
            setTimeout(() => setCombatAnimation(null), 1500);
        };
        window.addEventListener('triggerCombatAnimationLocal', handleEvent);
        return () => window.removeEventListener('triggerCombatAnimationLocal', handleEvent);
    }, []);

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

    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            const key = e.key.toLowerCase();
            
            if (key === 'm' && !isMeasuringMode.current) { 
                isMeasuringMode.current = 'free'; 
                setIsRulerKeyHeld(true);
                isPanningRef.current = false;
            }
            if (key === 'n' && !isMeasuringMode.current) { 
                isMeasuringMode.current = 'movement'; 
                setIsRulerKeyHeld(true);
                isPanningRef.current = false; 
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
                    if (e.shiftKey) {
                        let newRotation = (entity.rotation || 0) + (e.deltaY > 0 ? 90 : -90);
                        newRotation = ((newRotation % 360) + 360) % 360; 
                        onRotateToken(primaryTarget, newRotation);
                    }
                    if (e.altKey) onResizeToken(primaryTarget, parseFloat(Math.max(0.1, (entity.size || 1) + (e.deltaY > 0 ? -0.1 : 0.1)).toFixed(1)));
                }
                return;
            }

            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const currentScale = scaleRef.current;

            const worldX = (mouseX - offset.x) / currentScale;
            const worldY = (mouseY - offset.y) / currentScale;

            const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
            let newScale = currentScale * zoomFactor;
            newScale = Math.min(Math.max(0.2, newScale), 5); 

            if (newScale === currentScale) return;

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
    }, [role, entities, onRotateToken, onResizeToken, onMapChange, offset.x, offset.y]);

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
        const target = e.target as HTMLElement;
        const isToken = target.closest('.token-layer-container') || target.closest('img') || target.closest('.pointer-events-auto');
        const isToolActive = isFogMode || activeAoE || isMeasuringMode.current !== null || e.altKey;

        if (!isToken && (e.button === 1 || e.button === 2)) {
            e.preventDefault();
        }

        if (e.button === 1 || e.button === 2 || (e.button === 0 && !isToolActive && !isToken)) {
            isPanningRef.current = true;
            panStartPos.current = { x: e.clientX, y: e.clientY };
            if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
            return;
        }
        
        if (isToken && !isToolActive && e.button === 0) {
            return;
        }
        
        if (e.button !== 0 && e.button !== 2) return;
        
        isMapMouseDown.current = true;
        mapMouseDownPos.current = { x: e.clientX, y: e.clientY };

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = (mouseX - offset.x) / scale;
        const worldY = (mouseY - offset.y) / scale;

        if (isFogMode) {
            if (fogTool === 'wall') {
                // 👉 LÓGICA DE MAGNETISMO (SNAP) AO COMEÇAR A DESENHAR
                let startX = worldX / gridSize;
                let startY = worldY / gridSize;
                const snapThreshold = 0.25; 

                for (const w of walls) {
                    if (Math.hypot(startX - w.x1, startY - w.y1) < snapThreshold) { startX = w.x1; startY = w.y1; break; }
                    if (Math.hypot(startX - w.x2, startY - w.y2) < snapThreshold) { startX = w.x2; startY = w.y2; break; }
                }

                setWallDrawStart({ x: startX, y: startY });
                return;
            } else if (fogTool === 'eraseWall' && onDeleteWall) {
                const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
                    const l2 = (x1 - x2) ** 2 + (y1 - y2) ** 2;
                    if (l2 === 0) return Math.hypot(px - x1, py - y1);
                    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
                    t = Math.max(0, Math.min(1, t));
                    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
                };

                const clickedX = worldX / gridSize;
                const clickedY = worldY / gridSize;
                
                let wallToDelete = null;
                let minDist = 0.3; 
                
                walls.forEach(w => {
                    const dist = distToSegment(clickedX, clickedY, w.x1, w.y1, w.x2, w.y2);
                    if (dist < minDist) {
                        minDist = dist;
                        wallToDelete = w.id;
                    }
                });

                if (wallToDelete) {
                    onDeleteWall(wallToDelete);
                }
                return;
            }

            setFogDrawStart({ x: worldX, y: worldY });
            return;
        }

        if (activeAoE) {
            setAoeStart({ x: worldX, y: worldY });
            return;
        }

        if (isMeasuringMode.current !== null && e.button === 0) { 
            const gridCenterPixelX = (Math.floor(worldX / gridSize) * gridSize + (gridSize / 2)) * scale + offset.x;
            const gridCenterPixelY = (Math.floor(worldY / gridSize) * gridSize + (gridSize / 2)) * scale + offset.y;

            setIsMeasuring(true);
            setRulerStart({ x: gridCenterPixelX, y: gridCenterPixelY });
            setRulerEnd({ x: gridCenterPixelX, y: gridCenterPixelY, distance: 0, isCapped: false });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        setMousePos({ x: e.clientX, y: e.clientY });

        if (isPanningRef.current) {
            const dx = e.clientX - panStartPos.current.x;
            const dy = e.clientY - panStartPos.current.y;
            
            panStartPos.current = { x: e.clientX, y: e.clientY };

            setOffset(prev => {
                const newOffset = {
                    x: prev.x + dx,
                    y: prev.y + dy
                };
                if (role === 'DM' && onMapChange) onMapChange(newOffset, scaleRef.current);
                return newOffset;
            });
            return;
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (isPanningRef.current) {
            isPanningRef.current = false;
            if (containerRef.current) containerRef.current.style.cursor = activeAoE ? 'crosshair' : (isFogMode ? 'cell' : 'grab');
            return;
        }

        if (isFogMode) {
            const rect = containerRef.current!.getBoundingClientRect();
            const endWorldX = (e.clientX - rect.left - offset.x) / scale;
            const endWorldY = (e.clientY - rect.top - offset.y) / scale;

            if (wallDrawStart && fogTool === 'wall' && onAddWall) {
                // 👉 LÓGICA DE MAGNETISMO (SNAP) AO TERMINAR DE DESENHAR
                let endX = endWorldX / gridSize;
                let endY = endWorldY / gridSize;
                const snapThreshold = 0.25;

                for (const w of walls) {
                    if (Math.hypot(endX - w.x1, endY - w.y1) < snapThreshold) { endX = w.x1; endY = w.y1; break; }
                    if (Math.hypot(endX - w.x2, endY - w.y2) < snapThreshold) { endX = w.x2; endY = w.y2; break; }
                }

                // Evita criar uma parede microscópica (mesmo ponto de início e fim)
                if (Math.hypot(endX - wallDrawStart.x, endY - wallDrawStart.y) > 0.05) {
                    onAddWall({
                        id: Date.now().toString(),
                        x1: wallDrawStart.x,
                        y1: wallDrawStart.y,
                        x2: endX,
                        y2: endY
                    });
                }
                setWallDrawStart(null);
            } 
            else if (fogDrawStart) {
                const startGridX = Math.floor(fogDrawStart.x / gridSize);
                const startGridY = Math.floor(fogDrawStart.y / gridSize);
                const endGridX = Math.floor(endWorldX / gridSize);
                const endGridY = Math.floor(endWorldY / gridSize);

                const cellsToUpdate: {x: number, y: number}[] = [];

                if (fogShape === 'rect' || fogTool === 'room') {
                    const minX = Math.min(startGridX, endGridX);
                    const maxX = Math.max(startGridX, endGridX);
                    const minY = Math.min(startGridY, endGridY);
                    const maxY = Math.max(startGridY, endGridY);

                    if ((maxX - minX) * (maxY - minY) < 5000) {
                        for (let y = minY; y <= maxY; y++) {
                            for (let x = minX; x <= maxX; x++) {
                                cellsToUpdate.push({x, y});
                            }
                        }
                    }
                } else if (fogShape === 'brush') {
                     cellsToUpdate.push({x: startGridX, y: startGridY});
                     cellsToUpdate.push({x: endGridX, y: endGridY});
                } else if (fogShape === 'line') {
                      let x0 = startGridX;
                      let y0 = startGridY;
                      let x1 = endGridX;
                      let y1 = endGridY;
                      
                      let dx = Math.abs(x1 - x0);
                      let dy = Math.abs(y1 - y0);
                      let sx = (x0 < x1) ? 1 : -1;
                      let sy = (y0 < y1) ? 1 : -1;
                      let err = dx - dy;

                      let loopSafeguard = 0;
                      while(loopSafeguard++ < 1000) {
                          cellsToUpdate.push({x: x0, y: y0});
                          if ((x0 === x1) && (y0 === y1)) break;
                          let e2 = 2 * err;
                          if (e2 > -dy) { err -= dy; x0 += sx; }
                          if (e2 < dx) { err += dx; y0 += sy; }
                      }
                }

                if (cellsToUpdate.length > 0) {
                    if (String(fogTool) === 'room' && onAddFogRoomRequest) {
                        onAddFogRoomRequest(cellsToUpdate);
                    } else if (onFogBulkUpdate && (fogTool === 'reveal' || fogTool === 'hide')) {
                        onFogBulkUpdate(cellsToUpdate, fogTool === 'reveal');
                    }
                }
                setFogDrawStart(null);
            }
        }

        if (aoeStart && activeAoE && onAoEComplete) {
            const rect = containerRef.current!.getBoundingClientRect();
            let worldX = (e.clientX - rect.left - offset.x) / scale;
            let worldY = (e.clientY - rect.top - offset.y) / scale;
            
            const dist = Math.hypot(worldX - aoeStart.x, worldY - aoeStart.y);
            
            if (dist < 5) {
                worldX = aoeStart.x + gridSize;
                worldY = aoeStart.y + gridSize;
            }
            
            onAoEComplete();
            setAoeStart(null);
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

    const renderDrawingOverlay = () => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return null;
        
        const mX = (mousePos.x - rect.left - offset.x) / scale;
        const mY = (mousePos.y - rect.top - offset.y) / scale;

        return (
            <div className="absolute inset-0 pointer-events-none z-[190]">
                {/* 1. OVERLAY DE PAREDES LIVRES COM MAGNETISMO VISUAL */}
                {isFogMode && wallDrawStart && fogTool === 'wall' && (() => {
                    const startPxX = (wallDrawStart.x * gridSize * scale) + offset.x;
                    const startPxY = (wallDrawStart.y * gridSize * scale) + offset.y;
                    
                    let currentX = mX / gridSize;
                    let currentY = mY / gridSize;
                    const snapThreshold = 0.25;

                    for (const w of walls) {
                        if (Math.hypot(currentX - w.x1, currentY - w.y1) < snapThreshold) { currentX = w.x1; currentY = w.y1; break; }
                        if (Math.hypot(currentX - w.x2, currentY - w.y2) < snapThreshold) { currentX = w.x2; currentY = w.y2; break; }
                    }

                    const endPxX = (currentX * gridSize * scale) + offset.x;
                    const endPxY = (currentY * gridSize * scale) + offset.y;

                    return (
                        <svg className="absolute inset-0 w-full h-full">
                            <line x1={startPxX} y1={startPxY} x2={endPxX} y2={endPxY} stroke="#ef4444" strokeWidth={4 / scale} strokeLinecap="round" />
                            {/* Desenha uma pequena bolinha onde a linha vai "grudar" para guiar o mestre */}
                            <circle cx={endPxX} cy={endPxY} r={5 / scale} fill="white" opacity="0.8" />
                        </svg>
                    );
                })()}

                {/* 2. OVERLAY DE NEBLINA / CÔMODOS */}
                {isFogMode && fogDrawStart && fogTool !== 'wall' && fogTool !== 'eraseWall' && (() => {
                    const startPxX = (fogDrawStart.x * scale) + offset.x;
                    const startPxY = (fogDrawStart.y * scale) + offset.y;
                    const endPxX = (mX * scale) + offset.x;
                    const endPxY = (mY * scale) + offset.y;

                    const width = endPxX - startPxX;
                    const height = endPxY - startPxY;

                    let strokeColor = "white";
                    let fillColor = "rgba(255, 255, 255, 0.4)";

                    if (fogTool === 'hide') {
                        strokeColor = "black";
                        fillColor = "rgba(0, 0, 0, 0.6)";
                    } else if (fogTool === 'room') {
                        strokeColor = "#06b6d4"; 
                        fillColor = "rgba(6, 182, 212, 0.3)";
                    }

                    if (fogShape === 'rect' || fogTool === 'room') {
                        return (
                            <div 
                                className="absolute border-[2px]"
                                style={{ left: Math.min(startPxX, endPxX), top: Math.min(startPxY, endPxY), width: Math.abs(width), height: Math.abs(height), borderColor: strokeColor, backgroundColor: fillColor }} 
                            />
                        );
                    } else {
                        return (
                            <svg className="absolute inset-0 w-full h-full">
                                <line x1={startPxX} y1={startPxY} x2={endPxX} y2={endPxY} stroke={strokeColor} strokeWidth={4} strokeLinecap="round" />
                            </svg>
                        );
                    }
                })()}

                {/* 3. OVERLAY DE ÁREA DE EFEITO (AoE) */}
                {aoeStart && activeAoE && (() => {
                    const startPxX = (aoeStart.x * scale) + offset.x;
                    const startPxY = (aoeStart.y * scale) + offset.y;
                    const endPxX = (mX * scale) + offset.x;
                    const endPxY = (mY * scale) + offset.y;

                    let labelText = "";
                    let labelX = endPxX;
                    let labelY = endPxY;

                    const renderAoEShape = () => {
                        if (activeAoE === 'circle') {
                            const midX = (startPxX + endPxX) / 2;
                            const midY = (startPxY + endPxY) / 2;
                            const radiusPx = Math.hypot(endPxX - startPxX, endPxY - startPxY) / 2;
                            const radiusMeters = (radiusPx / (gridSize * scale)) * 1.5;
                            labelText = `Raio: ${radiusMeters.toFixed(1)}m`;
                            labelX = midX;
                            labelY = midY - radiusPx - 10;
                            return <circle cx={midX} cy={midY} r={radiusPx} fill={aoeColor + "33"} stroke={aoeColor} strokeWidth="2" />;
                        } else if (activeAoE === 'cube') {
                            const sideX = endPxX - startPxX;
                            const sideY = endPxY - startPxY;
                            const s = Math.max(Math.abs(sideX), Math.abs(sideY));
                            const dirX = sideX >= 0 ? 1 : -1;
                            const dirY = sideY >= 0 ? 1 : -1;
                            const sideMeters = (s / (gridSize * scale)) * 1.5;
                            labelText = `Aresta: ${sideMeters.toFixed(1)}m`;
                            labelX = startPxX + (s * dirX) / 2;
                            labelY = Math.min(startPxY, startPxY + s * dirY) - 10;
                            return <rect x={startPxX} y={startPxY} width={s * dirX} height={s * dirY} fill={aoeColor + "33"} stroke={aoeColor} strokeWidth="2" />;
                        } else if (activeAoE === 'cone') {
                            const radiusPx = Math.hypot(endPxX - startPxX, endPxY - startPxY);
                            const angle = Math.atan2(endPxY - startPxY, endPxX - startPxX);
                            const startAngle = angle - Math.PI / 6;
                            const endAngle = angle + Math.PI / 6;
                            
                            const x1 = startPxX + radiusPx * Math.cos(startAngle);
                            const y1 = startPxY + radiusPx * Math.sin(startAngle);
                            const x2 = startPxX + radiusPx * Math.cos(endAngle);
                            const y2 = startPxY + radiusPx * Math.sin(endAngle);

                            const distMeters = (radiusPx / (gridSize * scale)) * 1.5;
                            labelText = `Cone: ${distMeters.toFixed(1)}m`;
                            labelX = endPxX;
                            labelY = endPxY - 15;

                            return (
                                <path 
                                    d={`M ${startPxX} ${startPxY} L ${x1} ${y1} A ${radiusPx} ${radiusPx} 0 0 1 ${x2} ${y2} Z`} 
                                    fill={aoeColor + "33"} stroke={aoeColor} strokeWidth="2" 
                                />
                            );
                        }
                        return null;
                    };

                    return (
                        <svg className="absolute inset-0 w-full h-full">
                            {renderAoEShape()}
                            <text x={labelX} y={labelY} fill="white" fontSize="14" fontWeight="bold" textAnchor="middle" style={{ textShadow: "0 0 4px black" }}>
                                {labelText}
                            </text>
                        </svg>
                    );
                })()}

                {/* 4. OVERLAY DA RÉGUA DE MEDIÇÃO */}
                {isMeasuring && rulerStart && rulerEnd && (() => {
                    const dx = rulerEnd.x - rulerStart.x;
                    const dy = rulerEnd.y - rulerStart.y;
                    const distPx = Math.hypot(dx, dy);
                    const intervalPx = gridSize * scale;
                    const numIntervals = Math.floor(distPx / intervalPx);
                    
                    const nodes = [];
                    for (let i = 1; i <= numIntervals; i++) {
                        const ratio = (i * intervalPx) / distPx;
                        nodes.push(
                            <circle key={`interval-${i}`} cx={rulerStart.x + (dx * ratio)} cy={rulerStart.y + (dy * ratio)} r="3" fill={rulerEnd.isCapped ? "#ef4444" : "#eab308"} stroke="black" strokeWidth="1" />
                        );
                    }

                    return (
                        <svg className="absolute inset-0 w-full h-full">
                            <line x1={rulerStart.x} y1={rulerStart.y} x2={rulerEnd.x} y2={rulerEnd.y} stroke="#fbbf24" strokeWidth="3" strokeDasharray="10, 5" className="drop-shadow-[0_0_3px_black]"/>
                            {nodes}
                            <text x={(rulerStart.x + rulerEnd.x) / 2} y={(rulerStart.y + rulerEnd.y) / 2 - 10} fill="#fbbf24" fontSize="16" fontWeight="bold" textAnchor="middle" style={{ textShadow: "0 0 4px black" }}>
                                {rulerEnd.distance.toFixed(1)}m
                            </text>
                        </svg>
                    );
                })()}
            </div>
        );
    };

    return (
        <div 
            ref={containerRef}
            className={`w-full h-full bg-[#1a1a1a] overflow-hidden select-none overscroll-none relative transition-colors ${activeAoE ? 'cursor-crosshair' : (isFogMode ? 'cursor-cell' : 'cursor-grab')}`}
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
                role={role}
                globalBrightness={globalBrightness}
                fogRooms={fogRooms}
                walls={walls}
            />

            {renderDrawingOverlay()}

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

                const isMagic = combatAnimation.attackType.toLowerCase().includes('magia');
                
                return (
                    <div 
                        key={combatAnimation.id}
                        className="absolute pointer-events-none z-[300] flex items-center justify-center mix-blend-screen"
                        style={{ left: tokenScreenX, top: tokenScreenY, width: tokenSizeInPx, height: tokenSizeInPx }}
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
                    myCharacterId={myCharacterId}
                    
                    onSelectToken={(entity: Entity, multi?: boolean) => {
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
                    
                    onTokenDoubleClick={(entity: Entity, multi?: boolean) => {
                        if (entity.classType === 'Item' || entity.type === 'loot') {
                            onSelectEntity(entity, 0, 0); 
                        } else {
                            onTokenDoubleClick(entity, multi);
                        }
                    }} 

                    onTokenContextMenu={(e: React.MouseEvent, entity: Entity) => { 
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
                        Neblina: {String(fogTool).toUpperCase()}
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

            {isRulerKeyHeld && (
                <div className="absolute inset-0 z-[145]" />
            )}

            {isRulerKeyHeld && (
                <style>{`
                    .token-layer-container * {
                        pointer-events: none !important;
                    }
                `}</style>
            )}
        </div>
    );
};

export default GameMap;