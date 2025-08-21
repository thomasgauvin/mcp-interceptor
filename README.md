# MCP Interceptor

Debug MCP requests in real-time. Create a proxy URL, point your Claude (or any MCP client) at it, and watch the traffic flow.

Home           |  Monitor
:-------------------------:|:-------------------------:
<img width="1478" height="853" alt="Frame 13" src="https://github.com/user-attachments/assets/5f2c3bdf-2c3e-4c50-a7c1-2823c12896c9" />  |  <img width="1478" height="853" alt="Frame 12" src="https://github.com/user-attachments/assets/0b0c2aa2-c3ff-4187-8d1d-a6dbcaa96b40" />





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
