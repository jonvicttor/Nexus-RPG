import React, { useState, useEffect } from 'react';
import { Eraser, PenTool } from 'lucide-react'; // Removido 'Save'

const Scratchpad: React.FC = () => {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'saved' | 'saving'>('saved');

  // Carrega notas ao iniciar
  useEffect(() => {
    const savedNotes = localStorage.getItem('nexus_dm_scratchpad');
    if (savedNotes) {
      setText(savedNotes);
    }
  }, []);

  // Salva automaticamente ao digitar
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setText(newVal);
    setStatus('saving');
    
    // Salva no LocalStorage
    localStorage.setItem('nexus_dm_scratchpad', newVal);
    
    // Pequeno delay visual para mostrar que salvou
    setTimeout(() => setStatus('saved'), 500);
  };

  const handleClear = () => {
    if (window.confirm('Limpar todas as anotações?')) {
      setText('');
      localStorage.removeItem('nexus_dm_scratchpad');
    }
  };

  return (
    <div className="bg-[#15151a] border border-white/10 rounded-xl overflow-hidden shadow-lg flex flex-col h-64 transition-all hover:border-amber-900/50">
      {/* Cabeçalho */}
      <div className="bg-black/40 px-3 py-2 border-b border-white/5 flex justify-between items-center">
        <div className="flex items-center gap-2 text-amber-500/80">
          <PenTool size={14} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Anotações Rápidas</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] uppercase font-mono transition-colors ${status === 'saving' ? 'text-yellow-500 animate-pulse' : 'text-green-500/50'}`}>
            {status === 'saving' ? 'Salvando...' : 'Salvo'}
          </span>
          <button 
            onClick={handleClear} 
            className="text-gray-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-white/5" 
            title="Limpar tudo"
          >
            <Eraser size={14} />
          </button>
        </div>
      </div>

      {/* Área de Texto */}
      <textarea
        className="flex-grow w-full bg-[#0a0a0a] text-gray-300 p-3 text-xs font-mono leading-relaxed resize-none outline-none custom-scrollbar focus:bg-black transition-colors placeholder-gray-700"
        placeholder="PVs temporários, Iniciativas manuais, Ideias de loot..."
        value={text}
        onChange={handleChange}
        spellCheck={false}
      />
    </div>
  );
};

export default Scratchpad;