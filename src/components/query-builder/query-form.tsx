"use client";

import React, { useMemo } from "react";
import { PlusCircle, Trash2, Play, RotateCcw, Plus } from "lucide-react";
import { fieldMetadata } from "@/schema";
import { useQueryAction } from "./query-action-context";

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  QueryState,
  QueryType,
  WhereOperator,
  WhereClause,
  OrderDirection,
  ValueType,
} from "./types";
import { FieldSuggestions } from "./field-suggestions";
import { PathSuggestions } from "./path-suggestions";

interface QueryFormProps {
  query: QueryState;
  onChange: (query: QueryState) => void;
  isLoading: boolean;
}

export function QueryForm({ query, onChange, isLoading }: QueryFormProps) {
  const { onExecuteQuery } = useQueryAction();
  const [showNoLimitDialog, setShowNoLimitDialog] = React.useState(false);

  // Helper function to extract entity type from path
  const getEntityTypeFromPath = (
    path: string,
    queryType: QueryType
  ): string | null => {
    if (!path) return null;

    // For collection group, the path is just the collection name
    if (queryType === "collectionGroup") {
      return fieldMetadata[path] ? path : null;
    }

    // For collection, extract the last segment of the path
    if (queryType === "collection") {
      const segments = path.split("/");
      const lastSegment = segments[segments.length - 1];
      return fieldMetadata[lastSegment] ? lastSegment : null;
    }

    return null;
  };

  // Helper function to get field type from metadata
  const getFieldTypeFromMetadata = (
    fieldName: string,
    entityType: string | null
  ): ValueType => {
    if (!entityType || !fieldName) return "string";

    const entityMetadata = fieldMetadata[entityType];
    if (!entityMetadata || !entityMetadata[fieldName]) return "string";

    const fieldType = entityMetadata[fieldName].type;

    // Map schema type to ValueType
    if (
      fieldType === "number" ||
      fieldType === "boolean" ||
      fieldType === "timestamp" ||
      fieldType === "null"
    ) {
      return fieldType as ValueType;
    }

    return "string";
  };

  // Determine the current entity type based on the path
  const currentEntityType = useMemo(() => {
    return getEntityTypeFromPath(query.source.path, query.source.type);
  }, [query.source.path, query.source.type]);

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

          // Reset operator to equality if it's currently a relational operator
          const currentOperator = newClauses[index].operator;
          if (["<", "<=", ">", ">="].includes(currentOperator)) {
            newClauses[index].operator = "==" as WhereOperator;
          }
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
      } else if (key === "field") {
        // Auto-update valueType based on schema metadata when field is selected
        if (currentEntityType && value) {
          const fieldName = value as string;
          const valueType = getFieldTypeFromMetadata(
            fieldName,
            currentEntityType
          );

          // Apply the detected type
          newClauses[index] = {
            ...newClauses[index],
            field: fieldName,
            valueType: valueType,
            // If the type changed, update the value too for consistency
            value:
              valueType === newClauses[index].valueType
                ? newClauses[index].value
                : "",
          };

          // Reset operator to equality if it's null with relational operator
          if (
            valueType === "null" &&
            ["<", "<=", ">", ">="].includes(newClauses[index].operator)
          ) {
            newClauses[index].operator = "==" as WhereOperator;
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
        }

        // If no type found in schema, just update the field name normally
        newClauses[index] = {
          ...newClauses[index],
          [key]: value,
        };
      } else if (key === "value") {
        // Auto-detect value type based on input
        const inputValue = value as string;
        let detectedType: ValueType = newClauses[index].valueType;

        // Check for null
        if (inputValue === "null") {
          detectedType = "null";

          // Reset operator to equality if it's currently a relational operator
          const currentOperator = newClauses[index].operator;
          if (["<", "<=", ">", ">="].includes(currentOperator)) {
            newClauses[index].operator = "==" as WhereOperator;
          }
        }
        // Check for boolean
        else if (inputValue === "true" || inputValue === "false") {
          detectedType = "boolean";
        }
        // Check for number - if it's a valid number and doesn't start with unnecessary zeros
        else if (
          !isNaN(Number(inputValue)) &&
          (inputValue === "" ||
            (!/^0[0-9]+/.test(inputValue) && /^-?\d*\.?\d*$/.test(inputValue)))
        ) {
          detectedType = "number";
        }
        // Check for date/timestamp - test for ISO format or common date formats
        else if (
          /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?(\.\d{1,3})?([+-]\d{2}:?\d{2}|Z)?)?$/.test(
            inputValue
          ) &&
          !isNaN(new Date(inputValue).getTime())
        ) {
          detectedType = "timestamp";
        }
        // Default to string for everything else
        else {
          detectedType = "string";
        }

        newClauses[index] = {
          ...newClauses[index],
          value: inputValue,
          // Only update valueType if it's detected as something different
          valueType: detectedType,
        };
      } else if (key === "operator") {
        // If setting a relational operator but the valueType is null, prevent it
        if (
          ["<", "<=", ">", ">="].includes(value as string) &&
          newClauses[index].valueType === "null"
        ) {
          // Don't change the operator
          return q;
        }

        newClauses[index] = {
          ...newClauses[index],
          operator: value as WhereOperator,
        };
      } else {
        newClauses[index] = {
          ...newClauses[index],
          [key]: value,
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
    updateQuery((q) => {
      // Don't allow deleting the last clause
      if (q.constraints.where.clauses.length <= 1) {
        return q;
      }

      return {
        ...q,
        constraints: {
          ...q.constraints,
          where: {
            ...q.constraints.where,
            clauses: q.constraints.where.clauses.filter((_, i) => i !== index),
          },
        },
      };
    });
  };

  // Toggle a constraint option
  const toggleConstraint = (constraintKey: keyof typeof query.constraints) => {
    updateQuery((q) => {
      const newState = {
        ...q,
        constraints: {
          ...q.constraints,
          [constraintKey]: {
            ...q.constraints[constraintKey],
            enabled: !q.constraints[constraintKey].enabled,
          },
        },
      };

      // Initialize with at least one empty where clause when enabling
      if (
        constraintKey === "where" &&
        !q.constraints[constraintKey].enabled &&
        q.constraints[constraintKey].clauses.length === 0
      ) {
        newState.constraints[constraintKey].clauses = [
          { field: "", operator: "==", value: "", valueType: "string" },
        ];
      }

      return newState;
    });
  };

  // Add a field to sum aggregation
  const addSumField = () => {
    updateQuery((q) => ({
      ...q,
      aggregation: {
        ...q.aggregation,
        sum: {
          ...q.aggregation.sum,
          fields: [...q.aggregation.sum.fields, ""],
        },
      },
    }));
  };

  // Remove a field from sum aggregation
  const removeSumField = (index: number) => {
    updateQuery((q) => ({
      ...q,
      aggregation: {
        ...q.aggregation,
        sum: {
          ...q.aggregation.sum,
          fields: q.aggregation.sum.fields.filter((_, i) => i !== index),
        },
      },
    }));
  };

  // Update a sum field
  const updateSumField = (index: number, value: string) => {
    updateQuery((q) => {
      const newFields = [...q.aggregation.sum.fields];

      // For numeric aggregations, validate that the field has a number type
      if (value && currentEntityType) {
        const fieldType = getFieldTypeFromMetadata(value, currentEntityType);

        // Display a warning or provide visual feedback if the field isn't a number
        if (fieldType !== "number") {
          console.warn(
            `Field '${value}' might not be a numeric field. Sum operation may not work as expected.`
          );
          // We still allow it, as Firestore might convert the field
        }
      }

      newFields[index] = value;
      return {
        ...q,
        aggregation: {
          ...q.aggregation,
          sum: {
            ...q.aggregation.sum,
            fields: newFields,
          },
        },
      };
    });
  };

  // Add a field to average aggregation
  const addAverageField = () => {
    updateQuery((q) => ({
      ...q,
      aggregation: {
        ...q.aggregation,
        average: {
          ...q.aggregation.average,
          fields: [...q.aggregation.average.fields, ""],
        },
      },
    }));
  };

  // Remove a field from average aggregation
  const removeAverageField = (index: number) => {
    updateQuery((q) => ({
      ...q,
      aggregation: {
        ...q.aggregation,
        average: {
          ...q.aggregation.average,
          fields: q.aggregation.average.fields.filter((_, i) => i !== index),
        },
      },
    }));
  };

  // Update an average field
  const updateAverageField = (index: number, value: string) => {
    updateQuery((q) => {
      const newFields = [...q.aggregation.average.fields];

      // For numeric aggregations, validate that the field has a number type
      if (value && currentEntityType) {
        const fieldType = getFieldTypeFromMetadata(value, currentEntityType);

        // Display a warning or provide visual feedback if the field isn't a number
        if (fieldType !== "number") {
          console.warn(
            `Field '${value}' might not be a numeric field. Average operation may not work as expected.`
          );
          // We still allow it, as Firestore might convert the field
        }
      }

      newFields[index] = value;
      return {
        ...q,
        aggregation: {
          ...q.aggregation,
          average: {
            ...q.aggregation.average,
            fields: newFields,
          },
        },
      };
    });
  };

  // Toggle an aggregation option
  const toggleAggregation = (
    aggregationKey: keyof typeof query.aggregation
  ) => {
    updateQuery((q) => {
      const newState = {
        ...q,
        aggregation: {
          ...q.aggregation,
          [aggregationKey]: {
            ...q.aggregation[aggregationKey],
            enabled: !q.aggregation[aggregationKey].enabled,
          },
        },
      };

      // Initialize with at least one empty field when enabling
      if (
        (aggregationKey === "sum" || aggregationKey === "average") &&
        !q.aggregation[aggregationKey].enabled &&
        q.aggregation[aggregationKey].fields.length === 0
      ) {
        newState.aggregation[aggregationKey].fields = [""];
      }

      return newState;
    });
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
          fields: [],
        },
        average: {
          enabled: false,
          fields: [],
        },
      },
    }));
  };

  const handleExecuteClick = () => {
    if (!query.constraints.limit.enabled) {
      setShowNoLimitDialog(true);
    } else {
      onExecuteQuery(query);
    }
  };

  return (
    <div className="bg-white pl-2 rounded-lg h-full overflow-y-auto">
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
            {/* Path Input - use PathSuggestions */}
            <div className="space-y-3">
              <Label htmlFor="path" className="text-sm font-medium">
                Path
              </Label>
              <PathSuggestions
                value={query.source.path}
                onChange={(value) =>
                  updateQuery((q) => ({
                    ...q,
                    source: { ...q.source, path: value },
                  }))
                }
                queryType={query.source.type}
                className="max-w-md"
                inputProps={{ id: "path" }}
              />
              {query.source.path &&
              getEntityTypeFromPath(query.source.path, query.source.type) ? (
                <p className="text-xs text-green-600">
                  ✓ Found schema for entity type &quot;{currentEntityType}&quot;
                  - field suggestions enabled
                </p>
              ) : query.source.path ? (
                <p className="text-xs text-amber-600">
                  ⚠ No schema found for this path - field suggestions
                  unavailable
                </p>
              ) : (
                <p className="text-xs text-gray-500">
                  Enter a path to enable field suggestions (e.g.,
                  &quot;posts&quot; or &quot;users/user123/posts&quot;)
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Query Options */}
        <div className="space-y-4">
          <div className="flex gap-1">
            <h3 className="text-sm/[1.5rem] font-medium ">Query Options</h3>
            {hasEnabledOptions() && (
              <Button
                variant="ghost"
                size="xs"
                onClick={resetOptions}
                className="flex gap-1 text-gray-500 hover:text-gray-700"
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
                <div className="pl-6 space-y-3 max-w-md mt-2">
                  <div className="grid grid-cols-[0fr_1.25fr_1fr] gap-2">
                    {query.constraints.where.clauses.map((clause, index) => (
                      <React.Fragment key={index}>
                        <div className="row-span-2 relative">
                          {query.constraints.where.clauses.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteWhereClause(index)}
                              className="h-10 w-10 flex-shrink-0 absolute -left-9"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete clause</span>
                            </Button>
                          )}
                        </div>
                        <FieldSuggestions
                          placeholder="Field"
                          value={clause.field}
                          onChange={(value) =>
                            updateWhereClause(index, "field", value)
                          }
                          entityType={currentEntityType}
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
                            {clause.valueType !== "null" && (
                              <>
                                <SelectItem value="<">&lt;</SelectItem>
                                <SelectItem value="<=">&lt;=</SelectItem>
                                <SelectItem value=">">&gt;</SelectItem>
                                <SelectItem value=">=">&gt;=</SelectItem>
                              </>
                            )}
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
                <div className="flex items-center gap-4 pl-6 max-w-xl mt-2">
                  <FieldSuggestions
                    placeholder="Field"
                    className="max-w-xs"
                    value={query.constraints.orderBy.field}
                    onChange={(value) => {
                      // Get field type from metadata for validation
                      if (currentEntityType && value) {
                        const fieldMetadataType =
                          fieldMetadata[currentEntityType]?.[value]?.type;

                        // For orderBy, we allow all field types but could add validation for specific cases
                        if (
                          fieldMetadataType === "array" ||
                          fieldMetadataType === "map"
                        ) {
                          console.warn(
                            `Field '${value}' is of type ${fieldMetadataType} which might not be sortable directly.`
                          );
                        }
                      }

                      updateQuery((q) => ({
                        ...q,
                        constraints: {
                          ...q.constraints,
                          orderBy: {
                            ...q.constraints.orderBy,
                            field: value,
                          },
                        },
                      }));
                    }}
                    entityType={currentEntityType}
                  />
                  <RadioGroup
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
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="asc" id="order-asc" />
                      <Label htmlFor="order-asc" className="font-normal">
                        Asc
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="desc" id="order-desc" />
                      <Label htmlFor="order-desc" className="font-normal">
                        Desc
                      </Label>
                    </div>
                  </RadioGroup>
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
                <div className="pl-6 max-w-xl mt-2 space-y-2">
                  {query.aggregation.sum.fields.length === 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addSumField}
                      className="flex items-center gap-1"
                    >
                      <PlusCircle className="h-4 w-4" /> Add Field
                    </Button>
                  ) : (
                    <>
                      {query.aggregation.sum.fields.map((field, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-2"
                        >
                          <FieldSuggestions
                            placeholder="Field to sum"
                            value={field}
                            onChange={(value) => updateSumField(index, value)}
                            entityType={currentEntityType}
                            className="flex-1"
                          />
                          {query.aggregation.sum.fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeSumField(index)}
                              className="h-10 w-10"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Remove field</span>
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addSumField}
                        className="flex items-center gap-1 mt-2"
                      >
                        <Plus className="h-4 w-4" /> Add Field
                      </Button>
                    </>
                  )}
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
                <div className="pl-6 max-w-xl mt-2 space-y-2">
                  {query.aggregation.average.fields.length === 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addAverageField}
                      className="flex items-center gap-1"
                    >
                      <PlusCircle className="h-4 w-4" /> Add Field
                    </Button>
                  ) : (
                    <>
                      {query.aggregation.average.fields.map((field, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-2"
                        >
                          <FieldSuggestions
                            placeholder="Field to average"
                            value={field}
                            onChange={(value) =>
                              updateAverageField(index, value)
                            }
                            entityType={currentEntityType}
                            className="flex-1"
                          />
                          {query.aggregation.average.fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeAverageField(index)}
                              className="h-10 w-10"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Remove field</span>
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addAverageField}
                        className="flex items-center gap-1 mt-2"
                      >
                        <Plus className="h-4 w-4" /> Add Field
                      </Button>
                    </>
                  )}
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
            size="sm"
            variant="default"
            onClick={handleExecuteClick}
            disabled={isLoading}
            className="bg-black text-white hover:bg-black/90 flex items-center gap-2"
          >
            {isLoading ? (
              <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Execute Query
          </Button>

          <AlertDialog
            open={showNoLimitDialog}
            onOpenChange={setShowNoLimitDialog}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>No Limit Specified</AlertDialogTitle>
                <AlertDialogDescription>
                  You haven&apos;t set a limit for this query. This might return
                  a large number of documents. Do you want to continue?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setShowNoLimitDialog(false);
                    onExecuteQuery(query);
                  }}
                >
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
