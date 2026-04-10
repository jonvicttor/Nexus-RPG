import React, { useRef, useEffect, useState, useCallback } from 'react';

export interface AoEData {
  type: 'circle' | 'cone' | 'cube';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface CanvasMapProps {
  mapUrl: string;
  gridSize?: number;
  offset: { x: number, y: number };
  scale: number;
  fogGrid: boolean[][];
  isFogMode: boolean;
  fogTool: 'reveal' | 'hide';
  onFogUpdate: (x: number, y: number, shouldReveal: boolean) => void;
  
  fogShape?: 'brush' | 'rect' | 'line';
  onFogBulkUpdate?: (cells: {x: number, y: number}[], shouldReveal: boolean) => void;
  
  onMapTransform: (newOffset: { x: number, y: number }, newScale: number) => void;
  
  activeAoE: 'circle' | 'cone' | 'cube' | null;
  aoeColor: string;
  onAoEComplete: (data?: AoEData) => void; 
  role: 'DM' | 'PLAYER';
  
  globalBrightness?: number;
}

const CanvasMap: React.FC<CanvasMapProps> = ({ 
  mapUrl, gridSize = 70, offset, scale,
  fogGrid, isFogMode, fogTool, onFogUpdate,
  fogShape = 'brush', onFogBulkUpdate,
  onMapTransform,
  activeAoE, aoeColor, onAoEComplete, role, globalBrightness = 1
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

  const [measureStart, setMeasureStart] = useState<{x: number, y: number} | null>(null);
  const [aoeStart, setAoeStart] = useState<{x: number, y: number} | null>(null);
  const [fogDrawStart, setFogDrawStart] = useState<{x: number, y: number} | null>(null);
  
  const [isPaintingFog, setIsPaintingFog] = useState(false);
  const isPanningRef = useRef(false);
  const panStartMouseRef = useRef({ x: 0, y: 0 });
  const panStartOffsetRef = useRef({ x: 0, y: 0 });
  const mousePosRef = useRef({ x: 0, y: 0 });
  const isMKeyPressed = useRef(false);
  const [forceRender, setForceRender] = useState(0);

  const lastFogUpdate = useRef<number>(0);
  const fogDebounceMs = 50; 

  useEffect(() => {
      const parent = canvasRef.current?.parentElement;
      if (!parent) return;
      setCanvasSize({ w: parent.clientWidth, h: parent.clientHeight });
      
      const resizeObserver = new ResizeObserver((entries) => {
          for (let entry of entries) {
              setCanvasSize({ w: entry.contentRect.width, h: entry.contentRect.height });
          }
      });
      resizeObserver.observe(parent);
      return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => { 
      const img = new Image(); 
      img.src = mapUrl; 
      img.onload = () => setMapImage(img); 
  }, [mapUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key?.toLowerCase() === 'm') isMKeyPressed.current = true; };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.key?.toLowerCase() === 'm') isMKeyPressed.current = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, []);

  const clampView = useCallback((proposedOffset: {x: number, y: number}, proposedScale: number) => {
      if (!mapImage || canvasSize.w === 0 || canvasSize.h === 0) {
          return { offset: proposedOffset, scale: proposedScale };
      }
      
      const minScaleX = canvasSize.w / mapImage.width;
      const minScaleY = canvasSize.h / mapImage.height;
      const minScale = Math.max(minScaleX, minScaleY);
      
      const finalScale = Math.max(minScale, Math.min(proposedScale, 10)); 
      
      const minX = canvasSize.w - (mapImage.width * finalScale);
      const minY = canvasSize.h - (mapImage.height * finalScale);
      
      const finalX = Math.min(Math.max(proposedOffset.x, minX), 0);
      const finalY = Math.min(Math.max(proposedOffset.y, minY), 0);
      
      return { offset: { x: finalX, y: finalY }, scale: finalScale };
  }, [mapImage, canvasSize]);

  useEffect(() => {
      if (!mapImage || canvasSize.w === 0) return;
      const clamped = clampView(offset, scale);
      
      const diffX = Math.abs(clamped.offset.x - offset.x);
      const diffY = Math.abs(clamped.offset.y - offset.y);
      const diffScale = Math.abs(clamped.scale - scale);
      
      if (diffScale > 0.001 || diffX > 0.1 || diffY > 0.1) {
          onMapTransform(clamped.offset, clamped.scale);
      }
  }, [offset, scale, mapImage, canvasSize, clampView, onMapTransform]);

  useEffect(() => {
    const canvas = canvasRef.current; 
    if (!canvas || !mapImage || canvasSize.w === 0) return;
    const ctx = canvas.getContext('2d'); 
    if (!ctx) return;
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save(); 
    ctx.translate(offset.x, offset.y); 
    ctx.scale(scale, scale);
    
    // 1. Desenha o Chão
    ctx.drawImage(mapImage, 0, 0, mapImage.width, mapImage.height);

    // 👉 2. NOVO: Desenha a Grade de Combate (Esquadrinhado de 1,5m)
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)"; // Linha branca sutil
    ctx.lineWidth = 1 / scale; // Mantém a linha fina independente do zoom
    
    ctx.beginPath();
    // Linhas Verticais
    for (let x = 0; x <= mapImage.width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, mapImage.height);
    }
    // Linhas Horizontais
    for (let y = 0; y <= mapImage.height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(mapImage.width, y);
    }
    ctx.stroke();
    ctx.restore();

    // 3. Desenha a Noite/Claridade
    if (globalBrightness < 1) {
        ctx.save();
        ctx.fillStyle = "#000000";
        ctx.globalAlpha = 1 - globalBrightness; 
        ctx.fillRect(0, 0, mapImage.width, mapImage.height);
        ctx.restore();
    }

    // 4. Desenha a Neblina (Fog of War)
    if (fogGrid && fogGrid.length > 0) {
      ctx.fillStyle = "#000000"; 
      ctx.globalAlpha = role === 'DM' ? 0.6 : 1.0; 
      
      const startCol = Math.max(0, Math.floor(-offset.x / (gridSize * scale)));
      const startRow = Math.max(0, Math.floor(-offset.y / (gridSize * scale)));
      const endCol = Math.min(fogGrid[0]?.length || 0, Math.ceil((canvas.width - offset.x) / (gridSize * scale)));
      const endRow = Math.min(fogGrid.length, Math.ceil((canvas.height - offset.y) / (gridSize * scale)));

      for (let y = startRow; y < endRow; y++) {
          if (!fogGrid[y]) continue;
          for (let x = startCol; x < endCol; x++) {
             if (fogGrid[y][x] === false) { 
                 ctx.fillRect(x * gridSize, y * gridSize, gridSize + 1, gridSize + 1); 
             }
          }
      }
      ctx.globalAlpha = 1.0; 
    }

    const rect = canvas.getBoundingClientRect();
    const mX = (mousePosRef.current.x - rect.left - offset.x) / scale;
    const mY = (mousePosRef.current.y - rect.top - offset.y) / scale;

    if (isFogMode && fogDrawStart) {
        ctx.save();
        ctx.fillStyle = fogTool === 'reveal' ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.6)";
        ctx.strokeStyle = fogTool === 'reveal' ? "white" : "black";
        ctx.lineWidth = 2 / scale;
        
        if (fogShape === 'rect') {
            const width = mX - fogDrawStart.x;
            const height = mY - fogDrawStart.y;
            ctx.fillRect(fogDrawStart.x, fogDrawStart.y, width, height);
            ctx.strokeRect(fogDrawStart.x, fogDrawStart.y, width, height);
        } else if (fogShape === 'line') {
            ctx.beginPath();
            ctx.moveTo(fogDrawStart.x, fogDrawStart.y);
            ctx.lineTo(mX, mY);
            ctx.stroke();
            
            ctx.beginPath(); ctx.arc(fogDrawStart.x, fogDrawStart.y, 4/scale, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(mX, mY, 4/scale, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }

    if (aoeStart && activeAoE) {
        ctx.save();
        ctx.fillStyle = aoeColor + "33"; 
        ctx.strokeStyle = aoeColor; 
        ctx.lineWidth = 2 / scale;
        ctx.beginPath();
        
        let labelText = "";
        let labelX = mX;
        let labelY = mY;

        if (activeAoE === 'circle') {
            const midX = (aoeStart.x + mX) / 2;
            const midY = (aoeStart.y + mY) / 2;
            const radius = Math.hypot(mX - aoeStart.x, mY - aoeStart.y) / 2;
            ctx.arc(midX, midY, radius, 0, Math.PI * 2);
            const radiusMeters = (radius / gridSize) * 1.5;
            labelText = `Raio: ${radiusMeters.toFixed(1)}m`;
            labelX = midX;
            labelY = midY - radius - (10/scale);
        } else if (activeAoE === 'cube') {
            const sideX = mX - aoeStart.x;
            const sideY = mY - aoeStart.y;
            const s = Math.max(Math.abs(sideX), Math.abs(sideY));
            const dirX = sideX >= 0 ? 1 : -1;
            const dirY = sideY >= 0 ? 1 : -1;
            ctx.rect(aoeStart.x, aoeStart.y, s * dirX, s * dirY);
            const sideMeters = (s / gridSize) * 1.5;
            labelText = `Aresta: ${sideMeters.toFixed(1)}m`;
            labelX = aoeStart.x + (s * dirX) / 2;
            labelY = Math.min(aoeStart.y, aoeStart.y + s * dirY) - (10/scale);
        } else if (activeAoE === 'cone') {
            const radius = Math.hypot(mX - aoeStart.x, mY - aoeStart.y);
            const angle = Math.atan2(mY - aoeStart.y, mX - aoeStart.x);
            ctx.moveTo(aoeStart.x, aoeStart.y);
            ctx.arc(aoeStart.x, aoeStart.y, radius, angle - Math.PI / 6, angle + Math.PI / 6);
            ctx.lineTo(aoeStart.x, aoeStart.y);
            const distMeters = (radius / gridSize) * 1.5;
            labelText = `Cone: ${distMeters.toFixed(1)}m`;
            labelX = mX;
            labelY = mY - (15/scale);
        }
        
        ctx.fill(); ctx.stroke();
        ctx.font = `bold ${14 / scale}px sans-serif`; 
        ctx.fillStyle = "white"; 
        ctx.textAlign = "center";
        ctx.fillText(labelText, labelX, labelY);
        ctx.restore();
    }

    if (measureStart) {
        ctx.beginPath(); ctx.moveTo(measureStart.x, measureStart.y); ctx.lineTo(mX, mY);
        ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 3 / scale; ctx.setLineDash([10, 5]); ctx.stroke(); ctx.setLineDash([]); 
        const dist = (Math.hypot(mX - measureStart.x, mY - measureStart.y) / gridSize) * 1.5;
        ctx.font = `bold ${16 / scale}px sans-serif`; ctx.fillStyle = "#fbbf24"; ctx.textAlign = "center";
        ctx.fillText(`${dist.toFixed(1)}m`, (measureStart.x+mX)/2, (measureStart.y+mY)/2);
    }

    ctx.restore();
  }, [mapImage, offset, scale, gridSize, fogGrid, role, measureStart, aoeStart, activeAoE, aoeColor, globalBrightness, canvasSize, forceRender, fogDrawStart, isFogMode, fogShape, fogTool]); 

  const handleWheel = (e: React.WheelEvent) => {
    if (!mapImage || canvasSize.w === 0) return;
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1; 
    const proposedScale = scale * zoomFactor;

    const rect = canvasRef.current!.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX - offset.x) / scale;
    const worldY = (mouseY - offset.y) / scale;

    const proposedOffset = {
        x: mouseX - worldX * proposedScale,
        y: mouseY - worldY * proposedScale
    };

    const clamped = clampView(proposedOffset, proposedScale);
    onMapTransform(clamped.offset, clamped.scale);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    if (e.button === 1) e.preventDefault();

    const rect = canvasRef.current!.getBoundingClientRect();
    const worldX = (e.clientX - rect.left - offset.x) / scale;
    const worldY = (e.clientY - rect.top - offset.y) / scale;

    const isPanIntent = e.button === 1 || e.ctrlKey || (!activeAoE && !isFogMode && !isMKeyPressed.current && !e.altKey && !e.shiftKey);
    if (isPanIntent) {
        isPanningRef.current = true;
        panStartMouseRef.current = { x: e.clientX, y: e.clientY };
        panStartOffsetRef.current = { x: offset.x, y: offset.y };
        return;
    }

    if (e.button !== 0) return;
    if (e.altKey) return; 
    if (isMKeyPressed.current) { setMeasureStart({ x: worldX, y: worldY }); return; }
    if (activeAoE) { setAoeStart({ x: worldX, y: worldY }); return; }
    
    if (isFogMode) { 
        if (fogShape === 'brush') {
            setIsPaintingFog(true); 
            onFogUpdate(Math.floor(worldX/gridSize), Math.floor(worldY/gridSize), fogTool === 'reveal'); 
            lastFogUpdate.current = Date.now();
        } else {
            setFogDrawStart({ x: worldX, y: worldY });
        }
        return; 
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    mousePosRef.current = { x: e.clientX, y: e.clientY };
    
    if (aoeStart || measureStart || fogDrawStart) setForceRender(prev => prev + 1);
    
    if (isFogMode && isPaintingFog && fogShape === 'brush') {
        const now = Date.now();
        if (now - lastFogUpdate.current > fogDebounceMs) {
            const rect = canvasRef.current!.getBoundingClientRect();
            const worldX = (e.clientX - rect.left - offset.x) / scale; 
            const worldY = (e.clientY - rect.top - offset.y) / scale;
            onFogUpdate(Math.floor(worldX/gridSize), Math.floor(worldY/gridSize), fogTool === 'reveal');
            lastFogUpdate.current = now;
        }
    }
    
    if (isPanningRef.current) {
        const deltaX = e.clientX - panStartMouseRef.current.x;
        const deltaY = e.clientY - panStartMouseRef.current.y;
        
        const proposedOffset = {
            x: panStartOffsetRef.current.x + deltaX,
            y: panStartOffsetRef.current.y + deltaY
        };
        const clamped = clampView(proposedOffset, scale);
        onMapTransform(clamped.offset, clamped.scale);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    isPanningRef.current = false;
    
    if (isFogMode) {
        if (isPaintingFog && fogShape === 'brush') {
            setIsPaintingFog(false);
            const rect = canvasRef.current!.getBoundingClientRect();
            const worldX = (e.clientX - rect.left - offset.x) / scale; 
            const worldY = (e.clientY - rect.top - offset.y) / scale;
            onFogUpdate(Math.floor(worldX/gridSize), Math.floor(worldY/gridSize), fogTool === 'reveal');
        } 
        else if (fogDrawStart && onFogBulkUpdate) {
            const rect = canvasRef.current!.getBoundingClientRect();
            const endWorldX = (e.clientX - rect.left - offset.x) / scale;
            const endWorldY = (e.clientY - rect.top - offset.y) / scale;

            const startGridX = Math.floor(fogDrawStart.x / gridSize);
            const startGridY = Math.floor(fogDrawStart.y / gridSize);
            const endGridX = Math.floor(endWorldX / gridSize);
            const endGridY = Math.floor(endWorldY / gridSize);

            const cellsToUpdate: {x: number, y: number}[] = [];

            if (fogShape === 'rect') {
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
                onFogBulkUpdate(cellsToUpdate, fogTool === 'reveal');
            }
            setFogDrawStart(null);
        }
    }
    
    setMeasureStart(null);
    
    if (aoeStart && activeAoE && onAoEComplete) {
        const rect = canvasRef.current!.getBoundingClientRect();
        let worldX = (e.clientX - rect.left - offset.x) / scale;
        let worldY = (e.clientY - rect.top - offset.y) / scale;
        
        const dist = Math.hypot(worldX - aoeStart.x, worldY - aoeStart.y);
        
        if (dist < 5) {
            worldX = aoeStart.x + gridSize;
            worldY = aoeStart.y + gridSize;
        }
        
        onAoEComplete({ type: activeAoE, startX: aoeStart.x, startY: aoeStart.y, endX: worldX, endY: worldY });
        setAoeStart(null);
        setForceRender(prev => prev + 1);
    }
  };

  return (
      <canvas 
        ref={canvasRef} 
        width={canvasSize.w} 
        height={canvasSize.h} 
        className={`shadow-2xl absolute inset-0 ${isFogMode ? 'cursor-cell' : (measureStart || activeAoE) ? 'cursor-crosshair' : isPanningRef.current ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown} 
        onMouseMove={handleMouseMove} 
        onMouseUp={handleMouseUp} 
        onWheel={handleWheel} 
        onContextMenu={(e) => e.preventDefault()} 
      />
  );
};

export default CanvasMap;