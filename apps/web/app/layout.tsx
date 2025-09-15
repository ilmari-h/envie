import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { PublicEnvScript } from 'next-runtime-env';
import { GoogleAnalytics } from '@next/third-parties/google'
import { env } from "./env";
import Script from "next/script";

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
          <>
          <GoogleAnalytics gaId={env.GOOGLE_ANALYTICS_ID} />

        <Script
          async
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${env.GOOGLE_ANALYTICS_ID}`}
        ></Script>
        <Script strategy="afterInteractive" id="gtm">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', ${env.GOOGLE_ANALYTICS_ID});
          `}
        </Script>
        </>
        )}
      </body>
    </html>
  );
}
