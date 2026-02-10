'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {useJWTAuth} from "@/context/jwtAuth";

export default function HomePage() {
  const { isLoggedIn } = useJWTAuth()
  const router = useRouter()

  useEffect(() => {

    if (isLoggedIn) {
      router.push('/project')
    } else {
      router.push('/login')
    }
  }, [isLoggedIn, router])

  return null
}
