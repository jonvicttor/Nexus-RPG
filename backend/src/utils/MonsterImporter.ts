import fs from 'fs';
import path from 'path';

export interface NexusMonster { 
  name: string; 
  hp: number; 
  ac: number; 
  image: string; 
  tokenImage: string; 
  size?: number; 
  // Sem rawMonsterData aqui para o VTT não explodir a memória!
}

export class MonsterImporter {
  static loadBestiary(): NexusMonster[] {
    const nexusMonsters: NexusMonster[] = [];
    const bestiaryDir = path.join(process.cwd(), 'src', 'data', 'bestiary'); 

    if (!fs.existsSync(bestiaryDir)) return [];

    try {
      const monsterFiles = fs.readdirSync(bestiaryDir);
      for (const fileName of monsterFiles) {
        if (!fileName.endsWith('.json')) continue;
        try {
          const bestiaryData = JSON.parse(fs.readFileSync(path.join(bestiaryDir, fileName), 'utf-8'));
          if (bestiaryData && bestiaryData.monster && Array.isArray(bestiaryData.monster)) {
            for (const m of bestiaryData.monster) {
              if (!m.name || !m.source) continue;
              
              // Ignora monstros copiados para evitar bugs de atributos faltantes
              if (m._copy) continue;

              const safeName = m.name.replace(/</g, '').replace(/>/g, '').replace(/"/g, '').replace(/\//g, '');
              let hp = 10, ac = 10;
              if (m.hp) { hp = typeof m.hp === 'number' ? m.hp : (m.hp.average || 10); }
              if (m.ac && m.ac.length > 0) { const firstAc = m.ac[0]; ac = typeof firstAc === 'number' ? firstAc : (firstAc.ac || 10); }

              let size = 1.0; 
              if (m.size) {
                  const sizeChar = Array.isArray(m.size) ? m.size[0] : m.size;
                  const sizeMap: Record<string, number> = { 'T': 0.7, 'S': 0.8, 'M': 1.0, 'L': 2.0, 'H': 3.0, 'G': 4.0 };
                  size = sizeMap[sizeChar] || 1.0;
              }

              nexusMonsters.push({
                name: m.name, hp, ac,
                // 👉 MAGIA DE CONJURAÇÃO ONLINE: Imagens puxadas diretamente do 5e.tools
                image: `https://5e.tools/img/bestiary/${m.source}/${safeName}.jpg`,
                tokenImage: `https://5e.tools/img/bestiary/tokens/${m.source}/${safeName}.webp`,
                size
              });
            }
          }
        } catch (e) {}
      }
      
      const uniqueMonsters = Array.from(new Map(nexusMonsters.map(m => [m.name, m])).values());
      console.log(`🐉 Bestiário Filtrado: ${uniqueMonsters.length} feras com imagens online prontas!`);
      return uniqueMonsters;
    } catch (e) { return []; }
  }
}