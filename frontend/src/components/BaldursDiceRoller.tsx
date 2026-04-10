import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, OrbitControls, ContactShadows, Stars, Sparkles } from '@react-three/drei';
import { DiceModel } from './DiceModel'; 
import * as THREE from 'three';
import { Howl } from 'howler';
import { Dice5, Eye, EyeOff } from 'lucide-react'; 

// --- SONS ---
const spinSound = new Howl({ src: ['/sfx/dado.mp3'], volume: 0.4, rate: 1.5 });
const impactSound = new Howl({ src: ['/sfx/impacto_dado.mp3'], volume: 0.6 });
const successSound = new Howl({ src: ['/sfx/levelup.mp3'], volume: 0.5 });
const critSuccessSound = new Howl({ src: ['/sfx/crit_success.mp3'], volume: 0.7 });

// --- ROTAÇÕES CALIBRADAS (X, Y, Z) ---
const faceRotations: Record<number, [number, number, number]> = {
  20: [1.45, 0.00, 0.00], 19: [5.22, -5.28, -6.09], 18: [14.50, -10.43, 0.93],
  17: [3.45, 6.83, -4.09], 16: [5.02, -7.32, -10.36], 15: [12.83, -8.87, 0.93],
  14: [8.71, -9.43, -0.02], 13: [8.17, -8.40, -9.81], 12: [2.42, 0.03, 0.65],
  11: [8.74, -9.40, 2.48], 10: [2.42, -0.00, -0.60], 9:  [5.59, -6.28, -5.64],
  8:  [11.38, -14.71, 2.83], 7:  [15.10, -6.28, 3.13], 6:  [6.59, -6.83, -8.49],
  5:  [5.19, 4.14, -0.90], 4:  [3.51, 2.59, -0.95], 3:  [5.04, 8.40, -5.24],
  2:  [2.00, 0.98, 0.25], 1:  [4.49, -6.27, -6.34], 
};

// --- DADO CINEMÁTICO ---
const SpinningDiceCinematic = ({ isRolling, finalResult, showImpactVFX }: { isRolling: boolean, finalResult: number | null, showImpactVFX: boolean }) => {
  const diceRef = useRef<THREE.Group>(null);
  const startTime = useRef<number | null>(null);
  const initialRotation = useRef(new THREE.Euler());

  useEffect(() => {
    if (isRolling) {
        startTime.current = null;
        if (diceRef.current) initialRotation.current.copy(diceRef.current.rotation);
    }
  }, [isRolling]);
  
  useFrame((state, delta) => {
    if (!diceRef.current) return;

    if (!isRolling && finalResult === null) {
        diceRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.1 + 0.8; 
        diceRef.current.rotation.y += 0.2 * delta; 
        diceRef.current.rotation.x = THREE.MathUtils.lerp(diceRef.current.rotation.x, 0.2, delta * 2);
        return;
    }

    if (isRolling && finalResult !== null) {
        if (startTime.current === null) startTime.current = state.clock.elapsedTime;
        const elapsed = state.clock.elapsedTime - startTime.current;

        const spinDuration = 1.8; 
        const snapDuration = 0.7; 
        const totalDuration = spinDuration + snapDuration;

        if (elapsed < spinDuration) {
            diceRef.current.rotation.x += 35 * delta;
            diceRef.current.rotation.y += 25 * delta;
            diceRef.current.rotation.z += 15 * delta;
            diceRef.current.position.x = (Math.random() - 0.5) * 0.05;
            diceRef.current.position.z = (Math.random() - 0.5) * 0.05;
            diceRef.current.position.y = 0.8 + Math.sin(elapsed * 20) * 0.1;
        } else if (elapsed < totalDuration) {
             const targetRot = faceRotations[finalResult] || [0,0,0];
             const dampFactor = 12; 
             diceRef.current.rotation.x = THREE.MathUtils.damp(diceRef.current.rotation.x, targetRot[0], dampFactor, delta);
             diceRef.current.rotation.y = THREE.MathUtils.damp(diceRef.current.rotation.y, targetRot[1], dampFactor, delta);
             diceRef.current.rotation.z = THREE.MathUtils.damp(diceRef.current.rotation.z, targetRot[2], dampFactor, delta);
             diceRef.current.position.set(0, 0.8, 0);
        } else {
             const targetRot = faceRotations[finalResult] || [0,0,0];
             diceRef.current.rotation.set(targetRot[0], targetRot[1], targetRot[2]);
        }
    }
  });

  return (
    <group>
        <group ref={diceRef} scale={2.8}> 
            <DiceModel /> 
        </group>
        {showImpactVFX && (
            <Sparkles 
                count={100}
                scale={4}
                size={4}
                speed={2}
                noise={0.2}
                color={finalResult === 20 ? "#22c55e" : finalResult === 1 ? "#ef4444" : "#fbbf24"}
                opacity={1}
                position={[0, 0.8, 0]}
            />
        )}
    </group>
  );
};

