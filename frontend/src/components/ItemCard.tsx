import React, { useState } from 'react';
import { Item } from '../App';
import { X, Trash2, Shield, Zap } from 'lucide-react';

// --- INTERFACES ---
interface ExtendedItem extends Item {
    rarity?: 'common' | 'rare' | 'epic' | 'legendary';
    isEquipped?: boolean;
    stats?: {
        damage?: string;
        ac?: number;
        properties?: string[];
    };
}

interface ItemCardProps {
    item: ExtendedItem;
    onUpdate: (updates: Partial<Item>) => void;
    onDelete: () => void;
    onEquip?: (item: ExtendedItem) => void;
}

const ItemCard: React.FC<ItemCardProps> = ({ item, onUpdate, onDelete, onEquip }) => {
    const [showModal, setShowModal] = useState(false);

    // --- FONTES ---
    const titleFont = { fontFamily: '"Uncial Antiqua", serif', textShadow: '1px 1px 0px rgba(0,0,0,0.3)' };
    const textFont = { fontFamily: '"Crimson Text", serif', fontWeight: 600 };

    // --- SELEÇÃO DE TEMPLATE (Bronze, Prata, Ouro) ---
    const getCardTemplate = () => {
        // Salve suas imagens na pasta public/assets/ com esses nomes:
        switch (item.rarity) {
            case 'legendary': 
            case 'epic': 
                return '/assets/card-gold.png';   // Ouro (Para Épico e Lendário)
            case 'rare': 
                return '/assets/card-silver.png'; // Prata (Para Raro)
            case 'common': 
            default: 
                return '/assets/card-bronze.png'; // Bronze (Para Comum e padrão)
        }
    };

    const assets = {
        template: getCardTemplate(),
        dice: '/assets/icone-dado.png', // Ícone do dado (caso precise)
        trash: '/assets/ui-lixeira-bronze.png'
    };

    const textColor = "text-[#2c241b]"; 

    // --- MODAL DETALHADO (CLIQUE DUPLO) ---
    const renderDetailModal = () => {
        if (!showModal) return null;

        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowModal(false)}>
                <div 
                    className="relative w-full max-w-[400px] aspect-[4/6] rounded-xl overflow-hidden drop-shadow-2xl animate-in zoom-in-95 duration-300 select-none" 
                    onClick={e => e.stopPropagation()}
                >
                    {/* 1. FUNDO (TEMPLATE SELECIONADO) */}
                    <img src={assets.template} alt="Card Background" className="absolute inset-0 w-full h-full object-fill" />

                    {/* Botão Fechar */}
                    <button onClick={() => setShowModal(false)} className="absolute top-3 right-3 z-50 bg-black/20 hover:bg-black/40 text-white rounded-full p-1 border border-white/20 transition-colors">
                        <X size={20} />
                    </button>

                    {/* 2. CONTEÚDO SOBREPOSTO */}
                    
                    {/* TÍTULO */}
                    <div className="absolute top-[8%] left-[10%] right-[10%] text-center flex items-center justify-center h-[8%]">
                        <h2 className={`text-2xl uppercase leading-none ${textColor}`} style={titleFont}>{item.name}</h2>
                    </div>

                    {/* TIPO / RARIDADE */}
                    <div className="absolute top-[16%] left-0 right-0 text-center">
                        <p className={`text-[10px] font-bold uppercase tracking-widest opacity-70 ${textColor}`} style={textFont}>
                            {item.type} • {item.rarity}
                        </p>
                    </div>

                    {/* IMAGEM DO ITEM */}
                    <div className="absolute top-[25%] left-[15%] right-[15%] h-[35%] flex items-center justify-center">
                        {item.image && <img src={item.image} alt={item.name} className="max-w-full max-h-full object-contain drop-shadow-lg" />}
                    </div>

                    {/* STATS (DANO E VALOR) */}
                    <div className="absolute top-[58%] left-[12%] right-[12%] flex justify-between items-center px-2">
                        
                        {/* Lado Esquerdo: Dano */}
                        <div className="flex flex-col items-center w-16">
                            {item.stats?.damage && (
                                <>
                                    {/* Exibe ícone do dado + valor */}
                                    <img src={assets.dice} alt="Dano" className="w-10 h-10 object-contain mb-[-5px]" onError={(e) => e.currentTarget.style.display = 'none'} /> 
                                    <span className={`text-xl font-bold ${textColor}`} style={titleFont}>{item.stats.damage}</span>
                                </>
                            )}
                        </div>

                        {/* Lado Direito: Valor (SOBRE A MOEDA JÁ DESENHADA NO TEMPLATE) */}
                        <div className="flex flex-col items-center w-16 pt-2"> 
                            {item.value && (
                                // Apenas o texto, posicionado para cair em cima da moeda da imagem de fundo
                                <span className={`text-xl font-black ${textColor}`} style={titleFont}>{item.value}</span>
                            )}
                        </div>
                    </div>

                    {/* DESCRIÇÃO */}
                    <div className="absolute bottom-[13%] left-[15%] right-[15%] h-[14%] flex items-center justify-center overflow-y-auto custom-scrollbar-dark text-center">
                        <p className={`text-sm leading-tight italic ${textColor}`} style={textFont}>
                            {item.description || "Descrição indisponível."}
                        </p>
                    </div>

                    {/* AÇÕES (Rodapé) */}
                    <div className="absolute bottom-[3%] left-0 right-0 flex justify-center gap-3 px-6">
                        {(onEquip && (item.type === 'weapon' || item.type === 'armor')) && (
                            <button onClick={() => onEquip(item)} className={`px-3 py-1.5 rounded shadow font-bold text-[10px] uppercase flex items-center gap-1 transition-transform active:scale-95 ${item.isEquipped ? 'bg-green-700 text-white' : 'bg-[#5d4037] text-[#f3e5be]'}`}>
                                {item.isEquipped ? <><Shield size={12}/> Equipado</> : <><Zap size={12}/> Equipar</>}
                            </button>
                        )}
                        <div className="flex bg-[#e6dcc3] rounded-full border border-[#8b6f4e] px-2 py-1 items-center gap-2 shadow-inner">
                             <button onClick={() => onUpdate({quantity: Math.max(0, item.quantity - 1)})} className="text-[#5d4037] hover:scale-125 font-bold">-</button>
                             <span className={`text-xs font-bold ${textColor}`}>{item.quantity}</span>
                             <button onClick={() => onUpdate({quantity: item.quantity + 1})} className="text-[#5d4037] hover:scale-125 font-bold">+</button>
                        </div>
                        <button onClick={() => { if(window.confirm('Excluir?')) { onDelete(); setShowModal(false); } }} className="p-1.5 bg-red-900/80 text-white rounded hover:bg-red-700">
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // --- CARD PEQUENO (GRID - VISUAL LIMPO) ---
    return (
        <>
            {renderDetailModal()}

            <div 
                className="group relative w-full h-full cursor-pointer select-none transition-transform hover:scale-[1.02] active:scale-95"
                onDoubleClick={() => setShowModal(true)}
                title={item.name}
            >
                {/* 1. IMAGEM DO TEMPLATE PEQUENA */}
                <img src={assets.template} alt="" className="absolute inset-0 w-full h-full object-fill rounded-md shadow-md filter contrast-105" />

                {/* 2. CONTEÚDO MINIMALISTA */}
                <div className="absolute inset-0 z-10">
                    
                    {/* Nome (Apenas texto, limpo) */}
                    <div className="absolute top-[8%] left-[8%] right-[8%] flex justify-center">
                        <h3 className={`text-[9px] font-bold uppercase truncate ${textColor}`} style={titleFont}>
                            {item.name}
                        </h3>
                    </div>

                    {/* Imagem Central */}
                    <div className="absolute top-[25%] left-[15%] right-[15%] bottom-[25%] flex items-center justify-center p-1">
                        {item.image ? (
                            <img src={item.image} alt={item.name} className="max-w-full max-h-full object-contain drop-shadow-sm" />
                        ) : (
                            <span className="text-3xl opacity-20 text-gray-500">⚔️</span>
                        )}
                    </div>

                    {/* Quantidade (Selo Flutuante) */}
                    {item.quantity > 1 && (
                        <div className="absolute top-[20%] right-[8%] bg-[#8b0000] text-white text-[7px] font-bold w-4 h-4 flex items-center justify-center rounded-full border border-white/30 shadow-sm z-20">
                            {item.quantity}
                        </div>
                    )}

                    {/* Descrição Curta (Rodapé) */}
                    <div className="absolute bottom-[10%] left-[12%] right-[12%] h-[12%] flex items-center justify-center">
                        <p className={`text-[6px] leading-[1.1] text-center line-clamp-2 italic opacity-80 ${textColor}`} style={textFont}>
                            {item.description}
                        </p>
                    </div>

                </div>
            </div>
        </>
    );
};

export default ItemCard;