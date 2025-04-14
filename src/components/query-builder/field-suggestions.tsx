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
import { Portal } from "@radix-ui/react-portal";

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
  const [popupPosition, setPopupPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });
  const commandRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Get field suggestions based on entity type
  const fieldSuggestions = useMemo(() => {
    if (!entityType) return [];
    const metadata = fieldMetadata[entityType as string];
    if (!metadata) return [];

    return Object.entries(metadata)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fieldName, meta]) => ({
        value: fieldName,
        label: fieldName,
        type: meta.type,
        isNullable: meta.isNullable || false,
      }));
  }, [entityType]);

  // Update popup position when input dimensions change
  useEffect(() => {
    if (!inputRef.current || !open) return;

    const updatePosition = () => {
      const rect = inputRef.current?.getBoundingClientRect();
      if (rect) {
        setPopupPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      }
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  // Close the dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInputClick = inputRef.current?.contains(target);
      const isPopupClick = popupRef.current?.contains(target);
      const isCommandClick = document
        .querySelector("[cmdk-root]")
        ?.contains(target);

      // Keep open if clicking on input, popup, or command elements
      if (!isInputClick && !isPopupClick && !isCommandClick) {
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

  return (
    <div className="relative" ref={commandRef}>
      <Input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => {
          const newValue = e.target.value;
          setInputValue(newValue);
          onChange(newValue);
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
        <Portal>
          <div
            ref={popupRef}
            style={{
              position: "absolute",
              top: `${popupPosition.top}px`,
              left: `${popupPosition.left}px`,
              minWidth: `${popupPosition.width}px`,
              zIndex: 50,
            }}
          >
            <Command className="rounded-lg border shadow-md bg-white">
              <CommandInput placeholder="Search fields..." />
              <CommandList>
                <CommandEmpty>No fields found.</CommandEmpty>
                <CommandGroup>
                  {fieldSuggestions.map((suggestion) => (
                    <CommandItem
                      key={suggestion.value}
                      value={suggestion.value}
                      onSelect={() => {
                        setInputValue(suggestion.value);
                        onChange(suggestion.value);
                        setOpen(false);
                      }}
                      className="flex items-center justify-between cursor-pointer"
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
        </Portal>
      )}
    </div>
  );
}
