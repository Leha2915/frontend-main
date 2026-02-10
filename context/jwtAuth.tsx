'use client'

import { createContext, useContext, useState, ReactNode, useEffect } from "react"
import { SettingsContext } from "./settings"

type JWTAuthContextType = {
    isLoggedIn: boolean
    isGuest: boolean
    login: (username: string, password: string) => Promise<boolean>
    logout: () => void
    enterAsGuest: (slug: string) => void
    fetchWithAuth: (input: RequestInfo, init?: RequestInit) => Promise<Response>
}

const JWTAuthContext = createContext<JWTAuthContextType | undefined>(undefined)
const api_url =  process.env.NEXT_PUBLIC_API_URL;

export function JWTAuthProvider({ children }: { children: ReactNode }) {
    const [isLoggedIn, setIsLoggedIn] = useState(false)
    const [isGuest, setIsGuest] = useState(false)

    const sc = useContext(SettingsContext)

    useEffect(() => {
        const authState = localStorage.getItem("auth")

        if (!authState) {
            setIsLoggedIn(false)
            setIsGuest(false)
        }

        if (authState === "user") {
            setIsLoggedIn(true)
        } else if (authState === "guest") {
            setIsGuest(true)
        }
    }, [])

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
            credentials: "include"
        })

        if (res.status ===401) {
            logout()
        }
        return res
    }

    const login = async (username: string, password: string): Promise<boolean> => {
        try {
            const res = await fetch(`${api_url}/auth-new/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
                credentials: "include",
            })

            if (!res.ok) return false

            const data = await res.json()
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
        //localStorage.removeItem("project")
        setIsLoggedIn(false)
        setIsGuest(false)
    }

    const enterAsGuest = (slug: string) => {

        console.log("entered")
        localStorage.setItem("auth", "guest")
        localStorage.setItem("project", slug)

        setIsGuest(true)
        setIsLoggedIn(false)
    }

    return (
        <JWTAuthContext.Provider
            value={{ isLoggedIn, isGuest, login, logout, enterAsGuest, fetchWithAuth }}
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