import Dexie, { Table } from 'dexie';

export interface LocalShipClass {
  id: string;
  code: string;
  name_zh: string;
  category: string;
  nato_code?: string;
  visual_features: string[];
}

export interface LocalShip {
  id: string;
  class_id: string;
  hull_number: string;
  name_zh: string;
  status: string;
}

export class NavalDB extends Dexie {
  ship_classes!: Table<LocalShipClass, string>;
  ships!: Table<LocalShip, string>;
  metadata!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('NavalDB');
    this.version(1).stores({
      ship_classes: 'id, code, category',
      ships: 'id, class_id, hull_number, name_zh',
      metadata: 'key'
    });
  }
}
export const db = new NavalDB();
