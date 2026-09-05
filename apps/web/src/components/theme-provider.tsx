import type { ApplicationTheme } from "@openmonetis/domain/preferences";
import { ScriptOnce } from "@tanstack/react-router";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

type Theme = ApplicationTheme;

type ThemeProviderProps = {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

function getThemeScript(storageKey: string, defaultTheme: Theme) {
  const key = JSON.stringify(storageKey);
  const fallback = JSON.stringify(defaultTheme);

  return `(function(){try{var t=localStorage.getItem(${key});if(t!=="light"&&t!=="dark"&&t!=="system"){t=${fallback}}var d=matchMedia("(prefers-color-scheme: dark)").matches;var r=t==="system"?(d?"dark":"light"):t;var e=document.documentElement;e.classList.add(r);e.style.colorScheme=r}catch(e){}})();`;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const resolvedTheme =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  root.classList.remove("light", "dark");
  root.classList.add(resolvedTheme);
  root.style.colorScheme = resolvedTheme;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "openmonetis-theme",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem(storageKey);
    setThemeState(
      storedTheme === "dark" || storedTheme === "light" || storedTheme === "system"
        ? storedTheme
        : defaultTheme,
    );
    setMounted(true);
  }, [defaultTheme, storageKey]);

  useEffect(() => {
    if (mounted) {
      applyTheme(theme);
    }
  }, [mounted, theme]);

  useEffect(() => {
    if (!mounted || theme !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applySystemTheme = () => applyTheme("system");
    mediaQuery.addEventListener("change", applySystemTheme);

    return () => mediaQuery.removeEventListener("change", applySystemTheme);
  }, [mounted, theme]);

  const setTheme = useCallback(
    (nextTheme: Theme) => {
      localStorage.setItem(storageKey, nextTheme);
      setThemeState(nextTheme);
    },
    [storageKey],
  );

  return (
    <ThemeProviderContext value={{ theme, setTheme }}>
      <ScriptOnce>{getThemeScript(storageKey, defaultTheme)}</ScriptOnce>
      {children}
    </ThemeProviderContext>
  );
}

export function useTheme() {
  const context = useContext(ThemeProviderContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}
