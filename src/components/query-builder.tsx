"use client";

import React, { useState } from "react";
import { PlusCircle, Trash2, Play } from "lucide-react";
import {
  collection,
  collectionGroup,
  getDocs,
  query,
  where,
  orderBy as firestoreOrderBy,
  limit as firestoreLimit,
  QuerySnapshot,
  DocumentData,
  Firestore,
  WhereFilterOp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Query Type Options
type QueryType = "collection" | "collectionGroup";

// Query Operators
type WhereOperator =
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
type OrderDirection = "asc" | "desc";

// Where Clause
interface WhereClause {
  field: string;
  operator: WhereOperator;
  value: string;
}

// Order By Clause
interface OrderByClause {
  field: string;
  direction: OrderDirection;
}

// Query Options
interface QueryOptions {
  where: {
    enabled: boolean;
    clauses: WhereClause[];
  };
  orderBy: {
    enabled: boolean;
    clause: OrderByClause;
  };
  limit: {
    enabled: boolean;
    value: string;
  };
  sum: {
    enabled: boolean;
    field: string;
  };
  count: {
    enabled: boolean;
  };
}

export function QueryBuilder() {
  // State for query type and path
  const [queryType, setQueryType] = useState<QueryType>("collection");
  const [path, setPath] = useState("");

  // State for query options
  const [queryOptions, setQueryOptions] = useState<QueryOptions>({
    where: {
      enabled: false,
      clauses: [{ field: "", operator: "==", value: "" }],
    },
    orderBy: {
      enabled: false,
      clause: { field: "", direction: "asc" },
    },
    limit: {
      enabled: false,
      value: "",
    },
    sum: {
      enabled: false,
      field: "",
    },
    count: {
      enabled: false,
    },
  });

  // State for query results and loading state
  const [queryResult, setQueryResult] = useState<DocumentData[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add new where clause
  const addWhereClause = () => {
    setQueryOptions((prev) => ({
      ...prev,
      where: {
        ...prev.where,
        clauses: [
          ...prev.where.clauses,
          { field: "", operator: "==", value: "" },
        ],
      },
    }));
  };

  // Update where clause
  const updateWhereClause = (
    index: number,
    key: keyof WhereClause,
    value: string
  ) => {
    setQueryOptions((prev) => {
      const newWhereClauses = [...prev.where.clauses];
      newWhereClauses[index] = {
        ...newWhereClauses[index],
        [key]: value,
      };
      return {
        ...prev,
        where: {
          ...prev.where,
          clauses: newWhereClauses,
        },
      };
    });
  };

  // Delete where clause
  const deleteWhereClause = (index: number) => {
    setQueryOptions((prev) => ({
      ...prev,
      where: {
        ...prev.where,
        clauses: prev.where.clauses.filter((_, i) => i !== index),
      },
    }));
  };

  // Toggle query option
  const toggleQueryOption = (option: keyof QueryOptions) => {
    setQueryOptions((prev) => ({
      ...prev,
      [option]: {
        ...prev[option],
        enabled: !prev[option].enabled,
      },
    }));
  };

  // Function to build and execute the Firestore query
  const executeQuery = async () => {
    setIsLoading(true);
    setError(null);
    setQueryResult(null);

    try {
      // Validate path
      if (!path.trim()) {
        throw new Error("Path is required");
      }

      // Start building the query
      let baseQuery;
      if (queryType === "collection") {
        baseQuery = collection(db, path);
      } else {
        baseQuery = collectionGroup(db, path);
      }

      // Create an array to hold query constraints
      const constraints = [];

      // Add where clauses if enabled
      if (queryOptions.where.enabled) {
        queryOptions.where.clauses.forEach((clause) => {
          if (clause.field && clause.value) {
            // Handle array operators differently
            if (
              ["in", "not-in", "array-contains-any"].includes(clause.operator)
            ) {
              try {
                // Attempt to parse as JSON array if it's a string representing an array
                let parsedValue;
                try {
                  parsedValue = JSON.parse(clause.value);
                } catch (e) {
                  // If not valid JSON, treat as a comma-separated list
                  parsedValue = clause.value
                    .split(",")
                    .map((item) => item.trim());
                }

                // Ensure it's an array
                const arrayValue = Array.isArray(parsedValue)
                  ? parsedValue
                  : [parsedValue];
                constraints.push(
                  where(
                    clause.field,
                    clause.operator as WhereFilterOp,
                    arrayValue
                  )
                );
              } catch (e) {
                console.error("Error parsing array value:", e);
                throw new Error(
                  `Invalid value for ${clause.operator} operator. Expected an array.`
                );
              }
            } else {
              // For non-array operators, use the value directly
              constraints.push(
                where(
                  clause.field,
                  clause.operator as WhereFilterOp,
                  clause.value
                )
              );
            }
          }
        });
      }

      // Add orderBy if enabled
      if (queryOptions.orderBy.enabled && queryOptions.orderBy.clause.field) {
        constraints.push(
          firestoreOrderBy(
            queryOptions.orderBy.clause.field,
            queryOptions.orderBy.clause.direction
          )
        );
      }

      // Add limit if enabled
      if (queryOptions.limit.enabled && queryOptions.limit.value) {
        const limitValue = parseInt(queryOptions.limit.value, 10);
        if (!isNaN(limitValue) && limitValue > 0) {
          constraints.push(firestoreLimit(limitValue));
        }
      }

      // Build the final query
      const firestoreQuery = query(baseQuery, ...constraints);

      // Execute the query
      const querySnapshot = await getDocs(firestoreQuery);

      // Process the results
      const results: DocumentData[] = [];
      querySnapshot.forEach((doc) => {
        results.push({
          id: doc.id,
          path: doc.ref.path,
          ...doc.data(),
        });
      });

      // Handle "count" option
      if (queryOptions.count.enabled) {
        setQueryResult([{ count: querySnapshot.size }]);
      }
      // Handle "sum" option
      else if (queryOptions.sum.enabled && queryOptions.sum.field) {
        const sum = results.reduce((acc, doc) => {
          const value = doc[queryOptions.sum.field];
          return acc + (typeof value === "number" ? value : 0);
        }, 0);
        setQueryResult([{ sum }]);
      }
      // Otherwise return all documents
      else {
        setQueryResult(results);
      }
    } catch (err) {
      console.error("Error executing query:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 bg-white rounded-lg shadow-sm">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Query Builder</h2>
          <p className="text-sm text-gray-500">
            Build and execute Firestore queries
          </p>
        </div>
        <Button
          size="icon"
          className="h-9 w-9 rounded-full"
          title="Execute Query"
          onClick={executeQuery}
          disabled={isLoading}
        >
          <Play className={`h-4 w-4 ${isLoading ? "opacity-50" : ""}`} />
          <span className="sr-only">Execute Query</span>
        </Button>
      </div>

      <div className="space-y-4">
        {/* Query Type Selection */}
        <div className="space-y-2">
          <Label className="inline-block text-md mb-4">Query Type</Label>
          <RadioGroup
            value={queryType}
            onValueChange={(value: QueryType) => setQueryType(value)}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="collection" id="collection" />
              <Label htmlFor="collection">Collection</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="collectionGroup" id="collectionGroup" />
              <Label htmlFor="collectionGroup">Collection Group</Label>
            </div>
          </RadioGroup>
        </div>

        {/* Path Input */}
        <div className="space-y-2">
          <Label htmlFor="path">Path</Label>
          <Input
            id="path"
            className="max-w-lg"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder={
              queryType === "collection" ? "users/user123/posts" : "posts"
            }
          />
        </div>

        {/* Query Options */}
        <div className="space-y-4">
          <h3 className="font-medium">Query Options</h3>

          {/* Where Clause */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="where-option"
                checked={queryOptions.where.enabled}
                onCheckedChange={() => toggleQueryOption("where")}
              />
              <Label htmlFor="where-option">Where</Label>
            </div>

            {queryOptions.where.enabled && (
              <div className="pl-6 space-y-3 max-w-xl">
                <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                  {queryOptions.where.clauses.map((clause, index) => (
                    <React.Fragment key={index}>
                      <Input
                        placeholder="Field"
                        value={clause.field}
                        onChange={(e) =>
                          updateWhereClause(index, "field", e.target.value)
                        }
                      />
                      <Select
                        value={clause.operator}
                        onValueChange={(value) =>
                          updateWhereClause(
                            index,
                            "operator",
                            value as WhereOperator
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Operator" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="==">==</SelectItem>
                          <SelectItem value="!=">!=</SelectItem>
                          <SelectItem value="<">&lt;</SelectItem>
                          <SelectItem value="<=">&lt;=</SelectItem>
                          <SelectItem value=">">&gt;</SelectItem>
                          <SelectItem value=">=">&gt;=</SelectItem>
                          <SelectItem value="array-contains">
                            array-contains
                          </SelectItem>
                          <SelectItem value="array-contains-any">
                            array-contains-any
                          </SelectItem>
                          <SelectItem value="in">in</SelectItem>
                          <SelectItem value="not-in">not-in</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Value"
                        value={clause.value}
                        onChange={(e) =>
                          updateWhereClause(index, "value", e.target.value)
                        }
                      />
                      {index > 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteWhereClause(index)}
                          className="h-10 w-10 flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete clause</span>
                        </Button>
                      ) : (
                        <div className="w-10"></div> // Empty placeholder for the first row
                      )}
                    </React.Fragment>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addWhereClause}
                  className="flex items-center gap-1 mt-2"
                >
                  <PlusCircle className="h-4 w-4" /> Add Clause
                </Button>
              </div>
            )}
          </div>

          {/* Order By */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="orderby-option"
                checked={queryOptions.orderBy.enabled}
                onCheckedChange={() => toggleQueryOption("orderBy")}
              />
              <Label htmlFor="orderby-option">Order By</Label>
            </div>

            {queryOptions.orderBy.enabled && (
              <div className="pl-6 flex space-x-2 max-w-xl">
                <Input
                  placeholder="Field"
                  value={queryOptions.orderBy.clause.field}
                  onChange={(e) =>
                    setQueryOptions((prev) => ({
                      ...prev,
                      orderBy: {
                        ...prev.orderBy,
                        clause: {
                          ...prev.orderBy.clause,
                          field: e.target.value,
                        },
                      },
                    }))
                  }
                />
                <Select
                  value={queryOptions.orderBy.clause.direction}
                  onValueChange={(value) =>
                    setQueryOptions((prev) => ({
                      ...prev,
                      orderBy: {
                        ...prev.orderBy,
                        clause: {
                          ...prev.orderBy.clause,
                          direction: value as OrderDirection,
                        },
                      },
                    }))
                  }
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Direction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Limit */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="limit-option"
                checked={queryOptions.limit.enabled}
                onCheckedChange={() => toggleQueryOption("limit")}
              />
              <Label htmlFor="limit-option">Limit</Label>
            </div>

            {queryOptions.limit.enabled && (
              <div className="pl-6 max-w-xl">
                <Input
                  type="number"
                  placeholder="Number of documents"
                  value={queryOptions.limit.value}
                  onChange={(e) =>
                    setQueryOptions((prev) => ({
                      ...prev,
                      limit: { ...prev.limit, value: e.target.value },
                    }))
                  }
                />
              </div>
            )}
          </div>

          {/* Sum */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sum-option"
                checked={queryOptions.sum.enabled}
                onCheckedChange={() => toggleQueryOption("sum")}
              />
              <Label htmlFor="sum-option">Sum</Label>
            </div>

            {queryOptions.sum.enabled && (
              <div className="pl-6 max-w-xl">
                <Input
                  placeholder="Field to sum"
                  value={queryOptions.sum.field}
                  onChange={(e) =>
                    setQueryOptions((prev) => ({
                      ...prev,
                      sum: { ...prev.sum, field: e.target.value },
                    }))
                  }
                />
              </div>
            )}
          </div>

          {/* Count */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="count-option"
              checked={queryOptions.count.enabled}
              onCheckedChange={() => toggleQueryOption("count")}
            />
            <Label htmlFor="count-option">Count</Label>
          </div>
        </div>
      </div>

      {/* Results display */}
      {isLoading && (
        <div className="mt-4 p-4 border rounded bg-gray-50">
          <p className="text-center text-gray-500">Executing query...</p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 border rounded bg-red-50">
          <p className="text-red-500">{error}</p>
        </div>
      )}

      {queryResult && !isLoading && !error && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Results ({queryResult.length})</h3>
          </div>
          <div className="border rounded overflow-auto max-h-80">
            {queryResult.length > 0 ? (
              <pre className="p-4 text-sm font-mono overflow-x-auto">
                {JSON.stringify(queryResult, null, 2)}
              </pre>
            ) : (
              <p className="p-4 text-center text-gray-500">No results found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
