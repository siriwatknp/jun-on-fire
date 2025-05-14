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
  isNullable?: boolean;
  /**
   * If present, the value is a document of this collection.
   */
  collectionRef?: string;
  /**
   * If present, the ref will use this value as a where clause
   */
  refField?: string;
}

/**
 * Metadata for all fields in the schemas
 */
export const fieldMetadata: Record<string, Record<string, FieldMetadata>> = {};

/**
 * Type mapping from entity names to their schema definitions
 */
export type BaseSchemaDefinition = Record<string, unknown>;
