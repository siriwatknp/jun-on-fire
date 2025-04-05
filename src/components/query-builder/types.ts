// Query Type Options
export type QueryType = "collection" | "collectionGroup";

// Query Operators
export type WhereOperator =
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "array-contains"
  | "array-contains-any"
  | "in"
  | "not-in";

// Order Direction
export type OrderDirection = "asc" | "desc";

// Value Type for Where Clause
export type ValueType = "string" | "number" | "boolean" | "null" | "timestamp";

// Where Clause
export interface WhereClause {
  field: string;
  operator: WhereOperator;
  value: string;
  valueType: ValueType;
}

// Define the unified query state schema
export interface QueryState {
  // Metadata
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;

  // Source configuration
  source: {
    type: QueryType;
    path: string;
  };

  // Query constraints
  constraints: {
    where: {
      enabled: boolean;
      clauses: WhereClause[];
    };

    orderBy: {
      enabled: boolean;
      field: string;
      direction: OrderDirection;
    };

    limit: {
      enabled: boolean;
      value: number | null;
    };
  };

  // Aggregations
  aggregation: {
    count: {
      enabled: boolean;
    };
    sum: {
      enabled: boolean;
      fields: string[];
    };
    average: {
      enabled: boolean;
      fields: string[];
    };
  };
}

// Props for the QueryForm component
export interface QueryFormProps {
  query: QueryState;
  onChange: (updatedQuery: QueryState) => void;
  onExecute: (query: QueryState) => void;
  isLoading?: boolean;
}

// Helper function to create a default query state
export const createDefaultQuery = (): QueryState => ({
  id: `query-${Date.now()}`,
  title: "New Query",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  source: {
    type: "collection",
    path: "",
  },
  constraints: {
    where: {
      enabled: false,
      clauses: [{ field: "", operator: "==", value: "", valueType: "string" }],
    },
    orderBy: {
      enabled: false,
      field: "",
      direction: "asc",
    },
    limit: {
      enabled: false,
      value: null,
    },
  },
  aggregation: {
    count: {
      enabled: false,
    },
    sum: {
      enabled: false,
      fields: [],
    },
    average: {
      enabled: false,
      fields: [],
    },
  },
});
