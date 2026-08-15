/**
 * stores/settings.ts —— 插件设置（非用户内容，存 dbStorage，合规）
 */
import { create } from 'zustand'

export type DarkMode = 'system' | 'light' | 'dark'

export interface Settings {
  darkMode: DarkMode
  defaultLanguage: string
}

interface SettingsState extends Settings {
  loaded: boolean
  load: () => void
  set: (patch: Partial<Settings>) => void
}

const STORAGE_KEY = 'pattern-vault.settings'

const DEFAULTS: Settings = {
  darkMode: 'system',
  defaultLanguage: 'javascript',
}

function readStored(): Settings {
  try {
    const raw = window.utools?.dbStorage?.getItem(STORAGE_KEY)
    if (raw && typeof raw === 'object') {
      return { ...DEFAULTS, ...(raw as Partial<Settings>) }
    }
  } catch {
    // ignore
  }
  return { ...DEFAULTS }
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  load: () => {
    const stored = readStored()
    set({ ...stored, loaded: true })
  },

  set: (patch) => {
    const next = { ...get(), ...patch }
    set(next)
    try {
      window.utools?.dbStorage?.setItem(STORAGE_KEY, {
        darkMode: next.darkMode,
        defaultLanguage: next.defaultLanguage,
      })
    } catch {
      // ignore
    }
  },
}))
