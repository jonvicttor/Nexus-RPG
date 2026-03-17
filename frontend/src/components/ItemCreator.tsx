import React, { useState, useRef } from 'react';
import { Package, Plus, Upload, Sword, Shield, FlaskConical, Coins } from 'lucide-react';
import { Item } from '../App';

interface ItemCreatorProps {
  onCreateItem: (item: Item) => void;
  targetName?: string;
}

const RARITY_COLORS = {
  common: 'border-white/10 text-gray-400 bg-white/5',
  rare: 'border-blue-500/30 text-blue-400 bg-blue-500/10',
  epic: 'border-purple-500/30 text-purple-400 bg-purple-500/10',
  legendary: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
};

const ITEM_TYPES = [
  { id: 'weapon', label: 'Arma', icon: <Sword size={16} /> },
  { id: 'armor', label: 'Armadura', icon: <Shield size={16} /> },
  { id: 'potion', label: 'Poção', icon: <FlaskConical size={16} /> },
  { id: 'misc', label: 'Item/Ouro', icon: <Coins size={16} /> },
];

const ItemCreator: React.FC<ItemCreatorProps> = ({ onCreateItem, targetName }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<Item['type']>('weapon');
  const [rarity, setRarity] = useState<Item['rarity']>('common');
  const [statValue, setStatValue] = useState('');
  const [cost, setCost] = useState('');
  const [desc, setDesc] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [itemImage, setItemImage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => { if (event.target?.result) setItemImage(event.target.result as string); };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const newItem: Item = {
      id: Date.now().toString(),
      name, description: desc, type, rarity, quantity, image: itemImage || '', value: cost, stats: {}
    };
    if (type === 'weapon') newItem.stats = { damage: statValue || '1d6' };
    if (type === 'armor') newItem.stats = { ac: parseInt(statValue) || 10 };
    if (type === 'potion') newItem.stats = { properties: ['heal', statValue || '1d4'] };
    onCreateItem(newItem);
    setName(''); setDesc(''); setStatValue(''); setCost(''); setQuantity(1); setItemImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getStatPlaceholder = () => {
    switch (type) {
      case 'weapon': return 'Dano (ex: 1d8+2)';
      case 'armor': return 'CA (ex: 16)';
      case 'potion': return 'Cura (ex: 2d4+2)';
      default: return 'Atributo';
    }
  };

  return (
    <div className="bg-[#0f0f13] border border-white/10 rounded-xl p-5 shadow-2xl relative overflow-hidden font-sans">
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-600/10 rounded-full blur-[50px] pointer-events-none"></div>

      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4 relative z-10">
        <h3 className="text-amber-500 font-bold uppercase tracking-[0.15em] text-xs flex items-center gap-2">
          <Package size={14} /> Forjar Item
        </h3>
        <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${targetName ? 'bg-green-900/20 border-green-500/30 text-green-400' : 'bg-red-900/20 border-red-500/30 text-red-400'}`}>
            {targetName ? `Para: ${targetName}` : 'Sem Alvo'}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
        <input type="text" placeholder="Nome do Item (Ex: Espada Vorpal)" className="w-full bg-black/30 border border-white/10 rounded p-3 text-sm text-white placeholder-white/20 outline-none focus:border-amber-500/50 focus:bg-black/50 transition-all font-serif" value={name} onChange={e => setName(e.target.value)} />

        <div className="flex gap-2">
            <div className="flex-1 flex gap-1 bg-black/30 p-1 rounded border border-white/5">
                {ITEM_TYPES.map(t => (
                    <button key={t.id} type="button" onClick={() => setType(t.id as any)} className={`flex-1 rounded flex items-center justify-center transition-all py-1.5 ${type === t.id ? 'bg-white/10 text-white shadow-sm border border-white/10' : 'text-gray-600 hover:text-gray-300 hover:bg-white/5'}`}>{t.icon}</button>
                ))}
            </div>
            <select value={rarity} onChange={(e) => setRarity(e.target.value as any)} className={`w-28 text-[10px] font-bold uppercase rounded outline-none px-2 border appearance-none text-center cursor-pointer transition-colors ${RARITY_COLORS[rarity || 'common']}`}>
                <option value="common">Comum</option><option value="rare">Raro</option><option value="epic">Épico</option><option value="legendary">Lendário</option>
            </select>
        </div>

        <div className="flex gap-3">
            <div className="flex-[2]">
                <input type="text" placeholder={getStatPlaceholder()} className="w-full bg-black/30 border border-white/10 rounded p-2 text-xs text-white placeholder-white/20 outline-none focus:border-blue-500/50 transition-colors" value={statValue} onChange={e => setStatValue(e.target.value)} />
            </div>
            <div className="flex items-center border border-white/10 rounded bg-black/30 overflow-hidden">
                <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3 py-2 text-gray-500 hover:text-white hover:bg-white/5">-</button>
                <span className="text-xs font-mono w-6 text-center text-white font-bold">{quantity}</span>
                <button type="button" onClick={() => setQuantity(quantity + 1)} className="px-3 py-2 text-gray-500 hover:text-white hover:bg-white/5">+</button>
            </div>
        </div>

        <div className="flex items-center bg-black/30 border border-yellow-900/20 rounded px-3 py-1 group focus-within:border-yellow-500/40 transition-colors">
            <Coins size={12} className="text-yellow-700 group-focus-within:text-yellow-500 mr-2" />
            <input type="text" placeholder="Valor (ex: 150 PO)" className="w-full bg-transparent border-none p-1.5 text-xs text-yellow-100 placeholder-yellow-800/50 outline-none font-mono" value={cost} onChange={e => setCost(e.target.value)} />
        </div>

        <div className="w-full h-16 border border-dashed border-white/10 rounded bg-black/30 flex flex-col items-center justify-center cursor-pointer hover:border-amber-500/30 hover:bg-amber-500/5 transition-all overflow-hidden relative group" onClick={() => fileInputRef.current?.click()}>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
          {itemImage ? <img src={itemImage} alt="Preview" className="h-full w-full object-contain opacity-50 group-hover:opacity-100 transition-all p-1" /> : <div className="flex flex-col items-center text-gray-600 group-hover:text-amber-500/80 transition-colors"><Upload size={16} className="mb-1 opacity-50" /><span className="text-[9px] uppercase font-bold tracking-widest">Imagem</span></div>}
        </div>

        <textarea placeholder="Descrição..." className="w-full bg-black/30 border border-white/10 rounded p-3 text-xs text-gray-400 h-16 resize-none outline-none focus:border-amber-500/30 transition-all custom-scrollbar placeholder-white/10" value={desc} onChange={e => setDesc(e.target.value)} />

        <button type="submit" disabled={!targetName || !name} className="w-full py-3 bg-gradient-to-r from-amber-900 to-yellow-900/80 hover:from-amber-800 hover:to-yellow-800 text-white font-bold text-[10px] uppercase tracking-[0.25em] rounded shadow-lg border border-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-95 group">
            <Plus size={14} className="text-amber-200" /> <span>Forjar Item</span>
        </button>
      </form>
    </div>
  );
};

export default ItemCreator;