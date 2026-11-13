"use client";

import { createContext, useContext } from "react";

/** Public page effects (intro/promotion) wait for the first-entry declaration. */
export const AgeDeclarationContext = createContext(false);
export function useAgeDeclared() { return useContext(AgeDeclarationContext); }
