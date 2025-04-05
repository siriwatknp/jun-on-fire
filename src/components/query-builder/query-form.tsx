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
            { field: "", operator: "==", value: "" },
          ],
        },
      },
    }));
  };

  // Update where clause
  const updateWhereClause = (
    index: number,
    key: keyof WhereClause,
    value: string
  ) => {
    updateQuery((q) => {
      const newClauses = [...q.constraints.where.clauses];
      newClauses[index] = {
        ...newClauses[index],
        [key]: key === "operator" ? (value as WhereOperator) : value,
      };

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
        // Disable all other aggregations when enabling one
        count: {
          enabled:
            aggregationKey === "count" ? !q.aggregation.count.enabled : false,
        },
        sum: {
          ...q.aggregation.sum,
          enabled:
            aggregationKey === "sum" ? !q.aggregation.sum.enabled : false,
        },
        average: {
          ...q.aggregation.average,
          enabled:
            aggregationKey === "average"
              ? !q.aggregation.average.enabled
              : false,
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
          clauses: [{ field: "", operator: "==", value: "" }],
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
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* Query title input */}
      <div className="flex gap-2 items-center mb-6">
        <Input
          value={query.title}
          onChange={(e) =>
            updateQuery((q) => ({ ...q, title: e.target.value }))
          }
          className="h-10 text-base"
          placeholder="Query Title"
        />
      </div>

      <div className="space-y-6">
        {/* Query Type Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Query Type</Label>
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
        </div>

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

        {/* Query Options */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium">Query Options</h3>
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

          <div className="grid grid-cols-1 gap-2">
            {/* Where Clause */}
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

            {/* Order By */}
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

            {/* Limit */}
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

            {/* Sum */}
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

            {/* Average */}
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

            {/* Count */}
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

          {/* Where Clause Content */}
          {query.constraints.where.enabled && (
            <div className="pl-6 space-y-3 max-w-xl mt-2">
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
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

          {/* Order By Content */}
          {query.constraints.orderBy.enabled && (
            <div className="pl-6 flex space-x-2 max-w-xl">
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

          {/* Limit Content */}
          {query.constraints.limit.enabled && (
            <div className="pl-6 max-w-xl">
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

          {/* Sum Content */}
          {query.aggregation.sum.enabled && (
            <div className="pl-6 max-w-xl">
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

          {/* Average Content */}
          {query.aggregation.average.enabled && (
            <div className="pl-6 max-w-xl">
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
