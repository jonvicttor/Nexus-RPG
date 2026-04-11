import fs from 'fs';
import path from 'path';
import { FiveEToolsParser } from './FiveEToolsParser';

export interface NexusSpell { id: string; name: string; level: number; school: string; time: string; range: string; components: string; duration: string; description: string; classes: string[]; source: string; rawSpellData?: any; }

export class SpellImporter {
  static loadSpells(): NexusSpell[] {
    const nexusSpells: NexusSpell[] = [];
    const spellsDir = path.join(process.cwd(), 'src', 'data', 'spells'); // 👉 Com src

    if (!fs.existsSync(spellsDir)) return [];

    try {
      const spellFiles = fs.readdirSync(spellsDir);
      for (const fileName of spellFiles) {
        if (!fileName.endsWith('.json')) continue;
        try {
          const spellData = JSON.parse(fs.readFileSync(path.join(spellsDir, fileName), 'utf-8'));
          if (spellData && spellData.spell && Array.isArray(spellData.spell)) {
            for (const s of spellData.spell) {
              let rawDesc = Array.isArray(s.entries) ? s.entries.map((e: any) => typeof e === 'string' ? e : JSON.stringify(e)).join('\n\n') : "";
              const classList: string[] = [];
              if (s.classes && s.classes.fromClassList) {
                  s.classes.fromClassList.forEach((c: any) => classList.push(c.name.toLowerCase()));
              }
              nexusSpells.push({
                  id: `${s.name.replace(/\s+/g, '-').toLowerCase()}-${s.source}`,
                  name: s.name, level: s.level, school: s.school,
                  time: s.time && s.time[0] ? `${s.time[0].number} ${s.time[0].unit}` : '1 Ação',
                  range: s.range ? (s.range.type === 'point' ? `${s.range.distance?.amount || ''} ${s.range.distance?.type || ''}` : s.range.type) : 'Toque',
                  components: Object.keys(s.components || {}).join(', ').toUpperCase(),
                  duration: s.duration && s.duration[0] ? (s.duration[0].type === 'instant' ? 'Instantânea' : `${s.duration[0].duration?.amount || ''} ${s.duration[0].duration?.type || ''}`) : 'Instantânea',
                  description: FiveEToolsParser.cleanTags(rawDesc),
                  classes: classList, source: s.source, rawSpellData: s
              });
            }
          }
        } catch (e) {}
      }
    } catch (e) {}

    const uniqueSpells = Array.from(new Map(nexusSpells.map(s => [s.name, s])).values());
    console.log(`📖 Magias Fallback: ${uniqueSpells.length} prontas.`);
    return uniqueSpells;
  }
}