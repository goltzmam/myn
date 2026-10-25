import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Language } from "@/lib/i18n";
type Preferences = {
  language: Language;
  setLanguage: (language: Language) => void;
  speechLanguage: string;
  setSpeechLanguage: (language: string) => void;
};
export const usePreferences = create(
  persist<Preferences>(
    (set) => ({
      language: "en",
      setLanguage: (language) => set({ language }),
      speechLanguage: "auto",
      setSpeechLanguage: (speechLanguage) => set({ speechLanguage }),
    }),
    { name: "myn-preferences" },
  ),
);
