import { Timestamp } from "firebase/firestore";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

// Setup dayjs for timezone support
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Schema definition for entities in the application.
 * These type definitions are used for:
 * 1. Autocompletion in query builder (where, order by, sum, average operations)
 * 2. Proper type handling in query results
 */

/**
 * Base interface for all schema entities
 */
export interface SchemaEntityBase {
  // Common fields that all entities might have
  id: string;
}

/**
 * Schema definition for a Post entity
 */
export interface PostSchema extends SchemaEntityBase {
  title: string | null;
  number: number;
  createdAt: Timestamp; // Stored as Firebase Timestamp in the database
}

/**
 * Type for all schema entities in the system
 */
export type SchemaEntity = PostSchema;

/**
 * Type mapping from entity names to their schema definitions
 */
export interface SchemaDefinition {
  post: PostSchema;
}

/**
 * Field metadata including display info and formatting functions
 */
export interface FieldMetadata {
  type:
    | "string"
    | "number"
    | "boolean"
    | "timestamp"
    | "array"
    | "map"
    | "null";
  displayName: string;
  description?: string;
  isNullable?: boolean;
}

/**
 * Metadata for all fields in the schemas
 */
export const fieldMetadata: Record<string, Record<string, FieldMetadata>> = {
  post: {
    title: {
      type: "string",
      displayName: "Title",
      description: "The title of the post",
      isNullable: true,
    },
    number: {
      type: "number",
      displayName: "Number",
      description: "A numeric value associated with the post",
    },
    createdAt: {
      type: "timestamp",
      displayName: "Created At",
      description: "When the post was created",
    },
  },
};

/**
 * Helper to format timestamp fields in query results
 * @param data The raw data from Firestore
 * @param entityType The type of entity being processed
 * @returns Processed data with timestamps converted to Date objects
 */
export function processTimestampFields<T extends keyof SchemaDefinition>(
  data: Record<string, unknown>,
  entityType: T
): Partial<SchemaDefinition[T]> {
  const result = { ...data };

  // Get field metadata for this entity type
  const metadata = fieldMetadata[entityType as string];
  if (!metadata) return result as Partial<SchemaDefinition[T]>;

  // Process each field
  Object.entries(metadata).forEach(([fieldName, meta]) => {
    // Convert timestamp fields to Date objects
    if (meta.type === "timestamp" && result[fieldName] instanceof Timestamp) {
      result[fieldName] = (result[fieldName] as Timestamp).toDate();
    }
  });

  return result as Partial<SchemaDefinition[T]>;
}

/**
 * Get the names of all fields of a specific type for a given entity
 * Useful for filtering fields for specific operations
 */
export function getFieldsByType(
  entityType: keyof SchemaDefinition,
  fieldType: FieldMetadata["type"] | FieldMetadata["type"][]
): string[] {
  const metadata = fieldMetadata[entityType as string];
  if (!metadata) return [];

  const fieldTypes = Array.isArray(fieldType) ? fieldType : [fieldType];

  return Object.entries(metadata)
    .filter(([, meta]) => fieldTypes.includes(meta.type))
    .map(([fieldName]) => fieldName);
}

/**
 * Get all field names for a specific entity
 */
export function getAllFields(entityType: keyof SchemaDefinition): string[] {
  const metadata = fieldMetadata[entityType as string];
  if (!metadata) return [];

  return Object.keys(metadata);
}
