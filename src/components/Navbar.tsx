'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'

export default function NavbarComponent() {
  const router = useRouter()
  const pathname = usePathname()

  const handleReload = () => {
    window.location.reload()
  }

  return (
    <>
      {/* Top black bar */}
      <div className="bg-black text-white py-1">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-end space-x-4 text-sm">
          <button
            onClick={handleReload}
            className="text-gray-300 hover:text-white"
          >
            Reload
          </button>
          <Link href="/downloads" className="text-gray-300 hover:text-white">
            Downloads
          </Link>
          <Link href="/settings" className="text-gray-300 hover:text-white">
            Settings
          </Link>
        </div>
      </div>

      {/* Main navigation */}
      <nav className="bg-[#2C2C2C] text-white border-b border-[#1C1C1C]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Left side - Logo and navigation */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-3">
                <Image 
                  src="/images/archivelogo.svg" 
                  alt="Internet Archive Mirror" 
                  width={24} 
                  height={24}
                  className="brightness-0 invert"
                />
                <span className="text-lg font-semibold">Internet Archive Mirror</span>
              </Link>
              <div className="ml-12 flex items-center space-x-8">
                <Link 
                  href="/archive/local" 
                  className={`text-sm hover:text-white transition-colors ${
                    pathname === '/archive/local' ? 'text-white' : 'text-gray-300'
                  }`}
                >
                  Local Library
                </Link>
                <Link 
                  href="/archive/remote/browse" 
                  className={`text-sm hover:text-white transition-colors ${
                    pathname === '/archive/remote/browse' ? 'text-white' : 'text-gray-300'
                  }`}
                >
                  Browse Archive
                </Link>
              </div>
            </div>

            {/* Right side - Empty */}
            <div></div>
          </div>
        </div>
      </nav>

      {/* Mobile navigation */}
      <div className="md:hidden bg-[#1C1C1C] border-t border-[#3C3C3C]">
        <div className="px-6 py-2">
          <div className="flex flex-col space-y-2">
            <Link 
              href="/archive/local" 
              className={`py-2 text-sm ${
                pathname === '/archive/local' ? 'text-white' : 'text-gray-300'
              }`}
            >
              Local Library
            </Link>
            <Link 
              href="/archive/remote/browse" 
              className={`py-2 text-sm ${
                pathname === '/archive/remote/browse' ? 'text-white' : 'text-gray-300'
              }`}
            >
              Browse Archive
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
