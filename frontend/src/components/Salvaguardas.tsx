import React from 'react';

export interface Salvaguarda {
  abrev: string;
  nome: string;
  valor: number;
  cores: {
    fill: string;
    stroke: string;
    strokeInner: string;
    texto: string;
  };
}

interface Props {
  salvaguardas?: Salvaguarda[];
}

const DEFAULT_SALVAGUARDAS: Salvaguarda[] = [
  { abrev: 'FOR', nome: 'Força', valor: -1, cores: { fill: '#EAF3DE', stroke: '#3B6D11', strokeInner: '#3B6D11', texto: '#27500A' } },
  { abrev: 'DES', nome: 'Destreza', valor: -1, cores: { fill: '#E6F1FB', stroke: '#185FA5', strokeInner: '#185FA5', texto: '#0C447C' } },
  { abrev: 'CON', nome: 'Constituição', valor: -1, cores: { fill: '#FCEBEB', stroke: '#A32D2D', strokeInner: '#A32D2D', texto: '#791F1F' } },
  { abrev: 'INT', nome: 'Inteligência', valor: -1, cores: { fill: '#EEEDFE', stroke: '#534AB7', strokeInner: '#534AB7', texto: '#26215C' } },
  { abrev: 'SAB', nome: 'Sabedoria', valor: -1, cores: { fill: '#FAEEDA', stroke: '#854F0B', strokeInner: '#854F0B', texto: '#412402' } },
  { abrev: 'CAR', nome: 'Carisma', valor: -1, cores: { fill: '#FBEAF0', stroke: '#993556', strokeInner: '#993556', texto: '#4B1528' } },
];

const formatarValor = (valor: number) => {
  if (valor > 0) return `+${valor}`;
  if (valor < 0) return `−${Math.abs(valor)}`; // Sinal de menos (minus)
  return '0';
};

const Salvaguardas: React.FC<Props> = ({ salvaguardas = DEFAULT_SALVAGUARDAS }) => {
  return (
    <div className="grid grid-cols-3 gap-y-4 gap-x-2 w-full justify-items-center">
      {salvaguardas.map((s, index) => (
        <div key={index} className="flex flex-col items-center">
          <svg 
            viewBox="0 0 90 100" 
            className="w-[50px] h-auto drop-shadow-md transition-transform hover:scale-105 cursor-pointer"
          >
            {/* Forma externa */}
            <path 
              d="M45 4 L82 18 L82 52 C82 72 63 88 45 96 C27 88 8 72 8 52 L8 18 Z" 
              fill={s.cores.fill} 
              stroke={s.cores.stroke} 
              strokeWidth="2"
            />
            
            {/* Borda interna tracejada */}
            <path 
              d="M45 14 L74 26 L74 52 C74 67 59 80 45 88 C31 80 16 67 16 52 L16 26 Z" 
              fill="none" 
              stroke={s.cores.strokeInner} 
              strokeWidth="0.75" 
              strokeDasharray="3,2"
            />
            
            {/* Abreviação */}
            <text 
              x="45" 
              y="52" 
              fontSize="13" 
              fontWeight="500" 
              fill={s.cores.texto} 
              textAnchor="middle"
            >
              {s.abrev}
            </text>
            
            {/* Valor Numérico */}
            <text 
              x="45" 
              y="67" 
              fontSize="11" 
              fontWeight="bold" 
              fill={s.cores.texto} 
              textAnchor="middle"
            >
              {formatarValor(s.valor)}
            </text>
          </svg>
          
          {/* Nome Completo como legenda */}
          <span 
            className="mt-1 text-[9px] uppercase font-bold tracking-widest text-center" 
            style={{ color: s.cores.texto }}
          >
            {s.nome}
          </span>
        </div>
      ))}
    </div>
  );
};

export default Salvaguardas;