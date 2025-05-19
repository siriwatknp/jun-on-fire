import * as dotenv from "dotenv";

dotenv.config();

import * as fs from "fs";
import * as path from "path";
import { auth, db } from "../src/lib/firebase";
import { connectAuthEmulator } from "firebase/auth";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  connectFirestoreEmulator,
} from "firebase/firestore";

connectAuthEmulator(auth, "http://localhost:9099", {
  disableWarnings: true,
});
connectFirestoreEmulator(db, "localhost", 8080);

// Simple random data helpers
function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomItem<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}
function randomItems<T>(arr: T[], count: number): T[] {
  const set = new Set<T>();
  while (set.size < count) set.add(randomItem(arr));
  return Array.from(set);
}

// Generate tags
const tags = Array.from({ length: 20 }, (_, i) => ({
  name: `Tag ${i + 1}`,
  description: `Description for tag ${i + 1}`,
}));

// Generate users
const users = Array.from({ length: 100 }, (_, i) => {
  const name = `User${i + 1}`;
  const email = `user${i + 1}@example.com`;
  const avatar = `https://i.pravatar.cc/150?img=${(i % 70) + 1}`;
  const favoriteTag = randomItem(tags).name;
  return { name, email, avatar, favoriteTag };
});

// Generate groups
const groups = Array.from({ length: 10 }, (_, i) => {
  const name = `Group ${i + 1}`;
  const ownerEmail = randomItem(users).email;
  return { name, ownerEmail };
});

// Generate posts
const posts = Array.from({ length: 300 }, (_, i) => {
  const title = `Post Title ${i + 1}`;
  const content = `This is the content of post ${i + 1}.`;
  const author = randomItem(users).name;
  const tagCount = randomInt(1, 5);
  const tagNames = randomItems(
    tags.map((t) => t.name),
    tagCount
  );
  const createdAt = new Date();
  return { title, content, author, tagNames, createdAt };
});

// Generate comments
const comments: Array<{
  postTitle: string;
  authorEmail: string;
  content: string;
  createdAt: Date;
}> = [];
posts.forEach((post) => {
  const commentCount = randomInt(0, 20);
  for (let i = 0; i < commentCount; i++) {
    comments.push({
      postTitle: post.title,
      authorEmail: randomItem(users).email,
      content: `Comment ${i + 1} on ${post.title}`,
      createdAt: new Date(),
    });
  }
});

// Generate activities for each user
const activitiesByUser: Record<
  string,
  Array<{
    type: string;
    timestamp: Date;
    description: string;
    postTitle?: string;
  }>
> = {};
users.forEach((user) => {
  const activityCount = randomInt(2, 3);
  const userActivities = [];
  for (let i = 0; i < activityCount; i++) {
    const hasPost = Math.random() < 0.7; // 70% chance to reference a post
    let postTitle: string | undefined = undefined;
    if (hasPost) {
      postTitle = randomItem(posts).title;
    }
    userActivities.push({
      type: hasPost ? "create_post" : "update_profile",
      timestamp: new Date(),
      description: hasPost
        ? `Created post ${postTitle}`
        : "Updated profile information.",
      ...(hasPost ? { postTitle } : {}),
    });
  }
  activitiesByUser[user.email] = userActivities;
});

// --- Write schemaContent to shared/schema-base.ts ---
const schemaContent = `/**
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

export interface SchemaDefinition {
  users: {
    name: string;
    email: string;
    avatar: string;
    favoriteTag: string;
  },
  posts: {
    title: string;
    content: string;
    author: string;
    tagNames: Array<string>;
    createdAt: Date;
  },
  comments: {
    postTitle: string;
    authorEmail: string;
    content: string;
    createdAt: Date;
  },
  groups: {
    name: string;
    ownerEmail: string;
  },
  tags: {
    name: string;
    description: string;
  }
}
`;

fs.writeFileSync(
  path.resolve(__dirname, "../shared/schema-base.ts"),
  schemaContent,
  "utf-8"
);

async function main() {
  // Add tags
  await Promise.all(tags.map((tag) => setDoc(doc(db, "tags", tag.name), tag)));
  console.log("✓ Tags added successfully");

  // Add users
  await Promise.all(
    users.map(async (user) => {
      await setDoc(doc(db, "users", user.email), user);
      const acts = activitiesByUser[user.email] || [];
      await Promise.all(
        acts.map((act) =>
          addDoc(collection(db, "users", user.email, "activities"), act)
        )
      );
    })
  );
  console.log("✓ Users added successfully");

  // Add groups
  await Promise.all(
    groups.map((group) => setDoc(doc(db, "groups", group.name), group))
  );
  console.log("✓ Groups added successfully");

  // Add posts
  await Promise.all(posts.map((post) => addDoc(collection(db, "posts"), post)));
  console.log("✓ Posts added successfully");

  // Add comments
  await Promise.all(
    comments.map((comment) => addDoc(collection(db, "comments"), comment))
  );
  console.log("✓ Comments added successfully");

  console.log("Mock data populated to Firestore emulator.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
