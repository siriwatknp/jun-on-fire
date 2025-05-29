import React, { useState, useDeferredValue } from "react";
import { DocumentData } from "firebase/firestore";
import { fieldMetadata } from "@/schema";
import { useQueryAction } from "./query-action-context";
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
  Column,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableHeader,
  TableHead,
} from "@/components/ui/table";
import { Search, ExternalLink, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableViewOptions } from "./data-table-view-options";
import { toast } from "sonner";
import { Drawer } from "vaul";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getStorage, ref, getMetadata, getDownloadURL } from "firebase/storage";
import { CollectionRefTooltip } from "./collection-ref-tooltip";
import { JsonView } from "./json-view";
import { dayjs } from "@/lib/dateTime";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  createDefaultQuery,
  QueryType,
  ValueType,
  OrderDirection,
  WhereOperator,
} from "./types";

interface TableViewProps {
  results: DocumentData[];
  queryPath: string;
  orderByField?: string;
  hasMore: boolean;
  isLoadingMore: boolean;
}

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

function isTimestampObject(val: unknown): val is { toDate: () => Date } {
  return (
    typeof val === "object" &&
    val !== null &&
    typeof (val as { toDate?: unknown }).toDate === "function"
  );
}

export const TableView = React.memo(function TableView({
  results,
  queryPath,
  orderByField,
  hasMore,
  isLoadingMore,
}: TableViewProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    path: false,
  });
  const [inputValue, setInputValue] = useState("");
  const deferredInputValue = useDeferredValue(inputValue);
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

  const { onFetchNextPage, onCreateQuery, onExecuteQuery, onSaveQuery } =
    useQueryAction();

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

    const entityType = queryPath.split("/").reverse()[0];
    const fieldMeta = entityType && fieldMetadata[entityType]?.[key];
    // Format Firestore Timestamp
    if (
      fieldMeta &&
      typeof fieldMeta === "object" &&
      fieldMeta.type === "timestamp" &&
      value &&
      typeof value === "object" &&
      typeof (value as { toDate?: () => Date }).toDate === "function"
    ) {
      return (
        <span className="inline-flex items-center rounded-full text-xs font-medium text-gray-700">
          {dayjs((value as { toDate: () => Date }).toDate()).format(
            "DD MMM BBBB, HH:mm:ss"
          )}
        </span>
      );
    }

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
          refField={
            typeof fieldMeta.refField === "string"
              ? fieldMeta.refField
              : undefined
          }
        />
      );
    }

    // Copy on single click for string, number, or date (timestamp)
    const isCopyable =
      typeof value === "string" ||
      typeof value === "number" ||
      isTimestampObject(value);

    if (isCopyable) {
      let displayValue = value;
      if (isTimestampObject(value)) {
        displayValue = dayjs(value.toDate()).format("DD MMM BBBB, HH:mm:ss");
      }
      const stringValue = String(displayValue);
      return (
        <span
          className="cursor-pointer hover:text-blue-600 transition-colors"
          onClick={() => {
            navigator.clipboard.writeText(stringValue);
            toast.success("Copied to clipboard");
          }}
          title={stringValue}
        >
          {stringValue.length > 20
            ? `${stringValue.slice(0, 20)}…`
            : stringValue}
        </span>
      );
    }
    return String(value);
  };

  // Handler for double-clicking id cell
  const handleIdDoubleClick = async (idValue: string) => {
    if (!idValue) return;
    await onSaveQuery();
    const segments = queryPath.split("/");
    const collectionPath =
      segments.length % 2 === 0 ? segments.slice(0, -1).join("/") : queryPath;
    const newQuery = {
      ...createDefaultQuery(),
      id: crypto.randomUUID(),
      title: `Query ${collectionPath} (__name__ == ${idValue})`,
      source: {
        type: "collection" as QueryType,
        path: collectionPath,
      },
      constraints: {
        where: {
          enabled: true,
          clauses: [
            {
              field: "__name__",
              operator: "==" as WhereOperator,
              value: idValue,
              valueType: "string" as ValueType,
            },
          ],
        },
        orderBy: {
          enabled: false,
          field: "",
          direction: "asc" as OrderDirection,
        },
        limit: {
          enabled: false,
          value: null,
        },
      },
      aggregation: {
        count: { enabled: false },
        sum: { enabled: false, fields: [] },
        average: { enabled: false, fields: [] },
      },
      updatedAt: Date.now(),
    };
    onCreateQuery(newQuery);
    onExecuteQuery(newQuery);
    toast.success(`Created and executed query for id: ${idValue}`);
  };

  const columns = React.useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    if (!results || results.length === 0) return [];

    const keys = new Set<string>();
    results.forEach((result) => {
      Object.keys(result).forEach((key) => keys.add(key));
    });

    let sortedKeys = Array.from(keys);
    // Move orderByField to the front if specified and present
    if (orderByField && sortedKeys.includes(orderByField)) {
      sortedKeys = [
        orderByField,
        ...sortedKeys.filter((k) => k !== orderByField),
      ];
    } else {
      sortedKeys = sortedKeys.sort((a, b) => {
        if (a === "id") return -1;
        if (b === "id") return 1;
        return a.localeCompare(b);
      });
    }

    return sortedKeys.map((key) => {
      const headerText = key;
      const widthCh = headerText.length;
      // Only add double-click for id column
      if (key === "id") {
        return {
          accessorKey: key,
          header: ({ column }: { column: Column<Record<string, unknown>> }) => (
            <TableHead
              className="inline-block"
              style={{ width: `max(${widthCh * 9}px + 1rem + 1rem, 160px)` }}
            >
              <DataTableColumnHeader column={column} title={key} />
            </TableHead>
          ),
          cell: ({
            row,
          }: {
            row: import("@tanstack/react-table").Row<Record<string, unknown>>;
          }) => (
            <TableCell
              className="inline-block whitespace-nowrap overflow-ellipsis overflow-hidden cursor-pointer hover:bg-blue-50"
              style={{ width: `max(${widthCh * 9}px + 1rem + 1rem, 160px)` }}
              onDoubleClick={async () => {
                await handleIdDoubleClick(String(row.getValue(key)));
              }}
              title="Double click to query by id"
            >
              {formatCellValue(row.getValue(key), key)}
            </TableCell>
          ),
        };
      }
      // Default for other columns
      return {
        accessorKey: key,
        header: ({ column }: { column: Column<Record<string, unknown>> }) => (
          <TableHead
            className="inline-block"
            style={{ width: `max(${widthCh * 9}px + 1rem + 1rem, 160px)` }}
          >
            <DataTableColumnHeader column={column} title={key} />
          </TableHead>
        ),
        cell: ({
          row,
        }: {
          row: import("@tanstack/react-table").Row<Record<string, unknown>>;
        }) => (
          <TableCell
            className="inline-block whitespace-nowrap overflow-ellipsis overflow-hidden"
            style={{ width: `max(${widthCh * 9}px + 1rem + 1rem, 160px)` }}
          >
            {formatCellValue(row.getValue(key), key)}
          </TableCell>
        ),
      };
    });
  }, [results, orderByField]);

  const table = useReactTable({
    data: results,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter: deferredInputValue,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // Table virtualization setup
  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => 40, // px, adjust as needed
    getScrollElement: () => tableContainerRef.current,
    overscan: 5,
  });

  return (
    <>
      <div className="flex items-center gap-2 mb-2 pt-2 px-2">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search all columns..."
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            className="h-8 w-[150px] lg:w-[250px]"
          />
        </div>
        <DataTableViewOptions table={table} />
      </div>

      {/* Virtualized Table Container */}
      <div
        className="min-w-full"
        ref={tableContainerRef}
        style={{ maxHeight: 600, overflowY: "auto", position: "relative" }}
        onScroll={() => {
          // Infinite scroll logic
          const el = tableContainerRef.current;
          if (!el || isLoadingMore || !hasMore) return;
          const { scrollTop, scrollHeight, clientHeight } = el;
          if (scrollHeight - scrollTop - clientHeight < 300) {
            onFetchNextPage();
          }
        }}
      >
        {/* Do not change to <Table>, otherwise the sticky table head will not work */}
        <table className="w-max caption-bottom table-fixed text-sm">
          <TableHeader
            style={{
              position: "sticky",
              top: 0,
              zIndex: 2,
              background: "white",
            }}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) =>
                  flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )
                )}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().length ? (
              rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <TableRow
                    key={row.id}
                    data-index={virtualRow.index}
                    ref={(node) => rowVirtualizer.measureElement(node)}
                    style={{
                      position: "absolute",
                      transform: `translateY(${virtualRow.start}px)`,
                      width: "100%",
                    }}
                  >
                    {row
                      .getVisibleCells()
                      .map((cell) =>
                        flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )
                      )}
                  </TableRow>
                );
              })
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
        </table>
        {/* Infinite scroll loading indicator */}
        {isLoadingMore && (
          <div className="flex justify-center py-2 text-gray-500 text-sm">
            Loading more...
          </div>
        )}
        {/* No more data indicator */}
        {!hasMore && results.length > 0 && (
          <div className="flex justify-center py-2 text-gray-400 text-xs">
            End of results
          </div>
        )}
      </div>

      <Drawer.Root
        direction="right"
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed z-10 inset-0 bg-black/40" />
          <Drawer.Content className="fixed z-100 right-0 top-0 bottom-0 w-[500px] bg-white p-6 shadow-lg">
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
                <JsonView
                  queryPath={queryPath}
                  results={selectedObject?.value}
                  schema={(() => {
                    const entityType = queryPath.split("/").reverse()[0];
                    return entityType && fieldMetadata[entityType]
                      ? fieldMetadata[entityType]
                      : null;
                  })()}
                  initialKeyField={selectedObject?.field}
                />
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
