import React, { useRef, useEffect, useState } from 'react';

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
  
  onPan: (newOffset: { x: number, y: number }) => void;
  onZoom: (newScale: number) => void;
  
  activeAoE: 'circle' | 'cone' | 'cube' | null;
  aoeColor: string;
  onAoEComplete: (data?: AoEData) => void; 
  role: 'DM' | 'PLAYER';
  
  globalBrightness?: number;
}

const CanvasMap: React.FC<CanvasMapProps> = ({ 
  mapUrl, gridSize = 70, offset, scale,
  fogGrid, isFogMode, fogTool, onFogUpdate,
  onPan, onZoom,
  activeAoE, aoeColor, onAoEComplete, role, globalBrightness = 1
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  const [measureStart, setMeasureStart] = useState<{x: number, y: number} | null>(null);
  const [aoeStart, setAoeStart] = useState<{x: number, y: number} | null>(null);
  
  // Controles de Performance de Pan/Fog
  const [isPaintingFog, setIsPaintingFog] = useState(false);
  const isPanningRef = useRef(false);
  const panStartMouseRef = useRef({ x: 0, y: 0 });
  const panStartOffsetRef = useRef({ x: 0, y: 0 });
  const mousePosRef = useRef({ x: 0, y: 0 });
  const isMKeyPressed = useRef(false);
  const [forceRender, setForceRender] = useState(0);

  // NOVO: Throttle para Sockets da Névoa (Reduz LAG)
  const lastFogUpdate = useRef<number>(0);
  const fogDebounceMs = 50; 

  useEffect(() => {
      const handleResize = () => setCanvasSize({ w: window.innerWidth, h: window.innerHeight });
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
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

  // O "Motor Gráfico" do Canvas
  useEffect(() => {
    const canvas = canvasRef.current; 
    if (!canvas || !mapImage) return;
    const ctx = canvas.getContext('2d'); 
    if (!ctx) return;
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save(); 
    ctx.translate(offset.x, offset.y); 
    ctx.scale(scale, scale);
    
    // Desenha o Fundo
    ctx.drawImage(mapImage, 0, 0, mapImage.width, mapImage.height);

    // Sistema de Iluminação Global
    if (globalBrightness < 1) {
        ctx.save();
        ctx.fillStyle = "#000000";
        ctx.globalAlpha = 1 - globalBrightness; 
        ctx.fillRect(0, 0, mapImage.width, mapImage.height);
        ctx.restore();
    }

    // Desenha a Névoa de Guerra
    if (fogGrid && fogGrid.length > 0) {
      ctx.fillStyle = "#000000"; 
      ctx.globalAlpha = role === 'DM' ? 0.6 : 1.0; 
      // Em vez de iterar sobre TODO o array de 8000x8000, 
      // iteramos apenas sobre a zona visível no Canvas para poupar CPU
      
      const startCol = Math.max(0, Math.floor(-offset.x / (gridSize * scale)));
      const startRow = Math.max(0, Math.floor(-offset.y / (gridSize * scale)));
      const endCol = Math.min(fogGrid[0]?.length || 0, Math.ceil((canvas.width - offset.x) / (gridSize * scale)));
      const endRow = Math.min(fogGrid.length, Math.ceil((canvas.height - offset.y) / (gridSize * scale)));

      for (let y = startRow; y < endRow; y++) {
          if (!fogGrid[y]) continue;
          for (let x = startCol; x < endCol; x++) {
             if (fogGrid[y][x] === false) { 
                 // Pinta apenas os quadrados não revelados
                 ctx.fillRect(x * gridSize, y * gridSize, gridSize + 1, gridSize + 1); 
             }
          }
      }
      ctx.globalAlpha = 1.0; 
    }

    // Geometria de Magias e Régua
    const rect = canvas.getBoundingClientRect();
    const mX = (mousePosRef.current.x - rect.left - offset.x) / scale;
    const mY = (mousePosRef.current.y - rect.top - offset.y) / scale;

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
  }, [mapImage, offset, scale, gridSize, fogGrid, role, measureStart, aoeStart, activeAoE, aoeColor, globalBrightness, canvasSize, forceRender]); 

  const handleWheel = (e: React.WheelEvent) => {
    const newScale = Math.min(Math.max(0.1, scale - e.deltaY * 0.001), 5);
    onZoom(newScale);
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
        setIsPaintingFog(true); 
        onFogUpdate(Math.floor(worldX/gridSize), Math.floor(worldY/gridSize), fogTool === 'reveal'); 
        lastFogUpdate.current = Date.now();
        return; 
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    mousePosRef.current = { x: e.clientX, y: e.clientY };
    
    if (aoeStart || measureStart) setForceRender(prev => prev + 1);
    
    if (isFogMode && isPaintingFog) {
        const now = Date.now();
        // OTIMIZAÇÃO: Throttle (Apenas atualiza o socket de névoa a cada X ms)
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
        onPan({
            x: panStartOffsetRef.current.x + deltaX,
            y: panStartOffsetRef.current.y + deltaY
        });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    isPanningRef.current = false;
    
    if (isPaintingFog) {
        setIsPaintingFog(false);
        // Garante que o último quadrado pintado no mouseUp é registado
        const rect = canvasRef.current!.getBoundingClientRect();
        const worldX = (e.clientX - rect.left - offset.x) / scale; 
        const worldY = (e.clientY - rect.top - offset.y) / scale;
        onFogUpdate(Math.floor(worldX/gridSize), Math.floor(worldY/gridSize), fogTool === 'reveal');
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
        
        onAoEComplete({
            type: activeAoE,
            startX: aoeStart.x,
            startY: aoeStart.y,
            endX: worldX,
            endY: worldY
        });
        
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