# Node Obfuscate

A Hono.js server with TypeScript, compiled to JavaScript bytecode for obfuscation using [bytenode](https://github.com/bytenode/bytenode).

## Features

- TypeScript + Hono.js web server
- Bytecode obfuscation with bytenode
- CommonJS output for bytenode compatibility
- Development mode with hot reload

## Routes

| Method | Endpoint  | Description           |
| ------ | --------- | --------------------- |
| GET    | `/`       | Returns "Hello Hono!" |
| POST   | `/post`   | Echoes JSON body      |
| PUT    | `/put`    | Echoes JSON body      |
| DELETE | `/delete` | Returns confirmation  |

## Quick Start

```bash
# Install dependencies
npm install

# Development (hot reload)
npm run dev

# Production build (TypeScript only)
npm run build

# Production build with bytecode obfuscation
npm run build:obfuscate
```

## Running the Server

### Development Mode

```bash
npm run dev
```

Server runs at http://localhost:3000

### Production (Plain JavaScript)

```bash
npm run build
npm run start:raw
```

### Production (Obfuscated)

```bash
npm run build:obfuscate
npm run start
```

## Testing

Use the provided `test.http` file with VS Code's REST Client extension, or use curl:

```bash
# GET /
curl http://localhost:3000

# POST /post
curl -X POST http://localhost:3000/post \
  -H "Content-Type: application/json" \
  -d '{"name":"test","value":123}'

# PUT /put
curl -X PUT http://localhost:3000/put \
  -H "Content-Type: application/json" \
  -d '{"name":"updated","value":456}'

# DELETE /delete
curl -X DELETE http://localhost:3000/delete
```

## Project Structure

```
bytecode-obfuscate/
├── src/
│   └── index.ts      # Application source code
├── dist/
│   ├── index.js      # Compiled JavaScript
│   └── index.jsc     # Obfuscated bytecode
├── test.http         # HTTP test requests
├── tsconfig.json     # TypeScript configuration
└── package.json      # Dependencies and scripts
```

## Notes

- Bytenode compiles CommonJS JavaScript to V8 bytecode (`.jsc` files)
- CommonJS can be mangled before obfuscation
- Bytecode can only be executed on the same Node.js version it was compiled with
- To run `.jsc` files, use `node -r bytenode` or require bytenode first
