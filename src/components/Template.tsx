'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-[#2C2C2C] text-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <Link href="/" className="text-xl font-semibold hover:text-white">
                Internet Archive Mirror
              </Link>
              <nav className="hidden md:flex space-x-6">
                <Link 
                  href="/archive/local" 
                  className={`hover:text-white transition-colors ${
                    pathname === '/archive/local' ? 'text-white' : 'text-gray-300'
                  }`}
                >
                  Local Library
                </Link>
                <Link 
                  href="/archive/remote/browse" 
                  className={`hover:text-white transition-colors ${
                    pathname === '/archive/remote/browse' ? 'text-white' : 'text-gray-300'
                  }`}
                >
                  Browse Archive
                </Link>
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <div className="md:hidden bg-[#1C1C1C] text-white">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <nav className="flex justify-around">
            <Link 
              href="/archive/local" 
              className={`py-2 ${
                pathname === '/archive/local' ? 'text-white' : 'text-gray-300'
              }`}
            >
              Local Library
            </Link>
            <Link 
              href="/archive/remote/browse" 
              className={`py-2 ${
                pathname === '/archive/remote/browse' ? 'text-white' : 'text-gray-300'
              }`}
            >
              Browse Archive
            </Link>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 bg-[#FAFAFA]">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#2C2C2C] text-white py-8">
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
    </div>
  )
}
