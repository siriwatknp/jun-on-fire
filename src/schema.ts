import { Timestamp } from "firebase/firestore";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
  fieldMetadata as baseFieldMetadata,
  type SchemaDefinition,
  type FieldMetadata,
} from "../packages/shared/schema-base";

let fieldMetadata = baseFieldMetadata;

if (process.env.NEXT_PUBLIC_FIREBASE_ENV === "production") {
  try {
    fieldMetadata =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("../packages/shared/schema-production").fieldMetadata;
  } catch {}
}

export type {
  FieldMetadata,
  SchemaDefinition,
} from "../packages/shared/schema-base";

export { fieldMetadata };

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
