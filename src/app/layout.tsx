import type { Metadata, Viewport } from "next";
import { Geist_Mono, Google_Sans } from "next/font/google";
import { env } from "@/env";
import { THEME_SCRIPT } from "@/components/theme";
import { TitleGuard } from "@/components/title-guard";
import { Toaster } from "@/components/toast";
import "./globals.css";

const googleSans = Google_Sans({
  variable: "--font-google-sans",
  subsets: ["latin", "cyrillic"],
  // Next has no metric overrides for Google Sans; use a close system stack.
  adjustFontFallback: false,
  fallback: ["Roboto", "Segoe UI", "Arial", "sans-serif"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: "PTO",
    template: "%s | PTO",
  },
  description: "Request and approve paid time off.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafd" },
    { media: "(prefers-color-scheme: dark)", color: "#131314" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme script sets data-theme before hydration.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${googleSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Runs before first paint so there's no flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster />
        <TitleGuard />
      </body>
    </html>
  );
}
