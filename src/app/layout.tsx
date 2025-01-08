import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'

export const metadata: Metadata = {
  title: 'Internet Archive Mirror',
  description: 'A local mirror for Internet Archive content',
  icons: {
    icon: '/images/archivelogo.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <div className="app-container">
          <Navbar />
          <main className="main-content">
            {children}
          </main>
          <footer className="footer">
            <div className="footer-content">
              <p>Internet Archive Mirror - A local mirror for Internet Archive content</p>
              <p>
                <a href="https://archive.org" target="_blank" rel="noopener noreferrer">
                  Internet Archive
                </a>
                {' • '}
                <a href="https://github.com/RyuuSlayer/IA-Mirror" target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
