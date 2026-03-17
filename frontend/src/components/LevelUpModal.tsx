import React, { useState } from 'react';
import { Entity } from '../App';
import { LEVEL_CHOICES } from '../utils/levelUpChoices';

interface LevelUpModalProps {
    newLevel: number;
    hpGain: number;
    charClass?: string; // Opcional para evitar erro se não passar
    oldStats: { str: number, dex: number, con: number, int: number, wis: number, cha: number };
    onConfirm: (updates: Partial<Entity>) => void;
}

const ATTRIBUTES = [
    { key: 'str', label: 'Força' },
    { key: 'dex', label: 'Destreza' },
    { key: 'con', label: 'Constituição' },
    { key: 'int', label: 'Inteligência' },
    { key: 'wis', label: 'Sabedoria' },
    { key: 'cha', label: 'Carisma' }
];

const LevelUpModal: React.FC<LevelUpModalProps> = ({ newLevel, hpGain, charClass = 'GUERREIRO', oldStats, onConfirm }) => {
    // Regra D&D 5e: ASI (Ability Score Improvement) nos níveis 4, 8, 12, 16, 19
    const isASILevel = [4, 8, 12, 16, 19].includes(newLevel);
    
    // Verifica se há uma escolha específica para esta classe neste nível
    const choiceData = LEVEL_CHOICES[charClass.toUpperCase()]?.[newLevel];

    // Estados
    const [pointsLeft, setPointsLeft] = useState(isASILevel ? 2 : 0);
    const [stats, setStats] = useState({ ...oldStats });
    const [selectedOption, setSelectedOption] = useState<string | null>(null);

    const handleIncrease = (key: string) => {
        if (pointsLeft > 0 && stats[key as keyof typeof stats] < 20) {
            setStats(prev => ({ ...prev, [key]: prev[key as keyof typeof stats] + 1 }));
            setPointsLeft(prev => prev - 1);
        }
    };

    const handleDecrease = (key: string) => {
        if (stats[key as keyof typeof stats] > oldStats[key as keyof typeof oldStats]) {
            setStats(prev => ({ ...prev, [key]: prev[key as keyof typeof stats] - 1 }));
            setPointsLeft(prev => prev + 1);
        }
    };

    const handleSave = () => {
        const updates: Partial<Entity> = {};

        // 1. Aplica atributos se for ASI
        if (isASILevel) {
            updates.stats = stats;
        }

        // 2. Salva a escolha (ex: Subclasse) como uma "feature" ou anotação
        if (choiceData && selectedOption) {
            // Aqui você pode salvar em um campo 'features' na entidade se existir
            // Por enquanto vamos logar ou mandar como propriedade genérica
            console.log(`Escolha feita no nível ${newLevel}: ${selectedOption}`);
            // Exemplo: updates.features = [...oldFeatures, selectedOption];
        }

        onConfirm(updates);
    };

    return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
            <div className="bg-[#111] border-2 border-amber-500 rounded-lg shadow-[0_0_50px_rgba(245,158,11,0.3)] w-[500px] p-6 text-center relative overflow-hidden font-serif">
                
                {/* Efeito de Fundo */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>

                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-100 to-amber-600 mb-1" style={{ fontFamily: 'Cinzel' }}>LEVEL UP!</h1>
                <h2 className="text-xl text-gray-400 font-bold mb-6">Nível {newLevel} Alcançado</h2>

                {/* Resumo de Ganhos */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6 flex justify-around items-center">
                    <div className="flex flex-col items-center">
                        <span className="text-2xl">❤️</span>
                        <span className="text-green-400 font-bold text-lg">+{hpGain} PV</span>
                    </div>
                    <div className="w-px h-8 bg-white/10"></div>
                    <div className="flex flex-col items-center">
                        <span className="text-2xl">🎲</span>
                        <span className="text-blue-400 font-bold text-lg">
                            {[5, 9, 13, 17].includes(newLevel) ? '+1 PB' : '-'}
                        </span>
                    </div>
                </div>

                {/* ÁREA DE CONTEÚDO DINÂMICO */}
                <div className="mb-6 text-left">
                    
                    {/* CASO 1: Escolha de Classe (Subclasse/Estilo) */}
                    {choiceData && (
                        <div className="animate-in slide-in-from-bottom-4 duration-500">
                            <h3 className="text-amber-500 font-bold text-sm uppercase tracking-widest mb-3 border-b border-amber-500/30 pb-1">
                                {choiceData.title}
                            </h3>
                            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                {choiceData.options.map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setSelectedOption(opt.value)}
                                        className={`w-full p-3 rounded border text-left transition-all group ${selectedOption === opt.value ? 'bg-amber-900/40 border-amber-500 ring-1 ring-amber-500' : 'bg-black/40 border-white/10 hover:bg-white/5 hover:border-white/30'}`}
                                    >
                                        <div className={`font-bold text-sm ${selectedOption === opt.value ? 'text-white' : 'text-gray-300'}`}>{opt.label}</div>
                                        <div className="text-[10px] text-gray-500 group-hover:text-gray-400">{opt.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CASO 2: ASI (Atributos) */}
                    {isASILevel && !choiceData && (
                        <div className="animate-in slide-in-from-bottom-4 duration-500">
                            <div className="flex justify-between items-center mb-3">
                                <p className="text-amber-400 text-sm font-bold uppercase">Distribua Pontos</p>
                                <span className={`text-xs px-2 py-1 rounded border ${pointsLeft > 0 ? 'bg-amber-900/50 border-amber-500 text-amber-100' : 'bg-green-900/30 border-green-500/50 text-green-400'}`}>
                                    Restantes: {pointsLeft}
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2">
                                {ATTRIBUTES.map((attr) => (
                                    <div key={attr.key} className="flex flex-col items-center bg-black/40 p-2 rounded border border-white/10">
                                        <span className="text-[9px] text-gray-500 uppercase font-bold mb-1">{attr.label}</span>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => handleDecrease(attr.key)}
                                                disabled={stats[attr.key as keyof typeof stats] <= oldStats[attr.key as keyof typeof oldStats]}
                                                className="w-5 h-5 flex items-center justify-center bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded text-xs transition-colors disabled:opacity-20"
                                            >-</button>
                                            <span className={`text-sm font-bold w-5 text-center ${stats[attr.key as keyof typeof stats] > oldStats[attr.key as keyof typeof oldStats] ? 'text-green-400' : 'text-white'}`}>
                                                {stats[attr.key as keyof typeof stats]}
                                            </span>
                                            <button 
                                                onClick={() => handleIncrease(attr.key)}
                                                disabled={pointsLeft === 0 || stats[attr.key as keyof typeof stats] >= 20}
                                                className="w-5 h-5 flex items-center justify-center bg-white/5 hover:bg-green-500/20 text-gray-400 hover:text-green-400 rounded text-xs transition-colors disabled:opacity-20"
                                            >+</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CASO 3: Nível Normal (Sem escolhas) */}
                    {!isASILevel && !choiceData && (
                        <div className="text-center py-4">
                            <p className="text-gray-500 text-xs italic">Nenhuma escolha especial neste nível.</p>
                            <p className="text-gray-600 text-[10px]">Continue sua jornada!</p>
                        </div>
                    )}
                </div>

                <button 
                    onClick={handleSave}
                    disabled={(isASILevel && pointsLeft > 0 && !choiceData) || (choiceData && !selectedOption)}
                    className="w-full bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded shadow-lg uppercase tracking-[0.2em] text-xs transition-all active:scale-95"
                >
                    Confirmar Evolução
                </button>
            </div>
        </div>
    );
};

export default LevelUpModal;