import fs from 'fs';
import path from 'path';

export interface NexusRace {
  name: string;
  size: number;
  visionRadius: number;
  speed: number;
  source: string;
}

export class RaceImporter {
  static loadRaces(): NexusRace[] {
    const nexusRaces: NexusRace[] = [];
    
    try {
      // 👉 CAMINHO BLINDADO PARA A NUVEM (RENDER)
      const filePath = path.join(process.cwd(), 'src', 'data', 'races.json');
      
      if (!fs.existsSync(filePath)) {
        console.warn('⚠️ Arquivo races.json não encontrado.');
        return [];
      }

      const rawData = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(rawData);
      
      const racesArray = data.race || [];

      for (const r of racesArray) {
        if (!r.name) continue;

        let sizeValue = 1; 
        if (r.size) {
            const sz = Array.isArray(r.size) ? r.size[0] : r.size;
            if (sz === 'S') sizeValue = 0.8;
            if (sz === 'L') sizeValue = 2.0;
        }

        let visionRadius = 9; 
        if (r.darkvision) {
            visionRadius = Math.floor(r.darkvision / 5);
        }

        let speed = 30;
        if (typeof r.speed === 'number') {
            speed = r.speed;
        } else if (r.speed && r.speed.walk) {
            speed = r.speed.walk;
        }

        nexusRaces.push({
          name: r.name,
          size: sizeValue,
          visionRadius,
          speed,
          source: r.source || 'PHB'
        });
      }
      
      console.log(`🧝‍♂️ Raças Restauradas! ${nexusRaces.length} linhagens disponíveis.`);
    } catch (error) {
      console.error(`❌ Erro ao ler raças:`, error);
    }

    return nexusRaces;
  }
}