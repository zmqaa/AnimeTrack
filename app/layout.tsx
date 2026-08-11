import type { Metadata } from "next";
import "./globals.css";
import SidebarLayout from "@/components/SidebarLayout";
import { Providers } from "@/components/Providers";
import RouteLoadingBar from "@/components/shared/RouteLoadingBar";
import Toast from "@/components/shared/Toast";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import { themeInitScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Anime Track",
  description: "记录番剧观看与漫画阅读进度的个人动漫收藏工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Providers>
          <Toast />
          <RouteLoadingBar />
          <SidebarLayout>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </SidebarLayout>
        </Providers>
      </body>
    </html>
  );
}