export interface RollBonus {
  id: string; name: string; value: number; type: 'flat'|'dice'; active: boolean; icon: string;
}

interface BaldursDiceRollerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  difficultyClass: number;
  baseModifier: number;
  proficiency: number;
  rollType?: 'normal' | 'advantage' | 'disadvantage';
  extraBonuses?: RollBonus[];
  onComplete: (total: number, isSuccess: boolean, isCrit: boolean, isSecret: boolean) => void;
}

const BaldursDiceRoller: React.FC<BaldursDiceRollerProps> = ({ 
  isOpen, onClose, title, subtitle, difficultyClass, baseModifier, proficiency, onComplete 
}) => {
  const [isRolling, setIsRolling] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [showTotal, setShowTotal] = useState(false);
  const [isSecret, setIsSecret] = useState(false);

  // 👉 LÓGICA DE OCULTAÇÃO DA CD
  const isTargetDCHidden = subtitle.toLowerCase().includes('exigido pelo mestre') || subtitle.toLowerCase().includes('ataque');

  useEffect(() => {
    if (isOpen) {
        setResult(null);
        setShowTotal(false);
        setIsRolling(false);
        setIsSecret(false); 
    }
  }, [isOpen]);

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    setResult(null);
    setShowTotal(false);
    setIsRolling(false);
  };

  const handleRoll = () => {
    if (isRolling) return;
    
    setIsRolling(true);
    setShowTotal(false);
    
    const val = Math.floor(Math.random() * 20) + 1;
    setResult(val); 
    
    spinSound.stop();
    spinSound.play();

    setTimeout(() => {
        const total = val + baseModifier + proficiency;
        const isCrit = val === 20;
        const isSuccess = total >= difficultyClass;
        
        impactSound.play(); 
        if (isCrit) critSuccessSound.play();
        else if (isSuccess) successSound.play();

        setShowTotal(true); 
        setIsRolling(false); 
    }, 2500);
  };

  if (!isOpen) return null;

  const totalFinal = (result || 0) + baseModifier + proficiency;
  const isSuccessFinal = totalFinal >= difficultyClass;
  const isCritFinal = result === 20;
  const isCritFail = result === 1;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0e] to-black animate-in fade-in duration-500">
      <div className="absolute inset-0 opacity-30 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] brightness-100 contrast-150"></div>

      <div className="relative w-full h-full max-w-4xl flex flex-col items-center justify-center">
        
        {/* Toggle de GM Roll (Secreto) */}
        <button 
            onClick={(e) => { e.stopPropagation(); setIsSecret(!isSecret); }}
            className={`absolute top-8 right-24 z-[1000] p-3 rounded-full border transition-all flex items-center gap-2 ${isSecret ? 'bg-purple-900/80 border-purple-500 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'}`}
            title={isSecret ? "Rolagem Secreta (Só o Mestre vê)" : "Rolagem Pública"}
        >
            {isSecret ? <EyeOff size={20} /> : <Eye size={20} />}
            <span className="text-xs font-bold uppercase tracking-wider">{isSecret ? "Secreto" : "Público"}</span>
        </button>

        {/* --- CABEÇALHO (Atacante e Alvo Limpos) --- */}
        <div className="absolute top-10 text-center z-20 pointer-events-none w-full flex flex-col items-center">
          {/* Nome do Atacante na Placa */}
          <div className="bg-black/60 border border-amber-900/50 px-8 py-2 rounded-t-xl backdrop-blur-sm border-b-0">
             <h2 className="text-xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-yellow-400 to-amber-600 tracking-[0.2em] uppercase drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] filter" style={{ fontFamily: '"Cinzel Decorative", serif' }}>
               {title.replace(/"/g, '')}
             </h2>
          </div>
          <div className="h-[2px] w-[60%] md:w-[400px] bg-gradient-to-r from-transparent via-yellow-500/80 to-transparent shadow-[0_0_10px_#f59e0b]"></div>
          
          {/* Nome do Alvo (Pequeno e Transparente) */}
          <div className="mt-2 bg-black/40 px-4 py-1 rounded-full border border-white/5 backdrop-blur-sm">
             <p className="text-gray-400/80 text-[10px] md:text-xs font-mono font-bold tracking-widest uppercase truncate max-w-[300px]">
               {subtitle.replace('Alvo(s):', '🎯 ALVO:')}
             </p>
          </div>
        </div>

        {/* --- DIFICULDADE (CD) --- */}
        <div className="absolute top-24 right-10 z-20 flex flex-col items-center group bg-black/40 p-2 rounded-2xl border border-white/5 backdrop-blur-md">
            <span className="text-red-400/80 text-[10px] font-black uppercase tracking-[0.2em] mb-1">CD</span>
            <div className="relative flex items-center justify-center w-14 h-14">
                <div className={`absolute inset-0 rounded-full border border-red-500/30 ${isTargetDCHidden ? 'animate-pulse' : 'animate-[spin_10s_linear_infinite]'}`}></div>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-950 to-black border-2 border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.2)] flex items-center justify-center">
                    <span className={`font-bold font-serif ${isTargetDCHidden ? 'text-lg text-red-500/50' : 'text-xl text-white'}`}>
                        {isTargetDCHidden ? '???' : difficultyClass}
                    </span>
                </div>
            </div>
            <span className="text-gray-500 text-[8px] mt-1 italic max-w-[60px] text-center leading-tight">Para Acertar</span>
        </div>

        {/* PALCO 3D (O dado não cobre mais os nomes em cima) */}
        <div className="w-full h-[550px] relative cursor-pointer group mt-10" onClick={!isRolling && !showTotal ? handleRoll : undefined}>
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none transition-all duration-1000 ${isRolling ? 'bg-yellow-500/30 scale-110' : 'bg-blue-500/10 scale-100'} group-hover:bg-yellow-500/20`}></div>

            <Canvas camera={{ position: [0, 1.5, 6], fov: 35 }}> 
                <ambientLight intensity={0.4} />
                <spotLight position={[5, 8, 5]} angle={0.3} penumbra={1} intensity={2} castShadow color="#fffaed" />
                <spotLight position={[-5, -2, 0]} angle={0.5} penumbra={1} intensity={1.5} color="#eab308" />
                <pointLight position={[0, 2, 3]} intensity={1} color="#ffffff" />
                <Environment preset="city" />
                <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1.5} />
                <Sparkles count={80} scale={8} size={2} speed={isRolling ? 2 : 0.4} opacity={0.6} color={isRolling ? "#fbbf24" : "#ffffff"} />

                <Suspense fallback={null}>
                    <SpinningDiceCinematic isRolling={isRolling} finalResult={result} showImpactVFX={showTotal} />
                    <ContactShadows position={[0, 0, 0]} opacity={0.7} scale={15} blur={3} far={4} color="#0a0a0a" />
                </Suspense>
                
                <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} />
            </Canvas>

            {/* TEXTO ÉPICO DE AÇÃO */}
            {!isRolling && result === null && (
                <div className="absolute top-[80%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-10 pointer-events-none w-full">
                  <p className="text-amber-100/60 text-[10px] md:text-xs uppercase tracking-[0.5em] font-serif mb-2 animate-pulse">Clique para</p>
                  <h2 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-amber-300 to-amber-600 drop-shadow-[0_0_15px_rgba(245,158,11,0.8)] uppercase tracking-[0.15em] transition-all duration-300" style={{ fontFamily: '"Cinzel Decorative", serif' }}>Lançar os Dados</h2>
                </div>
            )}
        </div>

        {/* --- PAINEL DE RESULTADO (PREMIUM HUD COM LEGENDAS) --- */}
        {showTotal && (
             <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30 w-full max-w-md flex justify-center animate-in slide-in-from-bottom-10 fade-in duration-700">
                 
                 <div className="relative w-full bg-gradient-to-b from-black/90 via-[#0F0F13]/95 to-black px-8 py-6 flex flex-col items-center gap-2 border-t-2 border-yellow-500/50 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl rounded-3xl">
                    
                    {/* Joia do Topo */}
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-yellow-400 shadow-[0_0_15px_#facc15] z-50"></div>
                    
                    <span className="text-yellow-500/50 text-[9px] uppercase tracking-[0.4em] font-bold block mb-1">TOTAL OBTIDO</span>

                    {/* NÚMERO GIGANTE */}
                    <div className="flex items-center justify-center mb-2 relative">
                        <span className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-yellow-100 to-yellow-600 drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)]" style={{ fontFamily: '"Cinzel Decorative", serif' }}>
                            {totalFinal}
                        </span>
                        <div className="absolute inset-0 bg-yellow-500/10 blur-[20px] rounded-full -z-10"></div>
                    </div>

                    {/* --- BREAKDOWN MATEMÁTICO COM LEGENDAS --- */}
                    <div className="flex items-start justify-center gap-4 w-full bg-black/40 rounded-xl p-3 border border-white/5">
                        
                        {/* DADO */}
                        <div className="flex flex-col items-center flex-1">
                            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl shadow-lg mb-1">
                                <Dice5 size={18} className={isCritFinal ? 'text-green-400' : isCritFail ? 'text-red-500' : 'text-gray-300'}/>
                            </div>
                            <span className={`font-black text-sm ${isCritFinal ? 'text-green-400' : isCritFail ? 'text-red-500' : 'text-white'}`}>{result}</span>
                            <span className="text-[8px] text-gray-500 uppercase tracking-widest mt-1">1d20</span>
                        </div>

                        <span className="text-gray-600 text-xl font-thin mt-2">+</span>

                        {/* MODIFICADOR */}
                        <div className="flex flex-col items-center flex-1">
                            <div className="w-10 h-10 rounded-xl bg-blue-900/20 border border-blue-500/20 flex items-center justify-center text-xl shadow-lg text-blue-300 mb-1">
                                💪
                            </div>
                            <span className="text-blue-400 font-bold text-sm">{baseModifier}</span>
                            <span className="text-[8px] text-gray-500 uppercase tracking-widest mt-1">Mod</span>
                        </div>

                        <span className="text-gray-600 text-xl font-thin mt-2">+</span>

                        {/* PROFICIÊNCIA */}
                        <div className="flex flex-col items-center flex-1">
                            <div className="w-10 h-10 rounded-xl bg-purple-900/20 border border-purple-500/20 flex items-center justify-center text-xl shadow-lg text-purple-300 mb-1">
                                🎓
                            </div>
                            <span className="text-purple-400 font-bold text-sm">{proficiency}</span>
                            <span className="text-[8px] text-gray-500 uppercase tracking-widest mt-1">Profic</span>
                        </div>
                    </div>

                    {/* --- FEEDBACK ACERTO/ERRO E BOTÕES --- */}
                    <div className="flex gap-3 mt-4 w-full">
                      <button onClick={handleReset} className="px-4 py-3 bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors flex items-center justify-center" title="Rolar Novamente">
                        <span className="text-lg">↺</span>
                      </button>
                      
                      <button 
                        onClick={() => onComplete(totalFinal, isSuccessFinal, isCritFinal, isSecret)} 
                        className={`flex-1 py-3 text-white font-black text-sm uppercase tracking-[0.2em] rounded-lg shadow-lg active:scale-95 transition-all ${
                          isCritFinal ? 'bg-gradient-to-r from-green-600 to-emerald-800 border-2 border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.4)]' :
                          isCritFail ? 'bg-gradient-to-r from-red-700 to-red-900 border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]' :
                          isSuccessFinal ? 'bg-gradient-to-r from-green-700 to-green-900 border-2 border-green-500/50' : 
                          'bg-gradient-to-r from-gray-700 to-gray-900 border-2 border-gray-500/50'
                        }`}
                      >
                        {isCritFinal ? 'ACERTO CRÍTICO!' : isCritFail ? 'FALHA CRÍTICA!' : isSuccessFinal ? 'ACERTO!' : 'FALHOU!'} ❯
                      </button>
                    </div>

                 </div>
             </div>
        )}

        <button onClick={onClose} className="absolute top-8 right-8 text-white/20 hover:text-white text-2xl z-50 transition-colors">✕</button>
      </div>
    </div>
  );
};

export default BaldursDiceRoller;