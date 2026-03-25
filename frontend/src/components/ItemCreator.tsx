import React, { useState, useRef } from 'react';
import { Package, Upload, Sword, Shield, FlaskConical, Coins, Gem, Search } from 'lucide-react';
import { Item } from '../App';

interface ItemCreatorProps {
  onCreateItem: (item: Item) => void;
  targetName?: string;
  availableItems?: any[]; 
}

const RARITY_COLORS: Record<string, string> = {
  common: 'border-white/10 text-gray-400 bg-white/5',
  uncommon: 'border-green-500/30 text-green-400 bg-green-500/10',
  rare: 'border-blue-500/30 text-blue-400 bg-blue-500/10',
  veryrare: 'border-purple-500/30 text-purple-400 bg-purple-500/10',
  legendary: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
  artifact: 'border-red-500/30 text-red-400 bg-red-500/10'
};

const ITEM_TYPES = [
  { id: 'weapon', label: 'Arma', icon: <Sword size={16} /> },
  { id: 'armor', label: 'Armadura', icon: <Shield size={16} /> },
  { id: 'potion', label: 'Poção', icon: <FlaskConical size={16} /> },
  { id: 'misc', label: 'Item Geral', icon: <Package size={16} /> },
];

const ItemCreator: React.FC<ItemCreatorProps> = ({ onCreateItem, targetName, availableItems = [] }) => {
  // 👉 AGORA TEMOS 3 ABAS
  const [mode, setMode] = useState<'compendium' | 'forge' | 'treasure'>('compendium');

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [itemImage, setItemImage] = useState<string | null>(null);

  const [type, setType] = useState<Item['type']>('weapon');
  const [rarity, setRarity] = useState<Item['rarity']>('common');
  const [statValue, setStatValue] = useState('');
  const [cost, setCost] = useState('');
  const [quantity, setQuantity] = useState(1);

  const [gold, setGold] = useState('');
  const [silver, setSilver] = useState('');
  const [copper, setCopper] = useState('');
  
  const [itemSearch, setItemSearch] = useState(''); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 👉 SE NÃO TIVER BUSCA, MOSTRA OS PRIMEIROS 40 ITENS. SE TIVER, FILTRA E MOSTRA ATÉ 40.
  const filteredItems = availableItems
    .filter(i => itemSearch.trim() === '' ? true : i.name.toLowerCase().includes(itemSearch.toLowerCase()))
    .slice(0, 40);

  // 👉 CONVERTE O ITEM DO COMPÊNDIO PARA O FORMATO DO NEXUS RPG
  const mapCompendiumToItem = (compItem: any): Item => {
      return {
          id: Date.now().toString() + Math.random().toString(),
          name: compItem.name,
          description: compItem.properties?.join(', ') || '',
          type: compItem.type as any,
          rarity: compItem.rarity?.toLowerCase().replace(/\s/g, '') || 'common',
          quantity: 1,
          image: compItem.image || '',
          value: compItem.value,
          weight: compItem.weight || 0,
          stats: {
              damage: compItem.damage,
              ac: compItem.ac,
          }
      };
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => { if (event.target?.result) setItemImage(event.target.result as string); };
      reader.readAsDataURL(file);
    }
  };

  const getStatPlaceholder = () => {
    switch (type) {
      case 'weapon': return 'Dano (ex: 1d8+2)';
      case 'armor': return 'CA (ex: 16)';
      case 'potion': return 'Cura (ex: 2d4+2)';
      default: return 'Atributo ou Efeito';
    }
  };

  const createItemObject = (): Item => {
      if (mode === 'forge') {
          const newItem: Item = {
            id: Date.now().toString(),
            name: name.trim() || 'Objeto Misterioso', 
            description: desc, type, rarity, quantity, image: itemImage || '', value: cost, stats: {}
          };
          if (type === 'weapon') newItem.stats = { damage: statValue || '1d6' };
          if (type === 'armor') newItem.stats = { ac: parseInt(statValue) || 10 };
          if (type === 'potion') newItem.stats = { properties: ['heal', statValue || '1d4'] };
          return newItem;
      } else {
          const g = parseInt(gold) || 0; const s = parseInt(silver) || 0; const c = parseInt(copper) || 0;
          let parts = [];
          if (g > 0) parts.push(`${g} Moedas de Ouro (PO)`);
          if (s > 0) parts.push(`${s} Moedas de Prata (PP)`);
          if (c > 0) parts.push(`${c} Moedas de Cobre (PC)`);

          const defaultName = g >= 50 ? 'Baú do Tesouro' : 'Bolsa de Moedas';

          return {
              id: Date.now().toString(), name: name.trim() || defaultName,
              description: desc.trim() || `Contém a seguinte riqueza:\n\n• ${parts.join('\n• ')}`,
              type: 'misc', rarity: g >= 100 ? 'rare' : (g >= 500 ? 'epic' : 'common'),
              quantity: 1, image: itemImage || '', value: `${g} PO, ${s} PP, ${c} PC`,
              stats: { isTreasure: true, coins: { gp: g, sp: s, cp: c } } as any 
          };
      }
  };

  const resetFields = () => {
      setName(''); setDesc(''); setItemImage(null); setStatValue(''); setCost(''); setQuantity(1); setGold(''); setSilver(''); setCopper('');
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!targetName) return; 
    onCreateItem(createItemObject());
    resetFields();
  };

  const handleDragStart = (e: React.DragEvent) => { 
      e.dataTransfer.setData('application/json', JSON.stringify({ type: 'LOOT_DROP', item: createItemObject(), sourceId: 0 })); 
  };

  const hasCoins = (parseInt(gold) || 0) > 0 || (parseInt(silver) || 0) > 0 || (parseInt(copper) || 0) > 0;
  const isForgeValid = name.trim().length > 0;
  const isTreasureValid = hasCoins || name.trim().length > 0;
  const isValid = mode === 'forge' ? isForgeValid : isTreasureValid;

  return (
    <div className="bg-[#0f0f13] border border-white/10 rounded-xl p-4 shadow-2xl relative overflow-hidden font-sans flex flex-col h-full max-h-[500px]">
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-600/10 rounded-full blur-[50px] pointer-events-none"></div>

      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3 relative z-10 shrink-0">
        <h3 className="text-amber-500 font-bold uppercase tracking-[0.15em] text-xs flex items-center gap-2">
          <Package size={14} /> Arsenal & Forja
        </h3>
        <div className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${targetName ? 'bg-green-900/20 border-green-500/30 text-green-400 shadow-[0_0_10px_rgba(21,128,61,0.2)]' : 'bg-gray-900/50 border-gray-500/30 text-gray-400'}`}>
            {targetName ? `Alvo: ${targetName}` : 'Sem Alvo (Use o Mapa)'}
        </div>
      </div>

      {/* 👉 ABAS REFORMULADAS */}
      <div className="flex border-b border-white/10 mb-4 relative z-10 shrink-0">
        <button type="button" onClick={() => setMode('compendium')} className={`flex-1 pb-2 text-[10px] uppercase font-bold tracking-widest transition-colors flex items-center justify-center gap-1.5 ${mode === 'compendium' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-gray-500 hover:text-gray-300'}`}><Search size={12}/> Arsenal</button>
        <button type="button" onClick={() => setMode('forge')} className={`flex-1 pb-2 text-[10px] uppercase font-bold tracking-widest transition-colors flex items-center justify-center gap-1.5 ${mode === 'forge' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-gray-500 hover:text-gray-300'}`}><Sword size={12}/> Criar</button>
        <button type="button" onClick={() => setMode('treasure')} className={`flex-1 pb-2 text-[10px] uppercase font-bold tracking-widest transition-colors flex items-center justify-center gap-1.5 ${mode === 'treasure' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-500 hover:text-gray-300'}`}><Gem size={12}/> Tesouro</button>
      </div>

      <div className="flex-1 overflow-hidden relative z-10">
        
        {/* 👉 1. MODO ARSENAL (COMPÊNDIO VISUAL) */}
        {mode === 'compendium' && (
            <div className="flex flex-col h-full space-y-3 animate-in fade-in duration-200">
                <div className="relative shrink-0">
                    <Search size={14} className="absolute left-3 top-2.5 text-amber-500/50" />
                    <input 
                        type="text" 
                        placeholder="Buscar item no compêndio..." 
                        value={itemSearch} 
                        onChange={e => setItemSearch(e.target.value)} 
                        className="w-full bg-black/60 border border-amber-500/30 rounded-lg pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-amber-400 transition-colors" 
                    />
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-2 gap-2 pr-1">
                    {filteredItems.map((item, idx) => (
                        <button 
                            key={idx} 
                            type="button"
                            draggable 
                            onDragStart={(e) => {
                                e.dataTransfer.setData('application/json', JSON.stringify({ type: 'LOOT_DROP', item: mapCompendiumToItem(item), sourceId: 0 }));
                            }}
                            onClick={() => {
                                if (targetName) onCreateItem(mapCompendiumToItem(item));
                            }}
                            className="flex flex-col items-center bg-black/60 hover:bg-amber-900/30 border border-white/5 hover:border-amber-500/50 p-2 rounded-lg transition-all group cursor-grab active:cursor-grabbing text-left"
                            title={targetName ? `Clique para dar para ${targetName}` : "Arraste para jogar no mapa"}
                        >
                            <div className="w-10 h-10 rounded-md overflow-hidden mb-1.5 border border-white/20 group-hover:border-amber-500 shadow-lg bg-black flex items-center justify-center shrink-0">
                                {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-contain p-0.5" /> : <Package size={16} className="text-gray-500" />}
                            </div>
                            <span className="text-[9px] font-bold text-gray-300 group-hover:text-white truncate w-full text-center leading-tight">
                                {item.name}
                            </span>
                            <div className="flex gap-2 text-[9px] text-gray-500 font-mono mt-0.5">
                                {item.damage && <span className="text-red-400">⚔️ {item.damage}</span>}
                                {item.ac !== undefined && <span className="text-blue-400">🛡️ {item.ac}</span>}
                            </div>
                        </button>
                    ))}
                    {filteredItems.length === 0 && (
                        <div className="col-span-2 text-center py-6 text-xs text-gray-500 italic">
                            Nenhum item encontrado no arsenal.
                        </div>
                    )}
                </div>
                <div className="shrink-0 text-center mt-2">
                    <p className="text-[8px] text-gray-500 uppercase tracking-widest">Arraste para o mapa ou clique para entregar ao alvo.</p>
                </div>
            </div>
        )}

        {/* 👉 2. MODO FORJA (MANUAL) OU MODO TESOURO */}
        {mode !== 'compendium' && (
            <form onSubmit={handleSubmit} className="flex flex-col h-full justify-between overflow-y-auto custom-scrollbar pr-1 animate-in fade-in duration-200">
                <div className="space-y-4 pb-4">
                    <input type="text" placeholder={mode === 'forge' ? "Nome do Item (Obrigatório)" : "Nome (Opcional, Ex: Tesouro Goblin)"} className="w-full bg-black/30 border border-white/10 rounded p-3 text-sm text-white placeholder-white/30 outline-none focus:border-amber-500/50 focus:bg-black/50 transition-all font-serif" value={name} onChange={e => setName(e.target.value)} />

                    {mode === 'forge' && (
                    <div className="animate-in fade-in zoom-in-95 duration-200 space-y-4">
                        <div className="flex gap-2">
                            <div className="flex-1 flex gap-1 bg-black/30 p-1 rounded border border-white/5">
                                {ITEM_TYPES.map(t => (
                                    <button key={t.id} type="button" onClick={() => setType(t.id as any)} className={`flex-1 rounded flex items-center justify-center transition-all py-1.5 ${type === t.id ? 'bg-white/10 text-white shadow-sm border border-white/10' : 'text-gray-600 hover:text-gray-300 hover:bg-white/5'}`} title={t.label}>{t.icon}</button>
                                ))}
                            </div>
                            <select value={rarity} onChange={(e) => setRarity(e.target.value as any)} className={`w-28 text-[9px] font-bold uppercase rounded outline-none px-1 border appearance-none text-center cursor-pointer transition-colors ${RARITY_COLORS[rarity || 'common'] || RARITY_COLORS['common']}`}>
                                <option value="common">Comum</option><option value="uncommon">Incomum</option><option value="rare">Raro</option><option value="veryrare">M. Raro</option><option value="legendary">Lendário</option><option value="artifact">Artefato</option>
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
                    </div>
                    )}

                    {mode === 'treasure' && (
                    <div className="animate-in fade-in zoom-in-95 duration-200">
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2 font-bold text-center">Moedas do Tesouro</p>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-yellow-900/10 border border-yellow-500/30 rounded p-2 flex flex-col items-center focus-within:border-yellow-400 transition-colors">
                                <span className="text-yellow-500 font-bold text-[9px] uppercase tracking-widest mb-1">Ouro (PO)</span>
                                <input type="number" min="0" placeholder="0" className="w-full bg-black/50 text-white font-mono font-bold text-center rounded outline-none py-1.5 text-sm border border-transparent focus:border-yellow-500/50 transition-all" value={gold} onChange={e => setGold(e.target.value)} />
                            </div>
                            <div className="bg-gray-400/10 border border-gray-400/30 rounded p-2 flex flex-col items-center focus-within:border-gray-300 transition-colors">
                                <span className="text-gray-400 font-bold text-[9px] uppercase tracking-widest mb-1">Prata (PP)</span>
                                <input type="number" min="0" placeholder="0" className="w-full bg-black/50 text-white font-mono font-bold text-center rounded outline-none py-1.5 text-sm border border-transparent focus:border-gray-400/50 transition-all" value={silver} onChange={e => setSilver(e.target.value)} />
                            </div>
                            <div className="bg-orange-900/10 border border-orange-500/30 rounded p-2 flex flex-col items-center focus-within:border-orange-400 transition-colors">
                                <span className="text-orange-400 font-bold text-[9px] uppercase tracking-widest mb-1">Cobre (PC)</span>
                                <input type="number" min="0" placeholder="0" className="w-full bg-black/50 text-white font-mono font-bold text-center rounded outline-none py-1.5 text-sm border border-transparent focus:border-orange-500/50 transition-all" value={copper} onChange={e => setCopper(e.target.value)} />
                            </div>
                        </div>
                    </div>
                    )}

                    <div className="w-full h-14 border border-dashed border-white/10 rounded bg-black/30 flex flex-col items-center justify-center cursor-pointer hover:border-amber-500/30 hover:bg-amber-500/5 transition-all overflow-hidden relative group" onClick={() => fileInputRef.current?.click()}>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                        {itemImage ? <img src={itemImage} alt="Preview" className="h-full w-full object-contain opacity-50 group-hover:opacity-100 transition-all p-1" /> : <div className="flex flex-col items-center text-gray-600 group-hover:text-amber-500/80 transition-colors"><Upload size={14} className="mb-1 opacity-50" /><span className="text-[9px] uppercase font-bold tracking-widest">Imagem (Opcional)</span></div>}
                    </div>

                    <textarea placeholder="Descrição (Opcional)..." className="w-full bg-black/30 border border-white/10 rounded p-3 text-xs text-gray-400 h-16 resize-none outline-none focus:border-amber-500/30 transition-all custom-scrollbar placeholder-white/20" value={desc} onChange={e => setDesc(e.target.value)} />
                </div>

                <div className="flex gap-2 pt-2 border-t border-white/5 shrink-0">
                    <button 
                        type="submit" 
                        disabled={!targetName || !isValid} 
                        className={`flex-[1.5] py-3 text-[9px] font-bold uppercase tracking-widest rounded transition-all active:scale-95 flex items-center justify-center gap-1.5 ${targetName && isValid ? 'bg-green-800/80 hover:bg-green-600 text-white shadow-[0_0_15px_rgba(21,128,61,0.4)] border border-green-500/50' : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'}`}
                    >
                        <Package size={14} /> {targetName ? 'Dar ao Alvo' : 'Selecione Alvo'}
                    </button>

                    <div 
                        draggable={isValid}
                        onDragStart={handleDragStart} 
                        className={`flex-[2] py-3 font-bold text-[9px] uppercase tracking-widest rounded flex items-center justify-center gap-1.5 transition-all ${isValid ? 'bg-blue-900/50 hover:bg-blue-600 border border-blue-500/50 text-blue-200 hover:text-white cursor-grab active:cursor-grabbing shadow-lg group' : 'bg-gray-800 text-gray-600 border border-gray-700 cursor-not-allowed'}`}
                        title={isValid ? "Arraste e solte diretamente no mapa!" : "Preencha os campos para arrastar"}
                    >
                        <span className={isValid ? 'group-hover:-translate-y-1 transition-transform text-base' : 'text-base opacity-50'}>🖐️</span> 
                        <span>Arrastar p/ Mapa</span>
                    </div>
                </div>
            </form>
        )}
      </div>
    </div>
  );
};

export default ItemCreator;