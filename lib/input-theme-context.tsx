"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type InputThemeMode = "light" | "dark";

interface InputThemeContextType {
  theme: InputThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: InputThemeMode) => void;
}

const InputThemeContext = createContext<InputThemeContextType | undefined>(undefined);

const STORAGE_KEY = "dji_input_theme";

export function InputThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<InputThemeMode>("light");
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as InputThemeMode | null;
      if (saved === "dark" || saved === "light") {
        setThemeState(saved);
      }
    } catch (e) {
      // Ignore localStorage error
    }
  }, []);

  const setTheme = useCallback((newTheme: InputThemeMode) => {
    setThemeState(newTheme);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, newTheme);
      }
    } catch (e) {}
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: InputThemeMode = prev === "light" ? "dark" : "light";
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, next);
        }
      } catch (e) {}
      return next;
    });
  }, []);

  const isDark = mounted && theme === "dark";

  return (
    <InputThemeContext.Provider
      value={{
        theme,
        isDark,
        toggleTheme,
        setTheme,
      }}
    >
      <div className={`w-full transition-colors duration-300 ${isDark ? "dji-dark-input dark" : "dji-light-input"}`}>
        {children}
      </div>
    </InputThemeContext.Provider>
  );
}

export function useInputTheme(): InputThemeContextType {
  const context = useContext(InputThemeContext);
  if (!context) {
    return {
      theme: "light",
      isDark: false,
      toggleTheme: () => {},
      setTheme: () => {},
    };
  }
  return context;
}
