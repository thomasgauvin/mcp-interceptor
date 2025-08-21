# MCP Interceptor

Debug MCP requests in real-time. Create a proxy URL, point your Claude (or any MCP client) at it, and watch the traffic flow.

## What it does

- Creates unique proxy URLs for your MCP servers
- Intercepts and logs all requests/responses
- Real-time monitoring via WebSocket connection
- Built on Cloudflare Workers + Durable Objects

## Quick start

```bash
# Backend (API + proxy)
cd backend
npm install
npm run dev

# Frontend (monitoring UI)
cd frontend  
npm install
npm run dev
```

## How to use

1. **Create interceptor**: Enter your MCP server URL at `/`
2. **Get proxy URL**: Use the generated proxy URL in your MCP client
3. **Monitor traffic**: View real-time requests at `/monitor/{id}`

## Demo

Try it with the test MCP server: `https://random-weather-mcp.tgauvin.workers.dev/mcp`

## Deploy

```bash
# Deploy both frontend + backend to Cloudflare
cd backend && npm run deploy
cd frontend && npm run deploy
```

Built with Hono, React Router, and WebSockets. Only supports HTTP transport (MCP 2025-03-26+).
