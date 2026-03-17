import React, { useState } from 'react';
// Ajuste o caminho abaixo conforme a sua estrutura de pastas real
import socket from '../services/socket'; 

const DiceRoller = () => {
  const [result, setResult] = useState<number | string>('--');

  const rollDice = (sides: number) => {
    const roll = Math.floor(Math.random() * sides) + 1;
    setResult(roll);
    
    // Notifica o servidor sobre a rolagem
    socket.emit('rollDice', { sides, result: roll, roomId: 'mesa-do-victor' });
  };

  return (
    /* h-auto garante que o painel cresça para mostrar os botões */
    <div className="bg-rpgPanel/90 border border-rpgAccent/30 rounded-lg p-4 w-32 h-auto flex flex-col items-center shadow-2xl backdrop-blur-sm">
      <span className="text-[8px] text-rpgText opacity-50 uppercase font-mono tracking-widest mb-2 text-center">
        Painel de Dados
      </span>
      
      <div className="text-3xl font-bold text-rpgAccent my-2 font-mono drop-shadow-[0_0_8px_rgba(255,0,0,0.5)]">
        {result}
      </div>

      {/* Botões d20 e d6 */}
      <div className="grid grid-cols-2 gap-2 w-full mt-2">
        <button
          onClick={() => rollDice(20)}
          className="bg-rpgAccent hover:bg-rpgAccent/80 text-white text-[10px] font-bold py-2 rounded transition-all active:scale-95"
        >
          d20
        </button>
        <button
          onClick={() => rollDice(6)}
          className="bg-rpgAccent/40 hover:bg-rpgAccent/60 text-white text-[10px] font-bold py-2 rounded transition-all active:scale-95"
        >
          d6
        </button>
      </div>
    </div>
  );
};

export default DiceRoller;