import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { ThemeProvider } from '@/components/theme-provider'
import {
  SITE_NAME,
  SITE_TITLE,
  SITE_TAGLINE,
  SITE_DESCRIPTION,
  SITE_GENERATOR,
  BASE_URL,
  ORG_URL,
  ORG_NAME,
  DEFAULT_KEYWORDS,
} from '@/lib/site-config'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  generator: SITE_GENERATOR,
  keywords: DEFAULT_KEYWORDS,
  authors: [{ name: SITE_NAME, url: ORG_URL }],
  creator: ORG_NAME,
  publisher: ORG_NAME,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_TAGLINE,
  },
  alternates: {
    types: {
      'application/rss+xml': '/rss.xml',
      'text/plain': '/llms.txt',
      'application/json': '/llms-index.json',
    },
  },
  icons: {
    icon: '/icon-512.png',
    apple: '/icon-512.png',
  },
  manifest: '/manifest.json',
  other: {
    'msapplication-TileColor': '#0a0a0a',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="author" href="/humans.txt" />
        <link rel="help" href="/docs" />
        <link rel="search" href="/search" />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
