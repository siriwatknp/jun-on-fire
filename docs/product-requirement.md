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

Support value type

- [x] string
- [x] string with format
- [ ] array of ids
- [ ] map (key of ids)
- [ ] nested object with the above type
- [ ] array of object with the above type

### Aggregation

- [ ] sum values of map
- [ ] sum values of array

### Smart Json View
