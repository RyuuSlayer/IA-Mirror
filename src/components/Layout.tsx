'use client'

import Link from 'next/link'
import Image from 'next/image'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA]">
      {/* Top Navigation Bar */}
      <header className="bg-[#2C2C2C] text-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="h-14 flex items-center justify-between">
            {/* Left side */}
            <div className="flex items-center space-x-6">
              <Link href="/" className="flex items-center space-x-2 text-white no-underline">
                <Image 
                  src="/archive-logo.svg" 
                  alt="Internet Archive" 
                  width={24} 
                  height={24}
                  className="brightness-0 invert"
                />
                <span className="font-semibold">Internet Archive Mirror</span>
              </Link>
              <nav className="hidden md:flex space-x-4">
                <Link href="/archive/local" className="text-gray-300 hover:text-white no-underline">
                  Local Library
                </Link>
                <Link href="/archive/remote/browse" className="text-gray-300 hover:text-white no-underline">
                  Browse Archive
                </Link>
              </nav>
            </div>
            
            {/* Right side */}
            <div className="flex items-center space-x-4">
              <button className="text-gray-300 hover:text-white p-2 rounded-md">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                </button>
              <button className="text-gray-300 hover:text-white p-2 rounded-md">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <div className="md:hidden bg-gray-800 text-white">
        <div className="px-4 py-2 flex justify-around">
          <Link href="/archive/local" className="text-gray-300 hover:text-white no-underline">
            Local Library
          </Link>
          <Link href="/archive/remote/browse" className="text-gray-300 hover:text-white no-underline">
            Browse Archive
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 py-6">
        <div className="max-w-7xl mx-auto px-4">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-100 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-gray-600">
            <p className="mb-2">Internet Archive Mirror - Local Archive Browser</p>
            <p className="text-sm">
              A tool for browsing and managing your local Internet Archive collection
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
