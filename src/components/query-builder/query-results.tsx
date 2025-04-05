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
      <div className="mt-6 p-4 border rounded bg-gray-50">
        <p className="text-center text-gray-500">Executing query...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6 p-4 border rounded bg-red-50">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!results) {
    return null;
  }

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-medium">Results ({results.length})</h3>
      </div>
      <div className="border rounded overflow-auto max-h-80">
        {results.length > 0 ? (
          <pre className="p-4 text-sm font-mono overflow-x-auto">
            {JSON.stringify(results, null, 2)}
          </pre>
        ) : (
          <p className="p-4 text-center text-gray-500">No results found</p>
        )}
      </div>
    </div>
  );
}
