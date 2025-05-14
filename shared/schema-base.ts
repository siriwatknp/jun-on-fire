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
export const fieldMetadata: Record<string, Record<string, FieldMetadata>> = {
  users: {
    name: { type: "string" },
    email: { type: "string" },
    avatar: { type: "string" },
    favoriteTag: { type: "string", collectionRef: "tags", refField: "name" },
  },
  posts: {
    title: { type: "string" },
    content: { type: "string" },
    author: { type: "string", collectionRef: "users", refField: "name" },
    tagNames: { type: "array", collectionRef: "tags", refField: "name" },
    createdAt: { type: "timestamp" },
  },
  comments: {
    postTitle: { type: "string", collectionRef: "posts", refField: "title" },
    authorEmail: { type: "string", collectionRef: "users", refField: "email" },
    content: { type: "string" },
    createdAt: { type: "timestamp" },
  },
  groups: {
    name: { type: "string" },
    ownerEmail: { type: "string", collectionRef: "users", refField: "email" },
  },
  tags: {
    name: { type: "string" },
    description: { type: "string" },
  },
};

/**
 * Type mapping from entity names to their schema definitions
 */
export type BaseSchemaDefinition = Record<string, unknown>;
