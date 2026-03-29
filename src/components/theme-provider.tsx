"use client";

import * as React from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = Exclude<Theme, "system">;

const STORAGE_KEY = "theme";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  attribute?: "class" | `data-${string}`;
}

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light";
}

function normalizeTheme(theme: Theme, enableSystem: boolean): Theme {
  if (theme === "system" && !enableSystem) {
    return "light";
  }

  return theme;
}

function withoutTransitions() {
  const style = document.createElement("style");
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{transition:none!important}"
    )
  );
  document.head.appendChild(style);

  return () => {
    window.getComputedStyle(document.body);
    window.setTimeout(() => {
      document.head.removeChild(style);
    }, 1);
  };
}

function applyTheme(
  attribute: NonNullable<ThemeProviderProps["attribute"]>,
  theme: ResolvedTheme,
  disableTransitionOnChange: boolean
) {
  const root = document.documentElement;
  const cleanup = disableTransitionOnChange ? withoutTransitions() : null;

  if (attribute === "class") {
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  } else {
    root.setAttribute(attribute, theme);
  }

  root.style.colorScheme = theme;
  cleanup?.();
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange = false,
  attribute = "class",
}: ThemeProviderProps) {
  const fallbackTheme = normalizeTheme(defaultTheme, enableSystem);
  const [theme, setThemeState] = React.useState<Theme>(fallbackTheme);
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>(() =>
    fallbackTheme === "system" ? getSystemTheme() : fallbackTheme
  );

  React.useEffect(() => {
    const storedTheme =
      typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_KEY);
    const nextTheme = isTheme(storedTheme) ? storedTheme : fallbackTheme;
    setThemeState(normalizeTheme(nextTheme, enableSystem));
  }, [enableSystem, fallbackTheme]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(MEDIA_QUERY);

    const updateResolvedTheme = () => {
      const nextResolvedTheme =
        theme === "system" ? getSystemTheme() : theme;

      setResolvedTheme(nextResolvedTheme);
      applyTheme(attribute, nextResolvedTheme, disableTransitionOnChange);
    };

    updateResolvedTheme();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateResolvedTheme);

      return () => mediaQuery.removeEventListener("change", updateResolvedTheme);
    }

    mediaQuery.addListener(updateResolvedTheme);

    return () => mediaQuery.removeListener(updateResolvedTheme);
  }, [attribute, disableTransitionOnChange, theme]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = React.useCallback(
    (nextTheme: Theme) => {
      setThemeState(normalizeTheme(nextTheme, enableSystem));
    },
    [enableSystem]
  );

  const value = React.useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [resolvedTheme, setTheme, theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
