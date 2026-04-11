import fs from 'fs';
import path from 'path';

export interface NexusMonster { name: string; hp: number; ac: number; image: string; tokenImage: string; size?: number; rawMonsterData?: any; }

export class MonsterImporter {
  static loadBestiary(): NexusMonster[] {
    const nexusMonsters: NexusMonster[] = [];
    const bestiaryDir = path.join(process.cwd(), 'src', 'data', 'bestiary'); // 👉 Com src

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
              const safeName = m.name.replace(/</g, '').replace(/>/g, '').replace(/"/g, '').replace(/\//g, '');
              let hp = 10, ac = 10;
              if (m.hp) { hp = typeof m.hp === 'number' ? m.hp : (m.hp.average || 10); }
              if (m.ac && m.ac.length > 0) { const firstAc = m.ac[0]; ac = typeof firstAc === 'number' ? firstAc : (firstAc.ac || 10); }

              nexusMonsters.push({
                name: m.name, hp, ac,
                image: `/img/bestiary/${m.source}/${safeName}.webp`,
                tokenImage: `/img/bestiary/tokens/${m.source}/${safeName}.webp`,
                size: m.size ? 1.0 : 1.0,
                rawMonsterData: m 
              });
            }
          }
        } catch (e) {}
      }
      const uniqueMonsters = Array.from(new Map(nexusMonsters.map(m => [m.name, m])).values());
      console.log(`🐉 Bestiário Fallback: ${uniqueMonsters.length} feras.`);
      return uniqueMonsters.map(m => m.rawMonsterData);
    } catch (e) { return []; }
  }
}