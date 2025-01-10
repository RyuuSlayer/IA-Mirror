export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
      <div className="text-center p-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#428BCA] border-t-transparent"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  )
}
