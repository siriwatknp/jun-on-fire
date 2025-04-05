"use client";

import React, { useState, useEffect } from "react";
import { Save, FileText, Trash2, PlusCircle } from "lucide-react";
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
} from "firebase/firestore";
import { db } from "@/lib/firebase";

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
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DocumentData[] | null>(null);

  // Saved queries management
  const [savedQueries, setSavedQueries] = useState<QueryState[]>([]);
  const [activeQueryId, setActiveQueryId] = useState<string | null>(null);

  // Load saved queries from localStorage on component mount
  useEffect(() => {
    const storedQueries = localStorage.getItem("savedQueries");
    if (storedQueries) {
      try {
        const parsedQueries = JSON.parse(storedQueries) as QueryState[];
        setSavedQueries(parsedQueries);

        // Determine the highest draft number from existing queries
        let highestDraftNumber = 0;
        parsedQueries.forEach((query) => {
          const match = query.title.match(/Draft Query #(\d+)/);
          if (match && match[1]) {
            const draftNumber = parseInt(match[1], 10);
            if (!isNaN(draftNumber) && draftNumber > highestDraftNumber) {
              highestDraftNumber = draftNumber;
            }
          }
        });

        // If there are saved queries, set the most recent one as active
        if (parsedQueries.length > 0) {
          const mostRecent = parsedQueries.sort(
            (a, b) => b.updatedAt - a.updatedAt
          )[0];
          loadQuery(mostRecent);
        }
      } catch (error) {
        console.error("Error loading saved queries:", error);
      }
    } else {
      // If no saved queries, initialize with Draft Query #1 and save it
      const initialDraft = createDraftQuery(1);
      setSavedQueries([initialDraft]);
      setCurrentQuery(initialDraft);
      setActiveQueryId(initialDraft.id);
    }
  }, []);

  // Save queries to localStorage whenever savedQueries changes
  useEffect(() => {
    localStorage.setItem("savedQueries", JSON.stringify(savedQueries));
  }, [savedQueries]);

  // Create a new query with incremented draft number and save it to the list
  const createNewQuery = () => {
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

    // Add to saved queries list
    const updatedQueries = [...savedQueries, newDraftQuery];
    setSavedQueries(updatedQueries);
    setActiveQueryId(newDraftQuery.id);
  };

  // Save the current query
  const saveQuery = () => {
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
  };

  // Load a saved query
  const loadQuery = (query: QueryState) => {
    setCurrentQuery({ ...query });
    setIsLoading(false);
    setError(null);
    setResults(null);
    setActiveQueryId(query.id);
  };

  // Delete a saved query
  const deleteQuery = (id: string) => {
    const updatedQueries = savedQueries.filter((q) => q.id !== id);
    setSavedQueries(updatedQueries);

    // If the deleted query was active, clear the active query
    if (activeQueryId === id) {
      setActiveQueryId(null);
      setCurrentQuery(null as any); // Clear current query
      setResults(null);
      setError(null);
    }
  };

  // Handle query form changes
  const handleQueryChange = (updatedQuery: QueryState) => {
    setCurrentQuery(updatedQuery);
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
        baseQuery = collection(db, queryToExecute.source.path);
      } else {
        baseQuery = collectionGroup(db, queryToExecute.source.path);
      }

      // Create an array to hold query constraints
      const constraints = [];

      // Add where clauses if enabled
      if (queryToExecute.constraints.where.enabled) {
        queryToExecute.constraints.where.clauses.forEach(
          (clause: WhereClause) => {
            if (clause.field && clause.value) {
              // Handle array operators differently
              if (
                ["in", "not-in", "array-contains-any"].includes(clause.operator)
              ) {
                try {
                  // Attempt to parse as JSON array if it's a string representing an array
                  let parsedValue;
                  try {
                    parsedValue = JSON.parse(clause.value);
                  } catch (e) {
                    // If not valid JSON, treat as a comma-separated list
                    parsedValue = clause.value
                      .split(",")
                      .map((item: string) => item.trim());
                  }

                  // Ensure it's an array
                  const arrayValue = Array.isArray(parsedValue)
                    ? parsedValue
                    : [parsedValue];
                  constraints.push(
                    where(
                      clause.field,
                      clause.operator as WhereFilterOp,
                      arrayValue
                    )
                  );
                } catch (e) {
                  console.error("Error parsing array value:", e);
                  throw new Error(
                    `Invalid value for ${clause.operator} operator. Expected an array.`
                  );
                }
              } else {
                // For non-array operators, use the value directly
                constraints.push(
                  where(
                    clause.field,
                    clause.operator as WhereFilterOp,
                    clause.value
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
          !queryToExecute.aggregation.sum.field
        ) {
          throw new Error("A field must be specified for sum aggregation");
        }

        if (
          queryToExecute.aggregation.average.enabled &&
          !queryToExecute.aggregation.average.field
        ) {
          throw new Error("A field must be specified for average aggregation");
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

        if (queryToExecute.aggregation.sum.enabled) {
          aggregateSpec.sum = sum(queryToExecute.aggregation.sum.field);
        }

        if (queryToExecute.aggregation.average.enabled) {
          aggregateSpec.average = average(
            queryToExecute.aggregation.average.field
          );
        }

        // Execute the aggregation query
        const aggregateSnapshot = await getAggregateFromServer(
          constrainedQuery,
          aggregateSpec
        );
        const aggregateData = aggregateSnapshot.data();

        // Format the results
        const formattedResults: any = {};

        if (queryToExecute.aggregation.count.enabled) {
          formattedResults.count = aggregateData.count;
        }

        if (queryToExecute.aggregation.sum.enabled) {
          formattedResults.sum = aggregateData.sum;
        }

        if (queryToExecute.aggregation.average.enabled) {
          formattedResults.average = aggregateData.average;
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
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar component - direct child of flex container */}
        <Sidebar variant="sidebar" collapsible="icon" className="border-r">
          <SidebarHeader className="flex items-center justify-between p-4 border-b">
            <h2 className="font-semibold">Saved Queries</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={createNewQuery}
              className="h-8 w-8"
              title="Create new query"
            >
              <PlusCircle className="h-4 w-4" />
            </Button>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="px-4">My Queries</SidebarGroupLabel>
              <SidebarGroupContent>
                {savedQueries.length === 0 ? (
                  <p className="text-sm text-gray-500 px-4 py-2">
                    No saved queries yet
                  </p>
                ) : (
                  <SidebarMenu>
                    {savedQueries
                      .sort((a, b) => b.updatedAt - a.updatedAt)
                      .map((query) => (
                        <SidebarMenuItem key={query.id}>
                          <SidebarMenuButton
                            isActive={activeQueryId === query.id}
                            onClick={() => loadQuery(query)}
                            className="px-4 py-2"
                          >
                            <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span className="truncate">{query.title}</span>
                          </SidebarMenuButton>
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

          <div className="flex-1 overflow-auto p-4">
            {activeQueryId ? (
              <div className="flex flex-col gap-4">
                {/* Save button */}
                <div className="flex justify-end">
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

                {/* Query Form */}
                <QueryForm
                  query={currentQuery}
                  onChange={handleQueryChange}
                  onExecute={executeQuery}
                  isLoading={isLoading}
                />

                {/* Query Results */}
                <QueryResults
                  isLoading={isLoading}
                  error={error}
                  results={results}
                />
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
