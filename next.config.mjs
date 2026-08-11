/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // 隔离发布会在 .deploy 下复制源码并链接共享的 node_modules。固定追踪根目录，
  // 避免 Next.js 沿符号链接误判到外层工作区，导致 server.js 输出到嵌套路径。
  outputFileTracingRoot: process.cwd(),
  images: {
    // 封面图已本地化到 public/covers/
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.myanimelist.net' },
      { protocol: 'https', hostname: 'lain.bgm.tv' },
    ],
  },
};

export default nextConfig;
