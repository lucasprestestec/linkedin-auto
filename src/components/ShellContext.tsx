"use client";

import { createContext, useContext } from "react";
import type { ShellData } from "@/lib/shell";

const ShellContext = createContext<ShellData>({
  ownerName: null,
  automationPaused: true,
  needYou: [],
  needYouCount: 0,
});

export const ShellProvider = ShellContext.Provider;

export function useShell() {
  return useContext(ShellContext);
}
