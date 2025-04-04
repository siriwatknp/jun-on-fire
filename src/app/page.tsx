"use client";

import { QueryBuilder } from "@/components/query-builder";

export default function Dashboard() {
  return (
    <div className="container mx-auto py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Jun on Fire</h1>
        <p className="text-gray-500">A better Firestore console experience</p>
      </header>

      <main>
        <QueryBuilder />
      </main>
    </div>
  );
}
