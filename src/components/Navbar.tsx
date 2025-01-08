'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export default function NavbarComponent() {
  const router = useRouter()

  const handleReload = () => {
    window.location.reload()
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <Link href="/archive/local" className="brand-link">
            <Image 
              src="/images/archivelogo.svg" 
              alt="Internet Archive Mirror" 
              width={32} 
              height={32} 
              className="brand-logo"
            />
            <span className="brand-text">Internet Archive Mirror</span>
          </Link>
        </div>
        
        <div className="navbar-links">
          <Link href="/archive/local" className="nav-link">
            <Image 
              src="/images/baseline-home-24px.svg" 
              alt="Local Library" 
              width={24} 
              height={24} 
            />
            <span>Local Library</span>
          </Link>
          
          <Link href="/archive/remote/browse" className="nav-link">
            <Image 
              src="/images/baseline-update-24px.svg" 
              alt="Browse Archive" 
              width={24} 
              height={24} 
            />
            <span>Browse Internet Archive</span>
          </Link>
          
          <Link href="/downloads" className="nav-link">
            <Image 
              src="/images/download-icon.svg" 
              alt="Downloads" 
              width={24} 
              height={24} 
            />
            <span>Downloads</span>
          </Link>
          
          <button className="nav-link" onClick={handleReload}>
            <Image 
              src="/images/baseline-update-24px.svg" 
              alt="Reload" 
              width={24} 
              height={24} 
            />
            <span>Reload</span>
          </button>
          
          <Link href="/settings" className="nav-link">
            <Image 
              src="/images/settings.svg" 
              alt="Settings" 
              width={24} 
              height={24} 
            />
            <span>Settings</span>
          </Link>
        </div>
      </div>
    </nav>
  )
}
