import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Internet Archive Mirror',
  description: 'A local mirror for Internet Archive content - Browse and download books, documents, and media.',
}

// This page can be statically generated since it's just a redirect
export default function Home() {
  redirect('/archive/local')
  return null
}

// Enable static generation for this page
export const dynamic = 'force-static'
export const revalidate = false
