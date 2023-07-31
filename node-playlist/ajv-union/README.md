# Ajv - union type check

Ajv cannot validate a union in a list correctly.

```typescript
type A = { age: number } | { from: string };

type Trial = A[];

const target: Trial = [{ age: 11 }, { from: 'north' }];
//                        ^ajv cannot perform check well
```

**Solution**: avoid using union type in Ajv, use two different keys with different types.

## Usage

```bash
# generating the schema.js and schema.json for ajv validation
node prepare schema.js

# modify try.js and run to check ajv validation
node src/try.js
```
