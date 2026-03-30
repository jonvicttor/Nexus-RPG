import fs from 'fs';
import path from 'path';

export interface NexusMonster {
  name: string;
  hp: number;
  ac: number;
  image: string;      
  tokenImage: string; 
  size?: number; 
}

export class MonsterImporter {
  static loadBestiary(): NexusMonster[] {
    try {
      // 👉 MUDANÇA: Você pode adicionar outros arquivos aqui se baixar mais bestiários
      const fileName = 'bestiary-mm.json';
      const filePath = path.join(process.cwd(), 'src', 'data', fileName);
      
      if (!fs.existsSync(filePath)) {
          console.warn(`⚠️ ${fileName} não encontrado na pasta src/data. O Bestiário oficial não será carregado.`);
          return [];
      }

      const rawData = fs.readFileSync(filePath, 'utf-8');
      const bestiaryData = JSON.parse(rawData);

      const nexusMonsters: NexusMonster[] = [];

      if (bestiaryData && bestiaryData.monster) {
        for (const m of bestiaryData.monster) {
          // Ignora entradas que não são monstros reais (como tabelas ou notas)
          if (!m.name || !m.source) continue;

          // 👉 O FILTRO RESTRITO FOI REMOVIDO! 
          // Agora aceitamos monstros de qualquer fonte (MM, VGM, MTF, XPHB, etc.)

          const name = m.name;
          const safeName = name.replace(/</g, '').replace(/>/g, '').replace(/"/g, '').replace(/\//g, '');
          
          // Geração das URLs de imagem baseadas na estrutura do 5eTools
          const tokenImagePath = `/img/bestiary/tokens/${m.source}/${safeName}.webp`; 
          const fullImagePath = `/img/bestiary/${m.source}/${safeName}.webp`;        

          let hp = 10;
          if (m.hp) {
            if (typeof m.hp === 'number') hp = m.hp;
            else if (m.hp.average) hp = m.hp.average;
            else if (m.hp.special) hp = parseInt(String(m.hp.special)) || 10;
          }

          let ac = 10;
          if (m.ac && m.ac.length > 0) {
            const firstAc = m.ac[0];
            if (typeof firstAc === 'number') ac = firstAc;
            else if (typeof firstAc === 'object' && firstAc.ac) ac = firstAc.ac;
          }

          // Lógica de Tamanho (Escala do Grid)
          let size = 1.0; 
          if (m.size) {
              const sizeChar = Array.isArray(m.size) ? m.size[0] : m.size;
              const sizeMap: Record<string, number> = {
                  'T': 0.7, // Tiny
                  'S': 0.8, // Small
                  'M': 1.0, // Medium
                  'L': 2.0, // Large
                  'H': 3.0, // Huge
                  'G': 4.0  // Gargantuan
              };
              size = sizeMap[sizeChar] || 1.0;
          }

          nexusMonsters.push({
            name,
            hp,
            ac,
            image: fullImagePath,
            tokenImage: tokenImagePath,
            size
          });
        }
      }

      // 👉 REMOÇÃO DE DUPLICATAS
      const uniqueMonsters = Array.from(new Map(nexusMonsters.map(m => [m.name, m])).values());

      console.log(`🐉 Bestiário Carregado! ${uniqueMonsters.length} feras prontas para o combate.`);
      return uniqueMonsters;

    } catch (error) {
      console.error('❌ Erro ao ler o Bestiário:', error);
      return [];
    }
  }
}