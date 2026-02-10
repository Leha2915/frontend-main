import { Settings } from "@/lib/types"
import { createContext, Dispatch, SetStateAction, useState } from "react"


export const SettingsContext = createContext<Settings>({
    model: "",
    setModel: () => { },
    openaiAPIKey: "",
    setOpenaiAPIKey: () => { },
    topic: "",
    setTopic: () => { },
    description: "",
    setDescription: () => { },
    stimuli: [],
    setStimuli: () => { },
    n_stimuli: 0,
    setN_stimuli: () => { },
    projectSlug: "",
    setProjectSlug: () => {},
    baseURL: "",
    setBaseURL: () => {},
    consentGiven: false,
    setConsentGiven: () => {},
    n_values_max: 0,
    setN_values_max: () => {},
    dictationEnabled: false,
    setDictationEnabled: () => {},
    voiceEnabled: false,
    setVoiceEnabled: () => {},
    interviewMode: 1,
    setInterviewMode: () => {},
    treeEnabled: false,
    setTreeEnabled: () => {},
    autoSendAvm: false,
    setAutoSendAvm: () => {},
    timeLimit: -1,
    setTimeLimit: () => {},
    language: "de",
    setLanguage: () => {},
})


export function SettingsProvider({ children }: { children: React.ReactNode }) {

    const [model, setModel]: [string, Dispatch<SetStateAction<string>>] = useState("")
    const [topic, setTopic]: [string, Dispatch<SetStateAction<string>>] = useState("")
    const [description, setDescription]: [string, Dispatch<SetStateAction<string>>] = useState("")
    const [n_stimuli, setN_stimuli]: [number, Dispatch<SetStateAction<number>>] = useState(2)
    const [stimuli, setStimuli]: [string[], Dispatch<SetStateAction<string[]>>] = useState(["", "", ""])
    const [openaiAPIKey, setOpenaiAPIKey]: [string, Dispatch<SetStateAction<string>>] = useState("")
    const [projectSlug, setProjectSlug]: [string, Dispatch<SetStateAction<string>>] = useState("")
    const [baseURL, setBaseURL]: [string, Dispatch<SetStateAction<string>>] = useState("https://api.openai.com/v1")
    const [consentGiven, setConsentGiven]: [boolean, Dispatch<SetStateAction<boolean>>] = useState(false)
    const [n_values_max, setN_values_max]: [number, Dispatch<SetStateAction<number>>] = useState(-1)
    const [voiceEnabled, setVoiceEnabled]: [boolean, Dispatch<SetStateAction<boolean>>] = useState(false)
    const [interviewMode, setInterviewMode]: [number, Dispatch<SetStateAction<number>>] = useState(1)
    const [treeEnabled, setTreeEnabled]: [boolean, Dispatch<SetStateAction<boolean>>] = useState(false)
    const [dictationEnabled, setDictationEnabled]: [boolean, Dispatch<SetStateAction<boolean>>] = useState(false)
    const [autoSendAvm, setAutoSendAvm]: [boolean, Dispatch<SetStateAction<boolean>>] = useState(false)
    const [timeLimit, setTimeLimit]: [number, Dispatch<SetStateAction<number>>] = useState(-1)
    const [language, setLanguage]: [string, Dispatch<SetStateAction<string>>] = useState("de")

    return (
        <SettingsContext.Provider
            value={{
                model,
                setModel,
                topic,
                setTopic,
                description,
                setDescription,
                n_stimuli,
                setN_stimuli,
                stimuli,
                setStimuli,
                openaiAPIKey,
                setOpenaiAPIKey,
                projectSlug,
                setProjectSlug,
                baseURL,
                setBaseURL,
                consentGiven,
                setConsentGiven,
                n_values_max,
                setN_values_max,
                voiceEnabled,
                setVoiceEnabled,
                interviewMode,
                setInterviewMode,
                treeEnabled,
                setTreeEnabled,
                dictationEnabled,
                setDictationEnabled,
                autoSendAvm,
                setAutoSendAvm,
                timeLimit,
                setTimeLimit,
                language,
                setLanguage,
            }}>
            {children}
        </SettingsContext.Provider>
    )
}







