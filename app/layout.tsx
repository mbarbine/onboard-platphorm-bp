import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://docs.platphormnews.com'),
  title: {
    default: 'OpenDocs - MCP-Enabled Documentation Platform',
    template: '%s | OpenDocs',
  },
  description: 'A modern, AI-native documentation platform with full MCP integration. Submit, discover, and explore documentation from any source.',
  generator: 'OpenDocs',
  keywords: ['documentation', 'MCP', 'API', 'developer tools', 'knowledge base', 'model context protocol', 'AI documentation', 'open source', 'platphorm news'],
  authors: [{ name: 'OpenDocs', url: 'https://platphormnews.com' }],
  creator: 'Platphorm News',
  publisher: 'Platphorm News',
  openGraph: {
    title: 'OpenDocs - MCP-Enabled Documentation Platform',
    description: 'A modern, AI-native documentation platform with full MCP integration. Submit, discover, and explore documentation from any source.',
    type: 'website',
    siteName: 'OpenDocs',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OpenDocs',
    description: 'MCP-Enabled Documentation Platform',
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
