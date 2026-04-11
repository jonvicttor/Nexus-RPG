import fs from 'fs';
import path from 'path';

export interface NexusClass { name: string; hitDice: number; saves: string[]; source?: string; rawClassData?: any; }

export class ClassImporter {
  static loadClasses(): NexusClass[] {
    const nexusClasses: NexusClass[] = [];
    const classDir = path.join(process.cwd(), 'src', 'data', 'class'); // 👉 Com src

    if (!fs.existsSync(classDir)) return [];

    try {
      const classFiles = fs.readdirSync(classDir);
      for (const fileName of classFiles) {
        if (!fileName.endsWith('.json')) continue;
        try {
          const classData = JSON.parse(fs.readFileSync(path.join(classDir, fileName), 'utf-8'));
          if (classData && classData.class && Array.isArray(classData.class)) {
            for (const c of classData.class) {
              if (!c.name) continue;
              nexusClasses.push({
                name: c.name,
                hitDice: (c.hd && c.hd.faces) ? c.hd.faces : 8,
                saves: c.proficiency ? c.proficiency : [],
                source: c.source,
                rawClassData: c 
              });
            }
          }
        } catch (e) {}
      }
    } catch (e) {}

    const uniqueClasses = Array.from(new Map(nexusClasses.map(c => [c.name, c])).values());
    console.log(`🧙‍♂️ Classes Fallback: ${uniqueClasses.length} prontas.`);
    return uniqueClasses.map(c => c.rawClassData);
  }
}