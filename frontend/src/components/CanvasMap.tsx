import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FogRoom, Wall } from '../App';

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
  role: 'DM' | 'PLAYER';
  globalBrightness?: number;
  fogRooms?: FogRoom[];
  walls?: Wall[]; // 👉 ESTRUTURA DECLARADA: Fim do erro 2322!
}

const CanvasMap: React.FC<CanvasMapProps> = ({ 
  mapUrl, gridSize = 70, offset, scale,
  fogGrid, role, globalBrightness = 1,
  fogRooms = [], walls = []
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

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
    
    ctx.drawImage(mapImage, 0, 0, mapImage.width, mapImage.height);

    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1 / scale; 
    
    ctx.beginPath();
    for (let x = 0; x <= mapImage.width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, mapImage.height);
    }
    for (let y = 0; y <= mapImage.height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(mapImage.width, y);
    }
    ctx.stroke();
    ctx.restore();

    if (globalBrightness < 1) {
        ctx.save();
        ctx.fillStyle = "#000000";
        ctx.globalAlpha = 1 - globalBrightness; 
        ctx.fillRect(0, 0, mapImage.width, mapImage.height);
        ctx.restore();
    }

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

      if (role === 'DM') {
          // 👉 DESENHA AS PAREDES VETORIAIS
          if (walls && walls.length > 0) {
              ctx.save();
              ctx.strokeStyle = "#ef4444"; 
              ctx.lineWidth = 4 / scale;
              ctx.lineCap = "round";
              ctx.shadowColor = "rgba(0,0,0,0.8)";
              ctx.shadowBlur = 4 / scale;
              
              ctx.beginPath();
              walls.forEach(w => {
                  ctx.moveTo(w.x1 * gridSize, w.y1 * gridSize);
                  ctx.lineTo(w.x2 * gridSize, w.y2 * gridSize);
              });
              ctx.stroke();
              
              ctx.fillStyle = "#ef4444";
              walls.forEach(w => {
                  ctx.beginPath(); ctx.arc(w.x1 * gridSize, w.y1 * gridSize, 3/scale, 0, Math.PI*2); ctx.fill();
                  ctx.beginPath(); ctx.arc(w.x2 * gridSize, w.y2 * gridSize, 3/scale, 0, Math.PI*2); ctx.fill();
              });
              ctx.restore();
          }

          if (fogRooms && fogRooms.length > 0) {
              ctx.save();
              fogRooms.forEach((room: FogRoom) => {
                  if (!room || !room.cells || room.cells.length === 0) return;

                  let minX = room.cells[0].x, maxX = room.cells[0].x;
                  let minY = room.cells[0].y, maxY = room.cells[0].y;

                  room.cells.forEach((cell: {x: number, y: number}) => {
                      if (cell.x < minX) minX = cell.x;
                      if (cell.x > maxX) maxX = cell.x;
                      if (cell.y < minY) minY = cell.y;
                      if (cell.y > maxY) maxY = cell.y;
                  });

                  const width = (maxX - minX + 1) * gridSize;
                  const height = (maxY - minY + 1) * gridSize;
                  const pxX = minX * gridSize;
                  const pxY = minY * gridSize;

                  ctx.strokeStyle = "rgba(6, 182, 212, 0.8)";
                  ctx.lineWidth = 4 / scale;
                  ctx.setLineDash([15 / scale, 10 / scale]);
                  ctx.strokeRect(pxX, pxY, width, height);
                  ctx.setLineDash([]);

                  const labelX = pxX + (width / 2);
                  const labelY = pxY + (height / 2);
                  
                  ctx.font = `bold ${18 / scale}px sans-serif`;
                  ctx.textAlign = "center";
                  ctx.textBaseline = "middle";
                  
                  const textMetrics = ctx.measureText(room.name || 'Cômodo');
                  const paddingX = 12 / scale;
                  const paddingY = 8 / scale;
                  
                  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
                  ctx.fillRect(
                      labelX - (textMetrics.width / 2) - paddingX,
                      labelY - (18 / scale / 2) - paddingY,
                      textMetrics.width + (paddingX * 2),
                      (18 / scale) + (paddingY * 2)
                  );

                  ctx.fillStyle = "#22d3ee";
                  ctx.fillText(room.name || 'Cômodo', labelX, labelY);
              });
              ctx.restore();
          }
      }
    }

    ctx.restore();
  }, [mapImage, offset, scale, gridSize, fogGrid, role, globalBrightness, canvasSize, fogRooms, walls, clampView]); 

  return (
      <canvas 
        ref={canvasRef} 
        width={canvasSize.w} 
        height={canvasSize.h} 
        className={`shadow-2xl absolute inset-0 pointer-events-none`}
      />
  );
};

export default CanvasMap;