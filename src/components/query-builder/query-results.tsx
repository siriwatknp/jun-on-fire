"use client";

import React from "react";
import { DocumentData } from "firebase/firestore";

interface QueryResultsProps {
  isLoading?: boolean;
  error?: string | null;
  results?: DocumentData[] | null;
}

export function QueryResults({ isLoading, error, results }: QueryResultsProps) {
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
        <h3 className="font-medium">Results ({results.length})</h3>
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
