import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Language } from "@/lib/i18n";
export const usePreferences = create(
  persist<{ language: Language; setLanguage: (language: Language) => void }>(
    (set) => ({ language: "en", setLanguage: (language) => set({ language }) }),
    { name: "myn-preferences" },
  ),
);
