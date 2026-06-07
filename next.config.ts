import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 产出自包含运行包（.next/standalone）：Docker 运行镜像极小、运行时内存占用低，适合 2G 小服务器。
  // 注意：构建仍吃内存，别在 2G 机上构建（见 DEPLOY.md）。
  output: "standalone",
};

export default nextConfig;
