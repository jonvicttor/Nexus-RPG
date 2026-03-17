import React, { useState, useCallback, memo } from 'react';
import { Trash2, Coins, X } from 'lucide-react'; 
import { Item } from '../App';

interface InventoryProps {
  items: Item[];
  ownerId: number;
  onEquip?: (item: Item) => void;
  onDrop?: (item: Item) => void;
}

const SLOT_ASSETS = {
    main: '/assets/ui/slot-weapon.png',   
    armor: '/assets/ui/slot-armor.png',   
    off: '/assets/ui/slot-hand.png',      
    backpack: '/assets/ui/slot-empty.png' 
};

// --- COMPONENTE ÍCONE (MEMOIZADO) ---
const ItemIcon = memo(({ item, size = 24 }: { item: Item, size?: number }) => {
    if (item.image) return <img src={item.image} alt={item.name} className="w-full h-full object-contain p-2 drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)] z-10 relative pointer-events-none" />;
    if (item.type === 'misc') return <Coins size={size} className="text-yellow-500 drop-shadow-lg z-10 relative pointer-events-none" />;
    return <div className="text-[10px] font-bold text-gray-500 z-10 relative pointer-events-none">{item.name.substring(0,2)}</div>;
});

// --- COMPONENTE CARD (MEMOIZADO) ---
const InventoryCard = memo(({ item, ownerId, onClick, onDragStart, onDragEnd }: { 
    item: Item, 
    ownerId: number,
    onClick: (item: Item) => void,
    onDragStart: (e: React.DragEvent, item: Item) => void,
    onDragEnd: (e: React.DragEvent) => void
}) => {

    const handleDragStartLocal = (e: React.DragEvent) => {
        onDragStart(e, item);

        e.dataTransfer.effectAllowed = 'copyMove';
        const dropData = JSON.stringify({
            type: 'LOOT_DROP',
            item: item,
            sourceId: ownerId
        });
        e.dataTransfer.setData('application/json', dropData);

        const target = e.currentTarget as HTMLDivElement;
        const img = target.querySelector('img.object-contain') as HTMLImageElement;
        
        if (img && img.src) {
            e.dataTransfer.setDragImage(img, 25, 25);
        }
        
        setTimeout(() => {
            if (target) target.style.opacity = '0.4';
        }, 0);
    };

    return (
        <div 
            onClick={() => onClick(item)}
            draggable={true}
            onDragStart={handleDragStartLocal}
            onDragEnd={onDragEnd}
            className="relative w-full aspect-[2/3] group cursor-grab active:cursor-grabbing transition-all duration-200 hover:scale-[1.02] hover:z-10"
        >
            <img src={SLOT_ASSETS.backpack} alt="Background" className="absolute inset-0 w-full h-full object-fill rounded opacity-90 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(0,0,0,0)_20%,rgba(0,0,0,0.6)_100%)] rounded z-0 pointer-events-none"></div>
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300 z-0 bg-gradient-to-t ${item.rarity === 'legendary' ? 'from-amber-500' : item.rarity === 'epic' ? 'from-purple-500' : item.rarity === 'rare' ? 'from-blue-500' : 'from-gray-500'} to-transparent rounded pointer-events-none`}></div>

            <div className="absolute inset-0 flex items-center justify-center icon-container">
                <ItemIcon item={item} />
            </div>

            {item.quantity > 1 && (
                <span className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-[2px] text-[#d4af37] text-[9px] px-1.5 font-bold rounded border border-[#d4af37]/20 shadow-lg z-20 pointer-events-none font-serif">
                    {item.quantity}
                </span>
            )}

            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200 z-30 pointer-events-none w-[90%]">
                <div className="bg-[#050505]/95 text-[#e5e5e5] text-[8px] text-center py-1 px-1 rounded border border-[#d4af37]/30 shadow-2xl backdrop-blur-sm truncate tracking-wider font-serif">
                    {item.name}
                </div>
            </div>
            
            <div className="absolute inset-0 rounded border border-transparent group-hover:border-[#d4af37]/40 transition-colors pointer-events-none"></div>
        </div>
    );
});

// --- COMPONENTE SLOT VAZIO ---
const EmptySlot = memo(() => (
    <div className="relative w-full aspect-[2/3] opacity-30 hover:opacity-50 transition-all duration-300 group">
        <img src={SLOT_ASSETS.backpack} alt="Empty" className="absolute inset-0 w-full h-full object-fill rounded grayscale contrast-125 pointer-events-none" />
        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
    </div>
));

// --- MAIN COMPONENT ---
const Inventory: React.FC<InventoryProps> = ({ items, ownerId, onEquip, onDrop }) => {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [draggedItem, setDraggedItem] = useState<Item | null>(null);

  const equippedWeapon = items.find(i => i.isEquipped && i.type === 'weapon');
  const equippedArmor = items.find(i => i.isEquipped && i.type === 'armor');
  const equippedOffhand = items.find(i => i.isEquipped && ((i.type as string) === 'shield' || (i.type as string) === 'offhand'));
  
  const backpackItems = items.filter(i => !i.isEquipped);

  const handleDragStart = useCallback((e: React.DragEvent, item: Item) => {
      setDraggedItem(item);
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
      setDraggedItem(null);
      const target = e.currentTarget as HTMLDivElement;
      target.style.opacity = '1';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDropOnSlot = useCallback((e: React.DragEvent, slotType: string) => {
      e.preventDefault();
      if (!draggedItem || !onEquip) return;

      const itemType = draggedItem.type as string;
      const isCompatible = 
        (slotType === 'main' && itemType === 'weapon') ||
        (slotType === 'armor' && itemType === 'armor') ||
        (slotType === 'off' && (itemType === 'shield' || itemType === 'offhand'));

      if (isCompatible) {
          onEquip(draggedItem);
      }
  }, [draggedItem, onEquip]);

  const handleDropOnBackpack = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      if (draggedItem && draggedItem.isEquipped && onEquip) {
          onEquip(draggedItem);
      }
  }, [draggedItem, onEquip]);

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-700 select-none">
      
      {/* --- ÁREA DE EQUIPAMENTOS --- */}
      <section className="mb-6 relative">
        <div className="flex items-center justify-center gap-4 mb-4 opacity-80">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-[#d4af37]/50"></div>
            <h3 className="text-[#d4af37] font-bold text-[10px] uppercase tracking-[0.3em] drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] font-serif">Equipamento</h3>
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-[#d4af37]/50"></div>
        </div>
        
        <div className="flex gap-4 justify-center">
            {[
                { item: equippedWeapon, bgImage: SLOT_ASSETS.main, label: 'Mão Dir.', type: 'main' },
                { item: equippedArmor, bgImage: SLOT_ASSETS.armor, label: 'Torso', type: 'armor' },
                { item: equippedOffhand, bgImage: SLOT_ASSETS.off, label: 'Mão Esq.', type: 'off' }
            ].map((slot, idx) => {
                
                let isCompatible = false;
                if (draggedItem) {
                    const dType = draggedItem.type as string;
                    isCompatible = (
                        (slot.type === 'main' && dType === 'weapon') ||
                        (slot.type === 'armor' && dType === 'armor') ||
                        (slot.type === 'off' && (dType === 'shield' || dType === 'offhand'))
                    );
                }

                return (
                    <div 
                        key={idx}
                        onClick={() => slot.item && setSelectedItem(slot.item)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDropOnSlot(e, slot.type)}
                        className={`relative w-20 h-28 group cursor-pointer transition-all duration-200 
                            ${isCompatible ? 'scale-105 shadow-[0_0_15px_rgba(212,175,55,0.3)] border-amber-500/40' : 'hover:scale-105'}
                        `}
                    >
                        <img 
                            src={slot.bgImage} 
                            className={`absolute inset-0 w-full h-full object-fill rounded ${slot.item ? 'opacity-100' : 'opacity-40 grayscale'}`} 
                            alt={slot.label}
                            onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.classList.add('bg-white/5'); }}
                        />

                        {isCompatible && <div className="absolute inset-0 bg-[#d4af37]/10 rounded border border-[#d4af37]/50 animate-pulse z-30 pointer-events-none"></div>}
                        <div className="absolute inset-0 shadow-[inset_0_0_15px_rgba(0,0,0,0.8)] rounded pointer-events-none"></div>

                        {slot.item ? (
                            <>
                                <div 
                                    draggable 
                                    onDragStart={(e) => {
                                        // CORREÇÃO: Uso de ! para garantir que slot.item existe (já verificado pelo ternário)
                                        setDraggedItem(slot.item!);
                                        
                                        e.dataTransfer.effectAllowed = 'copyMove';
                                        const dropData = JSON.stringify({ type: 'LOOT_DROP', item: slot.item, sourceId: ownerId });
                                        e.dataTransfer.setData('application/json', dropData);
                                        
                                        const target = e.currentTarget as HTMLDivElement;
                                        const img = target.querySelector('img.object-contain') as HTMLImageElement;
                                        if (img && img.src) e.dataTransfer.setDragImage(img, 25, 25);
                                        setTimeout(() => target.style.opacity = '0.4', 0);
                                    }}
                                    onDragEnd={handleDragEnd}
                                    className="absolute inset-0 flex items-center justify-center p-2 z-10 cursor-grab active:cursor-grabbing"
                                >
                                    <ItemIcon item={slot.item} />
                                </div>
                                <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/90 to-transparent pt-4 pb-1 text-[8px] text-center font-bold text-[#d4af37] tracking-widest truncate px-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    {slot.item.name}
                                </div>
                            </>
                        ) : (
                            <span className="absolute inset-0 flex items-center justify-center text-[7px] uppercase tracking-[0.2em] font-bold text-[#d4af37]/30 pt-10 pointer-events-none font-serif">
                                {slot.label}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
      </section>

      {/* --- MOCHILA --- */}
      <section className="flex-grow overflow-y-auto custom-scrollbar px-2 pb-20" onDragOver={handleDragOver} onDrop={handleDropOnBackpack}>
        <div className="flex justify-between items-end mb-4 px-1 border-b border-[#d4af37]/10 pb-1">
            <h3 className="text-[#a1a1aa] font-bold text-[10px] uppercase tracking-[0.2em] font-serif">Inventário</h3>
            <span className="text-[9px] text-[#d4af37]/80 font-mono">{items.length} / 20</span>
        </div>
        
        <div className={`grid grid-cols-3 gap-3 transition-colors duration-300 rounded p-1 ${draggedItem?.isEquipped ? 'bg-[#d4af37]/5 border border-dashed border-[#d4af37]/30' : ''}`}>
            {backpackItems.map(item => (
                <InventoryCard 
                    key={item.id} 
                    item={item} 
                    ownerId={ownerId}
                    onClick={setSelectedItem} 
                    onDragStart={handleDragStart} 
                    onDragEnd={handleDragEnd} 
                />
            ))}
            {Array.from({ length: Math.max(0, 15 - backpackItems.length) }).map((_, i) => (
                <EmptySlot key={`empty-${i}`} />
            ))}
        </div>
      </section>

      {/* --- MODAL DETALHES --- */}
      {selectedItem && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setSelectedItem(null)}></div>
              
              <div className="relative w-full max-w-sm bg-[#0b0b0b] border border-[#d4af37]/20 rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-leather.png')] opacity-20 pointer-events-none"></div>

                  <div className="relative h-48 flex-shrink-0 bg-gradient-to-b from-[#151515] to-[#0b0b0b] overflow-hidden flex items-center justify-center border-b border-[#d4af37]/10">
                      <div className={`absolute inset-0 opacity-10 blur-2xl scale-150 ${selectedItem.rarity === 'legendary' ? 'bg-amber-600' : selectedItem.rarity === 'epic' ? 'bg-purple-600' : 'bg-blue-600'}`}></div>
                      <button onClick={() => setSelectedItem(null)} className="absolute top-3 right-3 text-white/30 hover:text-[#d4af37] z-20 transition-colors"><X size={18}/></button>

                      <div className="relative z-10 flex flex-col items-center w-full px-6">
                          <div className={`w-24 h-24 rounded shadow-2xl bg-[#050505] flex items-center justify-center overflow-hidden mb-3 border border-white/5 relative`}>
                              <ItemIcon item={selectedItem} size={64} />
                              <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,1)] pointer-events-none"></div>
                          </div>
                          <h2 className="text-xl text-[#e5e5e5] font-bold tracking-wide text-center leading-tight font-serif drop-shadow-md">{selectedItem.name}</h2>
                          <span className="text-[9px] font-bold uppercase tracking-[0.3em] mt-2 text-[#a1a1aa]">
                              {selectedItem.rarity} • {selectedItem.type}
                          </span>
                      </div>
                  </div>

                  <div className="p-6 flex-grow overflow-y-auto custom-scrollbar space-y-5 bg-transparent relative z-10">
                      <div className="text-xs text-[#a1a1aa] italic leading-relaxed text-center font-serif opacity-90">"{selectedItem.description || '...'}"</div>
                      <div className="grid grid-cols-2 gap-3">
                          {selectedItem.value && (
                              <div className="bg-[#151515] px-3 py-2 rounded border border-[#d4af37]/10 flex flex-col items-center justify-center shadow-inner">
                                  <span className="text-[8px] text-[#d4af37] uppercase font-bold tracking-widest mb-1">Valor</span>
                                  <span className="text-[#e5e5e5] font-mono font-bold text-sm flex items-center gap-1.5"><Coins size={12} className="text-[#d4af37]"/> {selectedItem.value}</span>
                              </div>
                          )}
                          {selectedItem.stats && Object.entries(selectedItem.stats).map(([key, val]) => (
                              <div key={key} className="bg-[#151515] px-3 py-2 rounded border border-white/5 flex flex-col items-center justify-center shadow-inner">
                                  <span className="text-[8px] text-gray-500 uppercase font-bold tracking-widest mb-1">{key === 'ac' ? 'Defesa' : key === 'damage' ? 'Dano' : key}</span>
                                  <span className="text-white font-mono font-bold text-sm">{Array.isArray(val) ? val.join(', ') : String(val)}</span>
                              </div>
                          ))}
                      </div>
                  </div>

                  <div className="p-4 border-t border-[#d4af37]/10 bg-[#050505]/50 flex gap-3 z-10">
                      <button onClick={() => { if(onEquip) onEquip(selectedItem); setSelectedItem(null); }} className={`flex-1 py-3 rounded font-bold text-[10px] uppercase tracking-[0.2em] transition-all shadow-lg flex items-center justify-center gap-2 ${selectedItem.isEquipped ? 'bg-[#2a1a0a] text-[#d4af37] border border-[#d4af37]/30 hover:bg-[#3a2a1a]' : 'bg-[#e5e5e5]/5 text-[#e5e5e5] hover:bg-[#e5e5e5]/10 border border-white/5'}`}>{selectedItem.isEquipped ? 'Desequipar' : 'Equipar'}</button>
                      {!selectedItem.isEquipped && <button onClick={() => { if(onDrop) onDrop(selectedItem); setSelectedItem(null); }} className="w-12 flex items-center justify-center rounded bg-red-900/10 border border-red-500/20 text-red-400 hover:bg-red-900/20 hover:text-red-200 transition-colors"><Trash2 size={16} /></button>}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Inventory;