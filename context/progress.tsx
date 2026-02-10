import { Settings } from "@/lib/types"
import { createContext, Dispatch, SetStateAction, useState } from "react"


export const ProgressContext = createContext<{
    submittedRanking: boolean,
    setSubmittedRanking: Dispatch<SetStateAction<boolean>>,
    toggleThoughts: boolean,
    setToggleThoughts: Dispatch<SetStateAction<boolean>>,
    userId: string,
    setUserId: Dispatch<SetStateAction<string>>,

}>({
    submittedRanking: false,
    setSubmittedRanking: () => { },
    toggleThoughts: false,
    setToggleThoughts: () => { },
    userId: null,
    setUserId: () => { }

})


export function ProgressProvider({ children }: { children: React.ReactNode }) {

    const [submittedRanking, setSubmittedRanking] = useState(false)
    const [toggleThoughts, setToggleThoughts] = useState(false)
    const [userId, setUserId] = useState(null)

    return (
        <ProgressContext.Provider
            value={{
                submittedRanking,
                setSubmittedRanking,
                toggleThoughts,
                setToggleThoughts,
                userId,
                setUserId
            }}>
            {children}
        </ProgressContext.Provider>
    )
}


