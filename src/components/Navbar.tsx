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
      {/* Top utility bar */}
      <div className="bg-black text-white py-1" role="banner">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-end space-x-4 text-sm">
          <nav aria-label="Utility navigation">
            <ul className="flex items-center space-x-4">
              <li>
                <button
                  onClick={handleReload}
                  className="text-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black rounded px-2 py-1"
                  aria-label="Reload current page"
                >
                  Reload
                </button>
              </li>
              <li>
                <Link 
                  href="/downloads" 
                  className="text-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black rounded px-2 py-1"
                  aria-label="View downloads page"
                >
                  Downloads
                </Link>
              </li>
              <li>
                <Link 
                  href="/settings" 
                  className="text-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black rounded px-2 py-1"
                  aria-label="View settings page"
                >
                  Settings
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Main navigation */}
      <nav className="bg-[#2C2C2C] text-white border-b border-[#1C1C1C]" role="navigation" aria-label="Main navigation">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Left side - Logo and navigation */}
            <div className="flex items-center">
              <Link 
                href="/" 
                className="flex items-center space-x-3 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#2C2C2C] rounded px-2 py-1"
                aria-label="Go to homepage - Internet Archive Mirror"
              >
                <Image 
                  src="/images/archivelogo.svg" 
                  alt="" 
                  width={24} 
                  height={24}
                  className="brightness-0 invert"
                  role="presentation"
                />
                <span className="text-lg font-semibold">Internet Archive Mirror</span>
              </Link>
              <nav aria-label="Primary navigation" className="ml-12">
                <ul className="flex items-center space-x-8">
                  <li>
                    <Link 
                      href="/archive/local" 
                      className={`text-sm hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#2C2C2C] rounded px-2 py-1 ${
                        pathname === '/archive/local' ? 'text-white' : 'text-gray-300'
                      }`}
                      aria-current={pathname === '/archive/local' ? 'page' : undefined}
                      aria-label="Browse local library"
                    >
                      Local Library
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/archive/remote/browse" 
                      className={`text-sm hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#2C2C2C] rounded px-2 py-1 ${
                        pathname === '/archive/remote/browse' ? 'text-white' : 'text-gray-300'
                      }`}
                      aria-current={pathname === '/archive/remote/browse' ? 'page' : undefined}
                      aria-label="Browse remote archive"
                    >
                      Browse Archive
                    </Link>
                  </li>
                </ul>
              </nav>
            </div>

            {/* Right side - Empty */}
            <div></div>
          </div>
        </div>
      </nav>

      {/* Mobile navigation */}
      <div className="md:hidden bg-[#1C1C1C] border-t border-[#3C3C3C]" role="navigation" aria-label="Mobile navigation">
        <div className="px-6 py-2">
          <nav>
            <ul className="flex flex-col space-y-2">
              <li>
                <Link 
                  href="/archive/local" 
                  className={`block py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#1C1C1C] rounded px-2 ${
                    pathname === '/archive/local' ? 'text-white' : 'text-gray-300'
                  }`}
                  aria-current={pathname === '/archive/local' ? 'page' : undefined}
                  aria-label="Browse local library"
                >
                  Local Library
                </Link>
              </li>
              <li>
                <Link 
                  href="/archive/remote/browse" 
                  className={`block py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#1C1C1C] rounded px-2 ${
                    pathname === '/archive/remote/browse' ? 'text-white' : 'text-gray-300'
                  }`}
                  aria-current={pathname === '/archive/remote/browse' ? 'page' : undefined}
                  aria-label="Browse remote archive"
                >
                  Browse Archive
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </>
  )
}
