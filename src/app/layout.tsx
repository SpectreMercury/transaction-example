"use client"
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import TrpcProvider from "./_trpc/Provider";


const inter = Inter({ subsets: ["latin"] });


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [queryClient] = useState(() => new QueryClient({}));
  return (
    <html lang="en" className="h-[100%]">
      <body className="min-h-[100%]" >
        <TrpcProvider>{children}</TrpcProvider>
      </body>
    </html>
  );
}
