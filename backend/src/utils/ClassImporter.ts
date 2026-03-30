import fs from 'fs';
import path from 'path';

export interface NexusClass {
  name: string;
  hitDice: number;
  saves: string[];
  source?: string; // 👉 Guardamos a fonte para facilitar buscas
}

export class ClassImporter {
  static loadClasses(): NexusClass[] {
    const nexusClasses: NexusClass[] = [];
    
    const classFiles = [
      'class-barbarian.json', 'class-bard.json', 'class-cleric.json', 
      'class-druid.json', 'class-fighter.json', 'class-monk.json', 
      'class-paladin.json', 'class-ranger.json', 'class-rogue.json', 
      'class-sorcerer.json', 'class-warlock.json', 'class-wizard.json',
      'class-artificer.json' // 👉 Adicionei o Artífice na lista
    ];

    for (const fileName of classFiles) {
      try {
        const filePath = path.join(__dirname, `../data/${fileName}`);
        
        if (!fs.existsSync(filePath)) {
            continue;
        }

        const rawData = fs.readFileSync(filePath, 'utf-8');
        const classData = JSON.parse(rawData);

        if (classData && classData.class) {
          for (const c of classData.class) {
            // 👉 REMOVIDO: Agora aceita qualquer source (PHB, XPHB, Tasha, etc)
            if (!c.name) continue;

            const name = c.name;
            let hitDice = 8; 
            if (c.hd && c.hd.faces) {
              hitDice = c.hd.faces;
            }

            let saves: string[] = [];
            if (c.proficiency) {
              saves = c.proficiency;
            }

            nexusClasses.push({
              name,
              hitDice,
              saves,
              source: c.source
            });
          }
        }
      } catch (error) {
        console.error(`❌ Erro ao ler classe ${fileName}:`, error);
      }
    }

    // Remove duplicatas (caso a mesma classe apareça em dois arquivos)
    const uniqueClasses = Array.from(new Map(nexusClasses.map(c => [c.name, c])).values());

    console.log(`🧙‍♂️ Classes Restauradas! ${uniqueClasses.length} caminhos de poder carregados.`);
    return uniqueClasses;
  }
}