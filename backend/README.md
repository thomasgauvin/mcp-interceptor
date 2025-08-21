# MCP Interceptor Backend

The Cloudflare Workers API backend for the MCP Interceptor service. Built with Hono framework and Durable Objects.

## Development

Start the development server:

```bash
npm install
npm run dev
```

## Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

## Type Generation

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```bash
npm run cf-typegen
```

## Architecture

The backend uses Durable Objects to maintain interceptor state and WebSocket connections. Pass the `CloudflareBindings` as generics when instantiating `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: Env }>()
```

## Key Components

- **API Routes**: Create and manage interceptors via REST endpoints
- **Durable Objects**: Persistent state management for each interceptor
- **WebSocket Support**: Real-time monitoring capabilities
- **Proxy Engine**: Routes and logs MCP server communications
