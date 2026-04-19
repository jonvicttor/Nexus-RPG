import React, { useState, useEffect, Suspense, useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, ContactShadows, Text, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { Howl } from 'howler';
import { Eye, EyeOff, Wrench } from 'lucide-react'; 

// --- SONS MÁGICOS ---
const spinSound = new Howl({ src: ['/sfx/dado.mp3'], volume: 0.6 });
const impactSound = new Howl({ src: ['/sfx/impacto_dado.mp3', '/sfx/dado.mp3'], volume: 0.5 });
const successSound = new Howl({ src: ['/sfx/levelup.mp3'], volume: 0.5 });
const critSuccessSound = new Howl({ src: ['/sfx/crit_success.mp3', '/sfx/levelup.mp3'], volume: 0.7 });

// ============================================================================
// 🗺️ OS MAPAS SAGRADOS DE ROTAÇÃO
// ============================================================================
const D20_FACES: Record<number, any> = {
  1: { x: 0.2897, y: 0.1583, z: 0.9433, w: 0.0354 },
  2: { x: 0.5191, y: 0.8159, z: 0.0555, w: 0.2485 },
  3: { x: 0.0188, y: 0.2758, z: -0.9599, w: 0.0474 },
  4: { x: 0.1573, y: 0.7591, z: 0.3249, w: 0.5417 },
  5: { x: 0.3536, y: -0.1756, z: 0.4182, w: 0.8181 },
  6: { x: 0.326, y: -0.3576, z: -0.8747, w: 0.0281 },
  7: { x: -0.1719, y: 0.319, z: -0.815, w: -0.4523 },
  8: { x: -0.1124, y: 0.8116, z: -0.5394, w: 0.1941 },
  9: { x: -0.2818, y: 0.6588, z: -0.2818, w: 0.6381 },
  10: { x: -0.748, y: -0.5662, z: 0.3464, w: -0.0023 },
  11: { x: 0.1162, y: -0.2439, z: -0.5272, w: 0.8056 },
  12: { x: 0.1095, y: -0.8355, z: 0.4163, w: 0.3415 },
  13: { x: 0.1149, y: 0.2973, z: -0.0497, w: -0.9466 },
  14: { x: 0.4252, y: -0.801, z: -0.37, w: -0.2017 },
  15: { x: 0.0404, y: -0.6932, z: 0.2867, w: 0.6601 },
  16: { x: -0.8222, y: 0.4687, z: 0.2037, w: 0.2509 },
  17: { x: -0.5422, y: 0.4302, z: -0.7172, w: 0.0813 },
  18: { x: 0.1458, y: 0.9133, z: 0.3747, w: -0.0644 },
  19: { x: 0.2763, y: -0.1316, z: 0.7772, w: -0.5499 },
  20: { x: -0.0203, y: 0.9644, z: -0.0592, w: 0.2571 }
};

const D12_FACES: Record<number, any> = {
  1: { x: -0.9999, y: -0.0051, z: -0.015, w: -0.0043 },
  2: { x: -0.2946, y: -0.0125, z: -0.7936, w: -0.5323 },
  3: { x: -0.3419, y: -0.7588, z: -0.5516, w: -0.0558 },
  4: { x: 0.0158, y: -0.9998, z: 0.0057, w: 0.0051 },
  5: { x: 0.8658, y: -0.1162, z: -0.4192, w: 0.2474 },
  6: { x: 0.8694, y: 0.1292, z: 0.3054, w: -0.3663 },
  7: { x: -0.4586, y: 0.5572, z: 0.2188, w: 0.6567 },
  8: { x: 0.1908, y: 0.0732, z: 0.937, w: -0.2834 },
  9: { x: 0.7513, y: 0.6297, z: 0.1889, w: -0.0586 },
  10: { x: -0.8695, y: 0.2984, z: -0.0696, w: 0.3874 },
  11: { x: 0.5203, y: -0.0337, z: -0.3322, w: 0.786 },
  12: { x: -0.085, y: -0.0037, z: 0.0154, w: 0.9963 }
};

const D10_FACES: Record<number, any> = {
  1: { x: -0.2613, y: -0.7677, z: -0.5556, w: 0.1836 },
  2: { x: 0.2377, y: -0.7904, z: -0.5392, w: -0.1675 },
  3: { x: -0.6992, y: 0.4675, z: 0.339, w: 0.4215 },
  4: { x: -0.8253, y: 0.0058, z: -0.0011, w: 0.5646 },
  5: { x: -0.6606, y: -0.4948, z: -0.3426, w: 0.4488 },
  6: { x: 0.1448, y: 0.567, z: -0.779, w: 0.2254 },
  7: { x: 0.4487, y: 0.3756, z: -0.5139, w: 0.6273 },
  8: { x: 0.7477, y: 0.0162, z: 0.0258, w: 0.6633 },
  9: { x: 0.4917, y: -0.3176, z: 0.482, w: 0.6519 },
  10: { x: 0.1626, y: -0.5621, z: 0.7857, w: 0.2006 },
  100: { x: -0.2613, y: -0.7677, z: -0.5556, w: 0.1836 },
  20: { x: 0.2377, y: -0.7904, z: -0.5392, w: -0.1675 },
  30: { x: -0.6992, y: 0.4675, z: 0.339, w: 0.4215 },
  40: { x: -0.8253, y: 0.0058, z: -0.0011, w: 0.5646 },
  50: { x: -0.6606, y: -0.4948, z: -0.3426, w: 0.4488 },
  60: { x: 0.1448, y: 0.567, z: -0.779, w: 0.2254 },
  70: { x: 0.4487, y: 0.3756, z: -0.5139, w: 0.6273 },
  80: { x: 0.7477, y: 0.0162, z: 0.0258, w: 0.6633 },
  90: { x: 0.4917, y: -0.3176, z: 0.482, w: 0.6519 },
};

const D8_FACES: Record<number, any> = {
  1: { x: -0.5194, y: -0.5289, z: -0.4742, w: 0.475 },
  2: { x: -0.0145, y: 0.799, z: 0.6012, w: 0.0057 },
  3: { x: 0.4932, y: -0.4546, z: 0.5548, w: 0.4922 },
  4: { x: 0.0297, y: -0.6847, z: 0.7227, w: 0.0897 },
  5: { x: 0.5032, y: 0.5208, z: -0.4456, w: 0.5263 },
  6: { x: 0.6676, y: 0.0692, z: -0.053, w: 0.7394 },
  7: { x: -0.4396, y: 0.5314, z: 0.4978, w: 0.5259 },
  8: { x: -0.0312, y: 0.0124, z: 0.9958, w: 0.0852 }
};

const D6_FACES: Record<number, any> = {
  1: { x: -0.8699, y: 0.0068, z: -0.0019, w: 0.4932 },
  2: { x: -0.2764, y: 0.0274, z: -0.0131, w: 0.9606 },
  3: { x: -0.5945, y: 0.6282, z: 0.3605, w: 0.3492 },
  4: { x: -0.607, y: -0.6162, z: -0.3535, w: 0.3563 },
  5: { x: 0.9711, y: -0.0037, z: 0.006, w: 0.2384 },
  6: { x: -0.0064, y: -0.8653, z: -0.5012, w: -0.0011 }
};

const D4_FACES: Record<number, any> = {
  1: { x: -0.003, y: -0.6967, z: -0.7173, w: -0.0029 },
  2: { x: 0.9809, y: -0.0039, z: 0.0059, w: 0.1945 },
  3: { x: 0.4824, y: -0.8341, z: 0.2289, w: 0.1384 },
  4: { x: 0.4892, y: 0.8265, z: -0.254, w: 0.1141 }
};

const getFaceMap = (sides: number) => {
    switch(sides) {
        case 20: return D20_FACES;
        case 12: return D12_FACES;
        case 10: return D10_FACES;
        case 100: return D10_FACES; 
        case 8: return D8_FACES;
        case 6: return D6_FACES;
        case 4: return D4_FACES;
        default: return null; 
    }
};

// ============================================================================
// 🛠️ FERRAMENTA DE MAPEAMENTO AVANÇADO (POPUP)
// ============================================================================
const CalibrationTool = ({ onClose }: { onClose: () => void }) => {
    const { nodes, materials } = useGLTF('/dado.glb') as any;
    const [rot, setRot] = useState({ x: 0, y: 0, z: 0 });
    const [selectedDie, setSelectedDie] = useState<number>(20);
    const [currentFace, setCurrentFace] = useState(20);
    const [mappedFaces, setMappedFaces] = useState<Record<number, any>>({});
    const meshRef = useRef<THREE.Group>(null);

    React.useLayoutEffect(() => {
        if (materials && materials.Dice) {
            materials.Dice.color.set('#0a0a0a');
            materials.Dice.metalness = 0.5;
            materials.Dice.roughness = 0.2;
        }
        if (materials && materials.Numbers) {
            materials.Numbers.color.set('#fbbf24');
            materials.Numbers.emissive.set('#ea580c');
            materials.Numbers.emissiveIntensity = 2.5;
        }
    }, [materials]);

    const handleSave = () => {
        if (meshRef.current) {
            const q = meshRef.current.quaternion;
            setMappedFaces(prev => ({
                ...prev,
                [currentFace]: { 
                    x: Number(q.x.toFixed(4)), 
                    y: Number(q.y.toFixed(4)), 
                    z: Number(q.z.toFixed(4)), 
                    w: Number(q.w.toFixed(4)) 
                }
            }));
        }
    };

    const renderSelectedModel = () => {
        const s = 1.0; 
        switch(selectedDie) {
            case 20: return (
                <group scale={1.2 * s}>
                    <mesh geometry={nodes.d20_0?.geometry} material={materials.Dice} />
                    <mesh geometry={nodes.d20_1?.geometry} material={materials.Numbers} />
                    {nodes.d20_1_1 && <mesh geometry={nodes.d20_1_1.geometry} material={materials.Numbers} />}
                </group>
            );
            case 12: return (
                <group scale={0.8 * s}>
                    <mesh geometry={nodes.d12_0?.geometry} material={materials.Dice} />
                    <mesh geometry={nodes.d12_1?.geometry} material={materials.Numbers} />
                </group>
            );
            case 10: return (
                <group scale={0.9 * s}>
                    <mesh geometry={nodes.d10_0?.geometry} material={materials.Dice} />
                    <mesh geometry={nodes.d10_1?.geometry} material={materials.Numbers} />
                    {nodes.d10_1_1 && <mesh geometry={nodes.d10_1_1.geometry} material={materials.Numbers} />}
                </group>
            );
            case 8: return (
                <group scale={1.2 * s}>
                    <mesh geometry={nodes.d8_0?.geometry} material={materials.Dice} />
                    <mesh geometry={nodes.d8_1?.geometry} material={materials.Numbers} />
                </group>
            );
            case 6: return (
                <group scale={1.0 * s}>
                    <mesh geometry={nodes.d6_0?.geometry} material={materials.Dice} />
                    <mesh geometry={nodes.d6_1?.geometry} material={materials.Numbers} />
                </group>
            );
            case 4: return (
                <group scale={1.5 * s} rotation={[0, 0, Math.PI]}>
                    <mesh geometry={nodes.Cone_0?.geometry} material={materials.Dice} />
                    <mesh geometry={nodes.Cone_1?.geometry} material={materials.Numbers} />
                </group>
            );
            default: return null;
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] bg-black/90 flex items-center justify-center pointer-events-auto backdrop-blur-sm">
            <div className="w-[900px] h-[600px] bg-gray-900 border border-gray-700 rounded-xl flex overflow-hidden shadow-2xl animate-in zoom-in duration-300">
                <div className="flex-1 relative bg-black/50">
                    <Canvas camera={{ position: [0, 5, 8], fov: 35 }}>
                        <ambientLight intensity={1.2} />
                        <spotLight position={[5, 10, 5]} angle={0.4} penumbra={1} intensity={2.5} color="#ffffff" />
                        <group ref={meshRef} rotation={[rot.x, rot.y, rot.z]}>
                            {renderSelectedModel()}
                        </group>
                        
                        <mesh position={[0, 2.5, 0]} rotation={[Math.PI, 0, 0]}>
                            <coneGeometry args={[0.2, 0.5, 16]} />
                            <meshBasicMaterial color="#ef4444" />
                        </mesh>
                    </Canvas>
                    <div className="absolute top-6 w-full text-center pointer-events-none">
                        <span className="bg-red-900/80 text-red-100 px-4 py-1 rounded-full text-[10px] font-bold tracking-widest border border-red-500 shadow-xl uppercase">
                            {selectedDie === 4 ? "Alinhe a PONTA com a seta" : "Alinhe a face com a seta"}
                        </span>
                    </div>
                </div>

                <div className="w-[350px] bg-gray-800 p-6 flex flex-col gap-3 overflow-y-auto border-l border-gray-700">
                    <div className="flex justify-between items-center mb-1">
                        <h2 className="text-amber-500 font-black tracking-widest uppercase text-sm">Laboratório</h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-white bg-gray-700 hover:bg-red-600 rounded-full w-8 h-8 flex items-center justify-center transition-colors">✕</button>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Tipo de Dado:</label>
                        <select 
                            value={selectedDie} 
                            onChange={(e) => {
                                const val = Number(e.target.value);
                                setSelectedDie(val); setCurrentFace(val); setMappedFaces({}); 
                            }}
                            className="bg-black border border-gray-600 text-white rounded p-2 text-sm focus:outline-none focus:border-amber-500"
                        >
                            <option value={20}>D20</option>
                            <option value={12}>D12</option>
                            <option value={10}>D10</option>
                            <option value={8}>D8</option>
                            <option value={6}>D6</option>
                            <option value={4}>D4 (Ponta)</option>
                        </select>
                    </div>
                    <div className="bg-black/40 p-3 rounded-lg border border-gray-700 mt-2">
                        <label className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Face Atual (Salvando):</label>
                        <input type="number" value={currentFace} onChange={e => setCurrentFace(Number(e.target.value))} min={1} max={selectedDie} className="bg-black border border-amber-500/50 text-amber-400 rounded p-1 text-2xl font-black w-full text-center" />
                    </div>
                    <div className="flex flex-col gap-3 my-1">
                        {['x', 'y', 'z'].map((axis) => (
                            <div key={axis}>
                                <div className="flex justify-between"><label className="text-[10px] text-gray-400 uppercase">Eixo {axis.toUpperCase()}</label></div>
                                <input type="range" min="-3.15" max="3.15" step="0.01" value={(rot as any)[axis]} onChange={e => setRot({...rot, [axis]: parseFloat(e.target.value)})} className="w-full accent-amber-500" />
                            </div>
                        ))}
                    </div>
                    <button onClick={handleSave} className="bg-green-600 hover:bg-green-500 text-white font-black py-2 rounded uppercase tracking-widest text-[10px]">Gravar Face {currentFace}</button>
                    <textarea readOnly value={JSON.stringify(mappedFaces, null, 2)} className="w-full flex-1 bg-black text-green-400 font-mono text-[9px] p-2 rounded border border-gray-700 resize-none outline-none min-h-[100px]" />
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// MOTOR DE FÍSICA NATIVA - ROLAGEM ORGÂNICA PELA MESA
// ============================================================================
const stepPhysics = (p: any, dt: number, restHeight: number) => {
    // Gravidade padrão
    p.vel.y -= 50 * dt; 
    
    // Atualiza a posição e rotação baseada na velocidade
    p.pos.addScaledVector(p.vel, dt);
    p.rot.x += p.angVel.x * dt;
    p.rot.y += p.angVel.y * dt;
    p.rot.z += p.angVel.z * dt;

    let hit = false;

    // COLISÃO COM A MESA (Chão)
    if (p.pos.y < restHeight) {
        p.pos.y = restHeight;
        
        // Micro-quique super sutil para parecer realista, não bola de borracha
        p.vel.y *= -0.3; 
        
        // Atrito da mesa (faz o dado parar de deslizar e rodopiar aos poucos)
        p.vel.x *= 0.95;  
        p.vel.z *= 0.95;  
        p.angVel.multiplyScalar(0.95); 
        hit = true;
    }

    // PAREDES INVISÍVEIS (Para manter os dados dentro da tela)
    // Limites Laterais (Esquerda e Direita)
    if (p.pos.x > 8) { p.pos.x = 8; p.vel.x *= -0.6; }
    if (p.pos.x < -8) { p.pos.x = -8; p.vel.x *= -0.6; }
    
    // O Muro Superior (Topo do mapa) - Eles batem aqui e param na parte de cima
    if (p.pos.z < -4) { p.pos.z = -4; p.vel.z *= -0.6; }
    
    // O Muro Inferior (Embaixo) - Apenas segurança
    if (p.pos.z > 10) { p.pos.z = 10; p.vel.z *= -0.6; }

    return hit;
};

const Die3D = ({ sides, isRolling, isDisappearing, finalResult, index, diceCount, onStop }: any) => {
  const rootRef = useRef<THREE.Group>(null); 
  const meshRef = useRef<THREE.Group>(null);
  const textRef = useRef<THREE.Group>(null);
  const { nodes, materials } = useGLTF('/dado.glb') as any;

  const faceMap = getFaceMap(sides);

  const physics = useRef({
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      rot: new THREE.Euler(),
      angVel: new THREE.Vector3(),
      stopped: true,
      lastImpact: 0,
      timeAccumulator: 0,
      offsetQ: new THREE.Quaternion(),
      scaleMult: 1.0,
      hasHitGround: false // Controle para tocar o som de rolar na mesa
  });

  React.useLayoutEffect(() => {
      // Selo de Solidez Supremo (Sem dados fantasmas)
      if (materials && materials.Dice) {
          materials.Dice.color.set('#0a0a0a'); 
          materials.Dice.metalness = 0.5;
          materials.Dice.roughness = 0.2;
          materials.Dice.transparent = false; 
          materials.Dice.opacity = 1;
          materials.Dice.depthWrite = true; 
          materials.Dice.side = THREE.FrontSide; 
          materials.Dice.needsUpdate = true; 
      }
      if (materials && materials.Numbers) {
          materials.Numbers.color.set('#fbbf24'); 
          materials.Numbers.emissive.set('#ea580c'); 
          materials.Numbers.emissiveIntensity = 2.5; 
          materials.Numbers.transparent = false; 
          materials.Numbers.opacity = 1;
          materials.Numbers.depthWrite = true;
          materials.Numbers.side = THREE.FrontSide;
          materials.Numbers.needsUpdate = true;
      }
  }, [materials]);

  const restHeight = sides === 4 ? 0.3 : 0.5; 

  useEffect(() => {
      if (isRolling && !isDisappearing) {
          const p = physics.current;
          p.stopped = false;
          p.scaleMult = 1.0;
          p.timeAccumulator = 0;
          p.hasHitGround = false; // Reseta o controlador de som
          
          // Calcula a posição inicial na base da tela, com espaçamento entre os dados
          const spacing = 2.5; // Espaço horizontal entre os dados
          const startX = (index - (diceCount - 1) / 2) * spacing;

          // Nasce perto da mesa (restHeight + 1.5) e lá no fundo da tela (z = 8)
          p.pos.set(
              startX, 
              restHeight + 1.5, 
              8 
          );
          
          // O Lançamento Físico: Rola forte pra frente (Z negativo), sem voar demais
          p.vel.set(
              (Math.random() - 0.5) * 2, // Desvio lateral minúsculo
              -2 - Math.random() * 2,    // Força pra bater logo na mesa
              -15 - Math.random() * 10   // Muita força rasgando a tela pro topo
          );
          
          p.rot.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
          
          // Giro insano para dar suspense
          p.angVel.set(
              (Math.random() - 0.5) * 25, 
              (Math.random() - 0.5) * 25, 
              (Math.random() - 0.5) * 25
          );
          
          if (faceMap && finalResult && faceMap[finalResult]) {
              let simP = { pos: p.pos.clone(), vel: p.vel.clone(), rot: p.rot.clone(), angVel: p.angVel.clone() };
              const dt = 1/60;
              let steps = 0;
              let simStopped = false;
              
              // Simulação invisível descobre a face antes do tempo
              while(!simStopped && steps < 800) { 
                  stepPhysics(simP, dt, restHeight);
                  const speed = Math.abs(simP.vel.x) + Math.abs(simP.vel.y) + Math.abs(simP.vel.z) + Math.abs(simP.angVel.x) + Math.abs(simP.angVel.y) + Math.abs(simP.angVel.z);
                  if (speed < 0.3 && simP.pos.y <= restHeight + 0.1) simStopped = true;
                  steps++;
              }
              
              const qPhysicsFinal = new THREE.Quaternion().setFromEuler(simP.rot);
              const face = faceMap[finalResult];
              const qTarget = new THREE.Quaternion(face.x, face.y, face.z, face.w).normalize();
              
              p.offsetQ.copy(qPhysicsFinal).invert().multiply(qTarget);
          } else {
              p.offsetQ.identity();
          }

          if (meshRef.current) {
              const qInitial = new THREE.Quaternion().setFromEuler(p.rot);
              meshRef.current.quaternion.copy(qInitial).multiply(p.offsetQ);
          }
      }
  }, [isRolling, isDisappearing, faceMap, finalResult, restHeight, index, diceCount]);

  useFrame((state, delta) => {
    if (!rootRef.current || !meshRef.current) return;
    
    const p = physics.current;

    if (isDisappearing) {
        p.scaleMult = THREE.MathUtils.lerp(p.scaleMult, 0, delta * 15); 
        rootRef.current.scale.set(p.scaleMult, p.scaleMult, p.scaleMult);
        if (textRef.current) textRef.current.visible = false;
        return; 
    } else {
        rootRef.current.scale.set(1, 1, 1);
        if (textRef.current) textRef.current.visible = p.stopped;
    }

    if (p.stopped) return;
    
    p.timeAccumulator += delta;
    if (p.timeAccumulator > 0.1) p.timeAccumulator = 0.1; 

    const dt = 1/60; 
    
    while (p.timeAccumulator >= dt) {
        const hit = stepPhysics(p, dt, restHeight);
        if (hit) {
            // 🔥 Gatilho de Áudio ao tocar a mesa pela primeira vez 🔥
            if (!p.hasHitGround) {
                p.hasHitGround = true;
                spinSound.stop();
                spinSound.play(); 
            }

            const now = performance.now();
            if (Math.abs(p.vel.y) > 1.5 && now - p.lastImpact > 100) {
                impactSound.play();
                p.lastImpact = now;
            }
        }
        p.timeAccumulator -= dt;

        const speed = Math.abs(p.vel.x) + Math.abs(p.vel.y) + Math.abs(p.vel.z) + Math.abs(p.angVel.x) + Math.abs(p.angVel.y) + Math.abs(p.angVel.z);
        
        // Critério rígido de parada: Só marca como parado quando o dado realmente congelar na mesa
        if (speed < 0.3 && p.pos.y <= restHeight + 0.1) {
            p.stopped = true;
            p.vel.set(0, 0, 0);
            p.angVel.set(0, 0, 0);
            
            const qPhys = new THREE.Quaternion().setFromEuler(p.rot);
            meshRef.current.quaternion.copy(qPhys).multiply(p.offsetQ);
            
            if (onStop) onStop();
            break;
        }
    }

    rootRef.current.position.copy(p.pos);
    
    if (!p.stopped) {
        const qPhys = new THREE.Quaternion().setFromEuler(p.rot);
        meshRef.current.quaternion.copy(qPhys).multiply(p.offsetQ);
    }

    if (textRef.current) {
        textRef.current.position.set(p.pos.x, p.pos.y + 1.2, p.pos.z);
    }
  });

  const renderDieModel = () => {
      const s = 0.6; 
      switch(sides) {
          case 20: return (
              <group scale={1.2 * s}>
                  <mesh geometry={nodes.d20_0?.geometry} material={materials.Dice} castShadow receiveShadow />
                  <mesh geometry={nodes.d20_1?.geometry} material={materials.Numbers} />
                  {nodes.d20_1_1 && <mesh geometry={nodes.d20_1_1.geometry} material={materials.Numbers} />}
              </group>
          );
          case 12: return (
              <group scale={0.7 * s}>
                  <mesh geometry={nodes.d12_0?.geometry} material={materials.Dice} castShadow receiveShadow />
                  <mesh geometry={nodes.d12_1?.geometry} material={materials.Numbers} />
              </group>
          );
          case 100: 
          case 10: return (
              <group scale={0.8 * s}>
                  <mesh geometry={nodes.d10_0?.geometry} material={materials.Dice} castShadow receiveShadow />
                  <mesh geometry={nodes.d10_1?.geometry} material={materials.Numbers} />
                  {nodes.d10_1_1 && <mesh geometry={nodes.d10_1_1.geometry} material={materials.Numbers} />}
              </group>
          );
          case 8: return (
              <group scale={1.1 * s}>
                  <mesh geometry={nodes.d8_0?.geometry} material={materials.Dice} castShadow receiveShadow />
                  <mesh geometry={nodes.d8_1?.geometry} material={materials.Numbers} />
              </group>
          );
          case 6: return (
              <group scale={0.9 * s}>
                  <mesh geometry={nodes.d6_0?.geometry} material={materials.Dice} castShadow receiveShadow />
                  <mesh geometry={nodes.d6_1?.geometry} material={materials.Numbers} />
              </group>
          );
          case 4: return (
              <group scale={1.4 * s} rotation={[0, 0, Math.PI]}>
                  <mesh geometry={nodes.Cone_0?.geometry} material={materials.Dice} castShadow receiveShadow />
                  <mesh geometry={nodes.Cone_1?.geometry} material={materials.Numbers} />
              </group>
          );
          default: return (
              <group scale={1.2 * s}>
                  <mesh geometry={nodes.d20_0?.geometry} material={materials.Dice} castShadow receiveShadow />
                  <mesh geometry={nodes.d20_1?.geometry} material={materials.Numbers} />
              </group>
          );
      }
  };

  return (
    <group>
        <group ref={rootRef}>
            <group ref={meshRef}>
                {renderDieModel()}
            </group>
        </group>
        
        <group ref={textRef}>
            <Suspense fallback={null}>
                <Text
                    position={[0, 0, 0]} 
                    fontSize={1.2}
                    color={finalResult === 20 && sides === 20 ? "#22c55e" : finalResult === 1 && sides === 20 ? "#ef4444" : "#ffffff"}
                    anchorX="center" anchorY="middle"
                    outlineWidth={0.1} outlineColor="#000000" 
                    visible={!isRolling && finalResult !== null && physics.current.stopped}
                    className="drop-shadow-[0_0_15px_rgba(245,158,11,0.8)]"
                    font="https://fonts.gstatic.com/s/cinzel_decorative/v13/bsayCBH8xXKYxXb_B_yJ1tA2wLMo_zs.woff"
                >
                    {finalResult || ''}
                </Text>
            </Suspense>
        </group>
    </group>
  );
};

useGLTF.preload('/dado.glb');

// --- INTERFACE PRINCIPAL ---
export interface RollBonus { id: string; name: string; value: number; type: 'flat'|'dice'; active: boolean; icon: string; }

interface UniversalDiceRollerProps {
  isOpen: boolean;
  rollId?: number; // 🔥 AGORA DEPENDEMOS DE UM ID DE ROLAGEM ÚNICO 🔥
  onClose: () => void; title: string; subtitle: string; difficultyClass: number;
  baseModifier: number; proficiency: number; rollType?: 'normal' | 'advantage' | 'disadvantage';
  extraBonuses?: RollBonus[]; isDamage?: boolean; damageExpression?: string;
  onComplete: (total: number, isSuccess: boolean, isCrit: boolean, isSecret: boolean, finalRolls?: number[], finalMod?: number) => void;
}

const UniversalDiceRoller: React.FC<UniversalDiceRollerProps> = ({ 
  isOpen, rollId, onClose, title, subtitle, difficultyClass, baseModifier, proficiency, extraBonuses,
  isDamage = false, damageExpression = '', rollType = 'normal', onComplete 
}) => {
  const [isRolling, setIsRolling] = useState(false);
  const [results, setResults] = useState<number[]>([]);
  const [showTotal, setShowTotal] = useState(false);
  const [isSecret, setIsSecret] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [rollTrigger, setRollTrigger] = useState(0); 
  const [, setStoppedDiceCount] = useState(0);
  const [isDisappearing, setIsDisappearing] = useState(false); 

  const rollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Guardamos o último ID que rolamos. Se for diferente, é rolagem nova!
  const lastRollIdRef = useRef<number | undefined>(undefined);

  const localIsDamage = isDamage || title.toLowerCase().includes('dano') || title.toLowerCase().includes('cura');
  let match = (damageExpression || '1d20').match(/(\d+)?d(\d+)/i);
  let diceCount = (!localIsDamage && (rollType !== 'normal')) ? 2 : (match ? Math.min(parseInt(match[1] || '1'), 15) : 1);
  let diceSides = match ? parseInt(match[2]) : 20;

  const activeExtraMods = useMemo(() => {
      return (extraBonuses || []).filter(b => b.active && b.type === 'flat').reduce((a, b) => a + b.value, 0);
  }, [extraBonuses]);

  let dmgMod = useMemo(() => {
      let mod = 0;
      if (localIsDamage) {
          const modifiers = damageExpression.match(/([+-]\s*\d+)/g);
          if (modifiers) {
              mod = modifiers.reduce((acc, m) => acc + parseInt(m.replace(/\s/g, '')), 0);
          }
      } else {
          mod = baseModifier + proficiency;
      }
      return mod + activeExtraMods;
  }, [localIsDamage, damageExpression, baseModifier, proficiency, activeExtraMods]);

  const handleRoll = useCallback(() => {
    if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
    
    setIsRolling(true); 
    setShowTotal(false); 
    setIsDisappearing(false);
    setStoppedDiceCount(0); 
    setRollTrigger(p => p+1);
    
    const newRolls = [];
    for(let i=0; i<diceCount; i++) {
        if(diceSides === 100) {
            newRolls.push((Math.floor(Math.random() * 10) + 1) * 10);
        } else {
            newRolls.push(Math.floor(Math.random() * diceSides) + 1);
        }
    }
    
    setResults(newRolls); 
    
    rollTimeoutRef.current = setTimeout(() => {
        setStoppedDiceCount(current => { if (current < diceCount) { setShowTotal(true); setIsRolling(false); } return current; });
    }, 6000); 
  }, [diceCount, diceSides]);

  const handlePhysicsStop = useCallback(() => {
      setStoppedDiceCount(prev => {
          if (prev + 1 >= diceCount) { 
              setShowTotal(true); setIsRolling(false); 
              if(!localIsDamage) {
                  let finalD20 = (rollType === 'advantage') ? Math.max(results[0], results[1]) : (rollType === 'disadvantage') ? Math.min(results[0], results[1]) : results[0];
                  if(finalD20===20 && diceSides===20) critSuccessSound.play(); else if(finalD20 + dmgMod >= difficultyClass) successSound.play();
              } else { successSound.play(); }
          }
          return prev + 1;
      });
  }, [diceCount, results, localIsDamage, rollType, dmgMod, difficultyClass, diceSides]);

  // 🔥 O VIGIA ESTRITO PELO ROLL ID 🔥
  useEffect(() => {
      if (isOpen) {
          // Se recebemos um ID novo e ele é diferente do anterior, ROLA.
          if (rollId !== undefined && rollId !== lastRollIdRef.current) {
              lastRollIdRef.current = rollId;
              
              setResults([]);
              setShowTotal(false);
              setIsRolling(false);
              setIsDisappearing(false);
              setStoppedDiceCount(0);

              // Removemos os sons de "spin" daqui. Eles tocam via Física.
              setTimeout(() => {
                  handleRoll();
              }, 300);

          } else if (rollId === undefined && results.length === 0 && !isRolling && !showTotal && !isDisappearing) {
              // Fallback para quando o pai não passar o rollId
              setTimeout(() => { handleRoll(); }, 300);
          }
      } else {
          // Limpa quando a janela fechar
          if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
          lastRollIdRef.current = undefined;
          setResults([]);
          setShowTotal(false);
          setIsRolling(false);
          setIsDisappearing(false);
          setStoppedDiceCount(0);
          setIsCalibrating(false);
      }
  }, [isOpen, rollId, handleRoll, results.length, isRolling, showTotal, isDisappearing]);

  const initiateClose = useCallback(() => {
      if (isDisappearing) return;
      setIsDisappearing(true);
      setShowTotal(false);
      setTimeout(() => {
          onClose(); 
      }, 250); 
  }, [onClose, isDisappearing]);

  const initiateReroll = useCallback((e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      if (isDisappearing) return;
      
      setIsDisappearing(true);
      setShowTotal(false);
      setTimeout(() => {
          setResults([]); 
          setIsDisappearing(false); 
          // Sem som aqui. A Física cuidará.
          handleRoll(); 
      }, 250);
  }, [handleRoll, isDisappearing]);

  const handleFinalSubmit = useCallback(() => {
      if (isDisappearing) return; 
      
      let finalD20 = (rollType === 'advantage') ? Math.max(...results) : (rollType === 'disadvantage') ? Math.min(...results) : results[0];
      let total = localIsDamage ? results.reduce((a,b)=>a+b,0) + dmgMod : finalD20 + dmgMod;
      
      initiateClose(); 
      onComplete(total, total >= difficultyClass, finalD20 === 20, isSecret, results, dmgMod);
      
  }, [results, dmgMod, difficultyClass, localIsDamage, rollType, isSecret, onComplete, initiateClose, isDisappearing]);

  if (!isOpen) return null;

  let sumRolls = 0;
  let finalD20 = 0;

  if (localIsDamage) {
      sumRolls = results.reduce((a, b) => a + b, 0);
  } else {
      if (results.length > 0) {
          if (rollType === 'advantage') finalD20 = Math.max(results[0], results[1]);
          else if (rollType === 'disadvantage') finalD20 = Math.min(results[0], results[1]);
          else finalD20 = results[0];
          sumRolls = finalD20;
      }
  }

  const totalFinal = sumRolls + dmgMod;
  const isSuccessFinal = localIsDamage ? true : totalFinal >= difficultyClass;
  const isCritFinal = !localIsDamage && finalD20 === 20 && diceSides === 20;
  const isCritFail = !localIsDamage && finalD20 === 1 && diceSides === 20;

  let borderColor = "border-gray-600/50";
  let buttonGradient = "bg-gray-800 hover:bg-gray-700";
  let buttonText = localIsDamage ? "Enviar Dano" : "Confirmar";
  let glowEffect = "shadow-[0_10px_30px_rgba(0,0,0,0.8)]";

  if (showTotal && !isCalibrating) {
      if (isCritFinal) {
          borderColor = "border-green-500/80";
          buttonGradient = "bg-gradient-to-r from-green-600 to-green-800 hover:brightness-110 text-white";
          buttonText = "Crítico! Enviar";
          glowEffect = "shadow-[0_10px_40px_rgba(34,197,94,0.3)]";
      } else if (isCritFail) {
          borderColor = "border-red-600/80";
          buttonGradient = "bg-gradient-to-r from-red-700 to-red-900 hover:brightness-110 text-white";
          buttonText = "Falha Crítica!";
          glowEffect = "shadow-[0_10px_40px_rgba(220,38,38,0.3)]";
      } else if (localIsDamage) {
          borderColor = "border-red-500/60";
          buttonGradient = "bg-gradient-to-r from-red-700 to-red-900 hover:brightness-110 text-white";
          glowEffect = "shadow-[0_10px_40px_rgba(220,38,38,0.2)]";
      } else if (isSuccessFinal) {
          borderColor = "border-yellow-500/80";
          buttonGradient = "bg-gradient-to-r from-yellow-600 to-amber-700 hover:brightness-110 text-white";
          buttonText = "Acerto! Enviar";
          glowEffect = "shadow-[0_10px_40px_rgba(234,179,8,0.2)]";
      } else {
          borderColor = "border-gray-500/60";
          buttonText = "Falhou! Enviar";
      }
  }

  return (
    <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center pointer-events-none transition-opacity duration-300 ${isDisappearing ? 'opacity-0' : 'opacity-100'}`}>
      {isCalibrating && <CalibrationTool onClose={() => setIsCalibrating(false)} />}
      
      <div className="absolute inset-0 w-full h-full">
          <Canvas camera={{ position: [0, 8, 14], fov: 35 }} gl={{ alpha: true }}> 
              <ambientLight intensity={1.2} />
              <spotLight position={[5, 10, 5]} intensity={2.5} castShadow />
              <Environment preset="city" />
              <Suspense fallback={null}>
                  <group position={[0, -2, 0]}>
                      {results.map((r, idx) => <Die3D key={`${idx}-${rollTrigger}`} sides={diceSides} isRolling={isRolling} isDisappearing={isDisappearing} finalResult={r} index={idx} diceCount={diceCount} onStop={handlePhysicsStop} />)}
                  </group>
                  <ContactShadows position={[0, -2, 0]} opacity={isDisappearing ? 0 : 0.5} scale={25} />
              </Suspense>
          </Canvas>
      </div>

      {!isDisappearing && (
        <div className="absolute top-6 flex w-full justify-between px-10 pointer-events-auto z-50 animate-in fade-in duration-300">
            <div className="flex gap-4">
                <button onClick={(e) => { e.stopPropagation(); setIsSecret(!isSecret); }} className={`px-4 py-2 rounded-full border backdrop-blur-md text-[10px] font-black uppercase tracking-widest ${isSecret ? 'bg-purple-900/90 border-purple-500 text-purple-100' : 'bg-black/60 border-white/20 text-gray-300 hover:text-white'}`}>
                  {isSecret ? <EyeOff size={14} className="inline mr-2" /> : <Eye size={14} className="inline mr-2" />} {isSecret ? 'Secreto' : 'Público'}
                </button>
                
                <button onClick={(e) => { e.stopPropagation(); setIsCalibrating(true); }} className="px-4 py-2 rounded-full border border-amber-500 bg-amber-900/80 text-amber-200 text-[10px] font-black uppercase tracking-widest hover:bg-amber-800">
                  <Wrench size={14} className="inline mr-2" /> Mapear Dados
                </button>
            </div>
            <button onClick={initiateClose} className="text-white bg-black/50 border border-white/20 hover:bg-red-500 w-10 h-10 rounded-full">✕</button>
        </div>
      )}

      {isRolling && !showTotal && !isDisappearing && (
          <div className="absolute top-[20%] pointer-events-none flex flex-col items-center animate-in fade-in">
             <div className="bg-black/80 px-6 py-2 rounded-full border border-amber-500/30 backdrop-blur-md shadow-[0_5px_20px_rgba(0,0,0,0.5)]">
                 <h2 className="text-sm font-black text-amber-400 tracking-[0.2em] uppercase">Rolando: {title.replace(/"/g, '')}</h2>
             </div>
          </div>
      )}

      {showTotal && !isCalibrating && !isDisappearing && (
           <div className="absolute bottom-16 pointer-events-auto animate-in slide-in-from-bottom-10 fade-in duration-300">
               <div className={`relative w-[300px] bg-black/85 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col overflow-hidden ${glowEffect}`}>
                  
                  <div className={`w-full h-1 ${localIsDamage ? 'bg-gradient-to-r from-red-600 to-red-900' : isCritFinal ? 'bg-green-500' : isCritFail ? 'bg-red-600' : isSuccessFinal ? 'bg-yellow-500' : 'bg-gray-500'}`}></div>

                  <div className="p-4 flex flex-col items-center">
                      <div className="flex justify-between items-center w-full mb-1 px-1">
                          <span className={`text-[9px] uppercase tracking-[0.3em] font-bold ${localIsDamage ? 'text-red-400' : 'text-gray-400'}`}>
                              {localIsDamage ? 'DANO TOTAL' : 'RESULTADO'}
                          </span>
                          {!localIsDamage && (
                              <div className="flex items-center gap-1 opacity-70">
                                  <span className="text-[8px] text-gray-400 uppercase tracking-widest">CD</span>
                                  <span className="text-[10px] font-bold text-white bg-white/10 px-1.5 rounded">{difficultyClass}</span>
                              </div>
                          )}
                      </div>

                      <div className="py-2">
                          <span className={`text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b drop-shadow-md ${isCritFinal ? 'from-white to-green-500' : isCritFail ? 'from-white to-red-600' : localIsDamage ? 'from-white to-red-500' : 'from-white to-yellow-500'}`} style={{ fontFamily: '"Cinzel Decorative", serif' }}>
                              {totalFinal}
                          </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-1 mb-4">
                          {results.map((r, i) => {
                              const isDiscarded = (!localIsDamage && rollType === 'advantage' && r === Math.min(results[0], results[1]) && results[0] !== results[1]) || 
                                                  (!localIsDamage && rollType === 'disadvantage' && r === Math.max(results[0], results[1]) && results[0] !== results[1]);
                              return (
                                  <div key={i} className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black ${isDiscarded ? 'opacity-30 border border-gray-700 text-gray-500 bg-transparent' : localIsDamage ? 'border border-red-500/30 text-red-300 bg-red-900/20' : (r===20 && diceSides===20 ? 'border border-green-500/50 text-green-300 bg-green-900/20' : r===1 && diceSides===20 ? 'border border-red-500/50 text-red-400 bg-red-900/20' : 'border border-white/20 text-white bg-white/5')}`}>
                                      {r}
                                  </div>
                              );
                          })}
                          
                          {dmgMod !== 0 && (
                              <div className="flex items-center gap-1 ml-1">
                                  <span className="text-gray-500 text-xs font-thin">{dmgMod > 0 ? '+' : '-'}</span>
                                  <div className="w-6 h-6 rounded border border-blue-500/30 bg-blue-900/20 flex items-center justify-center text-[10px] font-bold text-blue-300">
                                      {Math.abs(dmgMod)}
                                  </div>
                              </div>
                          )}
                      </div>

                      <div className="flex w-full gap-2 mt-1">
                        <button onClick={initiateReroll} className="w-10 h-9 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors flex items-center justify-center text-gray-400 hover:text-white">
                          <span className="text-sm">↺</span>
                        </button>
                        
                        <button onClick={handleFinalSubmit} className={`flex-1 h-9 font-black text-[10px] uppercase tracking-widest rounded-lg transition-all active:scale-95 border ${borderColor} ${buttonGradient}`}>
                          {buttonText}
                        </button>
                      </div>

                  </div>
               </div>
           </div>
      )}
    </div>
  );
};

export default UniversalDiceRoller;