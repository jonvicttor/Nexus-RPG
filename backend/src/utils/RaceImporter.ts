import fs from 'fs';
import path from 'path';

export interface NexusRace {
  name: string;
  size: number;
  visionRadius: number;
  speed: number;
}

export class RaceImporter {
  static loadRaces(): NexusRace[] {
    const nexusRaces: NexusRace[] = [];
    
    try {
      const filePath = path.join(__dirname, '../data/races.json');
      
      if (!fs.existsSync(filePath)) {
        console.warn('⚠️ Arquivo races.json não encontrado na forja. Pulando...');
        return [];
      }

      const rawData = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(rawData);
      
      const racesArray = data.race || [];

      for (const r of racesArray) {
        // Focando no Livro do Jogador (PHB) para manter a lista limpa e organizada
        if (r.source !== 'PHB') continue;

        // Tratamento de Tamanho (S = Small/Pequeno -> 0.8, M = Medium/Médio -> 1)
        let sizeValue = 1; 
        if (r.size && r.size.includes('S')) sizeValue = 0.8; 

        // Tratamento de Visão no Escuro (Darkvision)
        // No 5etools vem em pés (ex: 60 pés). 60 pés = 12 quadrados no grid.
        // O padrão de visão normal no nosso VTT é 9.
        let visionRadius = 9; 
        if (r.darkvision) {
            visionRadius = Math.floor(r.darkvision / 5);
        }

        // Tratamento de Deslocamento (Speed)
        let speed = 30; // Padrão
        if (typeof r.speed === 'number') {
            speed = r.speed;
        } else if (r.speed && r.speed.walk) {
            speed = r.speed.walk;
        }

        nexusRaces.push({
          name: r.name,
          size: sizeValue,
          visionRadius,
          speed
        });
      }
      
      console.log(`🧝‍♂️ Raças Carregadas! ${nexusRaces.length} linhagens prontas para aventura.`);
    } catch (error) {
      console.error(`❌ Erro ao ler races.json:`, error);
    }

    return nexusRaces;
  }
}