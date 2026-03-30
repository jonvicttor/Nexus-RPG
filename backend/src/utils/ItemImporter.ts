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
  image?: string; 
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
        
        // 👉 BUSCA AGRESSIVA: Pega itens básicos, itens mágicos e variantes mágicas
        const itemsArray = [
            ...(data.item || []), 
            ...(data.baseitem || []),
            ...(data.magicvariant || [])
        ];

        for (const it of itemsArray) {
          // Ignora se não tiver nome
          if (!it.name) continue;

          // 👉 O FILTRO RESTRITO FOI REMOVIDO! 
          // Agora ele aceita itens de TODOS os livros (PHB, XGE, TCE, XPHB, etc.)

          let type = 'misc';
          const rawType = (it.type || '').toUpperCase();
          
          if (['M', 'R', 'A'].includes(rawType) || it.weaponCategory) type = 'weapon';
          else if (['HA', 'LA', 'MA', 'S'].includes(rawType) || it.armor) type = 'armor';
          else if (rawType === 'P' || rawType === 'POTION' || it.potion) type = 'potion';
          else if (it.wondrous) type = 'magic';

          // 👉 LÓGICA DE IMAGEM DO ITEM
          let itemImagePath = undefined;
          if (it.source) {
              const safeItemName = it.name.replace(/</g, '').replace(/>/g, '').replace(/"/g, '').replace(/\//g, '');
              itemImagePath = `/img/items/${it.source}/${safeItemName}.webp`;
          }

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
            image: itemImagePath 
          });
        }
      } catch (error) {
        console.error(`❌ Erro na fornalha ao ler ${fileName}:`, error);
      }
    }

    // 👉 REMOÇÃO DE DUPLICATAS (Garante que a lista fique limpa)
    const uniqueItems = Array.from(new Map(nexusItems.map(item => [item.name, item])).values());

    console.log(`🎒 Arsenal Carregado! ${uniqueItems.length} itens afiados e polidos.`);
    return uniqueItems;
  }
}