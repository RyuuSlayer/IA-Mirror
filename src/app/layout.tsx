import type { Metadata } from 'next'
import './globals.css'
import './bookreader.css'
import Navbar from '@/components/Navbar'
import ErrorBoundary from '@/components/ErrorBoundary'

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
      <body className="min-h-screen flex flex-col bg-[#FAFAFA]">
        <Navbar />
        <main className="flex-1">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
        <footer className="bg-[#2C2C2C] text-white py-6">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center">
              <p className="text-gray-400">Internet Archive Mirror</p>
              <div className="mt-4 space-x-4">
                <a 
                  href="https://archive.org" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Internet Archive
                </a>
                <span className="text-gray-600">•</span>
                <a 
                  href="https://github.com/RyuuSlayer/IA-Mirror" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  GitHub
                </a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
