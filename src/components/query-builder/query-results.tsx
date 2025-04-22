"use client";

import React, { useMemo, useState } from "react";
import { DocumentData } from "firebase/firestore";
import { fieldMetadata } from "@/schema";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TableIcon, BracketsIcon, Search, ExternalLink, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableViewOptions } from "./data-table-view-options";
import { toast } from "sonner";
import { QueryState } from "./types";
import { Drawer } from "vaul";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getStorage, ref, getMetadata, getDownloadURL } from "firebase/storage";
import { CollectionRefTooltip } from "./collection-ref-tooltip";
import { GetItemString, JSONTree } from "react-json-tree";
import { ClipboardButton } from "@/components/ui/clipboard-button";

// Setup dayjs for timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

interface QueryResultsProps {
  isLoading: boolean;
  error: string | null;
  results: DocumentData[] | null;
  currentQuery: QueryState;
}

type ViewMode = "table" | "json";

// Helper functions
const formatFileSize = (bytes: number) => {
  const mbSize = bytes / 1024 / 1024;
  if (mbSize < 0.1) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${mbSize.toFixed(2)} MB`;
};

const isArrayLike = (value: unknown): boolean => {
  if (Array.isArray(value)) return true;

  if (typeof value === "object" && value !== null) {
    const keys = Object.keys(value);
    if (keys.length === 0) return false;
    return keys.every((key, index) => Number(key) === index);
  }

  return false;
};

const toArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === "object" && value !== null) {
    const keys = Object.keys(value);
    if (isArrayLike(value)) {
      return keys.map((key) => {
        const obj = value as { [key: string]: unknown };
        return obj[key];
      });
    }
  }
  return [];
};

// Helper to get storage reference from URL
const getStorageRefFromUrl = (url: string) => {
  // Firebase Storage URLs follow this pattern:
  // https://firebasestorage.googleapis.com/v0/b/[bucket]/o/[path]?...
  const matches = url.match(
    /firebasestorage\.googleapis\.com\/v0\/b\/(.+?)\/o\/(.+?)\?/
  );
  if (!matches) throw new Error("Invalid Firebase Storage URL");

  const storage = getStorage();
  const path = decodeURIComponent(matches[2]); // decode the URL-encoded path
  return ref(storage, path);
};

interface TableViewProps {
  results: DocumentData[];
  queryPath: string;
}

const TableView = React.memo(function TableView({
  results,
  queryPath,
}: TableViewProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    path: false,
  });
  const [globalFilter, setGlobalFilter] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedObject, setSelectedObject] = useState<{
    value: unknown;
    field: string;
    isArray?: boolean;
  } | null>(null);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    metadata: {
      dimensions?: string;
      size?: string;
      createdAt?: string;
    } | null;
  } | null>(null);

  const handleImageClick = async (url: string) => {
    try {
      const storageRef = getStorageRefFromUrl(url);
      const metadata = await getMetadata(storageRef);
      const downloadUrl = await getDownloadURL(storageRef);

      const img = new Image();
      img.src = downloadUrl;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      setSelectedImage({
        url: downloadUrl,
        metadata: {
          dimensions: `${img.naturalWidth} × ${img.naturalHeight}`,
          size: metadata.size ? formatFileSize(metadata.size) : undefined,
          createdAt: metadata.timeCreated
            ? new Date(metadata.timeCreated).toLocaleString()
            : undefined,
        },
      });
      setIsImageDialogOpen(true);
    } catch (error) {
      console.error("Error loading image metadata:", error);
      toast.error("Failed to load image metadata");
      setIsImageDialogOpen(false);
    }
  };

  const formatCellValue = (value: unknown, key: string): React.ReactNode => {
    if (value === null) {
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          null
        </span>
      );
    }
    if (value === undefined) return "";

    if (typeof value === "object" && value !== null) {
      const isArrayValue = isArrayLike(value);
      return (
        <button
          onClick={() => {
            setSelectedObject({
              value: isArrayValue ? toArray(value) : value,
              field: key,
              isArray: isArrayValue,
            });
            setIsDrawerOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
        >
          {isArrayValue ? "array" : "object"}
          <Search className="h-3 w-3" />
        </button>
      );
    }

    if (
      typeof value === "string" &&
      value.startsWith("https://firebasestorage")
    ) {
      return (
        <button
          onClick={() => handleImageClick(value)}
          className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 hover:bg-purple-100"
        >
          storage
          <Search className="h-3 w-3" />
        </button>
      );
    }

    const entityType = queryPath.split("/").reverse()[0];
    const fieldMeta = entityType && fieldMetadata[entityType]?.[key];
    if (
      fieldMeta &&
      typeof fieldMeta !== "string" &&
      typeof fieldMeta.collectionRef === "string" &&
      fieldMeta.collectionRef
    ) {
      return (
        <CollectionRefTooltip
          collectionRef={fieldMeta.collectionRef}
          queryPath={queryPath}
          value={String(value)}
        />
      );
    }

    if (key === "id") {
      const fullId = String(value);
      return (
        <span
          className="cursor-pointer hover:text-gray-600"
          onDoubleClick={() => {
            navigator.clipboard.writeText(fullId);
            toast.success("ID copied to clipboard");
          }}
          title={`Double click to copy: ${fullId}`}
        >
          {fullId.length > 15 ? `${fullId.slice(0, 5)}...` : fullId}
        </span>
      );
    }
    return String(value);
  };

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    if (!results || results.length === 0) return [];

    const keys = new Set<string>();
    results.forEach((result) => {
      Object.keys(result).forEach((key) => keys.add(key));
    });

    const sortedKeys = Array.from(keys).sort((a, b) => {
      if (a === "id") return -1;
      if (b === "id") return 1;
      return a.localeCompare(b);
    });

    return sortedKeys.map((key) => ({
      accessorKey: key,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={key} />
      ),
      cell: ({ row }) => formatCellValue(row.getValue(key), key),
    }));
  }, [results]);

  const table = useReactTable({
    data: results,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <>
      <div className="flex items-center gap-2 mb-2 pt-2 px-2">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search all columns..."
            value={globalFilter ?? ""}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="h-8 w-[150px] lg:w-[250px]"
          />
        </div>
        <DataTableViewOptions table={table} />
      </div>

      <div className="min-w-full">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Drawer.Root
        direction="right"
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed z-10 inset-0 bg-black/40" />
          <Drawer.Content className="fixed z-100 right-0 top-0 bottom-0 w-[400px] bg-white p-6 shadow-lg">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-baseline gap-2">
                  <DialogTitle>{selectedObject?.field}</DialogTitle>
                  <span className="text-sm text-gray-500">
                    ({selectedObject?.isArray ? "Array" : "Object"})
                  </span>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-auto">
                <JsonView results={selectedObject?.value} />
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Storage File Preview</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <div className="aspect-video relative bg-gray-100 rounded-lg overflow-hidden">
                {selectedImage && (
                  <img
                    src={selectedImage.url}
                    alt="Preview"
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                )}
              </div>
              {selectedImage && (
                <a
                  href={selectedImage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-2 right-2 text-sm bg-black/50 text-white px-2 py-1 rounded-md flex items-center gap-1 hover:bg-black/70"
                >
                  Open in new tab
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {selectedImage?.metadata && (
              <div className="border rounded-lg">
                <Table>
                  <TableBody>
                    {selectedImage.metadata.dimensions && (
                      <TableRow>
                        <TableCell className="font-medium w-32">
                          Dimensions
                        </TableCell>
                        <TableCell>
                          {selectedImage.metadata.dimensions}
                        </TableCell>
                      </TableRow>
                    )}
                    {selectedImage.metadata.size && (
                      <TableRow>
                        <TableCell className="font-medium w-32">Size</TableCell>
                        <TableCell>{selectedImage.metadata.size}</TableCell>
                      </TableRow>
                    )}
                    {selectedImage.metadata.createdAt && (
                      <TableRow>
                        <TableCell className="font-medium w-32">
                          Created
                        </TableCell>
                        <TableCell>
                          {selectedImage.metadata.createdAt}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

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

const JsonView = React.memo(function JsonView({
  results,
}: {
  results: unknown;
}) {
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

export function QueryResults({
  isLoading,
  error,
  results,
  currentQuery,
}: QueryResultsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Calculate the size of the results
  const resultSize = useMemo(() => {
    if (!results || results.length === 0) return null;

    const jsonString = JSON.stringify(results);
    const bytes = new TextEncoder().encode(jsonString).length;

    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
  }, [results]);

  if (isLoading) {
    return (
      <div className="p-4 border rounded bg-gray-50 h-full flex items-center justify-center">
        <p className="text-gray-500">Executing query...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border rounded bg-red-50 h-full">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="border rounded bg-white h-full flex items-center justify-center">
        <p className="text-gray-400">Execute a query to see results</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-medium flex items-center gap-2">
          Results
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600 font-normal">
              {results.length} {results.length === 1 ? "doc" : "docs"}
            </span>
            {resultSize && (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600 font-normal">
                size: {resultSize}
              </span>
            )}
          </div>
        </h3>

        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => value && setViewMode(value as ViewMode)}
        >
          <ToggleGroupItem
            value="table"
            aria-label="Table view"
            className="data-[state=on]:bg-white data-[state=on]:text-gray-900 rounded"
          >
            <TableIcon className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="json"
            aria-label="JSON view"
            className="data-[state=on]:bg-white data-[state=on]:text-gray-900 rounded"
          >
            <BracketsIcon className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="border rounded overflow-auto flex-1">
        {results.length > 0 ? (
          viewMode === "table" ? (
            <TableView results={results} queryPath={currentQuery.source.path} />
          ) : (
            <JsonView results={results} />
          )
        ) : (
          <p className="p-4 text-center text-gray-500">No results found</p>
        )}
      </div>
    </div>
  );
}
