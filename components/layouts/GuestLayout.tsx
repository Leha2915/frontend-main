"use client";

import "@/app/globals.css";
import { LoggingProvider } from "@/context/logging";

export function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <LoggingProvider>
      <div className="flex flex-col h-screen max-h-screen w-full">
        <header className="bg-[#ffffff] sticky top-0 z-10 flex min-h-[57px] max-h-[57px] w-full items-center gap-1 border-b px-4">
          <h1 className="text-xl font-semibold">LadderChat</h1>
        </header>

        <main className="h-[calc(100vh-57px)] max-h-[calc(100vh-57px)] overflow-auto">{children}</main>
      </div>
    </LoggingProvider>
  );
}
