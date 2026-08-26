import React, { createContext, useContext, useMemo, useState } from 'react';
import { boardThemes, defaultBoardTheme, BoardTheme } from './boardThemes';
import { stoneThemes, defaultStoneTheme, StoneTheme } from './stoneThemes';

interface ThemeState {
  board: BoardTheme;
  stones: StoneTheme;
  setBoardTheme: (id: string) => void;
  setStoneTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [boardId, setBoardId] = useState(defaultBoardTheme);
  const [stoneId, setStoneId] = useState(defaultStoneTheme);
  const value = useMemo(
    () => ({
      board: boardThemes[boardId] ?? boardThemes[defaultBoardTheme],
      stones: stoneThemes[stoneId] ?? stoneThemes[defaultStoneTheme],
      setBoardTheme: setBoardId,
      setStoneTheme: setStoneId,
    }),
    [boardId, stoneId]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
