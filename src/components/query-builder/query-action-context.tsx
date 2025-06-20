import { QueryState } from "./types";
import { createContext, useContext, ReactNode } from "react";

interface QueryActionContextValue {
  onSaveQuery: () => Promise<void>;
  onCreateQuery: (query: QueryState) => void;
  onExecuteQuery: (query: QueryState, forceRefresh?: boolean) => void;
  onFetchNextPage: () => Promise<void>;
}

const QueryActionContext = createContext<QueryActionContextValue | null>(null);

export function QueryActionProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: QueryActionContextValue;
}) {
  return (
    <QueryActionContext.Provider value={value}>
      {children}
    </QueryActionContext.Provider>
  );
}

export function useQueryAction() {
  const context = useContext(QueryActionContext);
  if (!context) {
    throw new Error("useQueryAction must be used within QueryActionProvider");
  }
  return context;
}
