import fs from 'fs';
import path from 'path';

export interface NexusItemDef {
  name: string;
  type: string; 
  rarity: string;
  value: string;
  weight: number;
  damage?: string;
  ac?: number;
  properties?: string[];
  image?: string; // 👉 NOVA PROPRIEDADE PARA A IMAGEM
}

export class ItemImporter {
  static loadItems(): NexusItemDef[] {
    const nexusItems: NexusItemDef[] = [];
    const filesToLoad = ['items-base.json', 'items.json'];

    for (const fileName of filesToLoad) {
      try {
        const filePath = path.join(__dirname, `../data/${fileName}`);
        
        if (!fs.existsSync(filePath)) {
          console.warn(`⚠️ Arquivo ${fileName} não encontrado na forja. Pulando...`);
          continue;
        }

        const rawData = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(rawData);
        
        const itemsArray = data.item || data.baseitem || [];

        for (const it of itemsArray) {
          if (it.source !== 'PHB' && it.source !== 'DMG') continue;

          let type = 'misc';
          if (['M', 'R', 'A'].includes(it.type) || it.weaponCategory) type = 'weapon';
          else if (['HA', 'LA', 'MA', 'S'].includes(it.type) || it.armor) type = 'armor';
          else if (it.type === 'P') type = 'potion';

          // 👉 LÓGICA DE IMAGEM DO ITEM (O 5eTools guarda as imagens de itens na raiz /img/items/)
          const safeItemName = it.name.replace(/</g, '').replace(/>/g, '').replace(/"/g, '').replace(/\//g, '');
          const itemImagePath = `/img/items/${it.source}/${safeItemName}.webp`;

          let damage = undefined;
          if (it.dmg1) damage = it.dmg1;

          let ac = undefined;
          if (it.ac) {
              ac = typeof it.ac === 'number' ? it.ac : parseInt(String(it.ac).replace(/\D/g, ''));
          }

          const valueInGold = it.value ? (it.value / 100) : 0;

          nexusItems.push({
            name: it.name,
            type,
            rarity: it.rarity || 'Comum',
            value: valueInGold > 0 ? `${valueInGold} PO` : '',
            weight: it.weight || 0,
            damage,
            ac,
            properties: it.property || [],
            image: itemImagePath // 👉 Anexando a imagem do item!
          });
        }
      } catch (error) {
        console.error(`❌ Erro na fornalha ao ler ${fileName}:`, error);
      }
    }

    console.log(`🎒 Arsenal Carregado! ${nexusItems.length} itens afiados e polidos (com imagens).`);
    return nexusItems;
  }
}