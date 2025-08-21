# MCP Interceptor

A powerful development tool for intercepting, monitoring, and debugging Model Context Protocol (MCP) server communications in real-time.

## Overview

MCP Interceptor creates a proxy layer between MCP clients and servers, allowing developers to:

- **Monitor Communications**: View all requests and responses between MCP clients and servers in real-time
- **Debug Protocol Issues**: Inspect message formats, timing, and potential errors
- **Development Support**: Test MCP server implementations and client integrations
- **Protocol Analysis**: Understand MCP communication patterns and flows

## Architecture

The project consists of two main components:

### Backend (Cloudflare Workers)
- **API Server**: Built with Hono framework, provides REST endpoints for managing interceptors
- **Durable Objects**: Maintains persistent state for each interceptor instance
- **WebSocket Support**: Enables real-time monitoring of intercepted communications
- **Proxy Engine**: Routes requests between clients and target MCP servers while logging all traffic

### Frontend (React Router App)
- **Interceptor Creator**: Simple interface to create new proxy instances
- **Real-time Monitor**: Live view of all intercepted requests and responses
- **Responsive UI**: Built with React 19 and Tailwind CSS for modern user experience

## Features

- ✅ **Real-time Monitoring**: WebSocket-based live updates of all MCP communications
- ✅ **MCP Server Validation**: Automatic validation that target URLs are valid MCP servers
- ✅ **Request/Response Logging**: Comprehensive logging of all HTTP traffic
- ✅ **Multiple Interceptors**: Support for monitoring multiple MCP servers simultaneously
- ✅ **Persistent State**: Durable Object storage maintains interceptor state across restarts
- ✅ **CORS Support**: Proper cross-origin handling for web-based MCP clients
- ✅ **Error Handling**: Graceful handling of network errors and invalid requests

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account (for deployment)
- Wrangler CLI (installed automatically with dependencies)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/thomasgauvin/mcp-interceptor.git
   cd mcp-interceptor
   ```

2. **Start the backend**
   ```bash
   cd backend
   npm install
   npm run dev
   ```

3. **Start the frontend** (in a new terminal)
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Access the application**
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:8787`

### Creating an Interceptor

1. Open the frontend application
2. Enter the URL of your MCP server (e.g., `http://localhost:3000`)
3. Click "Create Interceptor"
4. Use the generated proxy URL in your MCP client instead of the original server URL
5. Monitor all communications in real-time through the web interface

## API Endpoints

### Create Interceptor
```http
POST /api/interceptors
Content-Type: application/json

{
  "targetUrl": "http://your-mcp-server:3000"
}
```

### Get Interceptor Info
```http
GET /api/interceptors/{interceptorId}
```

### Clear Logs
```http
DELETE /api/interceptors/{interceptorId}/logs
```

### Proxy Requests
```http
ALL /proxy/{interceptorId}/*
```

### WebSocket Monitor
```
WS /monitor/{interceptorId}
```

## Deployment

### Backend (Cloudflare Workers)
```bash
cd backend
npm run deploy
```

### Frontend (Cloudflare Pages)
```bash
cd frontend
npm run deploy
```

## Configuration

### Environment Variables

**Frontend** (`.env`):
```env
VITE_API_HOST="your-api-domain.com"
VITE_HTTP_PROTOCOL="https"
```

**Backend** (`wrangler.toml`):
Configure Durable Object bindings and other Cloudflare-specific settings.

## Use Cases

### MCP Server Development
- Test your MCP server implementation by intercepting client requests
- Debug protocol compliance and message formatting
- Monitor performance and response times

### MCP Client Integration
- Verify that your client sends properly formatted requests
- Debug authentication and connection issues
- Analyze request/response patterns

### Protocol Research
- Study MCP communication patterns
- Analyze different MCP server implementations
- Educational exploration of the Model Context Protocol

## Security Considerations

- **Development Tool**: This is intended as a development and debugging tool
- **Proxy Validation**: The system validates that target URLs are legitimate MCP servers
- **CORS Configuration**: CORS is configured permissively for development use
- **No Sensitive Data**: No API keys or secrets are stored in the codebase

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Technology Stack

- **Backend**: Cloudflare Workers, Hono, Durable Objects, TypeScript
- **Frontend**: React 19, React Router 7, Tailwind CSS, TypeScript
- **Infrastructure**: Cloudflare Workers & Pages
- **Build Tools**: Vite, Wrangler
- **Analytics**: Counterscale (privacy-focused analytics)

## License

This project is open source and available under the [MIT License](LICENSE).

## Related Projects

- [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol) - The protocol this tool helps debug
- [MCP Servers](https://github.com/modelcontextprotocol/servers) - Official MCP server implementations

## Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/thomasgauvin/mcp-interceptor/issues) page
2. Create a new issue with details about your problem
3. Include steps to reproduce and any error messages

---

**Note**: This tool is designed for development and debugging purposes. Always ensure you have permission to intercept and monitor the communications you're debugging.