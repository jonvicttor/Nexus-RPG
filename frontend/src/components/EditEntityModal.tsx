import React, { useState, useRef } from 'react';
import { Entity, Item } from '../App';

interface EditEntityModalProps {
  entity: Entity;
  onSave: (id: number, updates: Partial<Entity>) => void;
  onClose: () => void;
  availableClasses?: any[]; 
  availableSpells?: any[]; 
  availableItems?: any[]; 
  availableRaces?: any[];
}

const EditEntityModal: React.FC<EditEntityModalProps> = ({ entity, onSave, onClose, availableClasses = [], availableSpells = [], availableItems = [], availableRaces = [] }) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'inventory' | 'spells'>('stats');
  
  const [formData, setFormData] = useState({
    name: entity.name,
    hp: entity.hp,
    maxHp: entity.maxHp,
    ac: entity.ac,
    classType: entity.classType || '', 
    race: entity.race || '',
    size: entity.size || 1,
    image: entity.image || '',
    visionRadius: entity.visionRadius || 9,
    stats: entity.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencies: entity.proficiencies || {}, 
    inventory: entity.inventory || [],
    spells: entity.spells || []
  });

  const [newItemName, setNewItemName] = useState('');
  const [spellSearch, setSpellSearch] = useState(''); 
  const [itemSearch, setItemSearch] = useState(''); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name.startsWith('stat-')) {
      const statName = name.replace('stat-', '');
      setFormData(prev => ({ ...prev, stats: { ...prev.stats, [statName]: parseInt(value) || 0 } }));
    } else if (name === 'size') {
      setFormData(prev => ({ ...prev, size: parseFloat(value) || 1 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: name === 'name' || name === 'classType' || name === 'race' ? value : parseInt(value) || 0 }));
    }
  };

  // 👉 CORREÇÃO: Agora a classe salva o ID em inglês do 5eTools de forma oculta para não quebrar a UI
  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const className = e.target.value;
    const selectedClass = availableClasses.find(c => c.name === className);
    if (selectedClass) {
        const newProfs = { ...formData.proficiencies };
        selectedClass.saves.forEach((save: string) => { newProfs[`save-${save.toLowerCase()}`] = 1; });
        // Embutindo o source/id original para usarmos no Grimório Flutuante
        const classString = `${className} (${selectedClass.source?.toLowerCase() || className.toLowerCase()})`;
        setFormData(prev => ({ ...prev, classType: classString, proficiencies: newProfs }));
    } else {
        setFormData(prev => ({ ...prev, classType: className }));
    }
  };

  const handleRaceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const raceName = e.target.value;
      const selectedRace = availableRaces.find(r => r.name === raceName);
      
      if (selectedRace) {
          setFormData(prev => ({
              ...prev,
              race: raceName,
              size: selectedRace.size || 1, 
              visionRadius: selectedRace.visionRadius || 9 
          }));
      } else {
          setFormData(prev => ({ ...prev, race: raceName }));
      }
  };

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
          let width = img.width; let height = img.height;
          if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, width, height); ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/png');
            setFormData(prev => ({ ...prev, image: compressedBase64 }));
          }
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddItem = (itemFromCompendium?: any) => {
      let newItem: Item;

      if (itemFromCompendium) {
          newItem = {
              id: Date.now().toString() + Math.random(),
              name: itemFromCompendium.name,
              description: 'Item do compêndio.',
              image: '', 
              type: itemFromCompendium.type as any,
              quantity: 1,
              weight: itemFromCompendium.weight,
              value: itemFromCompendium.value,
              rarity: itemFromCompendium.rarity?.toLowerCase() || 'common',
              stats: {
                  damage: itemFromCompendium.damage,
                  ac: itemFromCompendium.ac,
                  properties: itemFromCompendium.properties
              }
          };
      } else {
          if (!newItemName.trim()) return;
          newItem = {
              id: Date.now().toString(),
              name: newItemName,
              description: 'Item customizado.',
              image: '', type: 'misc', quantity: 1
          };
          setNewItemName('');
      }

      setFormData(prev => ({ ...prev, inventory: [...prev.inventory, newItem] }));
  };

  const handleDeleteItem = (itemId: string) => { setFormData(prev => ({ ...prev, inventory: prev.inventory.filter(i => i.id !== itemId) })); };

  const handleToggleSpell = (spell: any) => {
      setFormData(prev => {
          const hasSpell = prev.spells.find(s => s.name === spell.name);
          if (hasSpell) return { ...prev, spells: prev.spells.filter(s => s.name !== spell.name) };
          else return { ...prev, spells: [...prev.spells, { id: Date.now().toString() + Math.random(), name: spell.name, level: spell.level }] };
      });
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(entity.id, formData); onClose(); };

  const filteredSpells = availableSpells.filter(s => s.name.toLowerCase().includes(spellSearch.toLowerCase())).slice(0, 30);
  const filteredItems = itemSearch.trim() === '' ? [] : availableItems.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase())).slice(0, 15);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-rpgPanel border border-rpgAccent/30 p-6 rounded-lg shadow-2xl w-full max-w-md animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        
        <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
            <h2 className="text-rpgAccent font-bold uppercase">Ficha: {entity.name || 'Nova Entidade'}</h2>
            <div className="flex gap-1">
                <button onClick={() => setActiveTab('stats')} className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${activeTab === 'stats' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Atributos</button>
                <button onClick={() => setActiveTab('inventory')} className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${activeTab === 'inventory' ? 'bg-amber-600 text-white shadow-md' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Inventário</button>
                <button onClick={() => setActiveTab('spells')} className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${activeTab === 'spells' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Magias</button>
            </div>
        </div>
        
        {activeTab === 'stats' && (
            <form id="edit-form" onSubmit={handleSubmit} className="overflow-y-auto custom-scrollbar pr-2">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="col-span-2">
                      <label className="block text-[10px] text-gray-400 uppercase mb-1">Nome da Criatura</label>
                      <input name="name" value={formData.name} onChange={handleChange} className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-sm text-white outline-none focus:border-blue-500" />
                  </div>

                  <div className="col-span-2 flex gap-4">
                      <div className="flex-1">
                          <label className="block text-[10px] text-purple-400 uppercase mb-1 font-bold">Classe</label>
                          <select name="classType" value={formData.classType.split(' (')[0]} onChange={handleClassChange} className="w-full bg-black/40 border border-purple-500/30 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-purple-500 cursor-pointer">
                              <option value="">Nenhuma</option>
                              {availableClasses.map((cls: any) => (<option key={cls.name} value={cls.name}>{cls.name}</option>))}
                          </select>
                      </div>

                      <div className="flex-1">
                          <label className="block text-[10px] text-green-400 uppercase mb-1 font-bold">Raça</label>
                          <select name="race" value={formData.race} onChange={handleRaceChange} className="w-full bg-black/40 border border-green-500/30 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-green-500 cursor-pointer">
                              <option value="">Nenhuma</option>
                              {availableRaces.map((r: any) => (<option key={r.name} value={r.name}>{r.name}</option>))}
                          </select>
                      </div>
                  </div>

                  <div>
                      <label className="block text-[10px] text-gray-400 uppercase mb-1">HP Atual</label>
                      <input type="number" name="hp" value={formData.hp} onChange={handleChange} className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-sm text-white outline-none focus:border-blue-500" />
                  </div>
                  <div>
                      <label className="block text-[10px] text-gray-400 uppercase mb-1">HP Máximo</label>
                      <input type="number" name="maxHp" value={formData.maxHp} onChange={handleChange} className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-sm text-white outline-none focus:border-blue-500" />
                  </div>
                  
                  <div className="col-span-2">
                      <label className="block text-[10px] text-yellow-400 uppercase mb-1 font-bold">Raio de Visão</label>
                      <div className="flex items-center gap-2">
                          <input type="number" name="visionRadius" value={formData.visionRadius} onChange={handleChange} className="w-24 bg-black/40 border border-yellow-500/50 rounded px-2 py-1 text-sm text-yellow-400 outline-none focus:border-yellow-400" />
                          <span className="text-[9px] text-gray-500 italic">Ex: 9 quadrados.</span>
                      </div>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-[10px] text-gray-400 uppercase mb-1 font-bold">Tamanho no Mapa (Escala)</label>
                  <select name="size" value={formData.size} onChange={handleChange} className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-sm text-white outline-none focus:border-blue-500 cursor-pointer">
                      <option value="0.8">Pequeno</option><option value="1">Médio</option><option value="2">Grande</option><option value="3">Enorme</option><option value="4">Imenso</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-[10px] text-rpgAccent uppercase mb-2 font-bold tracking-widest">Atributos Base</label>
                  <div className="grid grid-cols-3 gap-2 bg-black/20 p-3 rounded border border-white/5">
                      {Object.entries(formData.stats).map(([stat, value]) => (
                      <div key={stat} className="flex flex-col">
                          <label className="text-[9px] text-gray-500 uppercase text-center">{stat}</label>
                          <input type="number" name={`stat-${stat}`} value={value} onChange={handleChange} className="bg-black/60 border border-white/10 rounded text-center text-xs py-1 text-blue-400 focus:border-blue-500 outline-none" />
                      </div>
                      ))}
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-[10px] text-gray-400 uppercase mb-2 font-bold">Token (Imagem)</label>
                  <div className="w-full h-20 border-2 border-dashed border-white/10 rounded bg-black/40 flex items-center justify-center cursor-pointer hover:border-blue-500 transition-all overflow-hidden group relative" onClick={() => fileInputRef.current?.click()}>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                      {formData.image ? (
                      <>
                          <img src={formData.image} alt="Preview" className="h-full w-auto object-contain transition-opacity group-hover:opacity-50" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><span className="text-[10px] text-white font-bold bg-black/60 px-2 py-1 rounded">TROCAR</span></div>
                      </>
                      ) : (
                      <div className="flex flex-col items-center gap-1 text-gray-500 group-hover:text-blue-400"><span className="text-xl">📷</span><span className="text-[9px] uppercase font-bold">Upload</span></div>
                      )}
                  </div>
                </div>
            </form>
        )}

        {activeTab === 'inventory' && (
            <div className="flex flex-col flex-grow overflow-hidden">
                <div className="mb-4 bg-black/30 p-2 rounded border border-amber-500/20">
                    <h3 className="text-[10px] font-bold text-amber-400 uppercase mb-2 flex justify-between">Mochila <span>{formData.inventory.length} itens</span></h3>
                    <div className="max-h-32 overflow-y-auto flex flex-col gap-1 custom-scrollbar">
                        {formData.inventory.length === 0 && <p className="text-xs text-gray-500 italic text-center py-2">Mochila vazia.</p>}
                        {formData.inventory.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-amber-900/10 p-1.5 rounded border border-amber-500/20">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <div className="text-xs font-bold text-gray-200 truncate">{item.name}</div>
                                    {item.stats?.damage && <span className="text-[9px] bg-red-900/50 text-red-300 px-1 rounded border border-red-500/30 whitespace-nowrap">{item.stats.damage}</span>}
                                    {item.stats?.ac && <span className="text-[9px] bg-blue-900/50 text-blue-300 px-1 rounded border border-blue-500/30 whitespace-nowrap">CA {item.stats.ac}</span>}
                                </div>
                                <button type="button" onClick={() => handleDeleteItem(item.id)} className="text-red-500 hover:text-red-300 text-xs px-1">✕</button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mb-2 relative">
                    <input 
                        type="text" 
                        placeholder="Buscar item mágico ou equipamento no 5eTools..." 
                        value={itemSearch} 
                        onChange={e => setItemSearch(e.target.value)} 
                        className="w-full bg-black/60 border border-amber-500/30 rounded p-2 text-xs text-white outline-none focus:border-amber-400 transition-colors" 
                    />
                    <div className="absolute right-2 top-2 text-xs opacity-50">🔍</div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 pr-1">
                    {filteredItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between p-2 rounded border items-center group bg-black/40 border-white/5 hover:border-amber-500/50 transition-colors">
                            <div className="flex flex-col overflow-hidden pr-2">
                                <div className="text-xs font-bold text-amber-100 truncate">{item.name}</div>
                                <div className="text-[9px] text-gray-500 flex gap-2">
                                    <span className="capitalize">{item.type}</span>
                                    {item.value && <span className="text-yellow-600 font-bold">{item.value}</span>}
                                    {item.rarity && <span className="text-purple-400 capitalize">{item.rarity}</span>}
                                </div>
                            </div>
                            <button type="button" onClick={() => handleAddItem(item)} className="px-2 py-1 rounded text-xs font-bold text-amber-400 bg-amber-900/20 hover:bg-amber-900/50 hover:text-white transition-all flex-shrink-0">
                                Pegar
                            </button>
                        </div>
                    ))}
                    
                    {itemSearch.trim() !== '' && (
                        <div className="mt-2 p-2 border border-dashed border-gray-600 rounded bg-black/20 text-center">
                            <p className="text-[9px] text-gray-400 mb-1">Não encontrou? Crie um item manual com este nome:</p>
                            <button type="button" onClick={() => { setNewItemName(itemSearch); handleAddItem(); setItemSearch(''); }} className="w-full bg-gray-800 hover:bg-gray-700 text-white text-xs py-1.5 rounded font-bold transition-colors">
                                + Adicionar "{itemSearch}" Manualmente
                            </button>
                        </div>
                    )}
                    {itemSearch === '' && <p className="text-gray-500 text-xs text-center mt-4 italic">Digite para buscar espadas, poções e relíquias...</p>}
                </div>
            </div>
        )}

        {activeTab === 'spells' && (
            <div className="flex flex-col flex-grow overflow-hidden">
                <div className="mb-4 bg-black/30 p-2 rounded border border-purple-500/20">
                    <h3 className="text-[10px] font-bold text-purple-400 uppercase mb-2 flex justify-between">Magias Conhecidas <span>{formData.spells.length}</span></h3>
                    <div className="max-h-32 overflow-y-auto flex flex-col gap-1 custom-scrollbar">
                        {formData.spells.length === 0 && <p className="text-xs text-gray-500 italic text-center py-2">Nenhuma magia aprendida.</p>}
                        {formData.spells.map(s => (
                            <div key={s.id} className="flex justify-between bg-purple-900/20 p-1.5 rounded border border-purple-500/30 items-center shadow-inner">
                                <span className="text-xs font-bold text-purple-100 truncate pr-2">
                                    {s.level === 0 ? <span className="text-[9px] bg-purple-900 text-purple-300 px-1 rounded mr-1">Cantrip</span> : <span className="text-[9px] bg-indigo-900 text-indigo-300 px-1 rounded mr-1">Lv.{s.level}</span>}
                                    {s.name}
                                </span>
                                <button type="button" onClick={() => handleToggleSpell(s)} className="text-red-400 hover:text-red-300 text-xs px-1">✕</button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mb-2">
                    <input type="text" placeholder="Buscar magias no Grimório..." value={spellSearch} onChange={e => setSpellSearch(e.target.value)} className="w-full bg-black/60 border border-purple-500/30 rounded p-2 text-xs text-white outline-none focus:border-purple-400 transition-colors" />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 pr-1">
                    {filteredSpells.map(s => {
                        const isKnown = formData.spells.some(known => known.name === s.name);
                        return (
                            <div key={s.name} className={`flex justify-between p-2 rounded border items-center group transition-colors ${isKnown ? 'bg-purple-900/40 border-purple-500 shadow-sm' : 'bg-black/40 border-white/5 hover:border-purple-500/50'}`}>
                                <div className="flex flex-col overflow-hidden pr-2">
                                    <div className="text-xs font-bold text-gray-200 truncate">{s.name}</div>
                                    <div className="text-[9px] text-gray-500">{s.school} | {s.level === 0 ? 'Cantrip' : `Level ${s.level}`}</div>
                                </div>
                                <button type="button" onClick={() => handleToggleSpell(s)} className={`px-2 py-1 rounded text-xs font-bold transition-all flex-shrink-0 ${isKnown ? 'text-red-400 bg-red-900/20 hover:bg-red-900/50' : 'text-purple-400 bg-purple-900/20 hover:bg-purple-900/50 hover:text-white'}`}>
                                    {isKnown ? 'Remover' : 'Aprender'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors uppercase font-bold tracking-wider">Cancelar</button>
          <button type="button" onClick={handleSubmit} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all border border-blue-400/50 active:scale-95">Salvar Ficha</button>
        </div>
      </div>
    </div>
  );
};

export default EditEntityModal;