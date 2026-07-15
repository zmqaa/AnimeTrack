"use client";

import { SessionProvider } from "next-auth/react";
import { SWRConfig } from "swr";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { swrFetcher } from "@/lib/swr-config";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <SWRConfig
          value={{
            fetcher: swrFetcher,
            dedupingInterval: 5000,
            keepPreviousData: true,
            revalidateOnReconnect: true,
            errorRetryCount: 2,
          }}
        >
          {children}
        </SWRConfig>
      </SessionProvider>
    </ThemeProvider>
  );
}
