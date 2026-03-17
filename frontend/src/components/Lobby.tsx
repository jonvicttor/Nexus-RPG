import React, { useState } from 'react';
import { Entity } from '../App';
import { Shield, Crown, CheckCircle2, XCircle, User, Heart } from 'lucide-react';

// Estende a tipagem para incluir 'race' e 'classType'
interface PlayerEntity extends Entity {
    race?: string;
    classType?: string;
}

interface LobbyProps {
  availableCharacters: Entity[];
  onStartGame: () => void;
  myPlayerName: string;
}

const Lobby: React.FC<LobbyProps> = ({ availableCharacters, onStartGame, myPlayerName }) => {
  const [selectedCharId, setSelectedCharId] = useState<number | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Estilos de Fonte
  const titleFont = { fontFamily: '"Uncial Antiqua", serif' };
  const textFont = { fontFamily: '"Crimson Text", serif' };

  // --- FILTRO DE PERSONAGENS ÚNICOS ---
  const uniqueCharacters = Array.from(
    new Map(availableCharacters
        .filter(e => e.type === 'player')
        .map(item => [item.name, item])
    ).values()
  );

  // --- LISTA DE JOGADORES (AGORA MOSTRA SÓ VOCÊ) ---
  // Futuramente, isso virá do servidor via Socket
  const currentPlayers = [
    { 
        id: 99, 
        name: myPlayerName || 'Jogador', 
        role: myPlayerName === 'Mestre' ? 'DM' : 'PLAYER', // Lógica simples para teste
        ready: isReady 
    }
  ];

  return (
    <div className="w-full h-screen bg-[#0d0b09] flex items-center justify-center p-8 overflow-hidden relative">
      <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] pointer-events-none"></div>

      <div className="max-w-6xl w-full h-full grid grid-cols-12 gap-6 relative z-10">
        
        {/* === COLUNA ESQUERDA: SELEÇÃO DE PERSONAGEM === */}
        <div className="col-span-8 flex flex-col gap-6">
          
          <div className="bg-[#1a1510] border border-white/10 p-6 rounded-lg shadow-2xl flex justify-between items-center">
            <div>
              <h1 className="text-4xl text-amber-500 mb-1" style={titleFont}>A Taverna</h1>
              <p className="text-gray-400 text-sm" style={textFont}>Escolha seu herói e prepare-se para a aventura.</p>
            </div>
            <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded border border-white/5">
              <span className="text-gray-400 text-xs uppercase tracking-widest">Código da Sala:</span>
              <span className="text-amber-200 font-mono font-bold tracking-widest text-lg">X7B-99</span>
            </div>
          </div>

          <div className="flex-grow bg-[#1a1510] border border-white/10 p-6 rounded-lg shadow-2xl overflow-y-auto custom-scrollbar">
            <h2 className="text-gray-300 uppercase tracking-widest text-xs font-bold mb-4 border-b border-white/5 pb-2">Heróis Disponíveis</h2>
            
            <div className="grid grid-cols-3 gap-4">
              {uniqueCharacters.map((entity) => {
                const char = entity as PlayerEntity;
                return (
                  <div 
                    key={char.id}
                    onClick={() => setSelectedCharId(char.id)}
                    className={`relative group cursor-pointer border-2 rounded-lg transition-all duration-300 overflow-hidden h-64 flex flex-col
                      ${selectedCharId === char.id 
                        ? 'border-amber-500 bg-amber-900/10 shadow-[0_0_20px_rgba(245,158,11,0.2)]' 
                        : 'border-white/10 bg-black/40 hover:border-white/30'
                      }`}
                  >
                    <div className="absolute inset-0">
                      <img src={char.image || '/assets/card-template.png'} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" alt={char.name} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
                    </div>

                    <div className="relative z-10 flex flex-col h-full justify-end p-4">
                      <h3 className="text-2xl text-white leading-none mb-1" style={titleFont}>{char.name}</h3>
                      <p className="text-amber-400/80 text-xs uppercase font-bold mb-3">{char.race || 'Humano'} {char.classType || 'Guerreiro'}</p>
                      
                      <div className="flex gap-2 text-xs text-gray-300 bg-black/60 p-2 rounded backdrop-blur-sm border border-white/5">
                        <span className="flex items-center gap-1"><Shield size={12} className="text-blue-400"/> AC {char.ac}</span>
                        <span className="flex items-center gap-1"><Heart size={12} className="text-red-500"/> HP {char.hp}</span>
                      </div>
                    </div>

                    {selectedCharId === char.id && (
                      <div className="absolute top-2 right-2 bg-amber-500 text-black p-1 rounded-full shadow-lg animate-in zoom-in">
                        <CheckCircle2 size={20} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* === COLUNA DIREITA: JOGADORES (ATUALIZADO) === */}
        <div className="col-span-4 flex flex-col gap-6">
          
          <div className="bg-[#1a1510] border border-white/10 p-6 rounded-lg shadow-2xl h-1/2 flex flex-col">
            <h2 className="text-gray-300 uppercase tracking-widest text-xs font-bold mb-4 flex items-center gap-2">
              <User size={14}/> Aventureiros ({currentPlayers.length}/5)
            </h2>
            
            <div className="space-y-3 flex-grow overflow-y-auto pr-2 custom-scrollbar">
              {currentPlayers.map(player => (
                <div key={player.id} className="flex items-center justify-between bg-black/30 p-3 rounded border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border ${player.role === 'DM' ? 'border-purple-500 text-purple-400' : 'border-gray-600 text-gray-400'}`}>
                      {player.role === 'DM' ? <Crown size={14}/> : player.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm text-gray-200 font-bold">{player.name} {player.name === myPlayerName && '(Você)'}</div>
                      <div className="text-[10px] text-gray-500 uppercase">{player.role === 'DM' ? 'Mestre do Jogo' : 'Aventureiro'}</div>
                    </div>
                  </div>
                  <div>
                    {player.ready ? (
                      <span className="flex items-center gap-1 text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded border border-green-900">
                        <CheckCircle2 size={12}/> Pronto
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-900/20 px-2 py-1 rounded border border-gray-800">
                        <XCircle size={12}/> Aguardando
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#1a1510] border border-white/10 p-6 rounded-lg shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between text-sm text-gray-400 border-b border-white/5 pb-4">
              <span>Status da Sala</span>
              <span className="text-amber-500 animate-pulse">Aguardando todos...</span>
            </div>

            <button 
              onClick={() => setIsReady(!isReady)}
              className={`w-full py-4 text-lg font-bold uppercase tracking-widest rounded border transition-all shadow-lg flex items-center justify-center gap-2
                ${isReady 
                  ? 'bg-green-800/80 border-green-600 text-green-100 hover:bg-green-700' 
                  : 'bg-amber-900/20 border-amber-800/50 text-amber-500 hover:bg-amber-900/40 hover:border-amber-500'
                }`}
              style={titleFont}
            >
              {isReady ? 'Você está Pronto!' : 'Marcar como Pronto'}
            </button>

            <button 
              onClick={onStartGame}
              className="w-full py-3 bg-indigo-900/50 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-900 hover:text-white rounded uppercase text-xs font-bold tracking-widest transition-all"
            >
              Iniciar Aventura (DM Override)
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Lobby;