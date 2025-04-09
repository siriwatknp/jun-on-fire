# Jun on Fire

A better Firebase console for busy developers.

## Project Overview

Jun on Fire is designed to provide a more efficient and user-friendly interface for managing Firebase projects. It aims to streamline workflows for developers who frequently interact with Firebase, offering enhanced features and a more intuitive user experience.

## Key Features

### Firestore

**Query Builder**

- **Intuitive Interface**: The Query Builder offers a user-friendly interface to construct complex queries with ease. Users can add, update, and delete query constraints dynamically, reducing the amount of clicks needed to create queries.

- **Schema-Aware**: The Query Builder leverages schema metadata to provide intelligent suggestions and validations, ensuring that queries are constructed with valid fields and types.

- **Dynamic Field/Value Suggestions**: The component provides field suggestions based on the current entity type, helping users to quickly select the appropriate fields for their queries. The value is inferred from the detected schema, ensuring accurate and relevant suggestions.

- **Flexible Query Constraints**: Users can add multiple `where` clauses with various operators and value types, such as strings, numbers, booleans, timestamps, and nulls. The Query Builder automatically adjusts the value type based on the selected field and provides type-specific input handling.

- **Aggregation Support**: The Query Builder supports aggregation functions like sum and average, allowing users to perform calculations on their data directly within the query interface.

- **Saved/Favorite Queries**: Users can save their frequently used queries for quick access, allowing them to efficiently manage and execute their favorite queries without having to recreate them each time.

**Query Result**

- **Dual View Modes**: Users can toggle between table and JSON views, allowing them to choose the most convenient format for analyzing their data.

- **Interactive Data Table**: The table view supports sorting, filtering, and column visibility toggling, enabling users to customize their data presentation for better insights.

- **Real-time Feedback**: The interface provides immediate feedback through toast notifications, informing users of successful actions or errors, such as query execution or creation.

- **Timezone-Aware Date Formatting**: Dates are automatically formatted to the user's local timezone (e.g., Bangkok), ensuring that timestamps are always relevant and easy to interpret.

- **Seamless Query Creation**: Users can create new queries directly from the results interface by clicking on collection references, streamlining the process of exploring related data.

- **Error Handling**: Robust error handling ensures that users are informed of any issues during query execution or data retrieval, maintaining a smooth user experience.

**Security**

Support email/password login to gain authentication access for queries data.

## Tech Stack

- **Frontend**: ReactJS, NextJS (v15 with static site generation)
- **Languages**: TypeScript, JavaScript
- **Styling**: TailwindCSS
- **Backend**: Firebase (Firestore, Authentication)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```bash
   cd jun-on-fire
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Set up environment variables by copying `.env.example` to `.env.local` and filling in the required values.
5. Start the development server:
   ```bash
   npm run dev
   ```

## Directory Structure

- `src/components/query-builder/`: Components related to building and displaying queries.
- `src/components/ui/`: UI components.
- `src/lib/`: Utility functions or libraries used across the project.
- `src/hooks/`: Custom React hooks.
- `src/contexts/`: Context providers for managing global state.

## Usage

- Access the application at `http://localhost:4416` after starting the development server.
- Use the Query Builder to construct and execute queries.
- View query results in table or JSON format.

## Contributing

- Fork the repository and create a new branch for your feature or bugfix.
- Submit a pull request with a clear description of your changes.

## License

This project is licensed under the MIT License.
