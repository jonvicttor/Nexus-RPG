import React, { useState, useEffect } from 'react';

// Definição das cores e formas para cada dado (Estilo Google)
const DICE_CONFIG = {
  4: { color: '#34a853', shape: 'polygon(50% 0%, 0% 100%, 100% 100%)' }, // Verde (Triângulo)
  6: { color: '#fbbc05', shape: 'polygon(10% 10%, 90% 10%, 90% 90%, 10% 90%)' }, // Amarelo (Quadrado arredondado)
  8: { color: '#8e24aa', shape: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }, // Roxo (Losango)
  10: { color: '#e53935', shape: 'polygon(50% 0%, 100% 30%, 80% 100%, 20% 100%, 0% 30%)' }, // Vermelho (Pipa)
  12: { color: '#f4511e', shape: 'polygon(50% 0%, 100% 38%, 81% 100%, 19% 100%, 0% 38%)' }, // Laranja (Pentágono)
  20: { color: '#3949ab', shape: 'polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)' }, // Azul (Hexágono)
};

interface Die {
  id: string;
  sides: number;
  value: number;
  isRolling: boolean;
}

const GoogleDiceRoller: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [diceTray, setDiceTray] = useState<Die[]>([]);
  const [modifier, setModifier] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [isRollingAll, setIsRollingAll] = useState(false);

  // Adiciona um dado na bandeja
  const addDie = (sides: number) => {
    const newDie: Die = {
      id: Math.random().toString(),
      sides,
      value: sides, // Valor inicial mostra o valor máximo do dado
      isRolling: false,
    };
    setDiceTray([...diceTray, newDie]);
  };

  // Remove um dado específico da bandeja (clicando nele)
  const removeDie = (id: string) => {
    setDiceTray(diceTray.filter(d => d.id !== id));
  };

  const clearTray = () => {
    setDiceTray([]);
    setModifier(0);
    setTotal(0);
  };

  const rollDice = () => {
    if (diceTray.length === 0) return;
    
    setIsRollingAll(true);
    
    // Inicia a animação em todos os dados
    setDiceTray(prev => prev.map(d => ({ ...d, isRolling: true })));

    // Após 500ms (tempo da animação), define os resultados
    setTimeout(() => {
      let sum = modifier;
      const rolledTray = diceTray.map(d => {
        const result = Math.floor(Math.random() * d.sides) + 1;
        sum += result;
        return { ...d, value: result, isRolling: false };
      });
      
      setDiceTray(rolledTray);
      setTotal(sum);
      setIsRollingAll(false);
    }, 500);
  };

  // Recalcula o total apenas se não estiver rolando (útil se mudar o modificador)
  useEffect(() => {
    if (!isRollingAll && diceTray.length > 0) {
      const sum = diceTray.reduce((acc, curr) => acc + curr.value, 0) + modifier;
      setTotal(sum);
    } else if (diceTray.length === 0) {
      setTotal(0);
    }
  }, [diceTray, modifier, isRollingAll]);

  return (
    <div className="bg-[#202124] rounded-lg shadow-2xl overflow-hidden w-full max-w-2xl border border-gray-700 font-sans text-white">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-[#303134]">
        <h2 className="text-xl font-medium text-gray-200">Jogar os dados</h2>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            ✕
          </button>
        )}
      </div>

      {/* Área da Bandeja de Dados */}
      <div className="p-8 min-h-[250px] relative flex flex-wrap justify-center items-center gap-6 bg-[#202124]">
        {diceTray.length === 0 ? (
          <span className="text-gray-500 text-lg">Selecione os dados abaixo para rolar</span>
        ) : (
          diceTray.map((die) => (
            <div 
              key={die.id}
              onClick={() => removeDie(die.id)}
              className={`relative flex justify-center items-center cursor-pointer hover:scale-105 transition-transform w-20 h-20 ${die.isRolling ? 'animate-[spin_0.2s_linear_infinite]' : ''}`}
              title="Clique para remover"
            >
              {/* Forma geométrica do dado (SVG/CSS) */}
              <div 
                className="absolute inset-0"
                style={{
                  backgroundColor: DICE_CONFIG[die.sides as keyof typeof DICE_CONFIG].color,
                  clipPath: DICE_CONFIG[die.sides as keyof typeof DICE_CONFIG].shape,
                  transform: die.sides === 6 ? 'scale(0.85) rounded-lg' : 'scale(1)',
                }}
              ></div>
              {/* Valor do dado */}
              <span className="relative z-10 text-3xl font-bold drop-shadow-md select-none">
                {die.value}
              </span>
            </div>
          ))
        )}

        {/* Totalizador Flutuante */}
        {diceTray.length > 0 && !isRollingAll && (
          <div className="absolute bottom-4 right-6 text-right">
            <span className="text-gray-400 text-lg font-medium mr-2">Total</span>
            <span className="text-5xl font-bold">{total}</span>
          </div>
        )}
      </div>

      {/* Controles: Seleção de Dados e Botões */}
      <div className="bg-[#303134] p-4 flex flex-col items-center gap-4">
        {/* Botões dos Dados */}
        <div className="flex flex-wrap justify-center gap-3">
          {[4, 6, 8, 10, 12, 20].map((sides) => (
            <button
              key={sides}
              onClick={() => addDie(sides)}
              className="w-10 h-10 flex justify-center items-center hover:scale-110 transition-transform relative"
              title={`Adicionar D${sides}`}
            >
              <div 
                className="absolute inset-0 opacity-90"
                style={{
                  backgroundColor: DICE_CONFIG[sides as keyof typeof DICE_CONFIG].color,
                  clipPath: DICE_CONFIG[sides as keyof typeof DICE_CONFIG].shape,
                  transform: sides === 6 ? 'scale(0.85) rounded-sm' : 'scale(1)',
                }}
              ></div>
              <span className="relative z-10 text-sm font-bold text-white drop-shadow-sm">{sides}</span>
            </button>
          ))}
          
          {/* Modificador Numérico */}
          <div className="flex items-center ml-2 border-l border-gray-600 pl-4 gap-2">
            <span className="text-gray-400 font-bold select-none text-xl">±</span>
            <input 
              type="number" 
              value={modifier}
              onChange={(e) => setModifier(Number(e.target.value))}
              className="w-16 bg-[#202124] text-white text-center rounded border border-gray-600 focus:outline-none focus:border-blue-500 py-1"
            />
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-4">
          <button 
            onClick={rollDice}
            disabled={diceTray.length === 0 || isRollingAll}
            className="bg-blue-300 text-blue-900 font-bold px-8 py-2 rounded-full hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Rolar
          </button>
          <button 
            onClick={clearTray}
            disabled={diceTray.length === 0}
            className="bg-[#3c4043] text-gray-200 font-medium px-8 py-2 rounded-full hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Limpar
          </button>
        </div>
      </div>
    </div>
  );
};

export default GoogleDiceRoller;