import localFont from "next/font/local";

// Self-hosted variable fonts (SIL OFL 1.1) — no third-party requests, CSP-friendly.
export const fontSans = localFont({
  src: "./fonts/inter-latin-var.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

export const fontMono = localFont({
  src: "./fonts/jetbrains-mono-latin-var.woff2",
  variable: "--font-jetbrains",
  weight: "100 800",
  display: "swap",
});
