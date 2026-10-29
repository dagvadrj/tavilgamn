import { fileURLToPath } from "node:url";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: projectRoot,
  reactStrictMode: true,
  images: {
    qualities: [75, 90, 95],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "i.pravatar.cc" },
    ],
  },
  transpilePackages: ["three"],
  webpack(config, { isServer, webpack }) {
    if (!isServer) {
      // @gltf-transform/core lazily imports node:fs/node:path for NodeIO only;
      // the browser uses WebIO, so strip the scheme and stub the modules.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:(fs|path)$/, (resource) => {
          resource.request = resource.request.replace(/^node:/, "");
        }),
      );
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false };
    }
    return config;
  },
};

export default (phase) => ({
  ...nextConfig,
  distDir: process.env.NEXT_DIST_DIR || (phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next"),
});
