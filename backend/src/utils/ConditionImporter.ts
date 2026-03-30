import fs from 'fs';
import path from 'path';

export interface NexusCondition {
  name: string;
  description: string;
}

export class ConditionImporter {
  static loadConditions(): NexusCondition[] {
    const nexusConditions: NexusCondition[] = [];
    
    try {
      // 👉 CAMINHO BLINDADO PARA A NUVEM
      const filePath = path.join(process.cwd(), 'src', 'data', 'conditionsdiseases.json');
      
      if (!fs.existsSync(filePath)) {
        console.warn('⚠️ Arquivo conditionsdiseases.json não encontrado na forja. Pulando...');
        return [];
      }

      const rawData = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(rawData);
      
      // Pegamos apenas as Condições (ignoramos as Doenças base por enquanto)
      const conditionsArray = data.condition || [];

      for (const c of conditionsArray) {
        // Focando nas condições oficiais do Livro do Jogador / Regras Básicas
        if (c.source !== 'PHB' && c.source !== 'Basic Rules') continue;

        // O 5etools guarda as descrições como um array de parágrafos. Vamos juntá-los.
        let desc = '';
        if (Array.isArray(c.entries)) {
          desc = c.entries.map((entry: any) => {
            if (typeof entry === 'string') return entry;
            if (entry.items) return '• ' + entry.items.join('\n• '); // Se for uma lista de efeitos
            return '';
          }).join('\n\n');
        }

        // Limpeza mágica: O 5etools usa tags como {@condition blinded} ou {@chance 50}. 
        // Essa Regex mágica remove a tag e deixa só a palavra legível.
        const cleanDesc = desc.replace(/{@\w+\s([^}]+)}/g, '$1');

        nexusConditions.push({
          name: c.name,
          description: cleanDesc
        });
      }
      
      console.log(`💫 Condições Carregadas! ${nexusConditions.length} regras de status prontas para uso.`);
    } catch (error) {
      console.error(`❌ Erro ao ler conditionsdiseases.json:`, error);
    }

    return nexusConditions;
  }
}