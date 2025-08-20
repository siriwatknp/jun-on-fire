import React from "react";
import { GetItemString, JSONTree } from "react-json-tree";
import { ClipboardButton } from "@/components/ui/clipboard-button";
import { CollectionRefTooltip } from "./collection-ref-tooltip";
import { FieldMetadata } from "@/schema";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { ChevronsUpDown, ChevronsDownUp } from "lucide-react";
import { Button } from "@/components/ui/button";

dayjs.extend(utc);
dayjs.extend(timezone);

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
  initialKeyField?: string;
}

// Recursively replace all fields with a toDate method with their toDate() value
function replaceToDateFields(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map(replaceToDateFields);
  }
  if (data && typeof data === "object" && !(data instanceof Date)) {
    if (typeof (data as { toDate?: unknown }).toDate === "function") {
      const date = (data as { toDate: () => Date }).toDate();
      // Format as ISO string with +07:00 offset
      return dayjs(date).tz("Asia/Bangkok").format("YYYY-MM-DDTHH:mm:ssZ");
    }
    const result: Record<string, unknown> = {};
    for (const key in data as Record<string, unknown>) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        result[key] = replaceToDateFields(
          (data as Record<string, unknown>)[key],
        );
      }
    }
    return result;
  }
  return data;
}

export const JsonView = React.memo(function JsonView({
  results,
  queryPath = "",
  schema,
  initialKeyField,
}: JsonViewProps) {
  const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(
    new Set(),
  );
  const [renderKey, setRenderKey] = React.useState(0);

  const getPathKey = React.useCallback((keyPath: (string | number)[]) => {
    return keyPath.reverse().join(".");
  }, []);

  const getKeyCollectionRef = React.useCallback(
    (path: (string | number)[]) => {
      if (!queryPath || !schema || path.length === 0) return null;

      let keyLastTemplate = ""; // for { foo.map.baz.map.field: "..." }
      let result;
      let count = 1;
      const segments =
        initialKeyField && path.length > 0
          ? [path[0], initialKeyField, ...path.slice(1)]
          : [...path];
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
        return {
          collectionRef: result.collectionRef,
          refField:
            typeof result.refField === "string" ? result.refField : undefined,
        };
      }

      return null;
    },
    [queryPath, schema, initialKeyField],
  );
  const getValueCollectionRef = React.useCallback(
    (path: (string | number)[]) => {
      if (!queryPath || !schema || path.length === 0) return null;

      let key = "";
      let keyTemplate = ""; // for { foo.bar.baz.%s.field: "..." }
      let result;
      let count = 1;
      const segments =
        initialKeyField && path.length > 0
          ? [path[0], initialKeyField, ...path.slice(1)]
          : [...path];
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
        return {
          collectionRef: result.collectionRef,
          refField:
            typeof result.refField === "string" ? result.refField : undefined,
        };
      }

      return null;
    },
    [queryPath, schema, initialKeyField],
  );

  const defaultItemString: GetItemString = React.useCallback(
    (type, data, itemType, itemString, keyPath) => {
      const collectionRefObj =
        getKeyCollectionRef(keyPath as string[]) || undefined;
      const collectionRefString =
        typeof collectionRefObj === "object"
          ? collectionRefObj.collectionRef
          : collectionRefObj;

      const isExpandable = type === "Object" || type === "Array";
      const pathKey = getPathKey([...keyPath]);
      const isExpanded = expandedPaths.has(pathKey);

      const handleToggleExpandAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        const newExpandedPaths = new Set(expandedPaths);

        if (isExpanded) {
          // Collapse: remove this path and all child paths
          newExpandedPaths.delete(pathKey);
          newExpandedPaths.forEach((path) => {
            if (path.startsWith(pathKey + ".")) {
              newExpandedPaths.delete(path);
            }
          });
        } else {
          // Expand: add this path
          newExpandedPaths.add(pathKey);
        }

        setExpandedPaths(newExpandedPaths);
        setRenderKey((prev) => prev + 1);
      };

      return (
        <span className="inline-flex group items-center">
          {itemType} {itemString}
          {isExpandable && (
            <Button
              variant="ghost"
              size="xs"
              className="ml-1 h-4 w-4 p-0 invisible group-hover:visible"
              onClick={handleToggleExpandAll}
              title={
                isExpanded
                  ? "Collapse all nested items"
                  : "Expand all nested items"
              }
            >
              {isExpanded ? (
                <ChevronsDownUp className="h-3 w-3" />
              ) : (
                <ChevronsUpDown className="h-3 w-3" />
              )}
            </Button>
          )}
          {typeof collectionRefString === "string" && (
            <CollectionRefTooltip
              className="ml-1"
              collectionRef={collectionRefString}
              queryPath={queryPath}
              value={String(keyPath[0])}
              hideText
              {...(collectionRefObj &&
              typeof collectionRefObj === "object" &&
              typeof collectionRefObj.refField === "string"
                ? { refField: collectionRefObj.refField }
                : {})}
            />
          )}
          <ClipboardButton
            value={replaceToDateFields(data)}
            className="ml-1 invisible group-hover:visible"
          />
        </span>
      );
    },
    [getKeyCollectionRef, queryPath, expandedPaths, getPathKey],
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
          const collectionRefObj =
            getValueCollectionRef(keyPath as string[]) || undefined;
          const collectionRefString =
            typeof collectionRefObj === "object"
              ? collectionRefObj.collectionRef
              : collectionRefObj;

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

          // Combine the special 'id' field logic with the main return
          const isIdField =
            keyPath && keyPath.length === 3 && keyPath[0] === "id";
          return (
            <span className="inline-flex group ml-[0.5ch]">
              {valueAsString as string}{" "}
              {isIdField ? (
                <CollectionRefTooltip
                  className="ml-1"
                  collectionRef={queryPath}
                  queryPath={queryPath}
                  value={String(value)}
                  hideText
                />
              ) : (
                typeof collectionRefString === "string" && (
                  <CollectionRefTooltip
                    className="ml-1"
                    collectionRef={collectionRefString}
                    queryPath={queryPath}
                    value={String(value)}
                    hideText
                    {...(collectionRefObj &&
                    typeof collectionRefObj === "object" &&
                    typeof collectionRefObj.refField === "string"
                      ? { refField: collectionRefObj.refField }
                      : {})}
                  />
                )
              )}
              <ClipboardButton
                value={value}
                className="ml-1 invisible group-hover:visible"
              />
            </span>
          );
        }}
        shouldExpandNodeInitially={(keyPath, data, level) => {
          // Check if any parent path is in expandedPaths
          const currentPath = getPathKey([...keyPath]);

          // Check if this path or any parent path is marked for expansion
          for (const expandedPath of expandedPaths) {
            if (currentPath.startsWith(expandedPath)) {
              return true;
            }
          }

          // Default behavior
          return level <= 1;
        }}
        key={renderKey}
      />
    </div>
  );
});
