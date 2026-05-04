import "./globals.css";
import "./vltd-design.css";
import TopNav from "@/components/TopNav";
import Providers from "@/components/Providers";
import { ThemeBoot } from "@/components/ThemeBoot";
import ThemeScript from "@/components/ThemeScript";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeBoot />

        <Providers>
          <TopNav />
          <div style={{ paddingTop: "var(--topnav-h)" }}>{children}</div>
        </Providers>
      </body>
    </html>
  );
}