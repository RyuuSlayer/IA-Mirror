import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/archive/local')
  return null
}
