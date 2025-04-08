import React, { useState, useEffect, useRef, useMemo } from "react";
import { fieldMetadata, SchemaDefinition } from "@/schema";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface FieldSuggestionsProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  entityType?: keyof SchemaDefinition | string | null;
  className?: string;
}

export function FieldSuggestions({
  value,
  onChange,
  placeholder = "Field",
  entityType = null,
  className,
}: FieldSuggestionsProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const commandRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get field suggestions based on entity type
  const fieldSuggestions = useMemo(() => {
    if (!entityType) return [];
    const metadata = fieldMetadata[entityType as string];
    if (!metadata) return [];

    return Object.entries(metadata).map(([fieldName, meta]) => ({
      value: fieldName,
      label: fieldName,
      type: meta.type,
      isNullable: meta.isNullable || false,
    }));
  }, [entityType]);

  // Close the dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        commandRef.current &&
        !commandRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Update input value when value prop changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Function to handle field selection
  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setInputValue(selectedValue);
    setOpen(false);
  };

  return (
    <div className="relative" ref={commandRef}>
      <Input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          onChange(e.target.value);
          if (!open && entityType) {
            setOpen(true);
          }
        }}
        onClick={() => entityType && setOpen(true)}
        onFocus={() => entityType && setOpen(true)}
        placeholder={
          entityType ? placeholder : `${placeholder} (define path first)`
        }
        className={cn("grow", className)}
      />

      {open && entityType && (
        <div className="absolute z-10 w-full mt-1">
          <Command className="rounded-lg border shadow-md">
            <CommandInput placeholder="Search fields..." />
            <CommandList>
              <CommandEmpty>No fields found.</CommandEmpty>
              <CommandGroup>
                {fieldSuggestions.map((suggestion) => (
                  <CommandItem
                    key={suggestion.value}
                    onSelect={() => handleSelect(suggestion.value)}
                    className="flex items-center justify-between"
                  >
                    <span className="font-medium">{suggestion.label}</span>
                    <div className="flex items-center gap-1">
                      <code className="text-xs px-1 bg-gray-100 rounded">
                        {suggestion.type}
                        {suggestion.isNullable && "?"}
                      </code>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}
