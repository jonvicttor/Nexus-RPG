export class FiveEToolsParser {
  /**
   * Limpa as tags proprietárias do 5etools e traduz termos de ataque.
   */
  static cleanTags(text: string | null | undefined): string {
    if (!text) return '';

    // 1. Tradução direta de atalhos comuns de ataque do 5etools
    let cleaned = text
      .replace(/\{@atk mw\}/g, 'Ataque Corpo a Corpo com Arma:')
      .replace(/\{@atk rw\}/g, 'Ataque à Distância com Arma:')
      .replace(/\{@atk mw,rw\}/g, 'Ataque Corpo a Corpo ou à Distância com Arma:')
      .replace(/\{@h\}/g, 'Acerto:');

    // 2. A Magia Principal (Regex)
    // Procura por padrões como: {@nomeDaTag valorDesejado|informaçãoIgnorada}
    // Exemplo: {@damage 2d6+4|fire}  -> Captura "damage" e "2d6+4"
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