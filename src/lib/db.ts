import Dexie, { Table } from "dexie";
import { QueryState } from "@/components/query-builder/types";

export class AppDatabase extends Dexie {
  queries!: Table<QueryState, string>; // string is the type of the primary key

  constructor() {
    super("FirestoreQueryBuilderDB");

    // Define the database schema
    this.version(1).stores({
      queries: "id, title, updatedAt", // Primary key is id, and we index title and updatedAt
    });
  }
}

// Create a singleton instance of the database
export const db = new AppDatabase();

// Helper functions for database operations
export async function getAllQueries(): Promise<QueryState[]> {
  return await db.queries.toArray();
}

export async function getQueryById(
  id: string
): Promise<QueryState | undefined> {
  return await db.queries.get(id);
}

export async function saveQuery(query: QueryState): Promise<string> {
  return await db.queries.put(query);
}

export async function deleteQuery(id: string): Promise<void> {
  await db.queries.delete(id);
}

export async function getLatestQuery(): Promise<QueryState | undefined> {
  return await db.queries.orderBy("updatedAt").reverse().first();
}
