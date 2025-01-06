import Store from 'electron-store';

interface StoreSchema {
  outputPath: string;
  darkMode: boolean;
}

export class Settings {
  private store: Store<StoreSchema>;

  constructor() {
    this.store = new Store<StoreSchema>({
      defaults: {
        outputPath: '',
        darkMode: false
      }
    });
  }

  save(settings: Partial<StoreSchema>) {
    Object.entries(settings).forEach(([key, value]) => {
      this.store.set(key as keyof StoreSchema, value);
    });
  }

  get<K extends keyof StoreSchema>(key: K): StoreSchema[K] {
    return this.store.get(key);
  }

  getAll(): StoreSchema {
    return this.store.store;
  }
} 