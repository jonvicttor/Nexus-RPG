import React, { useState } from 'react';
import { Entity, MonsterPreset } from '../App';

interface MonsterCreatorModalProps {
  onSave: (data: Partial<Entity>) => void;
  // ADICIONEI ESTA LINHA:
  onSavePreset: (preset: MonsterPreset) => void;
  onClose: () => void;
}

const MonsterCreatorModal: React.FC<MonsterCreatorModalProps> = ({ onSave, onSavePreset, onClose }) => {
  const [targetLevel, setTargetLevel] = useState(1);
  const [data, setData] = useState({
    name: '',
    type: 'Monstrosidade Média',
    ac: 12,
    hp: 20,
    size: 1, 
    stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    image: ''
  });

  const handleChange = (field: string, value: any) => setData(prev => ({ ...prev, [field]: value }));
  
  const handleStatChange = (stat: string, value: string) => {
    const val = parseInt(value) || 10;
    setData(prev => ({ ...prev, stats: { ...prev.stats, [stat]: val } }));
  };

  // --- LÓGICA DE ESCALONAMENTO ---
  const handleApplyScaling = () => {
      if (targetLevel <= 1) return;

      // Fatores de crescimento
      const levelDiff = targetLevel - 1;
      const hpMultiplier = 1 + (levelDiff * 0.20); // +20% de HP por nível
      const acBonus = Math.floor(levelDiff / 3);   // +1 AC a cada 3 níveis
      const statBonus = Math.floor(levelDiff / 4); // +1 All Stats a cada 4 níveis

      // Sugestão de aumento de tamanho para chefões
      let newSize = data.size;
      if (targetLevel >= 5 && data.size < 2) newSize = 2; // Grande
      if (targetLevel >= 10 && data.size < 3) newSize = 3; // Enorme

      setData(prev => ({
          ...prev,
          hp: Math.floor(prev.hp * hpMultiplier),
          ac: prev.ac + acBonus,
          size: newSize,
          name: `${prev.name || 'Monstro'} (Lv.${targetLevel})`,
          stats: {
              str: prev.stats.str + statBonus,
              dex: prev.stats.dex + statBonus,
              con: prev.stats.con + statBonus,
              int: prev.stats.int + statBonus,
              wis: prev.stats.wis + statBonus,
              cha: prev.stats.cha + statBonus,
          }
      }));
  };

  // --- LÓGICA DE COMPRESSÃO PARA EVITAR QUE O PNG SUMA ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 800; 
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
          } else {
            if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            // WebP com transparência e compressão resolve o problema do Socket.io
            const compressedBase64 = canvas.toDataURL('image/webp', 0.8);
            handleChange('image', compressedBase64);
          }
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    onSave({
      name: data.name || 'Monstro Desconhecido',
      hp: Number(data.hp),
      maxHp: Number(data.hp),
      ac: Number(data.ac),
      stats: data.stats,
      image: data.image,
      classType: data.type,
      size: data.size
    });
  };

  // NOVA FUNÇÃO PARA SALVAR O PRESET
  const handleSavePresetClick = () => {
      if (!data.name) return alert("Dê um nome ao monstro para salvar.");
      const newPreset: MonsterPreset = {
          name: data.name,
          hp: Number(data.hp),
          ac: Number(data.ac),
          image: data.image || '/tokens/lobo.png',
          size: data.size
      };
      onSavePreset(newPreset);
      alert(`Preset "${data.name}" salvo com sucesso!`);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#1a1a1a] border-2 border-red-900 w-full max-w-lg rounded-lg shadow-2xl flex flex-col animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        
        <div className="bg-red-900/20 p-4 border-b border-red-900/50 flex justify-between items-start">
          <div className="flex-1 mr-4">
            <input 
              className="bg-transparent text-2xl font-serif font-bold text-red-500 uppercase tracking-wider w-full outline-none placeholder-red-800"
              value={data.name}
              onChange={e => handleChange('name', e.target.value)}
              placeholder="NOME DO MONSTRO"
              autoFocus
            />
            <input 
              className="bg-transparent text-xs text-gray-400 italic w-full outline-none mt-1"
              value={data.type}
              onChange={e => handleChange('type', e.target.value)}
              placeholder="Tipo / Tamanho / Tendência"
            />
          </div>
          <div className="w-16 h-16 border border-red-500/30 rounded bg-black overflow-hidden relative cursor-pointer hover:border-red-500 transition-colors">
             <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleImageUpload} accept="image/*" />
             {data.image ? <img src={data.image} className="w-full h-full object-cover" alt="Preview" /> : <div className="flex items-center justify-center h-full text-red-900 font-bold text-xs">IMG</div>}
          </div>
        </div>

        {/* --- BARRA DE ESCALONAMENTO DE NÍVEL --- */}
        <div className="px-6 py-2 bg-black/40 border-b border-white/5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 w-full">
                <span className="text-[10px] uppercase font-bold text-red-400 whitespace-nowrap">Escalar Poder:</span>
                <input 
                    type="range" min="1" max="20" 
                    value={targetLevel} 
                    onChange={(e) => setTargetLevel(parseInt(e.target.value))} 
                    className="w-full accent-red-600 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-white font-bold font-mono w-8 text-center">{targetLevel}</span>
            </div>
            <button 
                onClick={handleApplyScaling}
                className="bg-red-900/50 hover:bg-red-600 border border-red-500/30 text-white text-[10px] font-bold px-3 py-1 rounded uppercase transition-all active:scale-95"
            >
                Aplicar
            </button>
        </div>

        <div className="p-6 space-y-4 text-gray-300 font-serif overflow-y-auto max-h-[60vh] custom-scrollbar">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
                <span className="text-red-500 font-bold">CA:</span>
                <input type="number" className="bg-black/30 border-b border-red-900/30 w-full text-white text-center outline-none focus:border-red-500" value={data.ac} onChange={e => handleChange('ac', e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
                <span className="text-red-500 font-bold">PV:</span>
                <input type="number" className="bg-black/30 border-b border-red-900/30 w-full text-white text-center outline-none focus:border-red-500" value={data.hp} onChange={e => handleChange('hp', e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
                <span className="text-red-500 font-bold">Tam:</span>
                <select className="bg-black/30 border-b border-red-900/30 w-full text-white text-center outline-none focus:border-red-500" value={data.size} onChange={e => handleChange('size', parseFloat(e.target.value))}>
                    <option value="0.5">1.5x1.5</option>
                    <option value="1">2x2</option>
                    <option value="2">3x3</option>
                    <option value="3">4x4</option>
                    <option value="4">5x5</option>
                </select>
            </div>
          </div>

          <div className="h-px w-full bg-red-900/30"></div>

          <div className="grid grid-cols-6 gap-2 text-center">
            {Object.keys(data.stats).map(stat => (
                <div key={stat} className="flex flex-col items-center p-1 bg-black/20 rounded border border-white/5">
                    <span className="text-[10px] font-bold uppercase text-red-400">{stat}</span>
                    <input 
                        type="number" 
                        className="w-full bg-transparent text-center text-white font-bold outline-none"
                        value={(data.stats as any)[stat]}
                        onChange={e => handleStatChange(stat, e.target.value)}
                    />
                    <span className="text-[9px] text-gray-500">
                        {Math.floor(((data.stats as any)[stat] - 10) / 2) >= 0 ? '+' : ''}{Math.floor(((data.stats as any)[stat] - 10) / 2)}
                    </span>
                </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-black/40 border-t border-white/10 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs uppercase font-bold text-gray-500 hover:text-white transition-colors">Cancelar</button>
            
            {/* BOTÃO SALVAR PRESET */}
            <button 
                type="button" 
                onClick={handleSavePresetClick} 
                className="w-12 bg-gray-800 hover:bg-blue-600 border border-white/10 rounded flex items-center justify-center text-xl transition-colors" 
                title="Salvar Preset"
            >
                💾
            </button>

            <button onClick={handleSave} className="px-6 py-2 bg-red-900 hover:bg-red-700 text-white text-xs uppercase font-bold rounded shadow-lg border border-red-500/30">CRIAR</button>
        </div>
      </div>
    </div>
  );
};

export default MonsterCreatorModal;