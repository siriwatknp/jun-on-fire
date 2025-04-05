"use client";

import React from "react";
import { PlusCircle, Trash2, Play, RotateCcw } from "lucide-react";

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

import {
  QueryState,
  QueryFormProps,
  QueryType,
  WhereOperator,
  WhereClause,
  OrderDirection,
  ValueType,
} from "./types";

export function QueryForm({
  query,
  onChange,
  onExecute,
  isLoading = false,
}: QueryFormProps) {
  // Helper function to update the query
  const updateQuery = (updater: (query: QueryState) => QueryState) => {
    const updatedQuery = updater({
      ...query,
      updatedAt: Date.now(),
    });
    onChange(updatedQuery);
  };

  // Add new where clause
  const addWhereClause = () => {
    updateQuery((q) => ({
      ...q,
      constraints: {
        ...q.constraints,
        where: {
          ...q.constraints.where,
          clauses: [
            ...q.constraints.where.clauses,
            { field: "", operator: "==", value: "", valueType: "string" },
          ],
        },
      },
    }));
  };

  // Update where clause
  const updateWhereClause = (
    index: number,
    key: keyof WhereClause,
    value: string | ValueType
  ) => {
    updateQuery((q) => {
      const newClauses = [...q.constraints.where.clauses];

      if (key === "valueType") {
        // When changing value type, we might need to adjust the value
        const currentValue = newClauses[index].value;
        let newValue = currentValue;

        // Convert value based on new type
        if (value === "number" && !isNaN(Number(currentValue))) {
          newValue = currentValue;
        } else if (value === "boolean") {
          newValue = currentValue === "true" ? "true" : "false";
        } else if (value === "null") {
          newValue = "null";
        } else if (value === "timestamp") {
          // Default to current timestamp if empty or invalid
          if (!currentValue || isNaN(new Date(currentValue).getTime())) {
            const now = new Date();
            newValue = now.toISOString();
          } else {
            // If current value can be parsed as date, keep it
            newValue = currentValue;
          }
        } else if (value === "string") {
          newValue = currentValue;
        }

        newClauses[index] = {
          ...newClauses[index],
          valueType: value as ValueType,
          value: newValue,
        };
      } else {
        newClauses[index] = {
          ...newClauses[index],
          [key]: key === "operator" ? (value as WhereOperator) : value,
        };
      }

      return {
        ...q,
        constraints: {
          ...q.constraints,
          where: {
            ...q.constraints.where,
            clauses: newClauses,
          },
        },
      };
    });
  };

  // Delete where clause
  const deleteWhereClause = (index: number) => {
    updateQuery((q) => ({
      ...q,
      constraints: {
        ...q.constraints,
        where: {
          ...q.constraints.where,
          clauses: q.constraints.where.clauses.filter((_, i) => i !== index),
        },
      },
    }));
  };

  // Toggle a constraint option
  const toggleConstraint = (constraintKey: keyof typeof query.constraints) => {
    updateQuery((q) => ({
      ...q,
      constraints: {
        ...q.constraints,
        [constraintKey]: {
          ...q.constraints[constraintKey],
          enabled: !q.constraints[constraintKey].enabled,
        },
      },
    }));
  };

  // Toggle an aggregation option
  const toggleAggregation = (
    aggregationKey: keyof typeof query.aggregation
  ) => {
    updateQuery((q) => ({
      ...q,
      aggregation: {
        ...q.aggregation,
        [aggregationKey]: {
          ...q.aggregation[aggregationKey],
          enabled: !q.aggregation[aggregationKey].enabled,
        },
      },
    }));
  };

  // Check if any option is enabled
  const hasEnabledOptions = () => {
    return (
      query.constraints.where.enabled ||
      query.constraints.orderBy.enabled ||
      query.constraints.limit.enabled ||
      query.aggregation.count.enabled ||
      query.aggregation.sum.enabled ||
      query.aggregation.average.enabled
    );
  };

  // Reset all options to default state
  const resetOptions = () => {
    updateQuery((q) => ({
      ...q,
      constraints: {
        where: {
          enabled: false,
          clauses: [
            { field: "", operator: "==", value: "", valueType: "string" },
          ],
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
          field: "",
        },
        average: {
          enabled: false,
          field: "",
        },
      },
    }));
  };

  return (
    <div className="bg-white rounded-lg p-6">
      <div className="space-y-6">
        <div className="space-y-4">
          <Label className="text-sm/[1.5rem] font-medium block">
            Query Type
          </Label>
          <div className="ml-2 space-y-3">
            {/* Query Type Selection */}
            <RadioGroup
              value={query.source.type}
              onValueChange={(value: QueryType) =>
                updateQuery((q) => ({
                  ...q,
                  source: { ...q.source, type: value },
                }))
              }
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="collection" id="collection" />
                <Label htmlFor="collection" className="font-normal">
                  Collection
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="collectionGroup" id="collectionGroup" />
                <Label htmlFor="collectionGroup" className="font-normal">
                  Collection Group
                </Label>
              </div>
            </RadioGroup>
            {/* Path Input */}
            <div className="space-y-3">
              <Label htmlFor="path" className="text-sm font-medium">
                Path
              </Label>
              <Input
                id="path"
                className="max-w-lg"
                value={query.source.path}
                onChange={(e) =>
                  updateQuery((q) => ({
                    ...q,
                    source: { ...q.source, path: e.target.value },
                  }))
                }
                placeholder={
                  query.source.type === "collection"
                    ? "users/user123/posts"
                    : "posts"
                }
              />
            </div>
          </div>
        </div>

        {/* Query Options */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm/[1.5rem] font-medium ">Query Options</h3>
            {hasEnabledOptions() && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetOptions}
                className="flex h-6 px-2 text-xs items-center gap-1 text-gray-500 hover:text-gray-700"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Where Clause */}
            <div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="where-option"
                  checked={query.constraints.where.enabled}
                  onCheckedChange={() => toggleConstraint("where")}
                />
                <Label htmlFor="where-option" className="font-normal">
                  Where
                </Label>
              </div>

              {query.constraints.where.enabled && (
                <div className="pl-6 space-y-3 max-w-3xl mt-2">
                  <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2">
                    {query.constraints.where.clauses.map((clause, index) => (
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
                        <Select
                          value={clause.valueType}
                          onValueChange={(value) =>
                            updateWhereClause(
                              index,
                              "valueType",
                              value as ValueType
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="string">string</SelectItem>
                            <SelectItem value="boolean">boolean</SelectItem>
                            <SelectItem value="number">number</SelectItem>
                            <SelectItem value="timestamp">timestamp</SelectItem>
                            <SelectItem value="null">null</SelectItem>
                          </SelectContent>
                        </Select>
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
            <div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="orderby-option"
                  checked={query.constraints.orderBy.enabled}
                  onCheckedChange={() => toggleConstraint("orderBy")}
                />
                <Label htmlFor="orderby-option" className="font-normal">
                  Order By
                </Label>
              </div>

              {query.constraints.orderBy.enabled && (
                <div className="pl-6 flex space-x-2 max-w-xl mt-2">
                  <Input
                    placeholder="Field"
                    value={query.constraints.orderBy.field}
                    onChange={(e) =>
                      updateQuery((q) => ({
                        ...q,
                        constraints: {
                          ...q.constraints,
                          orderBy: {
                            ...q.constraints.orderBy,
                            field: e.target.value,
                          },
                        },
                      }))
                    }
                  />
                  <Select
                    value={query.constraints.orderBy.direction}
                    onValueChange={(value) =>
                      updateQuery((q) => ({
                        ...q,
                        constraints: {
                          ...q.constraints,
                          orderBy: {
                            ...q.constraints.orderBy,
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
            <div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="limit-option"
                  checked={query.constraints.limit.enabled}
                  onCheckedChange={() => toggleConstraint("limit")}
                />
                <Label htmlFor="limit-option" className="font-normal">
                  Limit
                </Label>
              </div>

              {query.constraints.limit.enabled && (
                <div className="pl-6 max-w-xl mt-2">
                  <Input
                    type="number"
                    placeholder="Number of documents"
                    value={query.constraints.limit.value?.toString() || ""}
                    onChange={(e) =>
                      updateQuery((q) => ({
                        ...q,
                        constraints: {
                          ...q.constraints,
                          limit: {
                            ...q.constraints.limit,
                            value: e.target.value
                              ? parseInt(e.target.value, 10)
                              : null,
                          },
                        },
                      }))
                    }
                  />
                </div>
              )}
            </div>

            {/* Sum */}
            <div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sum-option"
                  checked={query.aggregation.sum.enabled}
                  onCheckedChange={() => toggleAggregation("sum")}
                />
                <Label htmlFor="sum-option" className="font-normal">
                  Sum
                </Label>
              </div>

              {query.aggregation.sum.enabled && (
                <div className="pl-6 max-w-xl mt-2">
                  <Input
                    placeholder="Field to sum"
                    value={query.aggregation.sum.field}
                    onChange={(e) =>
                      updateQuery((q) => ({
                        ...q,
                        aggregation: {
                          ...q.aggregation,
                          sum: {
                            ...q.aggregation.sum,
                            field: e.target.value,
                          },
                        },
                      }))
                    }
                  />
                </div>
              )}
            </div>

            {/* Average */}
            <div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="average-option"
                  checked={query.aggregation.average.enabled}
                  onCheckedChange={() => toggleAggregation("average")}
                />
                <Label htmlFor="average-option" className="font-normal">
                  Average
                </Label>
              </div>

              {query.aggregation.average.enabled && (
                <div className="pl-6 max-w-xl mt-2">
                  <Input
                    placeholder="Field to average"
                    value={query.aggregation.average.field}
                    onChange={(e) =>
                      updateQuery((q) => ({
                        ...q,
                        aggregation: {
                          ...q.aggregation,
                          average: {
                            ...q.aggregation.average,
                            field: e.target.value,
                          },
                        },
                      }))
                    }
                  />
                </div>
              )}
            </div>

            {/* Count */}
            <div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="count-option"
                  checked={query.aggregation.count.enabled}
                  onCheckedChange={() => toggleAggregation("count")}
                />
                <Label htmlFor="count-option" className="font-normal">
                  Count
                </Label>
              </div>
            </div>
          </div>
        </div>

        {/* Execute Query Button */}
        <div className="pt-4">
          <Button
            variant="default"
            onClick={() => onExecute(query)}
            disabled={isLoading}
            className="bg-black text-white hover:bg-black/90 flex items-center gap-2"
          >
            <Play className={`h-4 w-4 ${isLoading ? "opacity-50" : ""}`} />
            Execute Query
          </Button>
        </div>
      </div>
    </div>
  );
}
