# MCP Interceptor Frontend

The web interface for creating and monitoring MCP (Model Context Protocol) interceptors. Built with React Router 7 and TypeScript.

## Features

- 🚀 Server-side rendering with React Router
- ⚡️ Hot Module Replacement (HMR) for fast development
- 📦 Asset bundling and optimization with Vite
- 🔄 Real-time monitoring with WebSockets
- 🔒 TypeScript by default for type safety
- 🎉 TailwindCSS for modern styling
- 📊 Privacy-focused analytics with Counterscale

## Getting Started

### Installation

Install the dependencies:

```bash
npm install
```

### Development

Start the development server with HMR:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

## Previewing the Production Build

Preview the production build locally:

```bash
npm run preview
```

## Building for Production

Create a production build:

```bash
npm run build
```

## Deployment

Deployment is done using the Wrangler CLI.

To build and deploy directly to production:

```sh
npm run deploy
```

To deploy a preview URL:

```sh
npx wrangler versions upload
```

You can then promote a version to production after verification or roll it out progressively.

```sh
npx wrangler versions deploy
```

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

---

Built with ❤️ using React Router.
