"use client"

import { AuthLayout } from '@/components/layouts/AuthLayout'
import { PublicLayout } from '@/components/layouts/PublicLayout'
import { GuestLayout } from '@/components/layouts/GuestLayout'
import {useJWTAuth} from "@/context/jwtAuth";

export default function LayoutSwitcher({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isGuest } = useJWTAuth()

  if (isLoggedIn) {
    return <AuthLayout>{children}</AuthLayout>
  }

  if (isGuest) {
    return <GuestLayout>{children}</GuestLayout>
  }

  return <PublicLayout>{children}</PublicLayout>
}