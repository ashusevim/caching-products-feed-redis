# Caching Products Feed (Redis)

A minimal **TypeScript + Express** API that demonstrates using **Redis** to implement **rate limiting** and serves a sample **products feed** endpoint.

> Current implementation includes a `/products` route and an IP-based rate limiter powered by Redis `INCR` + `EXPIRE`.

## Features

- **Express** HTTP server
- **Redis-backed rate limiting** (per client IP)
    - Counts requests per IP in a 60-second window
    - Rejects requests after a threshold (currently `> 10` per minute)
- Sample endpoint:
    - `GET /products` → returns a JSON message

## Tech Stack

- Node.js (ESM)
- TypeScript
- Express
- Redis (official `redis` client)

## Project Structure

- `src/index.ts` — Express app, Redis client connection, rate limiter middleware, and routes
- `package.json` — dependencies and scripts
- `tsconfig.json` — TypeScript configuration

## Prerequisites

- **Node.js 18+** (recommended)
- **Redis server** running locally or remotely

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start Redis (example using Docker):

```bash
docker run --name redis -p 6379:6379 redis:latest
```

3. Run the server (TypeScript):

This repo includes `ts-node` and `nodemon` in dev dependencies, but scripts are not yet defined. You can run directly with:

```bash
npx ts-node src/index.ts
```

The server listens on:

- `http://localhost:3000`

## Usage

### Get products feed

```bash
curl http://localhost:3000/products
```

Example response:

```json
{ "message": "Here is the product feed" }
```

### Rate limiting behavior

- Requests are tracked by client IP (`req.ip`)
- Redis key format: `rate_limit:<ip>`
- Window: **60 seconds**
- Limit: **10 requests per window**
- After limit is exceeded, the server responds with HTTP **429**

## Configuration

The Redis client is currently created with default options:

```ts
const client = createClient();
```

If your Redis host/port differs from defaults, update the client configuration (e.g. via `REDIS_URL`) accordingly.

## Notes / Improvements

- Add proper response body + `return` for 429 responses (currently only sets status)
- Add `start` / `dev` scripts to `package.json`
- Add graceful shutdown and Redis error handling
- Implement real caching for an actual product feed response payload

## License

No license specified yet.
