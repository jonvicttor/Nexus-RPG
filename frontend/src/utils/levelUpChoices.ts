// Define as escolhas disponíveis por nível e classe
// Formato: { CLASSE: { NIVEL: { titulo, opcoes[] } } }

export const LEVEL_CHOICES: Record<string, Record<number, { title: string; options: { label: string; value: string; desc: string }[] }>> = {
  'BARBARO': {
    3: {
      title: 'Escolha seu Caminho Primitivo',
      options: [
        { label: 'Caminho do Berserker', value: 'berserker', desc: 'Frenesi: Pode fazer um ataque extra como ação bônus.' },
        { label: 'Guerreiro Totêmico', value: 'totem', desc: 'Espírito do Urso: Resistência a todos os danos (exceto psíquico).' }
      ]
    },
    4: {
      title: 'Melhoria de Atributo ou Talento',
      options: [
        { label: '+2 em Força', value: 'str+2', desc: 'Aumenta sua Força em +2.' },
        { label: '+2 em Constituição', value: 'con+2', desc: 'Aumenta sua Constituição em +2.' },
        { label: 'Talento: Grande Mestre de Armas', value: 'feat_gwm', desc: '-5 no acerto, +10 no dano com armas pesadas.' }
      ]
    }
  },
  'GUERREIRO': {
    1: {
      title: 'Estilo de Luta',
      options: [
        { label: 'Arquearia', value: 'archery', desc: '+2 nas jogadas de ataque à distância.' },
        { label: 'Defesa', value: 'defense', desc: '+1 na Classe de Armadura.' },
        { label: 'Duelo', value: 'dueling', desc: '+2 no dano com uma mão.' },
        { label: 'Combate com Duas Armas', value: 'two_weapon', desc: 'Adiciona modificador de habilidade no dano do segundo ataque.' }
      ]
    },
    3: {
      title: 'Arquétipo Marcial',
      options: [
        { label: 'Campeão', value: 'champion', desc: 'Crítico no 19 ou 20.' },
        { label: 'Mestre de Batalha', value: 'battlemaster', desc: 'Aprende manobras táticas e ganha dados de superioridade.' },
        { label: 'Cavaleiro Arcano', value: 'eldritch_knight', desc: 'Combina habilidades marciais com magia.' }
      ]
    },
    4: {
      title: 'Melhoria de Atributo ou Talento',
      options: [
        { label: '+2 em Força', value: 'str+2', desc: 'Aumenta sua Força em +2.' },
        { label: '+2 em Constituição', value: 'con+2', desc: 'Aumenta sua Constituição em +2.' },
        { label: 'Talento: Atirador de Elite', value: 'feat_sharpshooter', desc: 'Ignora cobertura e pode dar -5/+10 no tiro.' }
      ]
    }
  },
  'LADINO': {
    3: {
      title: 'Arquétipo Ladino',
      options: [
        { label: 'Ladrão', value: 'thief', desc: 'Mãos Rápidas e Segundo Andar.' },
        { label: 'Assassino', value: 'assassin', desc: 'Vantagem contra quem não agiu e Crítico automático em surpresa.' },
        { label: 'Trapaceiro Arcano', value: 'arcane_trickster', desc: 'Usa magia para ilusões e encantamentos.' }
      ]
    }
  },
  'MAGO': {
    2: {
      title: 'Tradição Arcana',
      options: [
        { label: 'Escola de Evocação', value: 'evocation', desc: 'Pode moldar magias para não atingir aliados.' },
        { label: 'Escola de Necromancia', value: 'necromancy', desc: 'Recupera vida ao matar inimigos com magia.' },
        { label: 'Escola de Adivinhação', value: 'divination', desc: 'Portento: Rola 2d20 e guarda os resultados para usar depois.' }
      ]
    }
  },
  'CLERIGO': {
    1: {
      title: 'Domínio Divino',
      options: [
        { label: 'Domínio da Vida', value: 'life', desc: 'Curas são mais potentes (+2 + nível da magia).' },
        { label: 'Domínio da Guerra', value: 'war', desc: 'Ataque extra como ação bônus (limitado).' },
        { label: 'Domínio da Luz', value: 'light', desc: 'Impõe desvantagem em ataques contra você (recurso).' }
      ]
    }
  }
};