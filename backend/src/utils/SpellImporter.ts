import fs from 'fs';
import path from 'path';
import { FiveEToolsParser } from './FiveEToolsParser';

export interface NexusSpell {
  id: string;
  name: string;
  level: number;
  school: string;
  time: string;
  range: string;
  components: string;
  duration: string;
  description: string;
  classes: string[]; 
  source: string;
}

export class SpellImporter {
  static loadSpells(): NexusSpell[] {
    const nexusSpells: NexusSpell[] = [];

    // Lê os 3 arquivos que você tem!
    const spellFiles = ['spells-phb.json', 'spells-xge.json', 'spells-tce.json'];

    spellFiles.forEach(fileName => {
        try {
            const filePath = path.join(__dirname, '../data/', fileName);
            
            if (!fs.existsSync(filePath)) {
                console.warn(`⚠️ ${fileName} não encontrado. Ignorando.`);
                return;
            }

            const rawData = fs.readFileSync(filePath, 'utf-8');
            const spellData = JSON.parse(rawData);

            if (spellData && spellData.spell) {
                for (const s of spellData.spell) {
                    
                    let rawDesc = "";
                    if (Array.isArray(s.entries)) {
                        rawDesc = s.entries.map((e: any) => typeof e === 'string' ? e : JSON.stringify(e)).join('\n\n');
                    }

                    const schools: Record<string, string> = {
                        'A': 'Abjuração', 'C': 'Conjuração', 'D': 'Adivinhação', 'E': 'Encantamento',
                        'I': 'Ilusão', 'N': 'Necromancia', 'P': 'Transmutação', 'V': 'Evocação'
                    };

                    // 👉 A MÁGICA ESTÁ AQUI: PADRONIZAÇÃO ABSOLUTA DAS CLASSES
                    const classList: string[] = [];
                    if (s.classes && s.classes.fromClassList) {
                        s.classes.fromClassList.forEach((c: any) => {
                            const cName = c.name.toLowerCase();
                            classList.push(cName);
                            
                            // Cria sinônimos para garantir o match no frontend (PT-BR e Siglas)
                            if (cName === 'wizard') classList.push('mago');
                            if (cName === 'sorcerer') classList.push('feiticeiro');
                            if (cName === 'warlock') classList.push('bruxo');
                            if (cName === 'cleric') classList.push('clérigo', 'clerigo');
                            if (cName === 'druid') classList.push('druida');
                            if (cName === 'bard') classList.push('bardo');
                            if (cName === 'paladin') classList.push('paladino');
                            if (cName === 'ranger') classList.push('patrulheiro');
                            if (cName === 'artificer') classList.push('artífice', 'artifice');
                            if (cName === 'fighter') classList.push('guerreiro');
                            if (cName === 'rogue') classList.push('ladino');
                        });
                    }

                    const castTime = s.time && s.time[0] ? `${s.time[0].number} ${s.time[0].unit}` : '1 Ação';
                    const spellRange = s.range ? (s.range.type === 'point' ? `${s.range.distance?.amount || ''} ${s.range.distance?.type || ''}` : s.range.type) : 'Toque';
                    const spellDuration = s.duration && s.duration[0] ? (s.duration[0].type === 'instant' ? 'Instantânea' : `${s.duration[0].duration?.amount || ''} ${s.duration[0].duration?.type || ''}`) : 'Instantânea';

                    nexusSpells.push({
                        id: `${s.name.replace(/\s+/g, '-').toLowerCase()}-${s.source}`,
                        name: s.name,
                        level: s.level,
                        school: schools[s.school] || s.school,
                        time: castTime,
                        range: spellRange,
                        components: Object.keys(s.components || {}).join(', ').toUpperCase(),
                        duration: spellDuration,
                        description: FiveEToolsParser.cleanTags(rawDesc),
                        classes: classList, // Array turbinado com PT e EN
                        source: s.source
                    });
                }
            }
        } catch (error) {
            console.error(`❌ Erro ao ler o Grimório ${fileName}:`, error);
        }
    });

    console.log(`📖 Grimório Arcano carregado! ${nexusSpells.length} magias prontas.`);
    return nexusSpells;
  }
}