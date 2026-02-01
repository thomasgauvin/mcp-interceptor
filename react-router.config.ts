import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "src/app",
  assetsBuildDirectory: "build/client",
  serverBuildPath: "build/server/index.js",
  ssr: true,
  future: {
    v8_viteEnvironmentApi: true,
  },
} satisfies Config;
