import React from "react";
import { GetItemString, JSONTree } from "react-json-tree";
import { ClipboardButton } from "@/components/ui/clipboard-button";

const jsonViewTheme = {
  scheme: "custom",
  author: "siriwatknp",
  base00: "transparent",
  base01: "#f5f5f5",
  base02: "#e5e5e5",
  base03: "#999999",
  base04: "#a3a3a3",
  base05: "#737373",
  base06: "#525252",
  base07: "#404040",
  base08: "#dc2626", // red
  base09: "#ea580c", // orange
  base0A: "#ca8a04", // yellow
  base0B: "#16a34a", // green
  base0C: "#0891b2", // cyan
  base0D: "#414141", // dark gray
  base0E: "#9333ea", // violet
  base0F: "#be185d", // magenta
};

interface JsonViewProps {
  results: unknown;
}

export const JsonView = React.memo(function JsonView({
  results,
}: JsonViewProps) {
  const defaultItemString: GetItemString = React.useCallback(
    (type, data, itemType, itemString) => {
      return (
        <span className="inline-flex group">
          {itemType} {itemString}
          <ClipboardButton
            value={data}
            className="ml-1 invisible group-hover:visible"
          />
        </span>
      );
    },
    []
  );
  return (
    <div className="bg-gray-50 rounded-sm p-4 h-full overflow-x-auto">
      <JSONTree
        data={results}
        theme={{
          extend: jsonViewTheme,
          tree: { fontSize: "0.875rem", margin: 0 },
        }}
        getItemString={defaultItemString}
        valueRenderer={(valueAsString, value) => {
          if (typeof value === "string" && value.startsWith("https://")) {
            return (
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  cursor: "pointer",
                  color: "#1976d2",
                  textDecoration: "underline",
                }}
              >
                {value}
              </a>
            );
          }
          return (
            <span className="inline-flex group ml-[0.5ch]">
              {valueAsString as string}{" "}
              <ClipboardButton
                value={value}
                className="ml-1 invisible group-hover:visible"
              />
            </span>
          );
        }}
        shouldExpandNodeInitially={(keyPath, data, level) => level <= 1}
      />
    </div>
  );
});
