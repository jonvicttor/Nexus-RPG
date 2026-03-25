import fs from 'fs';
import path from 'path';

export interface NexusItemDef {
  name: string;
  type: string; // 'weapon', 'armor', 'potion', 'misc'
  rarity: string;
  value: string;
  weight: number;
  damage?: string;
  ac?: number;
  properties?: string[];
}

export class ItemImporter {
  static loadItems(): NexusItemDef[] {
    const nexusItems: NexusItemDef[] = [];
    // Vamos carregar tanto os itens base (espadas, escudos normais) quanto os mágicos
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
        
        // No 5etools, os itens base podem vir em 'baseitem' e os outros em 'item'
        const itemsArray = data.item || data.baseitem || [];

        for (const it of itemsArray) {
          // Vamos focar nos itens oficiais do Livro do Jogador e Guia do Mestre para não poluir
          if (it.source !== 'PHB' && it.source !== 'DMG') continue;

          // Descobrindo o tipo do item
          let type = 'misc';
          if (['M', 'R', 'A'].includes(it.type) || it.weaponCategory) type = 'weapon';
          else if (['HA', 'LA', 'MA', 'S'].includes(it.type) || it.armor) type = 'armor';
          else if (it.type === 'P') type = 'potion';

          // Pegando o dano (se for arma)
          let damage = undefined;
          if (it.dmg1) damage = it.dmg1;

          // Pegando a CA (se for armadura/escudo)
          let ac = undefined;
          if (it.ac) {
              // As vezes a CA vem como número, as vezes como string complexa, pegamos o número base
              ac = typeof it.ac === 'number' ? it.ac : parseInt(String(it.ac).replace(/\D/g, ''));
          }

          // Convertendo o valor (5etools salva o valor em Peças de Cobre, dividimos por 100 para Ouro)
          const valueInGold = it.value ? (it.value / 100) : 0;

          nexusItems.push({
            name: it.name,
            type,
            rarity: it.rarity || 'Comum',
            value: valueInGold > 0 ? `${valueInGold} PO` : '',
            weight: it.weight || 0,
            damage,
            ac,
            properties: it.property || []
          });
        }
      } catch (error) {
        console.error(`❌ Erro na fornalha ao ler ${fileName}:`, error);
      }
    }

    console.log(`🎒 Arsenal Carregado! ${nexusItems.length} itens afiados e polidos.`);
    return nexusItems;
  }
}