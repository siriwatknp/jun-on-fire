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
import { Portal } from "@radix-ui/react-portal";

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
  const [popupPosition, setPopupPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });
  const commandRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Get path suggestions based on query type
  const pathSuggestions = useMemo(() => {
    const collections = Object.keys(fieldMetadata).sort();
    if (queryType === "collectionGroup") {
      return collections.map((collection) => ({
        value: collection,
        label: collection,
      }));
    }

    // For collection type, we'll suggest paths based on the current input
    const segments = inputValue.split("/");
    const isEvenSegments = segments.length % 2 === 0;

    if (isEvenSegments) {
      // If even number of segments, suggest document IDs with placeholder
      return [
        {
          value:
            inputValue + (inputValue.endsWith("/") ? "" : "/") + "{{doc_id}}",
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
  }, [inputValue, queryType]);

  const handleSaveValue = () => {
    if (inputValue !== value) {
      onChange(inputValue);
    }
  };

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
        handleSaveValue();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [inputValue, value]);

  // Update input value when value prop changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  return (
    <div className="relative" ref={commandRef}>
      <Input
        autoComplete={pathSuggestions.length ? "off" : undefined}
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => {
          const newValue = e.target.value;
          setInputValue(newValue);
          if (!open) {
            setOpen(true);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleSaveValue();
            setOpen(false);
          }
        }}
        onBlur={handleSaveValue}
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        placeholder={
          queryType === "collection" ? "users/user123/posts" : "posts"
        }
        className={cn("grow", className)}
        {...inputProps}
      />

      {open && (
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
              <CommandInput placeholder="Search paths..." />
              <CommandList>
                <CommandEmpty>No suggestions found.</CommandEmpty>
                <CommandGroup>
                  {pathSuggestions.map((suggestion, index) => (
                    <CommandItem
                      key={index}
                      value={suggestion.value}
                      onSelect={() => {
                        setInputValue(suggestion.value);
                        onChange(suggestion.value);
                        setOpen(false);
                      }}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <span className="font-medium">{suggestion.label}</span>
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
