import fs from 'fs';
import path from 'path';

// Localização da biblioteca de arquivos JSON no backend
const DATA_DIR = path.join(process.cwd(), 'src', 'data');

export class RulesImporter {
    /**
     * Carrega as regras base do sistema (Ações e Condições)
     * focando na edição 2024/2025 quando disponível no JSON.
     */
    static loadRules() {
        const actionsPath = path.join(DATA_DIR, 'actions.json');
        const conditionsPath = path.join(DATA_DIR, 'conditionsdiseases.json');
        
        let actions = [];
        let conditions = [];

        try {
            // Carregar Ações (Attack, Dash, Hide, etc.)
            if (fs.existsSync(actionsPath)) {
                const rawActions = JSON.parse(fs.readFileSync(actionsPath, 'utf8'));
                actions = rawActions.action || [];
            }

            // Carregar Condições (Blinded, Charmed, Exhaustion, etc.)
            if (fs.existsSync(conditionsPath)) {
                const rawConditions = JSON.parse(fs.readFileSync(conditionsPath, 'utf8'));
                conditions = rawConditions.condition || [];
            }

            console.log(`📚 Biblioteca de Regras Carregada: ${actions.length} ações e ${conditions.length} condições.`);
            
        } catch (e: any) {
            console.error("🚨 Erro crítico ao ler os tomos de regras:", e.message);
        }

        return { actions, conditions };
    }
}