"use client";

import React, { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  getAllFields,
  getFieldsByType,
  fieldMetadata,
  SchemaDefinition,
  FieldMetadata,
} from "@/schema";

interface FieldSelectorProps {
  value: string;
  onChange: (value: string) => void;
  entityType?: keyof SchemaDefinition | string;
  placeholder?: string;
  filterTypes?: FieldMetadata["type"][];
  allowCustomFields?: boolean; // Allow typing custom fields not in schema
  className?: string;
}

export function FieldSelector({
  value,
  onChange,
  entityType = "post",
  placeholder = "Select field",
  filterTypes,
  allowCustomFields = true,
  className = "",
}: FieldSelectorProps) {
  // Get available fields from schema
  const availableFields = useMemo(() => {
    if (!entityType) return [];

    // If filtering by specific types, use filtered fields
    if (filterTypes && filterTypes.length > 0) {
      return getFieldsByType(entityType as keyof SchemaDefinition, filterTypes);
    }

    // Otherwise get all fields
    return getAllFields(entityType as keyof SchemaDefinition);
  }, [entityType, filterTypes]);

  // Check if we have schema metadata for the fields
  const hasSchemaFields = availableFields.length > 0;

  // If we have no schema or allow custom fields, render an input with autocomplete
  if (!hasSchemaFields || allowCustomFields) {
    return (
      <div className={`relative ${className}`}>
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          list="field-options"
          className="w-full"
        />
        {hasSchemaFields && (
          <datalist id="field-options">
            {availableFields.map((field) => (
              <option key={field} value={field}>
                {fieldMetadata[entityType as string]?.[field]?.displayName ||
                  field}
              </option>
            ))}
          </datalist>
        )}
      </div>
    );
  }

  // If we only use schema fields, render a select dropdown
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {availableFields.map((field) => (
          <SelectItem key={field} value={field}>
            {fieldMetadata[entityType as string]?.[field]?.displayName || field}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
