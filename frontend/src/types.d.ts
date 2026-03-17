// src/types.d.ts
export {};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      // Elementos 3D Básicos
      group: any;
      mesh: any;
      primitive: any;
      
      // Luzes
      ambientLight: any;
      spotLight: any;
      pointLight: any;
      directionalLight: any;
      
      // Câmeras e Controles
      perspectiveCamera: any;
      orbitControls: any;
      
      // Sombras e Efeitos
      contactShadows: any;
      
      // Materiais e Geometrias
      meshStandardMaterial: any;
      boxGeometry: any;
    }
  }
}