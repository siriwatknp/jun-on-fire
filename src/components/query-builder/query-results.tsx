"use client";

import React, { useMemo, useState } from "react";
import { DocumentData } from "firebase/firestore";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TableIcon, BracketsIcon } from "lucide-react";
import { QueryState } from "./types";
import { JsonView } from "./json-view";
import { TableView } from "./table-view";
import { fieldMetadata } from "@/schema";

interface QueryResultsProps {
  isLoading: boolean;
  error: string | null;
  results: DocumentData[] | null;
  currentQuery: QueryState;
}

type ViewMode = "table" | "json";

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
    <div className="min-h-0 max-h-full flex flex-col">
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
            <JsonView
              results={results}
              queryPath={currentQuery.source.path}
              schema={
                fieldMetadata[currentQuery.source.path.split("/").reverse()[0]]
              }
            />
          )
        ) : (
          <p className="p-4 text-center text-gray-500">No results found</p>
        )}
      </div>
    </div>
  );
}
