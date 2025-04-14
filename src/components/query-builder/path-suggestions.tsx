import React, { useState, useEffect, useRef, useMemo } from "react";
import { fieldMetadata } from "@/schema";

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

export interface PathSuggestionsProps {
  value: string;
  onChange: (value: string) => void;
  queryType: "collection" | "collectionGroup";
  className?: string;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
}

export function PathSuggestions({
  value,
  onChange,
  queryType,
  className,
  inputProps,
}: PathSuggestionsProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const commandRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get path suggestions based on query type
  const pathSuggestions = useMemo(() => {
    const collections = Object.keys(fieldMetadata);
    if (queryType === "collectionGroup") {
      return collections.map((collection) => ({
        value: collection,
        label: collection,
      }));
    }

    // For collection type, we'll suggest paths based on the current input
    const segments = value.split("/");
    const isEvenSegments = segments.length % 2 === 0;

    if (isEvenSegments) {
      // If even number of segments, suggest document IDs with placeholder
      return [
        {
          value: value + (value.endsWith("/") ? "" : "/") + "doc_id",
          label: "doc_id (example)",
        },
      ];
    } else {
      // If odd number of segments, suggest collections
      return collections.map((collection) => ({
        value:
          segments.slice(0, -1).join("/") +
          (segments.length > 1 ? "/" : "") +
          collection,
        label: collection,
      }));
    }
  }, [value, queryType]);

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

  // Function to handle path selection
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
          if (!open) {
            setOpen(true);
          }
        }}
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        placeholder={
          queryType === "collection" ? "users/user123/posts" : "posts"
        }
        className={cn("grow", className)}
        {...inputProps}
      />

      {open && (
        <div className="absolute z-10 w-full mt-1">
          <Command className="rounded-lg border shadow-md">
            <CommandInput placeholder="Search paths..." />
            <CommandList>
              <CommandEmpty>No suggestions found.</CommandEmpty>
              <CommandGroup>
                {pathSuggestions.map((suggestion, index) => (
                  <CommandItem
                    key={index}
                    onSelect={() => handleSelect(suggestion.value)}
                    className="flex items-center justify-between"
                  >
                    <span className="font-medium">{suggestion.label}</span>
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
