import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

import { db } from "../src/lib/firebase";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  connectFirestoreEmulator,
} from "firebase/firestore";

connectFirestoreEmulator(db, "localhost", 8080);

// Mock data
const users = [
  {
    id: "user1",
    name: "Alice",
    avatar: "https://i.pravatar.cc/150?img=1",
    socials: {
      twitter: "https://twitter.com/alice",
      github: "https://github.com/alice",
    },
    favoritePosts: ["post2", "post3"],
  },
  {
    id: "user2",
    name: "Bob",
    avatar: "https://i.pravatar.cc/150?img=2",
    socials: {
      twitter: "https://twitter.com/bob",
      github: "https://github.com/bob",
    },
    favoritePosts: ["post1"],
  },
  {
    id: "user3",
    name: "Charlie",
    avatar: "https://i.pravatar.cc/150?img=3",
    socials: {
      twitter: "https://twitter.com/charlie",
      github: "https://github.com/charlie",
    },
    favoritePosts: ["post4", "post5"],
  },
];

const posts = [
  {
    id: "post1",
    title: "First Post",
    content: "This is the first post.",
    author: "user1",
    createdAt: new Date(),
  },
  {
    id: "post2",
    title: "Second Post",
    content: "This is the second post.",
    author: "user2",
    createdAt: new Date(),
  },
  {
    id: "post3",
    title: "Third Post",
    content: "This is the third post.",
    author: "user3",
    createdAt: new Date(),
  },
  {
    id: "post4",
    title: "Fourth Post",
    content: "This is the fourth post.",
    author: "user1",
    createdAt: new Date(),
  },
  {
    id: "post5",
    title: "Fifth Post",
    content: "This is the fifth post.",
    author: "user2",
    createdAt: new Date(),
  },
];

type Activity = {
  type: string;
  timestamp: Date;
  description: string;
  postId?: string;
};

const activities = [
  (userId: string, postId?: string) =>
    [
      {
        type: "update_profile",
        timestamp: new Date(),
        description: "Updated profile information.",
      },
      postId
        ? {
            type: "create_post",
            timestamp: new Date(),
            postId,
            description: `Created post ${postId}`,
          }
        : null,
    ].filter(Boolean),
];

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
}

/**
 * Metadata for all fields in the schemas
 */
export const fieldMetadata: Record<string, Record<string, FieldMetadata>> = {
  users: {
    name: { type: "string" },
    avatar: { type: "string" },
    socials: { type: "map" },
    favoritePosts: { type: "array", collectionRef: "posts" },
  },
  posts: {
    title: { type: "string" },
    content: { type: "string" },
    author: { type: "string", collectionRef: "users" },
    createdAt: { type: "timestamp" },
  },
  activities: {
    type: { type: "string" },
    timestamp: { type: "timestamp" },
    description: { type: "string" },
    postId: { type: "string", isNullable: true, collectionRef: "posts" },
  },
};

/**
 * Type mapping from entity names to their schema definitions
 */
export interface UsersSchema {
  name: string;
  avatar: string;
  socials: Record<string, string>;
  favoritePosts: string[];
}

export interface PostsSchema {
  title: string;
  content: string;
  author: string;
  createdAt: Date;
}

export interface ActivitiesSchema {
  type: string;
  timestamp: Date;
  description: string;
  postId?: string;
}

export interface SchemaDefinition {
  users: UsersSchema;
  posts: PostsSchema;
  activities: ActivitiesSchema;
}
`;

fs.writeFileSync(
  path.resolve(__dirname, "../shared/schema-base.ts"),
  schemaContent,
  "utf-8"
);

async function main() {
  // Add users
  for (const user of users) {
    await setDoc(doc(db, "users", user.id), {
      name: user.name,
      avatar: user.avatar,
      socials: user.socials,
      favoritePosts: user.favoritePosts,
    });
  }

  // Add posts
  for (const post of posts) {
    await setDoc(doc(db, "posts", post.id), {
      title: post.title,
      content: post.content,
      author: post.author,
      createdAt: post.createdAt,
    });
  }

  // Add activities for each user
  for (const user of users) {
    // Find posts by this user
    const userPosts = posts.filter((p) => p.author === user.id);
    // Add 2-3 activities per user
    const acts = [
      ...activities[0](user.id, userPosts[0]?.id),
      ...activities[0](user.id, userPosts[1]?.id),
    ].filter(Boolean) as Activity[];
    for (const act of acts) {
      await addDoc(collection(db, "users", user.id, "activities"), {
        ...act,
        timestamp: act.timestamp || new Date(),
      });
    }
  }

  console.log("Mock data populated to Firestore emulator.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
