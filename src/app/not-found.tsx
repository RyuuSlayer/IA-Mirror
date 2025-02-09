import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Page Not Found
        </h2>
        <p className="text-gray-600 mb-6">
          Could not find the requested resource
        </p>
        <Link
          href="/"
          className="px-4 py-2 bg-[#428BCA] text-white rounded-md hover:bg-[#357EBD] transition-colors"
        >
          Return Home
        </Link>
      </div>
    </div>
  )
}
