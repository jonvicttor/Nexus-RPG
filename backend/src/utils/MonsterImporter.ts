import fs from 'fs';
import path from 'path';

export interface NexusMonster {
  name: string;
  hp: number;
  ac: number;
  image: string;      // 👉 Imagem completa (Corpo inteiro no Mapa)
  tokenImage: string; // 👉 Imagem do Token (Rosto redondo na Sidebar)
  size?: number; 
}

export class MonsterImporter {
  static loadBestiary(): NexusMonster[] {
    try {
      const filePath = path.join(__dirname, '../data/bestiary-mm.json');
      
      if (!fs.existsSync(filePath)) {
          console.warn('⚠️ bestiary-mm.json não encontrado na pasta src/data. O Bestiário completo não será carregado.');
          return [];
      }

      const rawData = fs.readFileSync(filePath, 'utf-8');
      const bestiaryData = JSON.parse(rawData);

      const nexusMonsters: NexusMonster[] = [];

      if (bestiaryData && bestiaryData.monster) {
        for (const m of bestiaryData.monster) {
          if (m.source !== 'MM') continue;

          const name = m.name;

          // Limpando o nome para montar a URL
          const safeName = name.replace(/</g, '').replace(/>/g, '').replace(/"/g, '').replace(/\//g, '');
          
          // --- 1. GERAÇÃO DINÂMICA DAS DUAS IMAGENS ---
          const tokenImagePath = `/img/bestiary/tokens/${m.source}/${safeName}.webp`; // Token Redondo
          const fullImagePath = `/img/bestiary/${m.source}/${safeName}.webp`;         // Corpo Inteiro

          let hp = 10;
          if (m.hp && m.hp.average) {
            hp = m.hp.average;
          }

          let ac = 10;
          if (m.ac && m.ac.length > 0) {
            const firstAc = m.ac[0];
            if (typeof firstAc === 'number') {
              ac = firstAc;
            } else if (firstAc.ac) {
              ac = firstAc.ac;
            }
          }

          let size = 1.0; 
          if (m.size) {
              const sizeStr = Array.isArray(m.size) ? m.size[0] : m.size;
              if (sizeStr === 'L') size = 2.0;      
              else if (sizeStr === 'H') size = 3.0; 
              else if (sizeStr === 'G') size = 4.0; 
              else if (sizeStr === 'T' || sizeStr === 'S') size = 0.8; 
          }

          nexusMonsters.push({
            name,
            hp,
            ac,
            image: fullImagePath,       // Vai para o mapa
            tokenImage: tokenImagePath, // Vai para a lista do Mestre
            size
          });
        }
      }

      console.log(`🐉 Livro dos Monstros importado com sucesso! ${nexusMonsters.length} feras estão prontas (com tokens e artes de corpo inteiro).`);
      return nexusMonsters;

    } catch (error) {
      console.error('❌ Falha na alquimia! Erro ao ler bestiary-mm.json:', error);
      return [];
    }
  }
}