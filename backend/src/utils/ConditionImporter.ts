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
      // 👉 CAMINHO ATUALIZADO: direto para a pasta data/conditionsdiseases.json
      const filePath = path.join(process.cwd(), 'data', 'conditionsdiseases.json');
      
      if (!fs.existsSync(filePath)) {
        console.warn('⚠️ Arquivo conditionsdiseases.json não encontrado na forja. Pulando...');
        return [];
      }

      const rawData = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(rawData);
      
      const conditionsArray = data.condition || [];

      for (const c of conditionsArray) {
        if (c.source !== 'PHB' && c.source !== 'Basic Rules') continue;

        let desc = '';
        if (Array.isArray(c.entries)) {
          desc = c.entries.map((entry: any) => {
            if (typeof entry === 'string') return entry;
            if (entry.items) return '• ' + entry.items.join('\n• '); 
            return '';
          }).join('\n\n');
        }

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

export class FiveEToolsParser {
  static cleanTags(text: string | null | undefined): string {
    if (!text) return '';

    let cleaned = text
      .replace(/\{@atk mw\}/g, 'Ataque Corpo a Corpo com Arma:')
      .replace(/\{@atk rw\}/g, 'Ataque à Distância com Arma:')
      .replace(/\{@atk mw,rw\}/g, 'Ataque Corpo a Corpo ou à Distância com Arma:')
      .replace(/\{@h\}/g, 'Acerto:');

    const regex = /\{@(\w+)\s+([^|}]+)[^}]*\}/g;
    
    cleaned = cleaned.replace(regex, (match, tag, value) => {
      if (tag === 'hit') {
        if (!value.startsWith('+') && !value.startsWith('-')) {
          return `+${value}`;
        }
        return value;
      }
      return value;
    });

    return cleaned.trim();
  }
}