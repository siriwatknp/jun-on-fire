import React from "react";
import { GetItemString, JSONTree } from "react-json-tree";
import { ClipboardButton } from "@/components/ui/clipboard-button";
import { CollectionRefTooltip } from "./collection-ref-tooltip";
import { FieldMetadata } from "@/schema";
import dayjs from "dayjs";

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
  schema: null | FieldMetadata | Record<string, FieldMetadata>;
  results: unknown;
  queryPath: string;
}

export const JsonView = React.memo(function JsonView({
  results,
  queryPath = "",
  schema,
}: JsonViewProps) {
  const getKeyCollectionRef = React.useCallback(
    (path: (string | number)[]) => {
      if (!queryPath || !schema || path.length === 0) return null;

      let keyLastTemplate = ""; // for { foo.map.baz.map.field: "..." }
      let result;
      let count = 1;
      const segments = [...path];
      while (!result && segments.length) {
        if (typeof segments[0] === "string") {
          if (count % 2 === 1) {
            keyLastTemplate = keyLastTemplate ? `%s.${keyLastTemplate}` : "%s";
          } else {
            keyLastTemplate = keyLastTemplate
              ? `${segments[0]}.${keyLastTemplate}`
              : segments[0];
          }
          result = schema[keyLastTemplate as keyof typeof schema];
          count++;
        }
        segments.shift();
      }

      if (result && typeof result === "object" && "collectionRef" in result) {
        return result.collectionRef;
      }

      return null;
    },
    [queryPath, schema]
  );
  const getValueCollectionRef = React.useCallback(
    (path: (string | number)[]) => {
      if (!queryPath || !schema || path.length === 0) return null;

      let key = "";
      let keyTemplate = ""; // for { foo.bar.baz.%s.field: "..." }
      let result;
      let count = 1;
      const segments = [...path];
      while (!result && segments.length) {
        if (typeof segments[0] === "string") {
          key = key ? `${segments[0]}.${key}` : segments[0];
          if (count % 2 === 0) {
            keyTemplate = keyTemplate ? `%s.${keyTemplate}` : "%s";
          } else {
            keyTemplate = keyTemplate
              ? `${segments[0]}.${keyTemplate}`
              : segments[0];
          }
          result =
            schema[key as keyof typeof schema] ||
            schema[keyTemplate as keyof typeof schema];
          count++;
        }
        segments.shift();
      }

      if (result && typeof result === "object" && "collectionRef" in result) {
        return result.collectionRef;
      }

      return null;
    },
    [queryPath, schema]
  );

  const defaultItemString: GetItemString = React.useCallback(
    (type, data, itemType, itemString, keyPath) => {
      const collectionRef = getKeyCollectionRef(keyPath as string[]);
      if (keyPath.includes("filledPOMap")) {
        console.log("keyPath", keyPath);
      }
      return (
        <span className="inline-flex group">
          {itemType} {itemString}
          {collectionRef && (
            <CollectionRefTooltip
              className="ml-1"
              collectionRef={collectionRef}
              queryPath={queryPath}
              value={String(keyPath[0])}
              hideText
            />
          )}
          <ClipboardButton
            value={data}
            className="ml-1 invisible group-hover:visible"
          />
        </span>
      );
    },
    [getKeyCollectionRef, queryPath]
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
        postprocessValue={(value) => {
          if (
            typeof value === "object" &&
            value &&
            "toDate" in value &&
            typeof value.toDate === "function"
          ) {
            return dayjs(value.toDate()).format("DD MMM BBBB [เวลา] HH:mm:ss");
          }
          return value;
        }}
        valueRenderer={(valueAsString, value, ...keyPath) => {
          const collectionRef = getValueCollectionRef(keyPath as string[]);

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
              {collectionRef && (
                <CollectionRefTooltip
                  className="ml-1"
                  collectionRef={collectionRef}
                  queryPath={queryPath}
                  value={String(value)}
                  hideText
                />
              )}
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
