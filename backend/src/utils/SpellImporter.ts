import fs from 'fs';
import path from 'path';
import { FiveEToolsParser } from './FiveEToolsParser';

export interface NexusSpell {
    id: string; name: string; level: number; school: string;
    time: string; range: string; components: string; duration: string;
    description: string; classes: string[]; source: string;
}

export class SpellImporter {
    static loadSpells(): NexusSpell[] {
        const nexusSpells: NexusSpell[] = [];
        const spellsDir = path.join(process.cwd(), 'src', 'data', 'spells');

        if (!fs.existsSync(spellsDir)) return [];

        try {
            const spellFiles = fs.readdirSync(spellsDir);
            for (const fileName of spellFiles) {
                if (!fileName.endsWith('.json')) continue;
                try {
                    const spellData = JSON.parse(fs.readFileSync(path.join(spellsDir, fileName), 'utf-8'));
                    if (spellData && spellData.spell && Array.isArray(spellData.spell)) {
                        for (const s of spellData.spell) {
                            let rawDesc = "";
                            if (Array.isArray(s.entries)) {
                                rawDesc = s.entries.map((e: any) => typeof e === 'string' ? e : JSON.stringify(e)).join('\n\n');
                            }

                            // 👉 MAGIA DE TRADUÇÃO: Lê em Português e salva em Inglês para o VTT entender
                            const classSet = new Set<string>();
                            const classString = JSON.stringify(s.classes || {}).toLowerCase();
                            
                            const classMap: Record<string, string[]> = {
                                'warlock': ['warlock', 'bruxo'],
                                'wizard': ['wizard', 'mago'],
                                'sorcerer': ['sorcerer', 'feiticeiro'],
                                'cleric': ['cleric', 'clérigo', 'clerigo'],
                                'bard': ['bard', 'bardo'],
                                'druid': ['druid', 'druida'],
                                'paladin': ['paladin', 'paladino'],
                                'ranger': ['ranger', 'patrulheiro'],
                                'artificer': ['artificer', 'artífice', 'artifice']
                            };

                            Object.entries(classMap).forEach(([engClass, synonyms]) => {
                                if (synonyms.some(syn => classString.includes(syn))) {
                                    classSet.add(engClass);
                                }
                            });

                            nexusSpells.push({
                                id: `${s.name.replace(/\s+/g, '-').toLowerCase()}-${s.source}`,
                                name: s.name,
                                level: Number(s.level) || 0,
                                school: s.school || 'A',
                                time: s.time && s.time[0] ? `${s.time[0].number} ${s.time[0].unit}` : '1 Ação',
                                range: s.range ? (s.range.type === 'point' ? `${s.range.distance?.amount || ''} ${s.range.distance?.type || ''}` : s.range.type) : 'Toque',
                                components: Object.keys(s.components || {}).join(', ').toUpperCase(),
                                duration: s.duration && s.duration[0] ? (s.duration[0].type === 'instant' ? 'Instantânea' : `${s.duration[0].duration?.amount || ''} ${s.duration[0].duration?.type || ''}`) : 'Instantânea',
                                description: FiveEToolsParser.cleanTags(rawDesc),
                                classes: Array.from(classSet), // 👈 Agora a magia sabe que pertence ao Warlock!
                                source: s.source
                            });
                        }
                    }
                } catch (e) {}
            }
        } catch (e) {}

        const uniqueSpells = Array.from(new Map(nexusSpells.map(s => [s.name, s])).values());
        console.log(`📖 Magias Bilingues: ${uniqueSpells.length} prontas no Backend.`);
        return uniqueSpells;
    }
}