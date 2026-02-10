import { useEffect, useContext } from 'react'
import { useRouter } from 'next/navigation'
import { useJWTAuth } from '@/context/jwtAuth'
import { SettingsContext } from '@/context/settings'

export default function RequireAuthLevel({
  children,
  allowGuest = false,
}: {
  children: React.ReactNode
  allowGuest?: boolean
}) {
  const { isLoggedIn, isGuest } = useJWTAuth()
  const router = useRouter()

  const sc = useContext(SettingsContext)

  const accessAllowed =
    isLoggedIn || (allowGuest && isGuest)

  useEffect(() => {

    const auth = localStorage.getItem("auth");
    const project = localStorage.getItem("project");

    if (
      (allowGuest && project) ||
      (allowGuest && auth) ||
      auth === "user"
    ) {
      return;
    }
    
    if (!accessAllowed) {
      router.replace('/login')
    }
  }, [accessAllowed])

  if (!accessAllowed) return null

  return <>{children}</>
}