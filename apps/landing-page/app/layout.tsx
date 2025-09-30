import type { Metadata } from 'next'
import { GoogleAnalytics } from '@next/third-parties/google'
import Header from './components/header'
import Footer from './components/footer'
import './globals.css'

export const metadata: Metadata = {
  title: 'Envie - manage your environment variables',
  description: 'Speed up development: One command away from prod, staging, or dev. Keep your and your team\'s environments secure and organized.',
  icons: {
    icon: '/icon-small.png',
  },
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
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <Header />
        <main className="flex-1 min-h-[calc(100vh-140px)]">
          {children}
        </main>
        <Footer />
      </body>
      <GoogleAnalytics gaId="G-J9CL16K7JM" />
    </html>
  )
}
