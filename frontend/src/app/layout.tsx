import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

// Force dynamic rendering to prevent SSR issues with RainbowKit/localStorage
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shadow Protocol | Private Leveraged Pre-IPO Trading",
  description: "Trade pre-IPO stocks with leverage. All positions encrypted with FHE - nobody can see your trades.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-text-primary min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
