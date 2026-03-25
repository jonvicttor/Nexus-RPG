import fs from 'fs';
import path from 'path';

export interface NexusClass {
  name: string;
  hitDice: number;
  saves: string[];
}

export class ClassImporter {
  static loadClasses(): NexusClass[] {
    const nexusClasses: NexusClass[] = [];
    
    // Lista dos arquivos que você copiou para a pasta data
    const classFiles = [
      'class-barbarian.json', 'class-bard.json', 'class-cleric.json', 
      'class-druid.json', 'class-fighter.json', 'class-monk.json', 
      'class-paladin.json', 'class-ranger.json', 'class-rogue.json', 
      'class-sorcerer.json', 'class-warlock.json', 'class-wizard.json'
    ];

    for (const fileName of classFiles) {
      try {
        const filePath = path.join(__dirname, `../data/${fileName}`);
        
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ Arquivo ${fileName} não encontrado. Pulando...`);
            continue;
        }

        const rawData = fs.readFileSync(filePath, 'utf-8');
        const classData = JSON.parse(rawData);

        if (classData && classData.class) {
          for (const c of classData.class) {
            // Ignora subclasses ou variantes de outros livros se quiser focar no básico
            if (c.source !== 'PHB') continue;

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
              saves
            });
          }
        }
      } catch (error) {
        console.error(`❌ Erro ao ler o arquivo ${fileName}:`, error);
      }
    }

    console.log(`🧙‍♂️ Compêndio de Classes importado! ${nexusClasses.length} classes prontas para uso.`);
    return nexusClasses;
  }
}