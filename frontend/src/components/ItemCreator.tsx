import React, { useState, useRef, useMemo } from 'react';
import { Package, Upload, Sword, Shield, FlaskConical, Coins, Gem, Search, BookOpen, Weight, Sparkles } from 'lucide-react';
import { Item } from '../App';

interface ItemCreatorProps {
  onCreateItem: (item: Item) => void;
  targetName?: string;
  availableItems?: any[]; 
}

const RARITY_COLORS: Record<string, string> = {
  common: 'border-white/20 text-gray-400 bg-white/5',
  uncommon: 'border-green-500/50 text-green-400 bg-green-500/10',
  rare: 'border-blue-500/50 text-blue-400 bg-blue-500/10',
  veryrare: 'border-purple-500/50 text-purple-400 bg-purple-500/10',
  legendary: 'border-amber-500/50 text-amber-400 bg-amber-500/10',
  artifact: 'border-red-500/50 text-red-400 bg-red-500/10'
};

// 👉 TRADUTOR DE RARIDADE PARA PORTUGUÊS
const RARITY_TRANSLATION: Record<string, string> = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Raro',
  veryrare: 'M. Raro',
  legendary: 'Lendário',
  artifact: 'Artefato',
  unknown: 'Desconhecido'
};

const ITEM_TYPES = [
  { id: 'weapon', label: 'Arma', icon: <Sword size={16} /> },
  { id: 'armor', label: 'Armadura', icon: <Shield size={16} /> },
  { id: 'potion', label: 'Poção', icon: <FlaskConical size={16} /> },
  { id: 'misc', label: 'Item Geral', icon: <Package size={16} /> },
];

const COMPENDIUM_CATEGORIES = [
    { id: 'all', label: 'Todos' },
    { id: 'weapon', label: 'Armas' },
    { id: 'armor', label: 'Armaduras' },
    { id: 'potion', label: 'Poções' },
    { id: 'wondrous', label: 'Mágicos' },
    { id: 'gear', label: 'Equipamento' }
];

const formatValue = (val: any): string => {
    if (val === undefined || val === null) return '';
    if (typeof val === 'number') {
        if (val >= 100 && val % 100 === 0) return `${val / 100} PO`;
        if (val >= 10 && val % 10 === 0) return `${val / 10} PP`;
        return `${val} PC`;
    }
    return String(val);
};

const formatEntries = (entries: any): string => {
    if (!entries) return '';
    if (typeof entries === 'string') return entries.replace(/{@\w+ (.*?)(?:\|.*?)?}/g, '$1'); 
    if (Array.isArray(entries)) return entries.map(e => formatEntries(e)).filter(Boolean).join('\n\n');
    if (typeof entries === 'object') {
        if (entries.entries) return formatEntries(entries.entries);
        if (entries.items) return formatEntries(entries.items);
        if (entries.text) return formatEntries(entries.text);
        return '';
    }
    return '';
};

