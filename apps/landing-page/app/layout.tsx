import type { Metadata } from 'next'
import { GoogleAnalytics } from '@next/third-parties/google'
import './globals.css'

export const metadata: Metadata = {
  title: 'Envie - manage your environment variables',
  description: 'Speed up development: One command away from prod, staging, or dev. Keep your and your team\'s environments secure and organized.',
  openGraph: {
    title: 'Envie - manage your environment variables',
    description: 'Speed up development: One command away from prod, staging, or dev. Keep your and your team\'s environments secure and organized.',
    type: 'website',
    url: 'https://envie.cloud',
    siteName: 'Envie',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Envie - manage your environment variables',
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
