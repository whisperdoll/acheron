import StateStore from "./state";
import { TokenUID } from "../Types";
import { MaybeGeneratedPromise } from "../lib/utils";
import Dict from "../lib/dict";
import { tokenDefinitions } from "../Tokens";
import { isOnDesktop } from "../utils/desktop";
import { KeyboardShortcut } from "../lib/keyboard";
import { migrateSettings } from "../Migrators";

export interface TokenSettings {
  shortcut: string;
  enabled: boolean;
}

export interface AppSettings {
  isFirstRun: boolean;
  version: number;
  playNoteOnClick: boolean;
  wrapPlayheads: boolean;
  tokens: Record<TokenUID, TokenSettings>;
  confirmDelete: boolean;
  midiInputs: string[];
  midiOutputs: string[];
  keyboardShortcuts: {
    play: KeyboardShortcut;
    settings: KeyboardShortcut;
    toggleMultilayerMode: KeyboardShortcut;
    addNewLayer: KeyboardShortcut;
    toggleShowLeftColumn: KeyboardShortcut;
    toggleShowInspector: KeyboardShortcut;
  };
}

export const defaultSettings: AppSettings = {
  isFirstRun: true,
  version: 1,
  playNoteOnClick: true,
  wrapPlayheads: true,
  tokens: Dict.fromArray<TokenUID, TokenSettings>(
    tokenDefinitions.map<[TokenUID, TokenSettings]>((t) => [
      t.uid,
      { enabled: true, shortcut: "" },
    ])
  ),
  confirmDelete: true,
  midiInputs: [],
  midiOutputs: [],
  keyboardShortcuts: {
    play: {
      key: "Enter",
      ctrl: true,
    },
    settings: {
      key: ".",
      ctrl: true,
    },
    toggleMultilayerMode: {
      key: "M",
      ctrl: true,
    },
    addNewLayer: {
      key: "L",
      ctrl: true,
    },
    toggleShowLeftColumn: {
      key: "P",
      ctrl: true,
    },
    toggleShowInspector: {
      key: "I",
      ctrl: true,
    },
  },
};

class SettingsStore extends StateStore<AppSettings> {
  debouncedTimer: number = 0;
  throttleLastTime: number = Date.now();
  throttleTimer: number = 0;

  constructor() {
    super(async () => {
      if (isOnDesktop()) {
        const fs = await import("@tauri-apps/plugin-fs");
        const path = await import("@tauri-apps/api/path");

        const dir = await path.appConfigDir();
        const filepath = await path.join(dir, "settings.json");

        if (!(await fs.exists(dir))) {
          await fs.mkdir(dir);
        }

        try {
          const fileContents = await fs.readTextFile(filepath);
          const newSettings: Partial<AppSettings> = await migrateSettings(
            JSON.parse(fileContents)
          );
          return {
            ...defaultSettings,
            ...newSettings,
            tokens: { ...defaultSettings.tokens, ...newSettings.tokens },
          };
        } catch {
          await fs.writeTextFile(filepath, JSON.stringify(defaultSettings));
          return defaultSettings;
        }
      } else {
        const fileContents = localStorage.getItem("settings");
        if (fileContents) {
          const newSettings: Partial<AppSettings> = await migrateSettings(
            JSON.parse(fileContents)
          );
          return {
            ...defaultSettings,
            ...newSettings,
            tokens: { ...defaultSettings.tokens, ...newSettings.tokens },
          };
        } else {
          localStorage.setItem("settings", JSON.stringify(defaultSettings));
          return defaultSettings;
        }
      }
    });
  }

  async set(
    newState: MaybeGeneratedPromise<Partial<AppSettings>, [AppSettings]>,
    why: string
  ) {
    await super.set(newState, why);
    await this.saveSettingsThrottled(1000, why);
    return this.values;
  }

  async save(why: string) {
    console.log(`saving settings bc ${why}`, this.values);

    if (isOnDesktop()) {
      const fs = await import("@tauri-apps/plugin-fs");
      const path = await import("@tauri-apps/api/path");

      const dir = await path.appConfigDir();
      const filepath = await path.join(dir, "settings.json");

      await fs.writeTextFile(filepath, JSON.stringify(this.values));
    } else {
      localStorage.setItem("settings", JSON.stringify(this.values));
    }
  }

  async saveSettingsDebounced(ms: number, why: string) {
    if (this.debouncedTimer) {
      clearTimeout(this.debouncedTimer);
    }

    this.debouncedTimer = window.setTimeout(() => {
      this.save(`(debounced) ${why}`);
    }, ms);
  }

  async saveSettingsThrottled(ms: number, why: string) {
    if (Date.now() - this.throttleLastTime > ms) {
      this.throttleLastTime = Date.now();
      return this.save(`(throttled) ${why}`);
    }

    if (this.throttleTimer) return;

    this.throttleTimer = window.setTimeout(() => {
      this.throttleTimer = 0;
      this.throttleLastTime = Date.now();
      this.save(`(throttled) ${why}`);
    }, ms - (Date.now() - this.throttleLastTime));
  }
}

const appSettingsStore = new SettingsStore();

await appSettingsStore.initialize();

export default appSettingsStore;
