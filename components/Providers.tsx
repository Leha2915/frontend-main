'use client'

import { ChatsProvider } from '@/context/chats'
import { SettingsProvider } from '@/context/settings'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FC, ReactNode } from 'react'
import { TooltipProvider } from './ui/tooltip'
import { ProgressProvider } from '@/context/progress'
import {JWTAuthProvider} from "@/context/jwtAuth";
import { InterviewHealthProvider } from '@/context/health'
import { LoggingProvider } from '@/context/logging'

interface LayoutProps {
    children: ReactNode
}

const Layout: FC<LayoutProps> = ({ children }) => {
    const queryClient = new QueryClient()

    return (
        <QueryClientProvider client={queryClient}>

            <JWTAuthProvider>
                <SettingsProvider>
                    <ChatsProvider>
                        <ProgressProvider>
                            <InterviewHealthProvider>
                                <TooltipProvider>
                                    <LoggingProvider>
                                        {children}
                                    </LoggingProvider>
                                </TooltipProvider>
                            </InterviewHealthProvider>
                        </ProgressProvider>
                    </ChatsProvider>
                </SettingsProvider>
            </JWTAuthProvider>
        </QueryClientProvider>
    )
}

export default Layout