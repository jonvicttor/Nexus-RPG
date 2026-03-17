import React from 'react';
import { Volume2, Play, Square, Music, Zap, Radio } from 'lucide-react';

// Definindo a interface das props que o componente aceita
export interface SoundboardProps {
  currentTrack: string | null;
  onPlayMusic: (trackId: string) => void;
  onStopMusic: () => void;
  onPlaySFX: (sfxId: string) => void;
  globalVolume: number;
  onVolumeChange: (val: number) => void;
}

const MUSIC_TRACKS = [
  { id: 'exploration', name: 'Exploração', color: 'bg-blue-900/50 border-blue-500/30' },
  { id: 'combat', name: 'Combate Épico', color: 'bg-red-900/50 border-red-500/30' },
  { id: 'tavern', name: 'Taverna', color: 'bg-amber-900/50 border-amber-500/30' },
  { id: 'suspense', name: 'Tensão/Terror', color: 'bg-purple-900/50 border-purple-500/30' },
  { id: 'boss', name: 'Chefe Final', color: 'bg-red-950 border-red-600' },
];

const SFX_LIST = [
  { id: 'dado', name: '🎲 Dado', icon: '🎲' },
  { id: 'sword', name: 'Espada', icon: '⚔️' },
  { id: 'magic', name: 'Magia', icon: '✨' },
  { id: 'explosion', name: 'Explosão', icon: '💥' },
  { id: 'roar', name: 'Monstro', icon: '👹' },
  { id: 'levelup', name: 'Level Up', icon: '🆙' },
];

const Soundboard: React.FC<SoundboardProps> = ({ 
  currentTrack, 
  onPlayMusic, 
  onStopMusic, 
  onPlaySFX, 
  globalVolume, 
  onVolumeChange 
}) => {
  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#1a1510] to-black text-white p-4 space-y-6">
      
      {/* --- CONTROLE DE VOLUME MESTRE --- */}
      <div className="bg-black/40 p-4 rounded-xl border border-white/10 shadow-lg">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-amber-500 flex items-center gap-2">
            <Volume2 size={16} /> Volume Global
          </h3>
          <span className="text-xs font-mono text-gray-400">{Math.round(globalVolume * 100)}%</span>
        </div>
        <input 
          type="range" 
          min="0" max="1" step="0.05" 
          value={globalVolume} 
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400 transition-all"
        />
      </div>

      {/* --- MÚSICA AMBIENTE --- */}
      <div className="space-y-3">
        <div className="flex justify-between items-center border-b border-white/10 pb-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-blue-400 flex items-center gap-2">
            <Music size={16} /> Atmosfera
          </h3>
          {currentTrack && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-green-400 animate-pulse">Tocando: {MUSIC_TRACKS.find(t => t.id === currentTrack)?.name}</span>
              <button onClick={onStopMusic} className="p-1 bg-red-900/80 rounded hover:bg-red-700 transition-colors" title="Parar Música">
                <Square size={12} fill="currentColor" />
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2">
          {MUSIC_TRACKS.map(track => (
            <button 
              key={track.id}
              onClick={() => onPlayMusic(track.id)}
              className={`relative overflow-hidden p-3 rounded-lg border flex items-center justify-between transition-all duration-300 group ${currentTrack === track.id ? 'border-green-500 bg-green-900/20 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : `${track.color} hover:brightness-125 border-transparent`}`}
            >
              <div className="flex items-center gap-3 z-10">
                {currentTrack === track.id ? <Radio size={18} className="text-green-400 animate-spin-slow" /> : <Play size={18} className="text-white/50 group-hover:text-white" />}
                <span className={`text-sm font-bold ${currentTrack === track.id ? 'text-green-100' : 'text-gray-200'}`}>{track.name}</span>
              </div>
              {currentTrack === track.id && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-500/10 to-transparent animate-shimmer"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* --- EFEITOS SONOROS (SFX) --- */}
      <div className="space-y-3">
        <div className="flex justify-between items-center border-b border-white/10 pb-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 flex items-center gap-2">
            <Zap size={16} /> Efeitos (One-Shot)
          </h3>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {SFX_LIST.map(sfx => (
            <button 
              key={sfx.id}
              onClick={() => onPlaySFX(sfx.id)}
              className="flex flex-col items-center justify-center p-2 bg-gray-800/50 hover:bg-purple-900/40 border border-white/5 hover:border-purple-500/50 rounded-lg transition-all active:scale-95 active:bg-purple-600 active:text-white group"
            >
              <span className="text-xl mb-1 filter drop-shadow-md group-hover:scale-110 transition-transform">{sfx.icon}</span>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider group-hover:text-purple-200">{sfx.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-4 text-center">
        <p className="text-[9px] text-gray-600 italic">Dica: O áudio é sincronizado com todos os jogadores conectados.</p>
      </div>
    </div>
  );
};

export default Soundboard;