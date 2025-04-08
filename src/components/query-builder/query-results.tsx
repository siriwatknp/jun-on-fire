"use client";

import React, { useMemo } from "react";
import { DocumentData } from "firebase/firestore";

interface QueryResultsProps {
  isLoading?: boolean;
  error?: string | null;
  results?: DocumentData[] | null;
}

export function QueryResults({ isLoading, error, results }: QueryResultsProps) {
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
      </div>
      <div className="border rounded overflow-auto flex-1">
        {results.length > 0 ? (
          <pre className="p-4 text-xs font-mono overflow-x-auto h-full">
            {JSON.stringify(results, null, 2)}
          </pre>
        ) : (
          <p className="p-4 text-center text-gray-500">No results found</p>
        )}
      </div>
    </div>
  );
}
