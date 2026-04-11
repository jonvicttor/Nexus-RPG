import fs from 'fs';
import path from 'path';

export interface NexusClass { name: string; hitDice: number; saves: string[]; source?: string; rawClassData?: any; }

export class ClassImporter {
  static loadClasses(): NexusClass[] {
    const allRawClasses: any[] = [];
    const allRawSubclasses: any[] = [];
    const allFeatures: any[] = []; // 👉 Agora ele puxa as habilidades!
    const classDir = path.join(process.cwd(), 'src', 'data', 'class');

    if (!fs.existsSync(classDir)) return [];

    try {
      const classFiles = fs.readdirSync(classDir);
      for (const fileName of classFiles) {
        if (!fileName.endsWith('.json')) continue;
        try {
          const classData = JSON.parse(fs.readFileSync(path.join(classDir, fileName), 'utf-8'));
          if (classData) {
              if (classData.class && Array.isArray(classData.class)) {
                  allRawClasses.push(...classData.class);
              }
              if (classData.subclass && Array.isArray(classData.subclass)) {
                  allRawSubclasses.push(...classData.subclass);
              }
              if (classData.classFeature && Array.isArray(classData.classFeature)) {
                  allFeatures.push(...classData.classFeature);
              }
          }
        } catch (e) {}
      }
    } catch (e) {}

    // 🪄 Magia de Fusão Total
    allRawClasses.forEach(c => {
        c.subclasses = allRawSubclasses.filter(sc => sc.className === c.name || sc.class === c.name);
        c.classFeature = allFeatures.filter(f => f.className === c.name || f.class === c.name);
    });

    const uniqueClasses = Array.from(new Map(allRawClasses.map(c => [c.name, c])).values());
    console.log(`🧙‍♂️ Classes Fallback: ${uniqueClasses.length} prontas com subclasses e habilidades fundidas.`);
    return uniqueClasses;
  }
}