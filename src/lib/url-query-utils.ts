import { QueryState, WhereClause, ValueType } from "@/components/query-builder/types";

/**
 * Convert QueryState to URL parameters
 * Only includes non-default values to keep URLs clean
 */
export function queryStateToURLParams(query: QueryState): URLSearchParams {
  const params = new URLSearchParams();

  // Source
  if (query.source.path) {
    params.set("path", query.source.path);
  }
  if (query.source.type !== "collection") {
    params.set("type", query.source.type === "collectionGroup" ? "group" : query.source.type);
  }

  // Where clauses
  if (query.constraints.where.enabled && query.constraints.where.clauses.length > 0) {
    const validClauses = query.constraints.where.clauses
      .filter(clause => clause.field && clause.value !== undefined && clause.value !== "")
      .map(clause => formatWhereClause(clause));
    
    if (validClauses.length > 0) {
      params.set("where", validClauses.join(","));
    }
  }

  // OrderBy
  if (query.constraints.orderBy.enabled && query.constraints.orderBy.field) {
    params.set("orderBy", `${query.constraints.orderBy.field}:${query.constraints.orderBy.direction}`);
  }

  // Limit
  if (query.constraints.limit.enabled && query.constraints.limit.value) {
    params.set("limit", query.constraints.limit.value.toString());
  }

  // Aggregations
  if (query.aggregation.count.enabled) {
    params.set("count", "true");
  }
  if (query.aggregation.sum.enabled && query.aggregation.sum.fields.length > 0) {
    const validFields = query.aggregation.sum.fields.filter(f => f.trim());
    if (validFields.length > 0) {
      params.set("sum", validFields.join(","));
    }
  }
  if (query.aggregation.average.enabled && query.aggregation.average.fields.length > 0) {
    const validFields = query.aggregation.average.fields.filter(f => f.trim());
    if (validFields.length > 0) {
      params.set("avg", validFields.join(","));
    }
  }

  return params;
}

/**
 * Parse URL parameters to partial QueryState
 */
export function urlParamsToQueryState(params: URLSearchParams): Partial<QueryState> {
  const result: Partial<QueryState> = {};

  // Parse source
  const path = params.get("path");
  const type = params.get("type");
  
  if (path) {
    result.source = {
      path,
      type: type === "group" ? "collectionGroup" : "collection"
    };
  }

  // Parse constraints
  result.constraints = {
    where: { enabled: false, clauses: [] },
    orderBy: { enabled: false, field: "", direction: "asc" },
    limit: { enabled: false, value: null }
  };

  // Parse where clauses
  const whereParam = params.get("where");
  if (whereParam) {
    const clauses = whereParam.split(",").map(clause => {
      try {
        return parseWhereClause(clause);
      } catch {
        return null;
      }
    }).filter(Boolean) as WhereClause[];

    if (clauses.length > 0) {
      result.constraints.where = {
        enabled: true,
        clauses
      };
    }
  }

  // Parse orderBy
  const orderByParam = params.get("orderBy");
  if (orderByParam) {
    const [field, direction] = orderByParam.split(":");
    if (field) {
      result.constraints.orderBy = {
        enabled: true,
        field,
        direction: (direction === "desc" ? "desc" : "asc") as "asc" | "desc"
      };
    }
  }

  // Parse limit
  const limitParam = params.get("limit");
  if (limitParam) {
    const limitValue = parseInt(limitParam, 10);
    if (!isNaN(limitValue) && limitValue > 0) {
      result.constraints.limit = {
        enabled: true,
        value: limitValue
      };
    }
  }

  // Parse aggregations
  result.aggregation = {
    count: { enabled: false },
    sum: { enabled: false, fields: [] },
    average: { enabled: false, fields: [] }
  };

  if (params.get("count") === "true") {
    result.aggregation.count = { enabled: true };
  }

  const sumParam = params.get("sum");
  if (sumParam) {
    const fields = sumParam.split(",").map(f => f.trim()).filter(Boolean);
    if (fields.length > 0) {
      result.aggregation.sum = { enabled: true, fields };
    }
  }

  const avgParam = params.get("avg");
  if (avgParam) {
    const fields = avgParam.split(",").map(f => f.trim()).filter(Boolean);
    if (fields.length > 0) {
      result.aggregation.average = { enabled: true, fields };
    }
  }

  return result;
}

/**
 * Format a where clause for URL
 * Format: field:operator:value:valueType
 */
export function formatWhereClause(clause: WhereClause): string {
  // Encode the value to handle special characters
  const encodedValue = encodeURIComponent(clause.value);
  
  // Only include valueType if it's not string (the default)
  if (clause.valueType !== "string") {
    return `${clause.field}:${clause.operator}:${encodedValue}:${clause.valueType}`;
  }
  
  return `${clause.field}:${clause.operator}:${encodedValue}`;
}

/**
 * Parse a where clause from URL format
 */
export function parseWhereClause(str: string): WhereClause {
  const parts = str.split(":");
  
  if (parts.length < 3) {
    throw new Error("Invalid where clause format");
  }

  const field = parts[0];
  const operator = parts[1];
  const encodedValue = parts[2];
  const valueType = (parts[3] as ValueType) || "string";

  // Decode the value
  const value = decodeURIComponent(encodedValue);

  // Validate operator
  const validOperators = ["==", "!=", "<", "<=", ">", ">=", "array-contains", "array-contains-any", "in", "not-in"];
  if (!validOperators.includes(operator)) {
    throw new Error(`Invalid operator: ${operator}`);
  }

  return {
    field,
    operator: operator as WhereClause["operator"],
    value,
    valueType
  };
}

/**
 * Merge URL query state with defaults
 * This ensures all required fields are present
 */
export function mergeWithDefaults(
  urlQuery: Partial<QueryState>,
  defaultQuery: QueryState
): QueryState {
  return {
    ...defaultQuery,
    source: {
      ...defaultQuery.source,
      ...urlQuery.source
    },
    constraints: {
      where: urlQuery.constraints?.where || defaultQuery.constraints.where,
      orderBy: urlQuery.constraints?.orderBy || defaultQuery.constraints.orderBy,
      limit: urlQuery.constraints?.limit || defaultQuery.constraints.limit
    },
    aggregation: {
      count: urlQuery.aggregation?.count || defaultQuery.aggregation.count,
      sum: urlQuery.aggregation?.sum || defaultQuery.aggregation.sum,
      average: urlQuery.aggregation?.average || defaultQuery.aggregation.average
    }
  };
}