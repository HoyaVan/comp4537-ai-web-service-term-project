import React, { createContext, useContext } from 'react';

type AppContextValue = { appName: string };
const AppContext = createContext<AppContextValue>({ appName: 'App' });
export const useAppContext = () => useContext(AppContext);
export function AppProvider({ children }: { children: React.ReactNode }) {
  return <AppContext.Provider value={{ appName: 'App' }}>{children}</AppContext.Provider>;
}
