import { Suspense } from 'react'
import LocalItemsList from '@/components/LocalItemsList'

export default function LocalArchivePage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#2C2C2C]">Your Local Archive</h1>
          <p className="mt-2 text-gray-600">Browse and manage your downloaded Internet Archive items</p>
        </div>
        
        <Suspense 
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#428BCA] border-t-transparent"></div>
            </div>
          }
        >
          <LocalItemsList />
        </Suspense>
      </main>
    </div>
  )
}
