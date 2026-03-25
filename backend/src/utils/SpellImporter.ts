import fs from 'fs';
import path from 'path';
import { FiveEToolsParser } from './FiveEToolsParser';

export interface NexusSpell {
  name: string;
  level: number;
  school: string;
  time: string;   // Tempo de conjuração
  range: string;  // Alcance
  components: string;
  duration: string;
  description: string;
}

export class SpellImporter {
  static loadSpells(): NexusSpell[] {
    try {
      const filePath = path.join(__dirname, '../data/spells-phb.json');
      
      if (!fs.existsSync(filePath)) {
          console.warn('⚠️ spells-phb.json não encontrado. O Grimório ficará vazio.');
          return [];
      }

      const rawData = fs.readFileSync(filePath, 'utf-8');
      const spellData = JSON.parse(rawData);
      const nexusSpells: NexusSpell[] = [];

      if (spellData && spellData.spell) {
        for (const s of spellData.spell) {
          // Filtramos apenas magias do Livro do Jogador (PHB)
          if (s.source !== 'PHB') continue;

          // Processamento da Descrição (A parte mais importante!)
          // O 5etools envia a descrição como um array de strings ou objetos
          let rawDesc = "";
          if (Array.isArray(s.entries)) {
              rawDesc = s.entries.map((e: any) => typeof e === 'string' ? e : JSON.stringify(e)).join('\n\n');
          }

          // Tradução básica da escola de magia
          const schools: Record<string, string> = {
            'A': 'Abjuração', 'C': 'Conjuração', 'D': 'Adivinhação', 'E': 'Encantamento',
            'I': 'Ilusão', 'N': 'Necromancia', 'P': 'Transmutação', 'V': 'Evocação'
          };

          nexusSpells.push({
            name: s.name,
            level: s.level,
            school: schools[s.school] || s.school,
            time: `${s.time[0].number} ${s.time[0].unit}`,
            range: s.range.type === 'point' ? `${s.range.distance.amount || ''} ${s.range.distance.type || ''}` : s.range.type,
            components: Object.keys(s.components || {}).join(', ').toUpperCase(),
            duration: s.duration[0].type === 'instant' ? 'Instantânea' : `${s.duration[0].duration?.amount || ''} ${s.duration[0].duration?.type || ''}`,
            // Usamos o nosso parser aqui! ✨
            description: FiveEToolsParser.cleanTags(rawDesc)
          });
        }
      }

      console.log(`📖 Grimório Arcano carregado! ${nexusSpells.length} magias prontas.`);
      return nexusSpells;

    } catch (error) {
      console.error('❌ Erro ao ler o Grimório:', error);
      return [];
    }
  }
}