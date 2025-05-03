import React, { useState } from "react";
import { DocumentData } from "firebase/firestore";
import { fieldMetadata } from "@/schema";
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

interface TableViewProps {
  results: DocumentData[];
  queryPath: string;
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

export const TableView = React.memo(function TableView({
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

  const columns = React.useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
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
                <JsonView
                  queryPath={queryPath}
                  results={selectedObject?.value}
                  schema={null}
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
