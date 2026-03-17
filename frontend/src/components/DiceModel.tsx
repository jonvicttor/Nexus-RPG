// @ts-nocheck
import React from 'react';
import { useGLTF } from '@react-three/drei';

export function DiceModel(props: any) {
  const { scene } = useGLTF('/dado.glb');

  return (
    <group {...props} dispose={null}>
      {/* Mudei de 20 para 5 para ele não "explodir" na tela */}
      <primitive object={scene} scale={0.003} /> 
    </group>
  );
}

useGLTF.preload('/dado.glb');