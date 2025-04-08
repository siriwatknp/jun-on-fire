"use client";

import React, { useMemo } from "react";
import { DocumentData, Timestamp } from "firebase/firestore";
import {
  fieldMetadata,
  processTimestampFields,
  SchemaDefinition,
} from "@/schema";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

// Setup dayjs for timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

interface QueryResultsProps {
  isLoading?: boolean;
  error?: string | null;
  results?: DocumentData[] | null;
  entityType?: keyof SchemaDefinition | string;
}

export function QueryResults({
  isLoading,
  error,
  results,
  entityType = "post", // Default to post if not specified
}: QueryResultsProps) {
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
            {JSON.stringify(processedResults, null, 2)}
          </pre>
        ) : (
          <p className="p-4 text-center text-gray-500">No results found</p>
        )}
      </div>
    </div>
  );
}
