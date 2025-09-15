import type { Metadata } from 'next'
import { GoogleAnalytics } from '@next/third-parties/google'
import './globals.css'
import Script from 'next/script'

export const metadata: Metadata = {
  title: 'Envie - environment configuration management for developers',
  description: 'Speed up development: One command away from prod, staging, or dev. Keep your and your team\'s environments secure and organized.',
  openGraph: {
    title: 'Envie - environment configuration management for developers',
    description: 'Speed up development: One command away from prod, staging, or dev. Keep your and your team\'s environments secure and organized.',
    type: 'website',
    url: 'https://envie.dev',
    siteName: 'Envie',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Envie - environment configuration management for developers',
    description: 'Speed up development: One command away from prod, staging, or dev. Keep your and your team\'s environments secure and organized.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
      <GoogleAnalytics gaId="AW-16519815193" />

    </html>
  )
}
