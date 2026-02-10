'use client'

import { createContext, useContext, useState, ReactNode, useEffect } from "react"

type JWTAuthContextType = {
    isHydrated: boolean
    isLoggedIn: boolean
    isGuest: boolean
    login: (username: string, password: string) => Promise<boolean>
    logout: () => void
    enterAsGuest: (slug: string) => void
    fetchWithAuth: (input: RequestInfo, init?: RequestInit) => Promise<Response>
}

const JWTAuthContext = createContext<JWTAuthContextType | undefined>(undefined)
const api_url =  process.env.NEXT_PUBLIC_API_URL;
const ACCESS_TOKEN_KEY = "access_token"
const REFRESH_TOKEN_KEY = "refresh_token"

export function JWTAuthProvider({ children }: { children: ReactNode }) {
    const [isHydrated, setIsHydrated] = useState(false)
    const [isLoggedIn, setIsLoggedIn] = useState(false)
    const [isGuest, setIsGuest] = useState(false)
    const [accessToken, setAccessToken] = useState<string | null>(null)
    const [refreshToken, setRefreshToken] = useState<string | null>(null)

    useEffect(() => {
        const authState = localStorage.getItem("auth")
        const bootAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
        const bootRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)

        if (!authState) {
            setIsLoggedIn(false)
            setIsGuest(false)
        }

        if (authState === "user" && bootAccessToken) {
            setAccessToken(bootAccessToken)
            setRefreshToken(bootRefreshToken)
            setIsLoggedIn(true)
        } else if (authState === "guest") {
            setAccessToken(null)
            setRefreshToken(null)
            setIsGuest(true)
        } else {
            localStorage.removeItem("auth")
            localStorage.removeItem(ACCESS_TOKEN_KEY)
            localStorage.removeItem(REFRESH_TOKEN_KEY)
            setAccessToken(null)
            setRefreshToken(null)
            setIsLoggedIn(false)
            setIsGuest(false)
        }
        setIsHydrated(true)
    }, [])

    const setTokens = (accessToken: string, refreshToken: string) => {
        setAccessToken(accessToken)
        setRefreshToken(refreshToken)
        localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    }

    const buildAuthHeaders = (init?: RequestInit, accessToken?: string | null): Headers => {
        const headers = new Headers(init?.headers ?? {})
        if (accessToken) {
            headers.set("Authorization", `Bearer ${accessToken}`)
        }
        return headers
    }

    const refreshAuthTokens = async (): Promise<string | null> => {
        if (!refreshToken) return null

        const res = await fetch(`${api_url}/auth-new/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
        })

        if (!res.ok) return null

        const data = await res.json()
        if (!data?.access_token || !data?.refresh_token) return null
        setTokens(data.access_token, data.refresh_token)
        return data.access_token
    }

    /**
     * Wrapper method for fetch(), which logs user out if response code is 401 unauthorized
     * @param input Same as with fetch()
     * @param init Same as with fetch()
     * @returns The response, just as fetch() would
     */
    const fetchWithAuth = async (
        input: RequestInfo,
        init?: RequestInit
    ): Promise<Response> => {
        const res = await fetch(input, {
            ...init,
            headers: buildAuthHeaders(init, accessToken),
        })

        if (res.status !== 401) {
            return res
        }

        const refreshedAccessToken = await refreshAuthTokens()
        if (!refreshedAccessToken) {
            logout()
            return res
        }

        const retryRes = await fetch(input, {
            ...init,
            headers: buildAuthHeaders(init, refreshedAccessToken),
        })

        if (retryRes.status === 401) {
            logout()
        }
        return retryRes
    }

    const login = async (username: string, password: string): Promise<boolean> => {
        try {
            const res = await fetch(`${api_url}/auth-new/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            })

            if (!res.ok) return false

            const data = await res.json()
            if (!data?.access_token || !data?.refresh_token) return false

            setTokens(data.access_token, data.refresh_token)
            localStorage.setItem("auth", "user")
            setIsLoggedIn(true)
            setIsGuest(false)
            return true
        } catch (err) {
            console.error("Login failed:", err)
            localStorage.removeItem("auth")
            return false
        }
    }

    const logout = () => {
        localStorage.removeItem("auth")
        localStorage.removeItem(ACCESS_TOKEN_KEY)
        localStorage.removeItem(REFRESH_TOKEN_KEY)
        //localStorage.removeItem("project")
        setAccessToken(null)
        setRefreshToken(null)
        setIsLoggedIn(false)
        setIsGuest(false)
    }

    const enterAsGuest = (slug: string) => {

        console.log("entered")
        localStorage.removeItem(ACCESS_TOKEN_KEY)
        localStorage.removeItem(REFRESH_TOKEN_KEY)
        localStorage.setItem("auth", "guest")
        localStorage.setItem("project", slug)

        setAccessToken(null)
        setRefreshToken(null)
        setIsGuest(true)
        setIsLoggedIn(false)
    }

    return (
        <JWTAuthContext.Provider
            value={{ isHydrated, isLoggedIn, isGuest, login, logout, enterAsGuest, fetchWithAuth }}
        >
            {children}
        </JWTAuthContext.Provider>
    )
}

export const useJWTAuth = () => {
    const ctx = useContext(JWTAuthContext)
    if (!ctx) throw new Error("useJWTAuth must be used inside <JWTAuthProvider>")
    return ctx
}