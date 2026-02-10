import "@/app/globals.css";
import Providers from '@/components/Providers';
import { Button } from "@/components/ui/button";
import RequireAuthLevel from "@/components/RequireAuthLevel";
import { Inter } from "next/font/google";
import Link from 'next/link';


import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";


import {
  ArrowDownNarrowWide,
  Bot,
  Home,
  Network,
  Settings2,
  SquareTerminal,
  Plus
} from "lucide-react";
import {useJWTAuth} from "@/context/jwtAuth";

const inter = Inter({ subsets: ["latin"] });

function LogoutButton() {
  const { logout, isLoggedIn } = useJWTAuth();

  if (!isLoggedIn) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={logout}
      className="ml-auto"
    >
      Logout
    </Button>
  );
}

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (

            <div className="flex flex-col h-screen max-h-screen w-full pl-[56px]">


              <aside className="bg-[#ffffff] inset-y fixed left-0 z-20 flex h-full flex-col border-r">
                <div className="border-b p-2">
                  <Link href="/">
                    <Button variant="outline" size="icon" aria-label="Home">
                      <Bot className="size-5 fill-foreground" />
                    </Button>
                  </Link>
                </div>

                <nav className="grid gap-1 p-2">

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link href="/">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-lg"
                          aria-label="Home"
                        >
                          <Home className="size-5" />
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={5}>
                      Home
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link href="/setup">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-lg"
                          aria-label="New"
                        >
                          <Plus className="size-5" />
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={5}>
                      New Project
                    </TooltipContent>
                  </Tooltip>

                </nav>
              </aside>



              <header className="bg-[#ffffff] sticky top-0 z-10 flex min-h-[57px] max-h-[57px] w-full items-center gap-1 border-b px-4">
                <h1 className="text-xl font-semibold">LadderChat</h1>

                <LogoutButton />
              </header>

              <div className="h-[calc(100vh-57px)] max-h-[calc(100vh-57px)]">
                {children}
              </div>
            </div>
  )
}