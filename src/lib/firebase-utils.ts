import { DocumentSnapshot } from "firebase/firestore";

// Serializable document snapshot data for storage
export interface SerializableDocSnapshot {
  id: string;
  data: any;
  path: string;
}

// Helper function to serialize DocumentSnapshot for storage
export const serializeDocSnapshot = (doc: DocumentSnapshot | null): SerializableDocSnapshot | undefined => {
  if (!doc) return undefined;
  return {
    id: doc.id,
    data: doc.data(),
    path: doc.ref.path,
  };
};

// Helper function to deserialize DocumentSnapshot data
export const deserializeDocSnapshot = (snapData: SerializableDocSnapshot | undefined): DocumentSnapshot | null => {
  if (!snapData) return null;
  // Create a minimal DocumentSnapshot-like object that works with startAfter
  // We'll need to reconstruct this properly for Firebase pagination
  return {
    id: snapData.id,
    data: () => snapData.data,
    ref: { path: snapData.path },
  } as DocumentSnapshot;
};