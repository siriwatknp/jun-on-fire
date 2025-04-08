"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Save,
  FileText,
  Trash2,
  PlusCircle,
  Pencil,
  Check,
  Heart,
} from "lucide-react";
import {
  collection,
  collectionGroup,
  getDocs,
  query,
  where,
  orderBy as firestoreOrderBy,
  limit as firestoreLimit,
  DocumentData,
  WhereFilterOp,
  getAggregateFromServer,
  count,
  sum,
  average,
  Timestamp,
} from "firebase/firestore";
import { db as firestoreDb } from "@/lib/firebase";
import { Toaster, toast } from "sonner";
import {
  getAllQueries,
  saveQuery as saveQueryToDb,
  deleteQuery as deleteQueryFromDb,
} from "@/lib/db";

import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";

// Import components directly from query-builder folder
import { QueryForm } from "@/components/query-builder/query-form";
import { QueryResults } from "@/components/query-builder/query-results";
import {
  QueryState,
  WhereClause,
  createDefaultQuery,
} from "@/components/query-builder/types";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  // Create a default query with a draft name
  const createDraftQuery = (draftNumber: number) => {
    const query = createDefaultQuery();
    query.title = `Draft Query #${draftNumber}`;
    return query;
  };

  // State for the currently active query - initialize with Draft Query #1
  const [currentQuery, setCurrentQuery] = useState<QueryState>(() =>
    createDraftQuery(1)
  );

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true); // Track initial loading state
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DocumentData[] | null>(null);
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Saved queries management
  const [savedQueries, setSavedQueries] = useState<QueryState[]>([]);
  const [activeQueryId, setActiveQueryId] = useState<string | null>(null);

  // Load saved queries from IndexedDB on component mount
  useEffect(() => {
    const loadQueries = async () => {
      setIsInitialLoading(true); // Set loading state to true when starting to load
      try {
        const storedQueries = await getAllQueries();

        if (storedQueries.length > 0) {
          setSavedQueries(storedQueries);
          toast.success(`Loaded ${storedQueries.length} queries from database`);

          // Determine the highest draft number from existing queries
          let highestDraftNumber = 0;
          storedQueries.forEach((query) => {
            const match = query.title.match(/Draft Query #(\d+)/);
            if (match && match[1]) {
              const draftNumber = parseInt(match[1], 10);
              if (!isNaN(draftNumber) && draftNumber > highestDraftNumber) {
                highestDraftNumber = draftNumber;
              }
            }
          });

          // Set the most recent query as active
          const mostRecent = storedQueries.sort(
            (a, b) => b.updatedAt - a.updatedAt
          )[0];
          loadQuery(mostRecent);
        } else {
          // If no saved queries, initialize with Draft Query #1 and save it
          const initialDraft = createDraftQuery(1);
          setSavedQueries([initialDraft]);
          setCurrentQuery(initialDraft);
          setActiveQueryId(initialDraft.id);

          // Save the initial draft to the database
          await saveQueryToDb(initialDraft);
        }
      } catch (error) {
        console.error("Error loading saved queries:", error);
        toast.error("Failed to load saved queries");
      } finally {
        setIsInitialLoading(false); // Set loading state to false when done
      }
    };

    loadQueries();
  }, []);

  // Create a new query with incremented draft number and save it to the list
  const createNewQuery = async () => {
    try {
      // Find the highest existing draft number
      let highestDraftNumber = 0;
      savedQueries.forEach((query) => {
        const match = query.title.match(/Draft Query #(\d+)/);
        if (match && match[1]) {
          const draftNumber = parseInt(match[1], 10);
          if (!isNaN(draftNumber) && draftNumber > highestDraftNumber) {
            highestDraftNumber = draftNumber;
          }
        }
      });

      // Use the highest existing draft number + 1
      const nextDraftNumber = highestDraftNumber + 1;

      // Create the new draft query
      const newDraftQuery = createDraftQuery(nextDraftNumber);

      // Update current query
      setCurrentQuery(newDraftQuery);
      setIsLoading(false);
      setError(null);
      setResults(null);

      // Add to saved queries list and save to IndexedDB
      const updatedQueries = [...savedQueries, newDraftQuery];
      setSavedQueries(updatedQueries);
      setActiveQueryId(newDraftQuery.id);

      // Save to database
      await saveQueryToDb(newDraftQuery);

      // Enter title edit mode for new queries
      setEditedTitle(newDraftQuery.title);
      setIsTitleEditing(true);
      setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.focus();
          titleInputRef.current.select();
        }
      }, 0);
    } catch (error) {
      console.error("Error creating new query:", error);
      toast.error("Failed to create new query");
    }
  };

  // Save the current query
  const saveQuery = async () => {
    try {
      // Prepare the query to be saved
      const queryToSave: QueryState = {
        ...currentQuery,
        id: activeQueryId || currentQuery.id,
        updatedAt: Date.now(),
      };

      // Determine if we're updating an existing query or adding a new one
      const updatedQueries = activeQueryId
        ? savedQueries.map((q) => (q.id === activeQueryId ? queryToSave : q))
        : [...savedQueries, queryToSave];

      setSavedQueries(updatedQueries);
      setActiveQueryId(queryToSave.id);

      // Save to database
      await saveQueryToDb(queryToSave);
      toast.success("Query saved successfully");
    } catch (error) {
      console.error("Error saving query:", error);
      toast.error("Failed to save query");
    }
  };

  // Load a saved query
  const loadQuery = (query: QueryState) => {
    setCurrentQuery({ ...query });
    setIsLoading(false);
    setError(null);
    setResults(null);
    setActiveQueryId(query.id);
    setIsTitleEditing(false); // Cancel any ongoing title editing
  };

  // Delete a saved query
  const deleteQuery = async (id: string) => {
    try {
      const updatedQueries = savedQueries.filter((q) => q.id !== id);
      setSavedQueries(updatedQueries);

      // Delete from database
      await deleteQueryFromDb(id);

      // If the deleted query was active, clear the active query
      if (activeQueryId === id) {
        setActiveQueryId(null);
        setCurrentQuery(createDefaultQuery()); // Use default query instead of null
        setResults(null);
        setError(null);
      }
    } catch (error) {
      console.error("Error deleting query:", error);
      toast.error("Failed to delete query");
    }
  };

  // Handle query form changes
  const handleQueryChange = (updatedQuery: QueryState) => {
    setCurrentQuery(updatedQuery);
  };

  // Handle title editing
  const startTitleEdit = () => {
    if (!activeQueryId) return;
    setEditedTitle(currentQuery.title);
    setIsTitleEditing(true);
    // Focus and select text in the next render cycle
    setTimeout(() => {
      if (titleInputRef.current) {
        titleInputRef.current.focus();
        titleInputRef.current.select();
      }
    }, 0);
  };

  const saveTitleEdit = async () => {
    if (!activeQueryId || !editedTitle.trim()) return;

    try {
      // Update the current query
      const updatedQuery = { ...currentQuery, title: editedTitle.trim() };
      setCurrentQuery(updatedQuery);

      // Update in saved queries list
      const updatedQueries = savedQueries.map((query) =>
        query.id === activeQueryId
          ? { ...query, title: editedTitle.trim() }
          : query
      );
      setSavedQueries(updatedQueries);

      // Save to database
      await saveQueryToDb(updatedQuery);

      // Exit edit mode
      setIsTitleEditing(false);
    } catch (error) {
      console.error("Error saving title edit:", error);
      toast.error("Failed to save title");
    }
  };

  const cancelTitleEdit = () => {
    setIsTitleEditing(false);
  };

  // Function to build and execute the Firestore query
  const executeQuery = async (queryToExecute: QueryState) => {
    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      // Validate path
      if (!queryToExecute.source.path.trim()) {
        throw new Error("Path is required");
      }

      // Start building the query
      let baseQuery;
      if (queryToExecute.source.type === "collection") {
        baseQuery = collection(firestoreDb, queryToExecute.source.path);
      } else {
        baseQuery = collectionGroup(firestoreDb, queryToExecute.source.path);
      }

      // Create an array to hold query constraints
      const constraints = [];

      // Add where clauses if enabled
      if (queryToExecute.constraints.where.enabled) {
        queryToExecute.constraints.where.clauses.forEach(
          (clause: WhereClause) => {
            if (clause.field && clause.value !== undefined) {
              // Validate null usage with operators - prevent invalid combinations
              if (
                clause.valueType === "null" &&
                ["<", "<=", ">", ">="].includes(clause.operator)
              ) {
                throw new Error(
                  `Invalid operator "${clause.operator}" with null value. Use "==" or "!=" instead.`
                );
              }

              // Parse value based on its type
              let parsedValue;

              // Handle array operators separately
              if (
                ["in", "not-in", "array-contains-any"].includes(clause.operator)
              ) {
                try {
                  // Attempt to parse as JSON array if it's a string representing an array
                  let parsedItems;
                  try {
                    parsedItems = JSON.parse(clause.value);
                  } catch {
                    // If not valid JSON, treat as a comma-separated list
                    parsedItems = clause.value
                      .split(",")
                      .map((item: string) => item.trim());
                  }

                  // Ensure it's an array
                  const arrayValue = Array.isArray(parsedItems)
                    ? parsedItems
                    : [parsedItems];

                  // Convert array items based on valueType
                  if (clause.valueType === "number") {
                    parsedValue = arrayValue.map((item) => Number(item));
                  } else if (clause.valueType === "boolean") {
                    parsedValue = arrayValue.map((item) =>
                      item === "true" || item === true ? true : false
                    );
                  } else if (clause.valueType === "null") {
                    parsedValue = arrayValue.map(() => null);
                  } else if (clause.valueType === "timestamp") {
                    try {
                      parsedValue = arrayValue.map((item) => {
                        const date = new Date(item);
                        if (isNaN(date.getTime())) {
                          throw new Error(
                            `Invalid date value in array: ${item}`
                          );
                        }
                        return Timestamp.fromDate(date);
                      });
                    } catch (e) {
                      console.error("Error parsing timestamp array:", e);
                      throw new Error(
                        `Invalid timestamp format in array. Use ISO format (YYYY-MM-DDTHH:MM:SS.sssZ).`
                      );
                    }
                  } else {
                    // Default to string
                    parsedValue = arrayValue;
                  }

                  constraints.push(
                    where(
                      clause.field,
                      clause.operator as WhereFilterOp,
                      parsedValue
                    )
                  );
                } catch (e) {
                  console.error("Error parsing array value:", e);
                  throw new Error(
                    `Invalid value for ${clause.operator} operator. Expected an array.`
                  );
                }
              } else {
                // For non-array operators, handle value based on its type
                if (clause.valueType === "number") {
                  parsedValue = Number(clause.value);
                  if (isNaN(parsedValue)) {
                    throw new Error(`Invalid number value: ${clause.value}`);
                  }
                } else if (clause.valueType === "boolean") {
                  parsedValue = clause.value === "true";
                } else if (clause.valueType === "null") {
                  parsedValue = null;
                } else if (clause.valueType === "timestamp") {
                  try {
                    // Convert the ISO string or date string to a Firestore Timestamp
                    const date = new Date(clause.value);
                    if (isNaN(date.getTime())) {
                      throw new Error(`Invalid date value: ${clause.value}`);
                    }
                    parsedValue = Timestamp.fromDate(date);
                  } catch (e) {
                    console.error("Error parsing timestamp:", e);
                    throw new Error(
                      `Invalid timestamp format: ${clause.value}. Use ISO format (YYYY-MM-DDTHH:MM:SS.sssZ).`
                    );
                  }
                } else {
                  // Default to string
                  parsedValue = clause.value;
                }

                constraints.push(
                  where(
                    clause.field,
                    clause.operator as WhereFilterOp,
                    parsedValue
                  )
                );
              }
            }
          }
        );
      }

      // Add orderBy if enabled
      if (
        queryToExecute.constraints.orderBy.enabled &&
        queryToExecute.constraints.orderBy.field
      ) {
        constraints.push(
          firestoreOrderBy(
            queryToExecute.constraints.orderBy.field,
            queryToExecute.constraints.orderBy.direction
          )
        );
      }

      // Add limit if enabled
      if (
        queryToExecute.constraints.limit.enabled &&
        queryToExecute.constraints.limit.value
      ) {
        const limitValue = Number(queryToExecute.constraints.limit.value);
        if (!isNaN(limitValue) && limitValue > 0) {
          constraints.push(firestoreLimit(limitValue));
        }
      }

      // Check if we're doing an aggregation query
      const isAggregationQuery =
        queryToExecute.aggregation.count.enabled ||
        queryToExecute.aggregation.sum.enabled ||
        queryToExecute.aggregation.average.enabled;

      if (isAggregationQuery) {
        // Validate field inputs for sum and average
        if (
          queryToExecute.aggregation.sum.enabled &&
          queryToExecute.aggregation.sum.fields.length === 0
        ) {
          throw new Error(
            "At least one field must be specified for sum aggregation"
          );
        }

        if (
          queryToExecute.aggregation.average.enabled &&
          queryToExecute.aggregation.average.fields.length === 0
        ) {
          throw new Error(
            "At least one field must be specified for average aggregation"
          );
        }

        // Build the base query with all constraints
        const constrainedQuery = query(baseQuery, ...constraints);

        // Create an object to hold our aggregation specifications
        const aggregateSpec: Record<
          string,
          ReturnType<typeof count | typeof sum | typeof average>
        > = {};

        // Add the requested aggregations
        if (queryToExecute.aggregation.count.enabled) {
          aggregateSpec.count = count();
        }

        // Add sum for each field
        if (queryToExecute.aggregation.sum.enabled) {
          queryToExecute.aggregation.sum.fields.forEach((field, index) => {
            if (field.trim() === "") {
              throw new Error(`Sum field ${index + 1} cannot be empty`);
            }
            aggregateSpec[`sum_${field}`] = sum(field);
          });
        }

        // Add average for each field
        if (queryToExecute.aggregation.average.enabled) {
          queryToExecute.aggregation.average.fields.forEach((field, index) => {
            if (field.trim() === "") {
              throw new Error(`Average field ${index + 1} cannot be empty`);
            }
            aggregateSpec[`avg_${field}`] = average(field);
          });
        }

        // Execute the aggregation query
        const aggregateSnapshot = await getAggregateFromServer(
          constrainedQuery,
          aggregateSpec
        );
        const aggregateData = aggregateSnapshot.data();

        // Format the results
        const formattedResults: {
          count?: number | null;
          sum?: Record<string, number | null>;
          average?: Record<string, number | null>;
        } = {};

        // Add count if enabled
        if (queryToExecute.aggregation.count.enabled) {
          formattedResults.count = aggregateData.count;
        }

        // Add sum results
        if (queryToExecute.aggregation.sum.enabled) {
          formattedResults.sum = {};
          queryToExecute.aggregation.sum.fields.forEach((field) => {
            if (formattedResults.sum) {
              formattedResults.sum[field] = aggregateData[`sum_${field}`];
            }
          });
        }

        // Add average results
        if (queryToExecute.aggregation.average.enabled) {
          formattedResults.average = {};
          queryToExecute.aggregation.average.fields.forEach((field) => {
            if (formattedResults.average) {
              formattedResults.average[field] = aggregateData[`avg_${field}`];
            }
          });
        }

        setResults([formattedResults]);
      } else {
        // For non-aggregation queries, use the regular approach
        // Build the final query
        const firestoreQuery = query(baseQuery, ...constraints);

        // Execute the query
        const querySnapshot = await getDocs(firestoreQuery);

        // Process the results
        const queryResults: DocumentData[] = [];
        querySnapshot.forEach((doc) => {
          queryResults.push({
            id: doc.id,
            path: doc.ref.path,
            ...doc.data(),
          });
        });

        setResults(queryResults);
      }
    } catch (err) {
      console.error("Error executing query:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage); // Still set error state for the QueryResults component
      toast.error(errorMessage); // Also show a toast notification
    } finally {
      setIsLoading(false);
    }
  };

  // Function to toggle favorite status of a query
  const toggleFavorite = async (queryId: string, event: React.MouseEvent) => {
    // Prevent event propagation to avoid triggering the query selection
    event.stopPropagation();

    try {
      // Find the query
      const query = savedQueries.find((q) => q.id === queryId);
      if (!query) return;

      // Update the query's favorite status
      const updatedQuery = {
        ...query,
        favorite: !query.favorite,
        updatedAt: Date.now(),
      };

      // Update in saved queries list
      const updatedQueries = savedQueries.map((q) =>
        q.id === queryId ? updatedQuery : q
      );
      setSavedQueries(updatedQueries);

      // Update active query if this is the current one
      if (activeQueryId === queryId) {
        setCurrentQuery(updatedQuery);
      }

      // Save to database
      await saveQueryToDb(updatedQuery);

      toast.success(
        updatedQuery.favorite
          ? "Query added to favorites"
          : "Query removed from favorites"
      );
    } catch (error) {
      console.error("Error updating favorite status:", error);
      toast.error("Failed to update favorite status");
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex-1 flex overflow-hidden">
        <Toaster position="top-right" richColors />
        {/* Sidebar component - direct child of flex container */}
        <Sidebar variant="sidebar" collapsible="icon" className="border-r">
          <SidebarHeader className="flex items-center justify-between p-3 border-b">
            {isInitialLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={createNewQuery}
                className="w-full"
                disabled={isInitialLoading}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                New Query
              </Button>
            )}
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="px-4">My Queries</SidebarGroupLabel>
              <SidebarGroupContent>
                {isInitialLoading ? (
                  <div className="space-y-2 p-2">
                    {/* Skeleton items for the sidebar queries */}
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="px-4 py-2 min-h-[60px]">
                        <div className="flex flex-col space-y-2">
                          <div className="flex items-center">
                            <Skeleton className="h-4 w-4 mr-2" />
                            <Skeleton className="h-5 w-32" />
                          </div>
                          <div className="flex ml-6 space-x-1">
                            <Skeleton className="h-4 w-10 rounded-full" />
                            <Skeleton className="h-4 w-14 rounded-full" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : savedQueries.length === 0 ? (
                  <p className="text-sm text-gray-500 px-4 py-2">
                    No saved queries yet
                  </p>
                ) : (
                  <SidebarMenu>
                    {savedQueries
                      // Sort by favorite first, then by updatedAt
                      .sort((a, b) => {
                        // First sort by favorite status (favorite first)
                        if (a.favorite && !b.favorite) return -1;
                        if (!a.favorite && b.favorite) return 1;
                        // Then sort by updatedAt for queries with the same favorite status
                        return b.updatedAt - a.updatedAt;
                      })
                      .map((query) => (
                        <SidebarMenuItem key={query.id}>
                          <SidebarMenuButton
                            isActive={activeQueryId === query.id}
                            onClick={() => loadQuery(query)}
                            className="px-4 py-2 min-h-[60px]"
                          >
                            <div className="flex flex-col items-start w-full">
                              <div className="flex items-center w-full">
                                <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                                <span className="truncate">{query.title}</span>
                              </div>

                              {/* Query info chips */}
                              <div className="flex flex-wrap gap-1 mt-1 ml-6">
                                {/* Source type chip */}
                                <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  {query.source.type === "collection"
                                    ? "col"
                                    : "grp"}
                                </span>

                                {/* Constraints chip - show if any constraint is enabled */}
                                {(query.constraints.where.enabled ||
                                  query.constraints.orderBy.enabled ||
                                  query.constraints.limit.enabled) && (
                                  <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                    const
                                  </span>
                                )}

                                {/* Aggregation chip - show if any aggregation is enabled */}
                                {(query.aggregation.count.enabled ||
                                  query.aggregation.sum.enabled ||
                                  query.aggregation.average.enabled) && (
                                  <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                    agg
                                  </span>
                                )}
                              </div>
                            </div>
                          </SidebarMenuButton>
                          <SidebarMenuAction
                            className="right-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(query.id, e);
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              // Only handle double click if it's already favorited
                              if (query.favorite) {
                                toggleFavorite(query.id, e);
                              }
                            }}
                            title={
                              query.favorite
                                ? "Double-click to unfavorite"
                                : "Click to favorite"
                            }
                            aria-label={
                              query.favorite
                                ? "Favorited query"
                                : "Add to favorites"
                            }
                          >
                            <Heart
                              className={`h-3 w-3 ${
                                query.favorite
                                  ? "fill-red-500 text-red-500"
                                  : ""
                              }`}
                            />
                          </SidebarMenuAction>
                          <SidebarMenuAction
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteQuery(query.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                            <span className="sr-only">Delete</span>
                          </SidebarMenuAction>
                        </SidebarMenuItem>
                      ))}
                  </SidebarMenu>
                )}
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        {/* Main content area - direct sibling of Sidebar */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center p-4 border-b">
            <SidebarTrigger className="mr-2" />
            <h2 className="text-lg font-semibold">Query Builder</h2>
          </div>

          <div className="flex-1 overflow-auto p-4 min-h-[calc(100vh-4rem)]">
            {isInitialLoading ? (
              <div className="space-y-6 p-4">
                {/* Title and save button skeleton */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-7 w-48" />
                  </div>
                  <Skeleton className="h-9 w-28" />
                </div>

                {/* Content in side-by-side layout for desktop */}
                <div className="flex flex-col xl:flex-row gap-4">
                  {/* Query form skeleton - left side */}
                  <div className="w-full xl:w-3/5 space-y-4">
                    {/* Source section skeleton */}
                    <div className="space-y-2 border rounded-lg p-4">
                      <Skeleton className="h-5 w-24" />
                      <div className="flex space-x-4">
                        <Skeleton className="h-10 w-36" />
                        <Skeleton className="h-10 flex-1" />
                      </div>
                    </div>

                    {/* Query options skeleton */}
                    <div className="space-y-3 border rounded-lg p-4">
                      <Skeleton className="h-5 w-32" />
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-6 w-24" />
                      </div>
                    </div>

                    {/* Execute button skeleton */}
                    <div className="flex justify-end">
                      <Skeleton className="h-9 w-36" />
                    </div>
                  </div>

                  {/* Results area skeleton - right side */}
                  <div className="w-full xl:w-2/5 space-y-3">
                    <Skeleton className="h-6 w-32" />
                    <div className="border rounded-lg p-4">
                      <div className="space-y-2">
                        {/* Table header skeleton */}
                        <div className="flex border-b pb-2">
                          <Skeleton className="h-5 w-24 mr-4" />
                          <Skeleton className="h-5 w-24 mr-4" />
                          <Skeleton className="h-5 w-24" />
                        </div>
                        {/* Table rows skeleton */}
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex py-2">
                            <Skeleton className="h-4 w-24 mr-4" />
                            <Skeleton className="h-4 w-24 mr-4" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeQueryId ? (
              <div className="flex flex-col gap-4">
                {/* Title and Save button row */}
                <div className="flex justify-between items-center">
                  {/* Editable Title */}
                  {isTitleEditing ? (
                    <div className="flex items-center gap-2 flex-1 mr-4">
                      <Pencil className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <div className="flex-1 flex items-center">
                        <input
                          ref={titleInputRef}
                          type="text"
                          value={editedTitle}
                          onChange={(e) => setEditedTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveTitleEdit();
                            if (e.key === "Escape") cancelTitleEdit();
                          }}
                          className="flex-1 px-2 py-1 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <Button
                          size="sm"
                          onClick={saveTitleEdit}
                          className="rounded-l-none h-[34px]"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={startTitleEdit}
                      className="flex items-center gap-2 cursor-pointer group"
                    >
                      <Pencil className="h-4 w-4 text-gray-500" />
                      <h2 className="text-lg font-medium group-hover:underline">
                        {currentQuery.title}
                      </h2>
                    </div>
                  )}

                  {/* Save button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={saveQuery}
                    className="flex items-center gap-1 whitespace-nowrap"
                    title="Save query"
                  >
                    <Save className="h-4 w-4" />
                    Save Query
                  </Button>
                </div>

                {/* Content layout - switch to side-by-side on desktop */}
                <div className="flex flex-col xl:flex-row gap-4">
                  {/* Query Form - takes less space on desktop */}
                  <div className="w-full xl:w-3/5">
                    <QueryForm
                      query={currentQuery}
                      onChange={handleQueryChange}
                      onExecute={executeQuery}
                      isLoading={isLoading}
                    />
                  </div>

                  {/* Query Results - takes remaining space on desktop */}
                  <div className="w-full xl:w-2/5">
                    <QueryResults
                      isLoading={isLoading}
                      error={error}
                      results={results}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center p-8 max-w-md">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium mb-2">
                    No query selected
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Select a query from the sidebar or create a new query to get
                    started.
                  </p>
                  <Button
                    onClick={createNewQuery}
                    className="flex mx-auto items-center gap-2"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Create New Query
                  </Button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
