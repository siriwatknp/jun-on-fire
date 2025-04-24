# Jun on Fire

A replicate of Firestore console but better experience.

## Query Builder

- Display query type with radio group with options `collection` and `collectionGroup`
  - a text input to type the path
- Query options, each contains checkbox at the begining for marking as used in the query
  - `where`: has 3 inputs next to it and has button below those input to support multiple where clauses
  - `orderBy`: has 2 inputs next to it
  - `limit`: has 1 input next to it
  - `sum`: has 1 input next to it
  - `count`: no input

### State management

Store queries as tree in a state, then travese the tree to transform into Firestore query call.

## Saved queries management

- User can create new query, the query will be saved as draft.
- Queries always saved when clicking "run query" and the result is shown (result also saved along the query)

## Query Result

### Collection Ref

Support field types with `collectionRef` in schema:

- [x] string (single document reference)
- [x] array of strings (multiple document references)
- [x] map with string values (key-value pairs of document references)
- [x] nested object containing the above types
- [x] array of objects containing the above types

When a field has `collectionRef` defined in the schema:

1. The value should be displayed as a clickable link in both views:
   - Table View: Show as a blue link with tooltip
   - JSON View: Show as a blue link next to the value
2. Clicking the link in either view creates a new query to fetch the referenced document(s)
3. For array fields, each item in the array should be a separate clickable link in both views
4. The collection reference path should support dynamic segments using `%s` which is replaced with the corresponding segment from the current query path

### Aggregation

- [ ] sum values of map
- [ ] sum values of array

### Smart Json View
