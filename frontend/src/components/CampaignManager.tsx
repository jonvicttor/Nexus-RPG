import React, { useState } from 'react';
// ✅ CORREÇÃO: Removi os ícones não utilizados para limpar os erros
import { Plus, Trash2, BookOpen, Scroll, Shield, Map } from 'lucide-react';

// Tipos para os dados da campanha
interface CampaignNote {
  id: string;
  title: string;
  content: string;
  type: 'story' | 'quest' | 'npc' | 'location';
}

const CampaignManager: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'story' | 'database'>('story');
  const [notes, setNotes] = useState<CampaignNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  
  // Estado para nova nota
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editType, setEditType] = useState<'story' | 'quest' | 'npc' | 'location'>('story');

  const handleSaveNote = () => {
    if (!editTitle.trim()) return;
    
    if (selectedNoteId) {
      // Editando existente
      setNotes(prev => prev.map(n => n.id === selectedNoteId ? { ...n, title: editTitle, content: editContent, type: editType } : n));
    } else {
      // Criando nova
      const newNote: CampaignNote = {
        id: Date.now().toString(),
        title: editTitle,
        content: editContent,
        type: editType
      };
      setNotes(prev => [...prev, newNote]);
    }
    
    // Limpa e fecha
    setIsEditing(false);
    setSelectedNoteId(null);
    setEditTitle('');
    setEditContent('');
  };

  const handleEditClick = (note: CampaignNote) => {
    setSelectedNoteId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditType(note.type);
    setIsEditing(true);
  };

  const handleNewClick = () => {
    setSelectedNoteId(null);
    setEditTitle('');
    setEditContent('');
    setEditType('story');
    setIsEditing(true);
  };

  const handleDeleteClick = (id: string) => {
    if (window.confirm('Tem certeza que deseja apagar esta anotação?')) {
      setNotes(prev => prev.filter(n => n.id !== id));
      if (selectedNoteId === id) setIsEditing(false);
    }
  };

  // Ícones por tipo
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'story': return <BookOpen size={14} className="text-yellow-500" />;
      case 'quest': return <Scroll size={14} className="text-blue-400" />;
      case 'npc': return <Shield size={14} className="text-green-400" />; 
      case 'location': return <Map size={14} className="text-purple-400" />;
      default: return <BookOpen size={14} />;
    }
  };

  return (
    <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
      
      {/* --- MENU SUPERIOR DA CAMPANHA --- */}
      <div className="flex gap-2 p-2 border-b border-white/10 bg-black/20">
        <button 
          onClick={() => setActiveSection('story')} 
          className={`flex-1 py-2 text-xs font-bold uppercase rounded transition-colors ${activeSection === 'story' ? 'bg-yellow-900/40 text-yellow-200 border border-yellow-500/30' : 'bg-transparent text-gray-500 hover:text-white'}`}
        >
          📖 Narrativa
        </button>
        <button 
          onClick={() => setActiveSection('database')} 
          className={`flex-1 py-2 text-xs font-bold uppercase rounded transition-colors ${activeSection === 'database' ? 'bg-blue-900/40 text-blue-200 border border-blue-500/30' : 'bg-transparent text-gray-500 hover:text-white'}`}
        >
          📚 Banco de Dados
        </button>
      </div>

      {/* --- CONTEÚDO PRINCIPAL --- */}
      <div className="flex-grow overflow-hidden flex flex-col p-3">
        
        {/* MODO EDIÇÃO (Formulário) */}
        {isEditing ? (
          <div className="flex flex-col h-full gap-3">
            <input 
              type="text" 
              placeholder="Título do Capítulo / Nota" 
              className="w-full bg-black/50 border border-white/20 rounded p-2 text-white font-bold text-sm focus:border-yellow-500 outline-none"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
            />
            
            <select 
              className="w-full bg-black/50 border border-white/20 rounded p-2 text-gray-300 text-xs focus:border-yellow-500 outline-none"
              value={editType}
              onChange={e => setEditType(e.target.value as any)}
            >
              <option value="story">📖 Capítulo de História</option>
              <option value="quest">📜 Missão (Quest)</option>
              <option value="npc">👤 NPC Importante</option>
              <option value="location">🗺️ Localização / Lore</option>
            </select>

            <textarea 
              placeholder="Escreva os detalhes aqui..." 
              className="flex-grow w-full bg-black/30 border border-white/10 rounded p-3 text-sm text-gray-300 resize-none focus:border-yellow-500/50 outline-none custom-scrollbar leading-relaxed"
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
            />

            <div className="flex gap-2">
              <button onClick={() => setIsEditing(false)} className="flex-1 py-2 bg-gray-800 text-gray-400 rounded text-xs font-bold hover:bg-gray-700">Cancelar</button>
              <button onClick={handleSaveNote} className="flex-1 py-2 bg-green-700 text-white rounded text-xs font-bold hover:bg-green-600">Salvar</button>
            </div>
          </div>
        ) : (
          /* MODO LISTA (Visualização) */
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                {activeSection === 'story' ? 'Capítulos da História' : 'Banco de Dados'}
              </h3>
              <button onClick={handleNewClick} className="bg-yellow-700/80 hover:bg-yellow-600 text-white p-1.5 rounded-full shadow-lg transition-transform active:scale-95">
                <Plus size={16} />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar space-y-2 pr-1">
              {notes.filter(n => activeSection === 'story' ? n.type === 'story' : n.type !== 'story').length === 0 ? (
                <p className="text-gray-600 text-xs text-center py-10 italic">Nenhum registro encontrado...</p>
              ) : (
                notes
                  .filter(n => activeSection === 'story' ? n.type === 'story' : n.type !== 'story')
                  .map(note => (
                    <div key={note.id} className="group bg-black/40 border border-white/5 hover:border-white/20 rounded p-3 transition-all cursor-pointer" onClick={() => handleEditClick(note)}>
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(note.type)}
                          <h4 className="text-sm font-bold text-gray-200 group-hover:text-yellow-400 transition-colors">{note.title}</h4>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(note.id); }}
                          className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed">
                        {note.content || "Sem conteúdo..."}
                      </p>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignManager;