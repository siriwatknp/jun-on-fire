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
}

/**
 * Metadata for all fields in the schemas
 */
export const fieldMetadata: Record<string, Record<string, FieldMetadata>> = {
  // post: {
  //   author: {
  //     type: "string",
  //     collectionRef: "users",
  //   },
  //   title: {
  //     type: "string",
  //     isNullable: true,
  //   },
  //   number: {
  //     type: "number",
  //   },
  //   createdAt: {
  //     type: "timestamp",
  //   },
  // },
};

/**
 * Type mapping from entity names to their schema definitions
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SchemaDefinition {}
