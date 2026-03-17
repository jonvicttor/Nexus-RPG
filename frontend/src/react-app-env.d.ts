/// <reference types="react-scripts" />

// --- ADICIONE ESTE BLOCO ABAIXO ---
declare global {
  namespace JSX {
    interface IntrinsicElements {
      // Elementos 3D
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
      
      // Efeitos e Ambiente
      contactShadows: any;
      environment: any; // Adicionei este também, pois vi Environment no seu código
      
      // Geometrias
      boxGeometry: any;
      meshStandardMaterial: any;
    }
  }
}