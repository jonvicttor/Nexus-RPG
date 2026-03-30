import React, { useState } from 'react';
import { X, Dice5, Gem } from 'lucide-react';

const LootGeneratorModal = ({ onGenerate, onClose }: any) => {
    const [count, setCount] = useState(3);
    const [rarity, setRarity] = useState('all');
    const [type, setType] = useState('all');

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1a1510] border border-amber-600/50 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                <div className="bg-gradient-to-r from-amber-900 to-black p-4 flex justify-between items-center border-b border-amber-600/30">
                    <h2 className="text-amber-400 font-black uppercase tracking-widest flex items-center gap-2">
                        <Gem size={20} /> Forja de Tesouros
                    </h2>
                    <button onClick={onClose} className="text-amber-700 hover:text-white"><X size={20}/></button>
                </div>
                
                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-[10px] text-amber-500 font-bold uppercase mb-2 block">Quantidade de Itens</label>
                        <input type="range" min="1" max="10" value={count} onChange={e => setCount(parseInt(e.target.value))} className="w-full accent-amber-600"/>
                        <div className="text-center text-white font-bold">{count} itens</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] text-amber-500 font-bold uppercase mb-2 block">Raridade</label>
                            <select value={rarity} onChange={e => setRarity(e.target.value)} className="w-full bg-black border border-white/10 rounded p-2 text-xs text-white outline-none">
                                <option value="all">Qualquer</option>
                                <option value="common">Comum</option>
                                <option value="uncommon">Incomum</option>
                                <option value="rare">Raro</option>
                                <option value="legendary">Lendário</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-amber-500 font-bold uppercase mb-2 block">Tipo</label>
                            <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-black border border-white/10 rounded p-2 text-xs text-white outline-none">
                                <option value="all">Qualquer</option>
                                <option value="weapon">Armas</option>
                                <option value="armor">Armaduras</option>
                                <option value="potion">Poções</option>
                                <option value="magic">Itens Mágicos</option>
                            </select>
                        </div>
                    </div>

                    <button 
                        onClick={() => onGenerate({ count, rarity, type })}
                        className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-black font-black uppercase tracking-widest rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 mt-4"
                    >
                        <Dice5 size={20} /> Gerar Saque Aleatório
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LootGeneratorModal;