const ItemCreator: React.FC<ItemCreatorProps> = ({ onCreateItem, targetName, availableItems = [] }) => {
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
  const [filterCategory, setFilterCategory] = useState('all'); 

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  const getCompendiumItemImage = (compItem: any) => {
      let imgUrl = compItem.image || '';
      
      if (!imgUrl && compItem.name && compItem.source) {
          imgUrl = `/img/items/${compItem.source}/${compItem.name}.webp`;
      } else if (imgUrl && !imgUrl.startsWith('http')) {
          imgUrl = imgUrl.replace(/^\/+/, '');
          if (!imgUrl.startsWith('img/')) {
              imgUrl = `img/${imgUrl}`;
          }
          imgUrl = `/${imgUrl}`;
      }
      return imgUrl;
  };

  const getCategory = (item: any) => {
      let t = '';
      if (typeof item.type === 'string') {
          t = item.type.toLowerCase();
      } else if (Array.isArray(item.type)) {
          t = item.type.join(' ').toLowerCase();
      } else if (item.type && typeof item.type === 'object') {
          t = JSON.stringify(item.type).toLowerCase();
      }
      
      const rawTypes = t.split(/[\s,]+/).map(s => s.trim());

      if (rawTypes.includes('p') || t.includes('potion')) return 'potion';
      if (rawTypes.some(rt => ['la', 'ma', 'ha', 's'].includes(rt)) || t.includes('armor') || t.includes('shield')) return 'armor';
      if (item.weaponCategory || rawTypes.some(rt => ['m', 'r', 'a', 'af', 'amm'].includes(rt)) || t.includes('weapon') || t.includes('firearm')) return 'weapon';
      if (rawTypes.some(rt => ['w', 'rg', 'rd', 'st', 'wd', 'sc'].includes(rt)) || t.includes('wondrous') || t.includes('ring') || t.includes('wand') || t.includes('rod') || t.includes('staff') || t.includes('scroll') || item.wondrous) return 'wondrous';
      
      return 'gear';
  };

  const { filteredItems, totalMatches } = useMemo(() => {
      const matchedItems = availableItems.filter(i => {
          const matchesSearch = itemSearch.trim() === '' || i.name.toLowerCase().includes(itemSearch.toLowerCase());
          const matchesCategory = filterCategory === 'all' || getCategory(i) === filterCategory;
          return matchesSearch && matchesCategory;
      });

      return {
          totalMatches: matchedItems.length,
          filteredItems: matchedItems.slice(0, 100) 
      };
  }, [availableItems, itemSearch, filterCategory]);

  const mapCompendiumToItem = (compItem: any): Item => {
      const rarityVal = compItem.rarity?.toLowerCase().replace(/\s/g, '') || 'common';
      const weightVal = compItem.weight ? `${compItem.weight} lb.` : '';
      const valueVal = formatValue(compItem.value);
      const reqAttune = !!compItem.reqAttune;
      const sourceVal = compItem.source || '';
      
      let damageStr = compItem.damage || '';
      if (!damageStr && compItem.dmg1) {
          damageStr = compItem.dmg1;
          if (compItem.dmgType) damageStr += ` ${compItem.dmgType.toUpperCase()}`; 
      }
      
      let fullDesc = formatEntries(compItem.entries) || compItem.properties?.join(', ') || '';

      return {
          id: Date.now().toString() + Math.random().toString(),
          name: compItem.name, 
          description: fullDesc.trim(),
          type: compItem.type as any,
          rarity: rarityVal as any,
          quantity: 1,
          image: getCompendiumItemImage(compItem), 
          value: valueVal,
          weight: weightVal as any,
          stats: {
              damage: damageStr,
              ac: compItem.ac,
              attunement: reqAttune,
              source: sourceVal
          } as any 
      };
  };

  const getItemFallbackIcon = (category: string, className: string) => {
      if (category === 'weapon') return <Sword size={16} className={className} />;
      if (category === 'armor') return <Shield size={16} className={className} />;
      if (category === 'potion') return <FlaskConical size={16} className={className} />;
      if (category === 'wondrous') return <Sparkles size={16} className={className} />;
      return <Package size={16} className={className} />;
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
    <div className="bg-[#0f0f13] border border-white/10 rounded-xl p-4 shadow-2xl relative overflow-hidden font-sans flex flex-col h-[550px]">
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-600/10 rounded-full blur-[50px] pointer-events-none"></div>

      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3 relative z-10 shrink-0">
        <h3 className="text-amber-500 font-bold uppercase tracking-[0.15em] text-xs flex items-center gap-2">
          <Package size={14} /> Arsenal & Forja
        </h3>
        <div className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${targetName ? 'bg-green-900/20 border-green-500/30 text-green-400 shadow-[0_0_10px_rgba(21,128,61,0.2)]' : 'bg-gray-900/50 border-gray-500/30 text-gray-400'}`}>
            {targetName ? `Alvo: ${targetName}` : 'Sem Alvo (Use o Mapa)'}
        </div>
      </div>

      <div className="flex border-b border-white/10 mb-4 relative z-10 shrink-0">
        <button type="button" onClick={() => setMode('compendium')} className={`flex-1 pb-2 text-[10px] uppercase font-bold tracking-widest transition-colors flex items-center justify-center gap-1.5 ${mode === 'compendium' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-gray-500 hover:text-gray-300'}`}><Search size={12}/> Arsenal</button>
        <button type="button" onClick={() => setMode('forge')} className={`flex-1 pb-2 text-[10px] uppercase font-bold tracking-widest transition-colors flex items-center justify-center gap-1.5 ${mode === 'forge' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-gray-500 hover:text-gray-300'}`}><Sword size={12}/> Criar</button>
        <button type="button" onClick={() => setMode('treasure')} className={`flex-1 pb-2 text-[10px] uppercase font-bold tracking-widest transition-colors flex items-center justify-center gap-1.5 ${mode === 'treasure' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-500 hover:text-gray-300'}`}><Gem size={12}/> Tesouro</button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden relative z-10 flex flex-col">
        
        {mode === 'compendium' && (
            <div className="flex flex-col h-full min-h-0 animate-in fade-in duration-200">
                <div className="relative shrink-0 mb-3">
                    <Search size={14} className="absolute left-3 top-2.5 text-amber-500/50" />
                    <input 
                        type="text" 
                        placeholder="Buscar item no compêndio..." 
                        value={itemSearch} 
                        onChange={e => setItemSearch(e.target.value)} 
                        className="w-full bg-black/60 border border-amber-500/30 rounded-lg pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-amber-400 transition-colors" 
                    />
                </div>

                <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-2 mb-2 shrink-0">
                    {COMPENDIUM_CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setFilterCategory(cat.id)}
                            className={`px-3 py-1.5 text-[9px] uppercase font-bold tracking-wider rounded border transition-colors whitespace-nowrap ${filterCategory === cat.id ? 'bg-amber-900/50 border-amber-500/50 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-black/50 border-white/5 text-gray-500 hover:border-white/20 hover:text-gray-300'}`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
                
                <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar grid grid-cols-2 gap-2 pr-1 pb-4">
                    {filteredItems.map((rawItem, idx) => {
                        const item = mapCompendiumToItem(rawItem); 
                        const category = getCategory(rawItem);
                        const rarityColor = RARITY_COLORS[item.rarity || 'common'] || RARITY_COLORS['common'];
                        const translatedRarity = RARITY_TRANSLATION[item.rarity || 'common'] || 'Comum';

                        const itemStats = item.stats as any || {};
                        const tooltipText = `${item.name}\n\nRaridade: ${translatedRarity}\nValor: ${item.value || '-'}\nPeso: ${item.weight || '-'}\nFonte: ${itemStats.source || '-'}\nSintonização: ${itemStats.attunement ? 'Sim' : 'Não'}\n\n${item.description ? item.description.substring(0, 150) + (item.description.length > 150 ? '...' : '') : ''}\n\n[Clique para dar ao alvo ou Arraste para o mapa]`;

                        return (
                            <button 
                                key={idx} 
                                type="button"
                                draggable 
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'LOOT_DROP', item: item, sourceId: 0 }));
                                }}
                                onClick={() => {
                                    if (targetName) onCreateItem(item);
                                }}
                                className="flex flex-col items-center bg-black/60 hover:bg-amber-900/30 border border-white/5 hover:border-amber-500/50 p-2.5 rounded-lg transition-all group cursor-grab active:cursor-grabbing text-left relative"
                                title={tooltipText}
                            >
                                <div className={`w-12 h-12 rounded-md overflow-hidden mb-2 border shadow-lg bg-black flex items-center justify-center shrink-0 relative transition-colors ${rarityColor}`}>
                                    {getItemFallbackIcon(category, "text-gray-500 absolute z-0 opacity-50")}
                                    
                                    {item.image && !imgErrors[item.name] && (
                                        <img 
                                            src={item.image} 
                                            alt={item.name} 
                                            className="w-full h-full object-contain p-0.5 absolute inset-0 z-10 bg-black" 
                                            onError={(e) => { 
                                                const target = e.currentTarget;
                                                if (target.src.includes('.webp')) {
                                                    target.src = target.src.replace('.webp', '.png');
                                                } else {
                                                    target.style.display = 'none';
                                                    setImgErrors(prev => ({...prev, [item.name]: true}));
                                                }
                                            }}
                                        />
                                    )}
                                </div>
                                
                                <span className="text-[10px] font-bold text-gray-300 group-hover:text-white truncate w-full text-center leading-tight mb-1.5">
                                    {item.name}
                                </span>

                                <div className="flex flex-wrap justify-center gap-1 w-full">
                                    {/* 👉 ETIQUETA NOVA: RARIDADE */}
                                    {item.rarity && (item.rarity as string) !== 'none' && (item.rarity as string) !== 'unknown' && (
                                        <span className={`text-[8px] font-mono px-1 rounded flex items-center border ${rarityColor}`} title="Raridade">
                                            {translatedRarity}
                                        </span>
                                    )}
                                    
                                    {item.stats?.damage && <span className="text-[8px] font-mono text-red-300 bg-red-900/40 px-1 rounded flex items-center border border-red-500/20">⚔️ {item.stats.damage}</span>}
                                    {item.stats?.ac !== undefined && <span className="text-[8px] font-mono text-blue-300 bg-blue-900/40 px-1 rounded flex items-center border border-blue-500/20">🛡️ {item.stats.ac}</span>}
                                    {item.value && <span className="text-[8px] font-mono text-yellow-300 bg-yellow-900/40 px-1 rounded flex items-center border border-yellow-500/20"><Coins size={8} className="mr-0.5"/> {item.value}</span>}
                                    {item.weight && <span className="text-[8px] font-mono text-gray-400 bg-gray-800 px-1 rounded flex items-center border border-gray-600/50"><Weight size={8} className="mr-0.5"/> {item.weight}</span>}
                                    {itemStats.attunement && <span className="text-[8px] font-mono text-purple-300 bg-purple-900/40 px-1 rounded flex items-center border border-purple-500/20" title="Requer Sintonização"><Sparkles size={8} className="mr-0.5"/>Sintoniza</span>}
                                    {itemStats.source && <span className="text-[8px] font-mono text-gray-500 bg-black/80 px-1 rounded flex items-center border border-white/10" title={`Fonte: ${itemStats.source}`}><BookOpen size={8} className="mr-0.5"/> {itemStats.source}</span>}
                                </div>
                            </button>
                        );
                    })}
                    {filteredItems.length === 0 && (
                        <div className="col-span-2 text-center py-6 text-xs text-gray-500 italic">
                            Nenhum item encontrado nesta categoria.
                        </div>
                    )}
                </div>

                {totalMatches > filteredItems.length && (
                    <div className="shrink-0 text-center py-2 text-[9px] border-t border-white/5 text-amber-500/70 font-bold uppercase tracking-widest bg-black/50">
                        Exibindo 100 de {totalMatches} itens. Use a busca para refinar.
                    </div>
                )}
            </div>
        )}

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