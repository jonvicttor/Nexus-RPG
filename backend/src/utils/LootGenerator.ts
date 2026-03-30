import { NexusItemDef } from './ItemImporter';

export class LootGenerator {
    static generate(allItems: NexusItemDef[], options: { rarity?: string, type?: string, count: number }): NexusItemDef[] {
        let pool = allItems;

        // Filtra por raridade se selecionado
        if (options.rarity && options.rarity !== 'all') {
            pool = pool.filter(i => i.rarity.toLowerCase().includes(options.rarity!.toLowerCase()));
        }

        // Filtra por tipo (arma, armadura, etc)
        if (options.type && options.type !== 'all') {
            pool = pool.filter(i => i.type === options.type);
        }

        if (pool.length === 0) return [];

        // Sorteia os itens
        const results: NexusItemDef[] = [];
        for (let i = 0; i < options.count; i++) {
            const randomIndex = Math.floor(Math.random() * pool.length);
            results.push({ ...pool[randomIndex] });
        }

        return results;
    }
}