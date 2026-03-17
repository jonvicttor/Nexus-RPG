import { useEffect, useRef } from 'react';
import { Howl, Howler } from 'howler'; 
import socket from '../services/socket';

const AudioSystem = () => {
  const sounds = useRef<{ [key: string]: Howl | null }>({
    dado: null,
    suspense: null
  });

  useEffect(() => {
    // 1. Capturamos a referência atual para garantir uma limpeza segura da memória
    const currentSounds = sounds.current;

    // 2. Inicialização dos sons (html5: true ajuda na compatibilidade com o Brave)
    currentSounds.dado = new Howl({ 
      src: ['/sfx/dado.mp3'], 
      volume: 0.5, 
      html5: true,
      preload: true 
    });

    currentSounds.suspense = new Howl({ 
      src: ['/sfx/suspense.mp3'], 
      volume: 0.4, 
      html5: true,
      loop: true 
    });

    socket.on('newDiceResult', () => {
      console.log("🎲 Tocando dado...");
      // Forçamos o desbloqueio do contexto de áudio do navegador
      if (Howler.ctx && Howler.ctx.state === 'suspended') {
        Howler.ctx.resume();
      }
      currentSounds.dado?.play();
    });

    socket.on('triggerAudio', ({ trackId }) => {
      if (trackId === 'suspense') {
        const s = currentSounds.suspense;
        if (s?.playing()) {
           s.stop();
        } else {
           s?.play();
        }
      }
    });

    return () => {
      socket.off('newDiceResult');
      socket.off('triggerAudio');
      // 3. Descarregamos os sons da memória para evitar o erro "pool exhausted"
      currentSounds.dado?.unload();
      currentSounds.suspense?.unload();
    };
  }, []); // Dependências vazias garantem que isso rode apenas uma vez

  return null;
};

export default AudioSystem;