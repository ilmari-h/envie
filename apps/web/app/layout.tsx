import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { PublicEnvScript } from 'next-runtime-env';
import { GoogleAnalytics } from '@next/third-parties/google'
import { env } from "./env";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "envie",
  description: "A simple way to manage your environment variables",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
        <head>
        <PublicEnvScript />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Providers>
          {children}
        </Providers>
        {env.GOOGLE_ANALYTICS_ID && (
          <GoogleAnalytics gaId={env.GOOGLE_ANALYTICS_ID} />
        )}
      </body>
    </html>
  );
}
