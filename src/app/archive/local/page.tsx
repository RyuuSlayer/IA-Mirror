import { Suspense } from 'react'
import LocalItemsList from '@/components/LocalItemsList'

export default function LocalArchivePage() {
  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Your Local Archive</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <LocalItemsList />
      </Suspense>
    </main>
  )
}
