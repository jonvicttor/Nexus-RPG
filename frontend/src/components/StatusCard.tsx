import React, { useRef } from 'react';
import { Entity } from '../App';

interface StatusCardProps {
  entity: Entity;
  onClose: () => void;
  position: { x: number, y: number }; 
  onSave: (id: number, updates: Partial<Entity>) => void;
}

const StatusCard: React.FC<StatusCardProps> = ({ entity, onClose, position, onSave }) => {
  const stats = entity.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const hpPercent = Math.max(0, Math.min(100, (entity.hp / entity.maxHp) * 100));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  // --- NOVA LÓGICA DE COMPRESSÃO DE IMAGEM ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        
        img.onload = () => {
          // Criar um canvas invisível para redimensionar
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 250; // Tamanho máximo (px) suficiente para um token
          
          // Mantém a proporção
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            
    
            const compressedBase64 = canvas.toDataURL('image/png');
            
            // Salva a versão leve
            onSave(entity.id, { image: compressedBase64 });
          }
        };
      };
      
      reader.readAsDataURL(file);
    }
  };
  // ------------------------------------------

  return (
    <div 
      className="absolute z-[200] w-64 bg-black/90 border-2 border-cyan-500 rounded-lg p-4 text-cyan-400 font-mono shadow-[0_0_20px_rgba(6,182,212,0.4)] backdrop-blur-md animate-in fade-in zoom-in duration-200"
      style={{ 
        left: Math.min(window.innerWidth - 300, position.x + 20), 
        top: Math.min(window.innerHeight - 400, position.y + 20) 
      }}
      onClick={(e) => e.stopPropagation()} 
    >
      <div className="flex justify-between items-start border-b border-cyan-500/30 pb-2 mb-3">
        <h3 className="text-xl font-bold uppercase tracking-widest drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]">STATUS</h3>
        <button onClick={onClose} className="text-cyan-600 hover:text-cyan-200 transition-colors">✕</button>
      </div>

      <div className="flex gap-3 mb-4">
        {/* Container da Imagem Clicável */}
        <div 
            className="w-16 h-16 border border-cyan-500/50 rounded bg-black flex items-center justify-center overflow-hidden cursor-pointer hover:border-white transition-all group relative shrink-0"
            onClick={handleImageClick}
            title="Clique para trocar a imagem"
        >
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*" 
            />
            {entity.image ? (
                <img 
                    src={entity.image} 
                    alt={entity.name} 
                    className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" 
                />
            ) : (
                <div className="text-2xl group-hover:scale-110 transition-transform">?</div>
            )}
            
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity flex items-center justify-center">
                <span className="text-[8px] text-white font-bold bg-black/70 px-1 rounded">EDIT</span>
            </div>
        </div>

        <div className="flex-1 text-xs overflow-hidden">
            <div className="flex justify-between items-center"><span className="opacity-70 mr-1">NOME:</span> <span className="font-bold text-white truncate">{entity.name}</span></div>
            <div className="flex justify-between items-center"><span className="opacity-70 mr-1">CLASSE:</span> <span className="truncate">{entity.classType || 'N/A'}</span></div>
            <div className="flex justify-between items-center"><span className="opacity-70 mr-1">TIPO:</span> <span className="uppercase truncate">{entity.type}</span></div>
        </div>
      </div>

      <div className="mb-4 space-y-1">
        <div className="flex justify-between text-[10px] uppercase"><span>Integridade (HP)</span> <span>{entity.hp}/{entity.maxHp}</span></div>
        <div className="w-full h-2 bg-gray-900 border border-cyan-900 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500 shadow-[0_0_10px_cyan]" style={{ width: `${hpPercent}%` }}></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-4">
        <div className="flex justify-between bg-cyan-900/20 px-2 py-1 rounded border border-cyan-500/20"><span>💪 FOR</span> <span className="text-white font-bold">{stats.str}</span></div>
        <div className="flex justify-between bg-cyan-900/20 px-2 py-1 rounded border border-cyan-500/20"><span>🏃 DES</span> <span className="text-white font-bold">{stats.dex}</span></div>
        <div className="flex justify-between bg-cyan-900/20 px-2 py-1 rounded border border-cyan-500/20"><span>❤️ CON</span> <span className="text-white font-bold">{stats.con}</span></div>
        <div className="flex justify-between bg-cyan-900/20 px-2 py-1 rounded border border-cyan-500/20"><span>🧠 INT</span> <span className="text-white font-bold">{stats.int}</span></div>
        <div className="flex justify-between bg-cyan-900/20 px-2 py-1 rounded border border-cyan-500/20"><span>🦉 SAB</span> <span className="text-white font-bold">{stats.wis}</span></div>
        <div className="flex justify-between bg-cyan-900/20 px-2 py-1 rounded border border-cyan-500/20"><span>🎭 CAR</span> <span className="text-white font-bold">{stats.cha}</span></div>
      </div>

      {entity.conditions && entity.conditions.length > 0 && (
          <div className="border-t border-cyan-500/30 pt-2">
              <span className="text-[10px] opacity-70 uppercase block mb-1">Condições Ativas:</span>
              <div className="flex gap-1 flex-wrap">
                  {entity.conditions.map(c => (
                      <span key={c} className="px-2 py-0.5 bg-red-900/50 border border-red-500 text-red-200 text-[10px] rounded uppercase">{c}</span>
                  ))}
              </div>
          </div>
      )}
      
      <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-cyan-300"></div>
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-cyan-300"></div>
    </div>
  );
};

export default StatusCard;