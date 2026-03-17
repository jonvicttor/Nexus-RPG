import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, OrbitControls, ContactShadows, Stars, Sparkles } from '@react-three/drei';
import { DiceModel } from './DiceModel'; 
import * as THREE from 'three';
import { Howl } from 'howler';
import { Dice5, Eye, EyeOff } from 'lucide-react'; // Importar ícones

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

  useEffect(() => {
    if (isOpen) {
        setResult(null);
        setShowTotal(false);
        setIsRolling(false);
        setIsSecret(false); // Resetar ao abrir
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

        {/* CABEÇALHO */}
        <div className="absolute top-16 text-center z-20 pointer-events-none space-y-2">
          <h2 className="text-5xl font-serif text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 tracking-widest uppercase drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] filter">
            {title}
          </h2>
          <div className="flex items-center justify-center gap-2">
             <div className="h-[1px] w-12 bg-gradient-to-r from-transparent via-yellow-500 to-transparent"></div>
             <p className="text-yellow-100/60 italic text-xl font-serif tracking-wider">{subtitle}</p>
             <div className="h-[1px] w-12 bg-gradient-to-r from-transparent via-yellow-500 to-transparent"></div>
          </div>
        </div>

        {/* DIFICULDADE */}
        <div className="absolute top-20 right-10 z-20 flex flex-col items-center group">
            <span className="text-yellow-500/80 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">Dificuldade</span>
            <div className="relative flex items-center justify-center w-16 h-16">
                <div className="absolute inset-0 rounded-full border border-yellow-500/30 animate-[spin_10s_linear_infinite]"></div>
                <div className="absolute inset-0 rounded-full border border-yellow-500/10 scale-125"></div>
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-800 to-black border-2 border-yellow-600 shadow-[0_0_20px_rgba(234,179,8,0.2)] flex items-center justify-center">
                    <span className="text-2xl font-bold text-white font-serif">{difficultyClass}</span>
                </div>
            </div>
        </div>

        {/* PALCO 3D */}
        <div className="w-full h-[600px] relative cursor-pointer group" onClick={!isRolling && !showTotal ? handleRoll : undefined}>
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
                  <h2 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-amber-300 to-amber-600 drop-shadow-[0_0_15px_rgba(245,158,11,0.8)] uppercase tracking-[0.15em] transition-all duration-300" style={{ fontFamily: '"Cinzel Decorative", serif' }}>Iniciar o Destino</h2>
                  <div className="w-64 h-[1px] bg-gradient-to-r from-transparent via-amber-500 to-transparent mx-auto mt-4 opacity-60 shadow-[0_0_10px_#f59e0b]"></div>
                </div>
            )}
        </div>

        {/* --- PAINEL DE RESULTADO (PREMIUM HUD) --- */}
        {showTotal && (
             <div className="absolute top-[60%] left-1/2 transform -translate-x-1/2 z-30 w-full max-w-md flex justify-center animate-in slide-in-from-bottom-10 fade-in duration-700">
                 
                 {/* Fundo de Vidro Mágico com Borda Dourada */}
                 <div className="relative w-full bg-gradient-to-b from-black/80 via-[#0F0F13]/95 to-black px-8 py-6 flex flex-col items-center gap-4 border-t-2 border-yellow-500/50 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl rounded-t-[3rem]">
                    
                    {/* Joia do Topo */}
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-yellow-400 shadow-[0_0_15px_#facc15] z-50"></div>
                    <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-32 h-[2px] bg-gradient-to-r from-transparent via-yellow-400 to-transparent blur-[1px]"></div>

                    {/* CONTEÚDO */}
                    <div className="text-center w-full">
                        <span className="text-yellow-500/40 text-[10px] uppercase tracking-[0.4em] font-bold block mb-1">Resultado Final</span>
                        
                        {/* Número Gigante do Total */}
                        <div className="flex items-center justify-center mb-4 relative">
                            <span className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-yellow-100 to-yellow-600 drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)]" style={{ fontFamily: '"Cinzel Decorative", serif' }}>
                                {(result || 0) + baseModifier + proficiency}
                            </span>
                            <div className="absolute inset-0 bg-yellow-500/20 blur-[30px] rounded-full -z-10"></div>
                        </div>

                        {/* Breakdown Matemático Visual (Ícones) */}
                        <div className="flex items-center justify-center gap-4 text-xs font-mono w-full">
                            
                            {/* DADO */}
                            <div className="flex flex-col items-center gap-1 group cursor-help transition-transform hover:scale-110">
                                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl shadow-lg group-hover:border-white/30 transition-colors">
                                    <Dice5 size={18} />
                                </div>
                                <span className="text-gray-400 font-bold">{result}</span>
                            </div>

                            <span className="text-gray-600 text-xl font-thin">+</span>

                            {/* MODIFICADOR */}
                            <div className="flex flex-col items-center gap-1 group cursor-help transition-transform hover:scale-110">
                                <div className="w-10 h-10 rounded-xl bg-blue-900/20 border border-blue-500/20 flex items-center justify-center text-xl shadow-lg text-blue-300 group-hover:border-blue-500/50 transition-colors">
                                    💪
                                </div>
                                <span className="text-blue-400 font-bold">{baseModifier}</span>
                            </div>

                            <span className="text-gray-600 text-xl font-thin">+</span>

                            {/* PROFICIÊNCIA */}
                            <div className="flex flex-col items-center gap-1 group cursor-help transition-transform hover:scale-110">
                                <div className="w-10 h-10 rounded-xl bg-purple-900/20 border border-purple-500/20 flex items-center justify-center text-xl shadow-lg text-purple-300 group-hover:border-purple-500/50 transition-colors">
                                    🎓
                                </div>
                                <span className="text-purple-400 font-bold">{proficiency}</span>
                            </div>
                        </div>
                    </div>

                    {/* BOTÕES ESTILIZADOS */}
                    <div className="flex gap-4 mt-2 w-full pt-4 border-t border-white/5">
                      <button 
                        onClick={handleReset} 
                        className="flex-1 py-3 text-gray-500 hover:text-white text-[10px] uppercase tracking-widest font-bold transition-colors hover:bg-white/5 rounded-lg flex items-center justify-center gap-2 group"
                      >
                        <span className="text-lg group-hover:-rotate-180 transition-transform duration-500">↺</span> Rolar Novamente
                      </button>
                      
                      <button 
                        onClick={() => onComplete((result || 0) + baseModifier + proficiency, (result || 0) + baseModifier + proficiency >= difficultyClass, result === 20, isSecret)} 
                        className="flex-[1.5] py-3 bg-gradient-to-r from-yellow-700 via-yellow-600 to-yellow-800 hover:brightness-110 text-white font-bold text-xs uppercase tracking-[0.2em] rounded-lg shadow-[0_0_20px_rgba(234,179,8,0.3)] border border-yellow-400/30 active:scale-95 transition-all"
                      >
                        Aceitar
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