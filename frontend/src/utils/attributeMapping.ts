// src/utils/attributeMapping.ts
import { Entity } from '../App';
import { Attribute } from './gameRules';

export const mapEntityStatsToAttributes = (entity: Entity): Record<Attribute, number> => {
  if (!entity.stats) {
    return { FOR: 10, DES: 10, CON: 10, INT: 10, SAB: 10, CAR: 10 };
  }
  return {
    FOR: entity.stats.str,
    DES: entity.stats.dex,
    CON: entity.stats.con,
    INT: entity.stats.int,
    SAB: entity.stats.wis,
    CAR: entity.stats.cha
  };
};