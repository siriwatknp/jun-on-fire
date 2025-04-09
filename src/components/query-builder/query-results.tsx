"use client";

import React, { useMemo, useState } from "react";
import { DocumentData, Timestamp } from "firebase/firestore";
import {
  fieldMetadata,
  processTimestampFields,
  SchemaDefinition,
} from "@/schema";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TableIcon, BracketsIcon, Search, ExternalLink, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableViewOptions } from "./data-table-view-options";
import { toast } from "sonner";
import { QueryState } from "./types";
import * as Drawer from "vaul";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getStorage, ref, getMetadata, getDownloadURL } from "firebase/storage";

// Setup dayjs for timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

interface QueryResultsProps {
  isLoading?: boolean;
  error?: string | null;
  results?: DocumentData[] | null;
  entityType?: keyof SchemaDefinition | string;
  currentQuery: QueryState;
  onSaveQuery: () => Promise<void>;
  onCreateQuery: (query: QueryState) => void;
  onExecuteQuery: (query: QueryState) => void;
}

type ViewMode = "table" | "json";

export function QueryResults({
  isLoading,
  error,
  results,
  entityType = "post",
  currentQuery,
  onSaveQuery,
  onCreateQuery,
  onExecuteQuery,
}: QueryResultsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    path: false, // Hide path column by default
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

  // Handle collection reference click
  const handleCollectionRefClick = async (
    collectionRef: string,
    value: string
  ) => {
    try {
      // Save the current query first
      await onSaveQuery();

      // Create a new query targeting the referenced collection
      const newQuery: QueryState = {
        ...currentQuery,
        id: crypto.randomUUID(),
        title: `Query ${collectionRef} (${value})`,
        source: {
          type: "collection",
          path: collectionRef,
        },
        constraints: {
          where: {
            enabled: true,
            clauses: [
              {
                field: "__name__",
                operator: "==",
                value: value,
                valueType: "string",
              },
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
        updatedAt: Date.now(),
      };

      // Create and execute the new query
      onCreateQuery(newQuery);
      onExecuteQuery(newQuery);
      toast.success(`Created new query for ${collectionRef}`);
    } catch (error) {
      console.error("Error handling collection reference click:", error);
      toast.error("Failed to create new query");
    }
  };

  // Helper function to format all date objects with Bangkok timezone
  const formatDatesInObject = (
    obj: Record<string, unknown>
  ): Record<string, unknown> => {
    if (!obj) return obj;

    const processValue = (value: unknown): unknown => {
      // Handle arrays recursively
      if (Array.isArray(value)) {
        return value.map((item) => processValue(item));
      }

      // Handle Date objects
      if (value instanceof Date) {
        return dayjs(value).tz("Asia/Bangkok").format("YYYY-MM-DD HH:mm:ss");
      }

      // Handle ISO date strings
      if (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(value)
      ) {
        return dayjs(value).tz("Asia/Bangkok").format("YYYY-MM-DD HH:mm:ss");
      }

      // Handle objects recursively
      if (typeof value === "object" && value !== null) {
        if (value instanceof Timestamp) {
          return dayjs(value.toDate())
            .tz("Asia/Bangkok")
            .format("YYYY-MM-DD HH:mm:ss");
        }

        const processed: Record<string, unknown> = {};
        Object.entries(value as Record<string, unknown>).forEach(
          ([key, val]) => {
            processed[key] = processValue(val);
          }
        );
        return processed;
      }

      return value;
    };

    const result: Record<string, unknown> = {};
    Object.entries(obj).forEach(([key, value]) => {
      result[key] = processValue(value);
    });
    return result;
  };

  // Process results to handle timestamp fields
  const processedResults = useMemo(() => {
    if (!results || results.length === 0) return results;

    const processValue = (value: unknown): unknown => {
      // Handle arrays recursively
      if (Array.isArray(value)) {
        return value.map((item) => processValue(item));
      }

      // Handle objects recursively
      if (typeof value === "object" && value !== null) {
        if (value instanceof Timestamp) {
          return value.toDate();
        }

        // If it's a regular object, process its properties
        const processed: Record<string, unknown> = {};
        Object.entries(value as Record<string, unknown>).forEach(
          ([key, val]) => {
            processed[key] = processValue(val);
          }
        );
        return processed;
      }

      return value;
    };

    return results.map((item) => {
      // If we have a schema for this entity type, process the timestamps
      let processed: Record<string, unknown>;
      if (entityType && fieldMetadata[entityType as string]) {
        processed = processTimestampFields(
          item,
          entityType as keyof SchemaDefinition
        );
      } else {
        // Process the item while preserving array structures
        processed = processValue(item) as Record<string, unknown>;
      }

      // Then format all dates with Bangkok timezone
      return formatDatesInObject(processed);
    });
  }, [results, entityType]);

  // Calculate the size of the results
  const resultSize = useMemo(() => {
    if (!results || results.length === 0) return null;

    // Convert results to a string to measure size
    const jsonString = JSON.stringify(results);
    // Size in bytes (Each character is 1 byte in UTF-16)
    const bytes = new TextEncoder().encode(jsonString).length;

    // Convert to appropriate unit
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
  }, [results]);

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

  // Inside handleImageClick function, update the size formatting logic
  const formatFileSize = (bytes: number) => {
    const mbSize = bytes / 1024 / 1024;
    if (mbSize < 0.1) {
      // Show in KB if less than 0.1 MB
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    // Show in MB with 2 decimal places
    return `${mbSize.toFixed(2)} MB`;
  };

  // Modified handleImageClick function to use Firebase Storage
  const handleImageClick = async (url: string) => {
    try {
      // Get storage reference from URL
      const storageRef = getStorageRefFromUrl(url);

      // Get metadata from Firebase Storage
      const metadata = await getMetadata(storageRef);

      // Get a fresh download URL (as URLs expire)
      const downloadUrl = await getDownloadURL(storageRef);

      // Create an image element to get dimensions
      const img = new Image();
      img.src = downloadUrl;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // Update the metadata setting
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

  // Modify the isArray helper to also check for "array-like" objects
  const isArrayLike = (value: unknown): boolean => {
    if (Array.isArray(value)) return true;

    // Check if it's an object with sequential numeric keys starting from 0
    if (typeof value === "object" && value !== null) {
      const keys = Object.keys(value);
      if (keys.length === 0) return false;

      // Check if all keys are sequential numbers starting from 0
      return keys.every((key, index) => Number(key) === index);
    }

    return false;
  };

  // Add a helper to convert array-like objects to actual arrays
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

  // Modify the formatCellValue function
  const formatCellValue = (value: unknown, key: string): React.ReactNode => {
    if (value === null) {
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          null
        </span>
      );
    }
    if (value === undefined) return "";

    // Handle object and array values
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

    // Handle Firebase Storage URLs
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

    // Check if this field has a collection reference
    const fieldMeta = entityType && fieldMetadata[entityType]?.[key];
    if (
      fieldMeta &&
      typeof fieldMeta !== "string" &&
      typeof fieldMeta.collectionRef === "string" &&
      fieldMeta.collectionRef
    ) {
      const collectionRef = fieldMeta.collectionRef;
      const fullValue = String(value);
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                onClick={() =>
                  handleCollectionRefClick(collectionRef, fullValue)
                }
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(fullValue);
                  toast.success("Reference ID copied to clipboard");
                }}
              >
                {fullValue.length > 5
                  ? `${fullValue.slice(0, 5)}...`
                  : fullValue}
                <ExternalLink className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[300px] space-y-1 px-2">
              <p className="font-medium">{collectionRef}</p>
              <p className="text-xs text-gray-300">ID: {fullValue}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
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

  // Define columns for the table
  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    if (!processedResults || processedResults.length === 0) return [];

    // Get all unique keys from the results
    const keys = new Set<string>();
    processedResults.forEach((result) => {
      Object.keys(result).forEach((key) => keys.add(key));
    });

    // Convert keys to array and sort them
    const sortedKeys = Array.from(keys).sort((a, b) => {
      // Always put "id" first
      if (a === "id") return -1;
      if (b === "id") return 1;
      // Sort other columns alphabetically
      return a.localeCompare(b);
    });

    // Create columns for each key
    return sortedKeys.map((key) => ({
      accessorKey: key,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={key} />
      ),
      cell: ({ row }) => formatCellValue(row.getValue(key), key),
    }));
  }, [processedResults]);

  // Initialize the table
  const table = useReactTable({
    data: processedResults || [],
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
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-medium flex items-center gap-2">
          Results
          <div className="flex items-center gap-1.5">
            {/* Documents count chip */}
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600 font-normal">
              {results.length} {results.length === 1 ? "doc" : "docs"}
            </span>
            {/* Size chip */}
            {resultSize && (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600 font-normal">
                size: {resultSize}
              </span>
            )}
          </div>
        </h3>
        <div className="flex items-center gap-2">
          {viewMode === "table" && (
            <>
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
            </>
          )}
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value: string) =>
              value && setViewMode(value as ViewMode)
            }
            className="border p-[3px] h-auto bg-transparent rounded-md"
          >
            <ToggleGroupItem
              value="table"
              aria-label="Table view"
              className="data-[state=on]:bg-gray-200 data-[state=on]:text-gray-900 rounded"
            >
              <TableIcon className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="json"
              aria-label="JSON view"
              className="data-[state=on]:bg-gray-200 data-[state=on]:text-gray-900 rounded"
            >
              <BracketsIcon className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      <div className="border rounded overflow-auto flex-1">
        {results.length > 0 ? (
          viewMode === "table" ? (
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
          ) : (
            <pre className="p-4 text-xs font-mono overflow-x-auto h-full">
              {JSON.stringify(processedResults, null, 2)}
            </pre>
          )
        ) : (
          <p className="p-4 text-center text-gray-500">No results found</p>
        )}
      </div>

      <Drawer.Root open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40" />
          <Drawer.Content className="fixed right-0 top-0 bottom-0 w-[400px] bg-white p-6 shadow-lg">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{selectedObject?.field}</h3>
                  <span className="text-xs text-gray-500">
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
                <pre className="text-sm font-mono bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">
                  {selectedObject
                    ? JSON.stringify(selectedObject.value, null, 2)
                    : null}
                </pre>
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
            {/* Image Preview Container */}
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

            {/* Metadata Table */}
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
    </div>
  );
}
