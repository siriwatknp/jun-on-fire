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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TableIcon, BracketsIcon, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableViewOptions } from "./data-table-view-options";

// Setup dayjs for timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

interface QueryResultsProps {
  isLoading?: boolean;
  error?: string | null;
  results?: DocumentData[] | null;
  entityType?: keyof SchemaDefinition | string;
}

type ViewMode = "table" | "json";

export function QueryResults({
  isLoading,
  error,
  results,
  entityType = "post", // Default to post if not specified
}: QueryResultsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    path: false, // Hide path column by default
  });
  const [globalFilter, setGlobalFilter] = useState("");

  // Helper function to format all date objects with Bangkok timezone
  const formatDatesInObject = (
    obj: Record<string, unknown>
  ): Record<string, unknown> => {
    if (!obj) return obj;

    const result: Record<string, unknown> = { ...obj };
    Object.entries(result).forEach(([key, value]) => {
      // Format Date objects with Bangkok timezone
      if (value instanceof Date) {
        result[key] = dayjs(value)
          .tz("Asia/Bangkok")
          .format("YYYY-MM-DD HH:mm:ss");
      }
      // Check if it's already a timestamp string in ISO format
      else if (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(value)
      ) {
        result[key] = dayjs(value)
          .tz("Asia/Bangkok")
          .format("YYYY-MM-DD HH:mm:ss");
      }
      // If it's a Timestamp object, convert to Date then format
      else if (value instanceof Timestamp) {
        result[key] = dayjs(value.toDate())
          .tz("Asia/Bangkok")
          .format("YYYY-MM-DD HH:mm:ss");
      }
      // Recursively process nested objects
      else if (typeof value === "object" && value !== null) {
        result[key] = formatDatesInObject(value as Record<string, unknown>);
      }
    });
    return result;
  };

  // Process results to handle timestamp fields
  const processedResults = useMemo(() => {
    if (!results || results.length === 0) return results;

    return results.map((item) => {
      // If we have a schema for this entity type, process the timestamps
      let processed: Record<string, unknown>;
      if (entityType && fieldMetadata[entityType as string]) {
        processed = processTimestampFields(
          item,
          entityType as keyof SchemaDefinition
        );
      } else {
        // Otherwise just do basic timestamp conversion
        processed = { ...item };
        Object.entries(processed).forEach(([key, value]) => {
          if (value instanceof Timestamp) {
            processed[key] = value.toDate();
          }
        });
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

  // Format cell value for display
  const formatCellValue = (value: unknown): string => {
    if (value === null) return "null";
    if (value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
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

    // Create columns for each key
    return Array.from(keys).map((key) => ({
      accessorKey: key,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={key} />
      ),
      cell: ({ row }) => formatCellValue(row.getValue(key)),
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
        <h3 className="font-medium">
          Results ({results.length})
          {resultSize && (
            <span className="ml-2 text-xs inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-gray-600 font-normal">
              size: {resultSize}
            </span>
          )}
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
    </div>
  );
}
