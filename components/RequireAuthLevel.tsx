import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useJWTAuth } from '@/context/jwtAuth'

export default function RequireAuthLevel({
  children,
  allowGuest = false,
}: {
  children: React.ReactNode
  allowGuest?: boolean
}) {
  const { isHydrated, isLoggedIn, isGuest } = useJWTAuth()
  const router = useRouter()

  const accessAllowed =
    isLoggedIn || (allowGuest && isGuest)

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    if (!accessAllowed) {
      router.replace('/login')
    }
  }, [isHydrated, accessAllowed, router])

  if (!isHydrated) return null
  if (!accessAllowed) return null

  return <>{children}</>
}