"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import StatusIndicator from "@/components/ui/StatusIndicator";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProgressContext } from "@/context/progress";
import { SettingsContext } from "@/context/settings";
import { checkConfig } from "@/lib/checkConfig";
import { StimuliPromptAnswer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { stimuliCreationPrompt } from "@/prompts/stimuli-creation";
import { useMutation } from "@tanstack/react-query";
import { Bird, ChevronRightIcon, Info, LoaderCircle, LockIcon, Rabbit, Trash2, Turtle, UploadIcon, EyeIcon, EyeOffIcon, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChatCompletion } from "openai/resources";
import React, { useContext, useEffect, useState, useLayoutEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import RequireAuthLevel from "@/components/RequireAuthLevel";
import { useJWTAuth } from "@/context/jwtAuth";
import CloudflareR2Tester from "@/components/CloudFlareTester";

type ButtonEvent = React.MouseEvent<HTMLButtonElement>
type ChangeEvent = React.ChangeEvent<HTMLTextAreaElement>

const api_url = process.env.NEXT_PUBLIC_API_URL;
const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o";
const DEFAULT_FINISH_NEXT_TITLE = "What happens next?"
const DEFAULT_FINISH_NEXT_BODY = "Please continue with the next part of the study by following this link:"
const DEFAULT_FINISH_NEXT_LINK = "https://survey.iism.kit.edu/index.php/821265?newtest=Y&lang=en"
const INFO_DEFAULTS = {
    en: {
        purposeTitle: "Purpose of the Study",
        purposeBody:
            "This study aims to explore your goals when using smartphones. We will use an interview tool to understand how end users perceive different smartphone functionalities. It is especially important for us to learn why certain features and characteristics matter to you.",
        taskTitle: "Your Task",
        taskBody:
            "Imagine you have been asked to help develop a new smartphone. To ensure that this product is perfectly tailored to you, we will conduct a short interview with you today. You will complete this interview as a potential user of the new smartphone. Several questions will guide you through the interview. Please answer them truthfully and in detail.",
        question2Prompt: "We aim to find out what your goals are when using smartphones.",
    },
    de: {
        purposeTitle: "Zweck der Studie",
        purposeBody:
            "In dieser wissenschaftlichen Studie geht es um die Untersuchung deiner Ziele bei der Nutzung von Smartphones. Dazu verwenden wir ein Tool zur Durchführung eines Interviews, um zu verstehen, wie Endnutzer Produkte und Services wahrnehmen. Dabei ist uns besonders wichtig zu erfahren, warum bestimmte Eigenschaften und Features wichtig sind.",
        taskTitle: "Deine Aufgabe",
        taskBody:
            "Stelle dir vor, du wurdest gebeten, bei der Entwicklung einer neuen App für Smartphones zu unterstützen. Damit diese App perfekt auf dich zugeschnitten ist, führt der Anbieter heute ein kurzes Interview mit dir. Dieses führst du als potenzieller Nutzer der neuen App mit unserem Tool durch. Mehrere Fragen werden dich durch das Interview führen. Beantworte die Fragen wahrheitsgemäß und detailliert.",
        question2Prompt: "Wir versuchen dadurch herauszufinden, was deine Ziele bei der Nutzung von Smartphones sind.",
    },
} as const


export default function Dashboard() {
    const { fetchWithAuth } = useJWTAuth();

    const router = useRouter()

    const sc = useContext(SettingsContext);
    const pc = useContext(ProgressContext)


    const [keyVisible, setKeyVisible] = useState(false)
    const [KeyTestMessage, setKeyTestMessage] = useState("Please test your key")
    const [keyTestResult, setKeyTestResult] = useState(false)
    const [apiConfigAdvanced, setApiConfigAdvanced] = useState(false)

    const [elevenlabsKeyVisible, setElevenlabsKeyVisible] = useState(false)
    const [elevenlabsKeyTestResult, setElevenlabsKeyTestResult] = useState(false)
    const [elevenabsKey, setElevenlabsKey] = useState("")

    const [sttProvider, setSttProvider] = useState("Microsoft Azure")
    const [sttKey, setSttKey] = useState("")
    const [sttKeyVisible, setSttKeyVisible] = useState(false)

    const [sttEndpoint, setSttEndpoint] = useState("https://germanywestcentral.api.cognitive.microsoft.com/")

    const [r2ID, setr2ID] = useState("")
    const [r2Key, setr2Key] = useState("")
    const [r2Secret, setr2Secret] = useState("")
    const [r2Bucket, setr2Bucket] = useState("")

    const [internalId, setInternalId] = useState("")
    const [idCount, setIdCount] = useState(internalId.length || 0)

    const [availableModels, setAvailableModels] = useState<string[]>([])
    const [isLoadingModels, setIsLoadingModels] = useState(false)
    const [modelLoadError, setModelLoadError] = useState<string | null>(null)

    const [startable, setStartable] = useState(checkConfig({ ...sc, keyTestResult, availableModels }).startable)
    const [err_message, setErr_message] = useState(checkConfig({ ...sc, keyTestResult, availableModels }).message)


    const predefinedBaseURLs = [
        { label: "OpenAI (default)", value: "https://api.openai.com/v1" },
        { label: "Groq (fastest)", value: "https://api.groq.com/openai/v1"},
        { label: "vLLM Universität Göttingen", value: "https://chat-ai.academiccloud.de/v1"},
        { label: "Anthropic Claude", value: "https://api.anthropic.com/v1"},
        { label: "Custom", value: "custom" }
    ]

    const [customBaseURL, setCustomBaseURL] = useState(sc.baseURL || OPENAI_DEFAULT_BASE_URL)
    const [selectedBaseURL, setSelectedBaseURL] = useState(() => {
        // Initialwert: ist baseURL in Liste? Wenn ja → Wert, sonst "custom"
        const effectiveBaseURL = sc.baseURL || OPENAI_DEFAULT_BASE_URL
        const known = predefinedBaseURLs.find(p => p.value === effectiveBaseURL)
        return known ? known.value : "custom"
    })

    const [descriptionCount, setDescriptionCount] = useState(sc.description?.length || 0)
    const [topicCount, setTopicCount] = useState(sc.topic?.length || 0)


    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [advancedVoiceEnabled, setAdvancedVoiceEnabled] = useState(false);
    const [treeEnabled, setTreeEnabled] = useState(false);
    const [interviewMode, setInterviewMode] = useState(1);
    const [maxRetries, setMaxRetries] = useState(3);

    const [language, setLanguage] = useState("en");
    const [finishNextTitle, setFinishNextTitle] = useState(DEFAULT_FINISH_NEXT_TITLE);
    const [finishNextBody, setFinishNextBody] = useState(DEFAULT_FINISH_NEXT_BODY);
    const [finishNextLink, setFinishNextLink] = useState(DEFAULT_FINISH_NEXT_LINK);
    const [infoPurposeTitle, setInfoPurposeTitle] = useState(INFO_DEFAULTS.en.purposeTitle);
    const [infoPurposeBody, setInfoPurposeBody] = useState(INFO_DEFAULTS.en.purposeBody);
    const [infoTaskTitle, setInfoTaskTitle] = useState(INFO_DEFAULTS.en.taskTitle);
    const [infoTaskBody, setInfoTaskBody] = useState(INFO_DEFAULTS.en.taskBody);
    const [infoQuestion2Prompt, setInfoQuestion2Prompt] = useState(INFO_DEFAULTS.en.question2Prompt);

    const [timeLimit, setTimeLimit] = useState(-1);

    const [minNodes, setMinNodes] = useState(0);

    const [autoSend, setAutoSend] = useState(false);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);


    const DEFAULT_PREF: (string | RegExp)[] = [
        DEFAULT_MODEL,
        "gpt-oss20B",
        "gpt-oss-120B",
        /claude.*sonnet/i,
        /llama.*instruct/i,
        /mistral.*large/i,
        /mixtral.*instruct/i,
        /mistral.*instruct/i,
        "qwq-32b"
    ];


    async function testElevenLabsKeyForTTS(key:string, voiceId:string): Promise<boolean> {
        try {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
            method: "POST",
            headers: {
                "xi-api-key": key,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg"
            },
            body: JSON.stringify({
            text: "",
            model_id: "eleven_turbo_v2"
            }),
        });

        if (!res.ok) return false;
        return true;
        } catch (err) {
        return false;
        }
    }

    function pickDefaultModel(models: string[]): string {
        if (!models || models.length === 0) return "";

        let pref = DEFAULT_PREF;

        const findByPattern = (p: string | RegExp) => {
            if (p instanceof RegExp) return models.find(m => p.test(m));
            const needle = p.toLowerCase();
            const exact = models.find(m => m.toLowerCase() === needle);
            if (exact) return exact;
            return models.find(m => m.toLowerCase().includes(needle));
        };

        for (const p of pref) {
            const hit = findByPattern(p);
            if (hit) return hit;
        }

        return models[0];
        }

    useEffect(() => {
        sc.setTopic("")
        sc.setDescription("")
        sc.setStimuli(["", "", ""])
        if (!sc.baseURL) {
            sc.setBaseURL(OPENAI_DEFAULT_BASE_URL)
        }
        setTopicCount(0)
        setDescriptionCount(0)
    }, [])

    useEffect(() => {
        if (!apiConfigAdvanced) {
            setSelectedBaseURL(OPENAI_DEFAULT_BASE_URL)
            sc.setBaseURL(OPENAI_DEFAULT_BASE_URL)
        }
    }, [apiConfigAdvanced])

    useEffect(() => {
        setStartable(checkConfig({ ...sc, keyTestResult, availableModels }).startable)
        setErr_message(checkConfig({ ...sc, keyTestResult, availableModels }).message)
    })

    useEffect(() => {
        const fetchModels = async () => {
            if (!sc.baseURL) {
                console.warn("No models selectable")
                return
            }

            setIsLoadingModels(true)
            setModelLoadError(null)

            try {
                const res = await fetch('/api/models', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        base_url: sc.baseURL,
                        OPENAI_API_KEY: sc.openaiAPIKey,
                    }),
                })

                if (!res.ok) throw new Error(`Status ${res.status}`)
                const data: string[] = await res.json()
                if (Array.isArray(data) && data.length > 0) {
                    setAvailableModels(data)
                    sc.setModel(pickDefaultModel(data))
                } else {
                    console.warn("No models returned from backend")
                    setAvailableModels([])
                    sc.setModel("")
                }
            } catch (err) {
                console.error("Loading error:", err)
                setModelLoadError("Could not load models.")
                setAvailableModels([])
                sc.setModel("")
            } finally {
                setIsLoadingModels(false)
            }
        }

        fetchModels()
    }, [sc.baseURL, sc.openaiAPIKey])

    useEffect(() => {
    if (!apiConfigAdvanced) {
        setKeyTestMessage("Default mode active - secure backend defaults are used");
        setKeyTestResult(true);
        return;
    }

    const key = sc.openaiAPIKey?.trim();
    if (!key) {
        setKeyTestMessage("No key entered - backend default is used if configured");
        setKeyTestResult(true);
        return;
    }

    setKeyTestMessage("Testing API key...");
    setKeyTestResult(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
        testAPIKey();
    }, 500);

    return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    }, [apiConfigAdvanced, sc.openaiAPIKey, sc.baseURL]);


    const handleAddInput = () => {
        sc.setStimuli([...sc.stimuli, ""])

    };

    const handleChange = (index: number, e: ChangeEvent) => {
        let NewArr = [...sc.stimuli]
        NewArr[index] = e.target.value
        sc.setStimuli(NewArr)
    }

    const handleDeleteInput = (index: number) => {
        let NewArr = [...sc.stimuli]
        NewArr.splice(index, 1)
        sc.setStimuli(NewArr)

    };

    const { mutate: testAPIKey, isPending: isTestingKey } = useMutation({
        // Key zur Identifizierung von Mutation
        mutationKey: ['testAPIKey'],
        // include message to later use it in onMutate
        mutationFn: async () => {
            const response = await fetch(`${api_url}/testOpenaiAPIKey`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },

                body: JSON.stringify({
                    OPENAI_API_KEY: sc.openaiAPIKey,
                    base_url: sc.baseURL || "https://api.openai.com/v1"
                }),
            })
            return response
        },

        onSuccess: async (data) => {
            
            const response = await data.json()

            if (response.ok === true) {
                setKeyTestMessage("API key is valid")
                setKeyTestResult(true)
            } else {
                setKeyTestMessage(response.reason)
                setKeyTestResult(false)
            }
        }
    })

    const { mutate: createProject, isPending: isCreatingProject } = useMutation({
    mutationKey: ['createProject'],
    mutationFn: async () => {

        const response = await fetchWithAuth(`${api_url}/projects`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
        },
            credentials: 'include',
        body: JSON.stringify({
            topic: sc.topic,
            description: sc.description,
            stimuli: sc.stimuli,
            n_stimuli: sc.n_stimuli,
            api_key: apiConfigAdvanced ? sc.openaiAPIKey : "",
            model: apiConfigAdvanced ? sc.model : DEFAULT_MODEL,
            base_url: apiConfigAdvanced ? sc.baseURL : OPENAI_DEFAULT_BASE_URL,
            n_values_max: sc.n_values_max,
            min_nodes: minNodes,
            voice_enabled: voiceEnabled,
            tree_enabled: treeEnabled,
            advanced_voice_enabled: advancedVoiceEnabled,
            interview_mode: interviewMode,
            elevenlabs_api_key: apiConfigAdvanced ? elevenabsKey : "",
            max_retries: maxRetries,
            auto_send: autoSend,
            time_limit: timeLimit,

            r2_account_id: apiConfigAdvanced ? r2ID : "",
            r2_access_key_id: apiConfigAdvanced ? r2Key : "",
            r2_secret_access_key: apiConfigAdvanced ? r2Secret : "",
            r2_bucket: apiConfigAdvanced ? r2Bucket : "",
            
            language: language,

            internal_id: internalId,

            stt_key: apiConfigAdvanced ? sttKey : "",
            stt_endpoint: apiConfigAdvanced ? sttEndpoint : "",
            stt_provider: apiConfigAdvanced
                ? (sttProvider === "KIT KARAI" ? "karai" : "azure")
                : "azure",
            finish_next_title: finishNextTitle,
            finish_next_body: finishNextBody,
            finish_next_link: finishNextLink,
            info_purpose_title: infoPurposeTitle,
            info_purpose_body: infoPurposeBody,
            info_task_title: infoTaskTitle,
            info_task_body: infoTaskBody,
            info_question2_prompt: infoQuestion2Prompt,
        }),
        });

        if (!response.ok) {
            throw new Error("Unable to create project.");
        }

        return await response.json();
    },
    onSuccess: (project) => {
        router.push(`/project`);
    },
    onError: () => {
        alert("Error while creating new project.");
    }
    });


    const { mutate: mutcreateStimuli, isPending } = useMutation({
        // Key zur Identifizierung von Mutation
        mutationKey: ['createStimuli'],
        // include message to later use it in onMutate
        mutationFn: async () => {
            const response = await fetch('/api/stimuli', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    role_prompt: stimuliCreationPrompt(sc.stimuli.length, sc.n_stimuli, sc.topic),
                    model: sc.model,
                    OPENAI_API_KEY: sc.openaiAPIKey,
                    base_url: sc.baseURL
                }),
            })
            return response
        },

        onSuccess: (data) => {
            if (data.status === 200) {
                data.json().then((response) => {
                    const answer = response as ChatCompletion
                    const Stimuli = JSON.parse(answer.choices[0].message.content.replace(/```json\n?/, "").replace(/```$/, "")) as StimuliPromptAnswer
                    
                    // Doppelpunkte aus den Stimuli entfernen falls vorhanden
                    const NewArr: string[] = sc.stimuli.map<string>((value, index) => 
                        Stimuli.stimuli[index][0].replace(/:\s*$/, '')) 
                    
                    sc.setStimuli(NewArr)
                })
            }
        }
    })

    useEffect(() => {
        if (availableModels.length > 0 && !availableModels.includes(sc.model)) {
            sc.setModel(pickDefaultModel(availableModels));
        }
    }, [availableModels, sc.model]);

    useEffect(() => {
        const defaults = language === "de" ? INFO_DEFAULTS.de : INFO_DEFAULTS.en;
        setInfoPurposeTitle(defaults.purposeTitle);
        setInfoPurposeBody(defaults.purposeBody);
        setInfoTaskTitle(defaults.taskTitle);
        setInfoTaskBody(defaults.taskBody);
        setInfoQuestion2Prompt(defaults.question2Prompt);
    }, [language]);


    const downloadSettingsConfig = () => {
        const element = document.createElement("a");
        const file = new Blob([JSON.stringify(sc, null, 2),], { type: 'application/json' });
        element.href = URL.createObjectURL(file);
        element.download = "LadderChat_Config_Data.json";
        document.body.appendChild(element); // Required for this to work in FireFox
        element.click();
    }


    return (

      <RequireAuthLevel>
        <div className="flex flex-col h-full bg-white">

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto p-6 space-y-8">
                    
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">1</div>
                            <h2 className="text-lg font-semibold text-gray-900">Basic Project Information</h2>
                        </div>
                        
                        <div className="flex gap-6">


                <div className="flex-1 space-y-2">
                    <Label htmlFor="laddering_topic">Topic</Label>
                    <Textarea
                    id="laddering_topic"
                    placeholder="The topic of the interview project"
                    style={{
                        width: "45ch",
                        height: "100px",
                        resize: "none",
                    }}
                    maxLength={70}
                    onChange={(e) => {
                        sc.setTopic(e.target.value);
                        setTopicCount(e.target.value.length);
                    }}
                    />
                    <p className="text-sm text-muted-foreground text-right">{topicCount}/70</p>
                </div>

                <div className="grid gap-3">
                    <Label htmlFor="project-description">Project Description</Label>
                    <Textarea
                        id="project-description"
                        placeholder="(This will be seen by the interviewees)"
                                style={{
                                    width: "45ch",
                                    height: "100px",
                                    resize: "none",
                                }}
                        maxLength={700}
                        onChange={(e) => {
                            sc.setDescription(e.target.value)
                            setDescriptionCount(e.target.value.length)
                        }}
                    />
                    <p className="text-sm text-muted-foreground text-right">{descriptionCount}/700</p>
                </div>



                </div>

                    </div>


                <div className="grid gap-3">
                    <div>
                    <Label htmlFor="internal-id">Internal Id</Label>
                    <Textarea
                        id="internal-id"
                        placeholder="(Not seen by interviewees)"
                                style={{
                                    width: "45ch",
                                    height: "100px",
                                    resize: "none",
                                }}
                        maxLength={200}
                        onChange={(e) => {
                            setInternalId(e.target.value)
                            setIdCount(e.target.value.length)
                        }}
                    />
                    <p className="text-sm text-muted-foreground text-center">{idCount}/200</p>
                    </div>
                </div>

                    

                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">2</div>
                            <h2 className="text-lg font-semibold text-gray-900">Service & API Configuration</h2>
                        </div>
                        
                        <Card className="border-gray-200">
                            <CardHeader className="pb-4">
                                <CardDescription>
                                    {apiConfigAdvanced
                                        ? "Configure provider and API credentials manually."
                                        : "Use secure backend defaults for provider credentials."}
                                </CardDescription>
                                <div className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 mt-2">
                                    <div className="text-sm">
                                        <span className="font-medium">{apiConfigAdvanced ? "Advanced" : "Default"}</span>
                                        <span className="text-gray-500 ml-2">mode</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={cn("text-xs", !apiConfigAdvanced ? "text-gray-900 font-medium" : "text-gray-500")}>Default</span>
                                        <Switch
                                            checked={apiConfigAdvanced}
                                            onCheckedChange={setApiConfigAdvanced}
                                            aria-label="Toggle advanced API configuration"
                                        />
                                        <span className={cn("text-xs", apiConfigAdvanced ? "text-gray-900 font-medium" : "text-gray-500")}>Advanced</span>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-4 flex flex-col">
                                <div className="order-2 space-y-4">
                                    {!apiConfigAdvanced && (
                                        <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-4 space-y-2 text-sm">
                                            <p className="font-medium text-gray-900">Default configuration summary</p>
                                            <p><span className="text-gray-500">LLM provider:</span> OpenAI (default)</p>
                                            <p><span className="text-gray-500">LLM base URL:</span> {OPENAI_DEFAULT_BASE_URL}</p>
                                            <p><span className="text-gray-500">Model:</span> {DEFAULT_MODEL} (default)</p>
                                            <p><span className="text-gray-500">Speech-to-Text provider:</span> Microsoft Azure</p>
                                            {advancedVoiceEnabled && (
                                                <p><span className="text-gray-500">Voice output provider:</span> ElevenLabs (if configured) with Browser TTS fallback</p>
                                            )}
                                            <p><span className="text-gray-500">Voice storage provider:</span> Cloudflare R2</p>
                                        </div>
                                    )}

                                    {apiConfigAdvanced && (
                                        <>
                                        <div className="flex flex-col gap-1">
                                            <Label htmlFor="base-url">Provider</Label>
                                            <Select
                                                value={selectedBaseURL}
                                                onValueChange={(val) => {
                                                    setKeyTestMessage("Please test your key")
                                                    setKeyTestResult(false)
                                                    setSelectedBaseURL(val)
                                                    if (val !== "custom") {
                                                        sc.setBaseURL(val)
                                                    } else {
                                                        sc.setBaseURL(customBaseURL)
                                                    }
                                                }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select base URL" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white">
                                                    {predefinedBaseURLs.map((item) => (
                                                        <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                            {selectedBaseURL === "custom" && (
                                                <Input
                                                    placeholder="Enter custom base URL"
                                                    value={customBaseURL}
                                                    onChange={(e) => {
                                                        const val = e.target.value
                                                        setCustomBaseURL(val)
                                                        sc.setBaseURL(val)
                                                        setKeyTestMessage("Please test your key")
                                                    }}
                                                />
                                            )}
                                        </div>

                                        <div className="grid gap-1">
                                            <Label htmlFor="api-key">API-Key</Label>
                                            <div className="flex gap-4 items-center">
                                                <Input
                                                    value={sc.openaiAPIKey || ""}
                                                    type={keyVisible ? "text" : "password"}
                                                    id="api-key"
                                                    onChange={(e) => {
                                                        sc.setOpenaiAPIKey(e.target.value);
                                                    }}
                                                />

                                                {keyVisible
                                                    ? <EyeOffIcon onClick={() => setKeyVisible(false)} className="cursor-pointer" />
                                                    : <EyeIcon onClick={() => setKeyVisible(true)} className="cursor-pointer" />
                                                }
                                            </div>
                                        </div>

                                        <div className="grid gap-3">
                                            <Label htmlFor="model-step2-advanced">Model</Label>
                                            <Select value={sc.model || undefined} onValueChange={(model) => sc.setModel(model)}>
                                                <SelectTrigger id="model-step2-advanced" className="items-start">
                                                    <SelectValue placeholder="Select a model" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white">
                                                    {isLoadingModels && <SelectItem disabled value="loading">Loading models...</SelectItem>}
                                                    {modelLoadError && <SelectItem disabled value="error">{modelLoadError}</SelectItem>}
                                                    {availableModels.map((modelId) => (
                                                        <SelectItem key={modelId} value={modelId}>{modelId}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="grid gap-1">
                                            <Label htmlFor="select-stt-provider">Speech-to-Text Provider</Label>
                                            <Select
                                                value={sttProvider}
                                                onValueChange={(v) => {
                                                    setSttProvider(v)
                                                }}
                                            >
                                                <SelectTrigger id="select-stt-provider-option" className="items-start">
                                                    <SelectValue placeholder="Select option" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white">
                                                    <SelectItem value="Microsoft Azure">Microsoft Azure</SelectItem>
                                                    <SelectItem value="KIT KARAI">KIT KARAI</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {sttProvider === "Microsoft Azure" && (
                                            <>
                                                <div className="grid gap-1">
                                                    <Label htmlFor="stt-endpoint">Azure STT Endpoint</Label>
                                                    <Input
                                                        value={sttEndpoint || ""}
                                                        placeholder="https://germanywestcentral.api.cognitive.microsoft.com/"
                                                        type="text"
                                                        id="stt-endpoint"
                                                        onChange={(e) => {
                                                            setSttEndpoint(e.target.value);
                                                        }}
                                                    />
                                                </div>

                                                <div className="grid gap-1">
                                                    <Label htmlFor="stt-key">Azure STT Key</Label>
                                                    <div className="flex gap-4 items-center">
                                                        <Input
                                                            value={sttKey || ""}
                                                            placeholder="Microsoft Azure Speech-to-Text Api Key"
                                                            type={sttKeyVisible ? "text" : "password"}
                                                            id="stt-key"
                                                            onChange={(e) => {
                                                                setSttKey(e.target.value);
                                                            }}
                                                        />
                                                        {sttKeyVisible
                                                            ? <EyeOffIcon onClick={() => setSttKeyVisible(false)} className="cursor-pointer" />
                                                            : <EyeIcon onClick={() => setSttKeyVisible(true)} className="cursor-pointer" />
                                                        }
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                        {sttProvider === "KIT KARAI" && (
                                            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                                                Using KIT KARAI endpoint: <span className="font-mono">https://karai.k8s.iism.kit.edu/transcribe</span>
                                            </div>
                                        )}

                                        <div className="grid gap-1">
                                            <Label htmlFor="elevenlabs-api-key">Elevenlabs Text-to-Speech API-Key</Label>
                                            <div className="flex gap-4 items-center">
                                                <Input
                                                    value={elevenabsKey || ""}
                                                    placeholder="Optional"
                                                    type={elevenlabsKeyVisible ? "text" : "password"}
                                                    id="elevenlabs-api-key"
                                                    onChange={async (e) => {
                                                        setElevenlabsKey(e.target.value);
                                                        if (await testElevenLabsKeyForTTS(e.target.value, "EXAVITQu4vr4xnSDxMaL")) {
                                                            setElevenlabsKeyTestResult(true)
                                                        } else {
                                                            setElevenlabsKeyTestResult(false)
                                                        }
                                                    }}
                                                />

                                                {elevenlabsKeyVisible
                                                    ? <EyeOffIcon onClick={() => setElevenlabsKeyVisible(false)} className="cursor-pointer" />
                                                    : <EyeIcon onClick={() => setElevenlabsKeyVisible(true)} className="cursor-pointer" />
                                                }
                                                {elevenlabsKeyTestResult ? <Check /> : <X />}
                                            </div>
                                        </div>

                                        <div className="grid gap-1">
                                            <Label>Cloudflare R2 Account (optional - only if user voice should be saved)</Label>
                                            <CloudflareR2Tester
                                                apiPath={`${api_url}/cloudflare/test`}
                                                initialAccountId={r2ID}
                                                initialAccessKeyId={r2Key}
                                                initialSecretAccessKey={r2Secret}
                                                initialBucket={r2Bucket}
                                                onValidatedChange={(r2) => {
                                                    setr2ID(r2.accountId);
                                                    setr2Key(r2.accessKeyId);
                                                    setr2Secret(r2.secretAccessKey);
                                                    setr2Bucket(r2.bucket);
                                                }}
                                            />
                                        </div>
                                        </>
                                    )}
                                </div>

                                <div className="order-1 space-y-4">
                                    {!apiConfigAdvanced && (
                                        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-2 text-sm">
                                            <p className="font-medium text-gray-900">Interview interaction settings summary</p>
                                            <p><span className="text-gray-500">Enable permanent tree view:</span> {String(treeEnabled)}</p>
                                            <p><span className="text-gray-500">Interview mode:</span> {interviewMode === 1 ? "Hybrid" : interviewMode === 2 ? "Text Only" : "Voice Only"}</p>
                                            <p><span className="text-gray-500">Enable Dictate Button:</span> {String(voiceEnabled)}</p>
                                            <p><span className="text-gray-500">Enable Advanced Voice Agent Button:</span> {String(advancedVoiceEnabled)}</p>
                                            <p><span className="text-gray-500">Language:</span> {language === "de" ? "German" : "English"}</p>
                                            {advancedVoiceEnabled && (
                                                <p><span className="text-gray-500">Voice output provider:</span> ElevenLabs (if configured) with Browser TTS fallback</p>
                                            )}
                                        </div>
                                    )}

                                    {apiConfigAdvanced && (
                                        <div className="rounded-md border border-gray-200 bg-white p-4 space-y-4">
                                            <p className="text-sm font-medium text-gray-900">Interview interaction settings</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="grid gap-3">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Label htmlFor="tree-enabled-step2" className="place-self-start">
                                                            Enable permanent tree view <Info className="size-4 inline-block ml-1" />
                                                        </Label>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="left" sideOffset={5}>
                                                        Interviewee can see their own tree at any point of time in the interview (default: false)
                                                    </TooltipContent>
                                                </Tooltip>
                                                <Select
                                                    value={String(treeEnabled)}
                                                    onValueChange={(v) => setTreeEnabled(v === "true")}
                                                >
                                                    <SelectTrigger id="tree-enabled-step2" className="items-start">
                                                        <SelectValue placeholder="Select option" />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-white">
                                                        <SelectItem value="true">True</SelectItem>
                                                        <SelectItem value="false">False</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="grid gap-3">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Label htmlFor="interview-mode-step2" className="place-self-start">
                                                            Interview mode <Info className="size-4 inline-block ml-1" />
                                                        </Label>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="left" sideOffset={5}>
                                                        <div>Hybrid     - Dialog with agent is enabled, but the user can also type directly</div>
                                                        <div>Text only  - Dialog with agent is disabled</div>
                                                        <div>Voice only - Dialog with agent is the only interaction</div>
                                                    </TooltipContent>
                                                </Tooltip>
                                                <Select
                                                    value={String(interviewMode)}
                                                    onValueChange={(v) => {
                                                        setInterviewMode(Number(v));
                                                        if (v == "2") {setAdvancedVoiceEnabled(false); setVoiceEnabled(false);}
                                                        if (v == "3") {setAdvancedVoiceEnabled(true);}
                                                    }}
                                                >
                                                    <SelectTrigger id="interview-mode-step2" className="items-start">
                                                        <SelectValue placeholder="Select option" />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-white">
                                                        <SelectItem value="1">Hybrid</SelectItem>
                                                        <SelectItem value="2">Text Only</SelectItem>
                                                        <SelectItem value="3">Voice Only</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="grid gap-3">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Label htmlFor="voice-enabled-step2" className="place-self-start">
                                                            Enable Dictate Button <Info className="size-4 inline-block ml-1" />
                                                        </Label>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="right" sideOffset={5}>
                                                        Enables user voice input and its transcription
                                                    </TooltipContent>
                                                </Tooltip>
                                                <Select
                                                    value={String(voiceEnabled)}
                                                    onValueChange={(v) => {
                                                        setVoiceEnabled(v === "true");
                                                        if (interviewMode == 2 && v === "true") {setInterviewMode(1)}
                                                        if (!advancedVoiceEnabled && v === "false") {setInterviewMode(2)}
                                                    }}
                                                >
                                                    <SelectTrigger id="voice-enabled-step2" className="items-start">
                                                        <SelectValue placeholder="Select option" />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-white">
                                                        <SelectItem value="true">True</SelectItem>
                                                        <SelectItem value="false">False</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="grid gap-3">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Label htmlFor="advanced-voice-enabled-step2" className="place-self-start">
                                                            Enable Advanced Voice Agent Button <Info className="size-4 inline-block ml-1" />
                                                        </Label>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="right" sideOffset={5}>
                                                        Enables direct communication
                                                    </TooltipContent>
                                                </Tooltip>
                                                <Select
                                                    value={String(advancedVoiceEnabled)}
                                                    onValueChange={(v) => {
                                                        setAdvancedVoiceEnabled(v === "true");
                                                        if (interviewMode == 2 && v === "true") {setInterviewMode(1)}
                                                        if (!voiceEnabled && v === "false") {setInterviewMode(2)}
                                                    }}
                                                >
                                                    <SelectTrigger id="advanced-voice-enabled-step2" className="items-start">
                                                        <SelectValue placeholder="Select option" />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-white">
                                                        <SelectItem value="true">True</SelectItem>
                                                        <SelectItem value="false">False</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="grid gap-3">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Label htmlFor="language-step2" className="place-self-start">
                                                            Language <Info className="size-4 inline-block ml-1" />
                                                        </Label>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="right" sideOffset={5}>
                                                        The Language of the experiment
                                                    </TooltipContent>
                                                </Tooltip>
                                                <Select
                                                    value={String(language)}
                                                    onValueChange={(v) => {
                                                        setLanguage(v)
                                                    }}
                                                >
                                                    <SelectTrigger id="language-step2" className="items-start">
                                                        <SelectValue placeholder="Select option" />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-white">
                                                        <SelectItem value="en">English</SelectItem>
                                                        <SelectItem value="de">German</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>

                            <CardFooter className="p-3 pt-2 flex justify-center">
                                <StatusIndicator className="" message={KeyTestMessage} isGood={keyTestResult} />
                            </CardFooter>
                        </Card>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">3</div>
                            <h2 className="text-lg font-semibold text-gray-900">Stimuli Generation</h2>
                        </div>

                        <div className="border border-gray-200 bg-white rounded-lg p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-medium text-gray-900">Stimulus Collection</h3>
                                <Button
                                    variant="outline"
                                    onClick={() => mutcreateStimuli()}
                                    disabled={!sc.model}
                                >
                                    {isPending ? (
                                        <LoaderCircle className="animate-spin" />
                                    ) : sc.model ? (
                                        <span>Suggest Stimuli with {sc.model}</span>
                                    ) : (
                                        <span>No model selected</span>
                                    )}
                                </Button>
                            </div>

                            <div className="space-y-4">
                                {sc.stimuli.map((item, index) => (
                                    <div className="space-y-2" key={index}>
                                        <div className="flex justify-between items-center">
                                            <Label>Stimulus {index + 1}</Label>
                                            <Button className="justify-self-end" variant="destructive" size="sm" onClick={() => handleDeleteInput(index)}>
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </div>
                                        <Textarea
                                            onChange={(e) => {
                                                handleChange(index, e)
                                            }}
                                            className="resize-none"
                                            id={"" + (index + 1)}
                                            placeholder="Enter Stimulus..."
                                            value={item}
                                        />
                                    </div>
                                ))}
                            </div>

                            <Button variant="outline" onClick={handleAddInput} className="w-full">Add Stimulus</Button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">4</div>
                            <h2 className="text-lg font-semibold text-gray-900">Interview Configuration</h2>
                        </div>
                        
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                            <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="grid gap-3">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Label htmlFor="n_stimuli" className="place-self-start">Number of selected Stimuli <Info className="size-4 inline-block ml-0.5" /></Label>
                                                </TooltipTrigger>
                                                <TooltipContent side="right" sideOffset={5}>
                                                    Number of Stimuli that will be elicitated by User. <br />
                                                    This also determines the number of interview chats.
                                                </TooltipContent>
                                            </Tooltip>
                                            <Input value={sc.n_stimuli} id="num_of_selection" type="number" placeholder="2" step="1" min={1} max={sc.stimuli.length} onChange={(e) => sc.setN_stimuli(Number(e.target.value))} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="grid gap-3">
                                            <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Label htmlFor="n_values_max" className="place-self-start">
                                                Max values per chat <Info className="size-4 inline-block ml-1" />
                                                </Label>
                                            </TooltipTrigger>
                                            <TooltipContent side="left" sideOffset={5}>
                                                Limits how many values a participant can enter per stimulus chat.
                                            </TooltipContent>
                                            </Tooltip>

                                            <Select
                                            value={String(sc.n_values_max ?? -1)}
                                            onValueChange={(v) => sc.setN_values_max(Number(v))}
                                            >
                                            <SelectTrigger id="n_values_max" className="items-start">
                                                <SelectValue placeholder="Select a limit" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-white">
                                                <SelectItem value="-1">No limit</SelectItem>
                                                {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                                                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                                ))}
                                            </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="grid gap-3">
                                            
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Label htmlFor="min_nodes" className="place-self-start">
                                                    Min Nodes per chat<Info className="size-4 inline-block ml-1" />
                                                    </Label>
                                                </TooltipTrigger>
                                                <TooltipContent side="right" sideOffset={5}>
                                                    Minimal amount of nodes needed to enable default stop rule (empty queue). Topic and stimulus count toward all nodes (Lower than 3 has no effect). Expect about 7 until the first value is reached.
                                                </TooltipContent>
                                            </Tooltip>

                                            <Input value={minNodes} id="min_nodes" type="number" placeholder="8" step="1" min={3} max={20} onChange={(e) => setMinNodes(Number(e.target.value))} />
                                        </div>
                                        

                                        <div className="grid gap-3">
                                            <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Label htmlFor="time_limit" className="place-self-start">
                                                Time limit<Info className="size-4 inline-block ml-1" />
                                                </Label>
                                            </TooltipTrigger>
                                            <TooltipContent side="left" sideOffset={5}>
                                                Limits the time of an interview.
                                            </TooltipContent>
                                            </Tooltip>

                                            <Select
                                            value={String(timeLimit ?? -1)}
                                            onValueChange={(v) => setTimeLimit(Number(v))}
                                            >
                                            <SelectTrigger id="time_limit" className="items-start">
                                                <SelectValue placeholder="Select a limit" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-white">
                                                <SelectItem value="-1">No limit</SelectItem>
                                                {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map((n) => (
                                                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                                ))}
                                            </SelectContent>
                                            </Select>
                                        </div>
                                        

                                        <div className="grid gap-3">
                                            
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Label htmlFor="advanced-voice-enabled" className="place-self-start">
                                                    Max retries <Info className="size-4 inline-block ml-1" />
                                                    </Label>
                                                </TooltipTrigger>
                                                <TooltipContent side="right" sideOffset={5}>
                                                    How many times the user can stay on the same node without ending the stimuli chat automatically
                                                </TooltipContent>
                                            </Tooltip>

                                            <Select
                                            value={String(maxRetries ?? -1)}
                                            onValueChange={(v) => setMaxRetries(Number(v))}
                                            >
                                            <SelectTrigger id="n_values_max" className="items-start">
                                                <SelectValue placeholder="Select a limit" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-white">
                                                <SelectItem value="-1">No limit</SelectItem>
                                                {[1,2,3,4,5].map((n) => (
                                                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                                ))}
                                            </SelectContent>
                                            </Select>  
                                        </div>


                                    {advancedVoiceEnabled &&

                                        <div className="grid gap-3">
                                            
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Label htmlFor="voice-enabled" className="place-self-start">
                                                    Auto send avm messages <Info className="size-4 inline-block ml-1" />
                                                    </Label>
                                                </TooltipTrigger>
                                                <TooltipContent side="right" sideOffset={5}>
                                                    When in the advanced voice mode, user messages will be sent to agent if user stops talking automatically.
                                                </TooltipContent>
                                            </Tooltip>

                                            <Select
                                            value={String(autoSend)}
                                            onValueChange={(v) => {
                                                setAutoSend(v === "true");
                                            }}
                                            >
                                            <SelectTrigger id="auto-send" className="items-start">
                                                <SelectValue placeholder="Select option" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-white">
                                                <SelectItem value="false">False</SelectItem>
                                            </SelectContent>
                                            </Select>
                                        </div>



                                    }

                                    </div>

                                </div>
                            </div>
                        </div>
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">5</div>
                        <h2 className="text-lg font-semibold text-gray-900">Project Info Page Texts</h2>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-6">
                                <div className="grid gap-3">
                                    <Label htmlFor="info-purpose-title">Purpose section title</Label>
                                    <Input
                                        id="info-purpose-title"
                                        value={infoPurposeTitle}
                                        onChange={(e) => setInfoPurposeTitle(e.target.value)}
                                        placeholder={INFO_DEFAULTS.en.purposeTitle}
                                    />
                                </div>
                                <div className="grid gap-3">
                                    <Label htmlFor="info-purpose-body">Purpose section text</Label>
                                    <Textarea
                                        id="info-purpose-body"
                                        className="resize-none"
                                        value={infoPurposeBody}
                                        onChange={(e) => setInfoPurposeBody(e.target.value)}
                                        placeholder={INFO_DEFAULTS.en.purposeBody}
                                    />
                                </div>
                                <div className="grid gap-3">
                                    <Label htmlFor="info-task-title">Your task section title</Label>
                                    <Input
                                        id="info-task-title"
                                        value={infoTaskTitle}
                                        onChange={(e) => setInfoTaskTitle(e.target.value)}
                                        placeholder={INFO_DEFAULTS.en.taskTitle}
                                    />
                                </div>
                                <div className="grid gap-3">
                                    <Label htmlFor="info-task-body">Your task section text</Label>
                                    <Textarea
                                        id="info-task-body"
                                        className="resize-none"
                                        value={infoTaskBody}
                                        onChange={(e) => setInfoTaskBody(e.target.value)}
                                        placeholder={INFO_DEFAULTS.en.taskBody}
                                    />
                                </div>
                                <div className="grid gap-3">
                                    <Label htmlFor="info-question2">Question 2 prompt</Label>
                                    <Textarea
                                        id="info-question2"
                                        className="resize-none"
                                        value={infoQuestion2Prompt}
                                        onChange={(e) => setInfoQuestion2Prompt(e.target.value)}
                                        placeholder={INFO_DEFAULTS.en.question2Prompt}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">6</div>
                        <h2 className="text-lg font-semibold text-gray-900">End Card</h2>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 gap-6">
                                <div className="grid gap-3">
                                    <Label htmlFor="finish-next-title">Finish box title</Label>
                                    <Input
                                        id="finish-next-title"
                                        value={finishNextTitle}
                                        onChange={(e) => setFinishNextTitle(e.target.value)}
                                        placeholder={DEFAULT_FINISH_NEXT_TITLE}
                                    />
                                </div>
                                <div className="grid gap-3">
                                    <Label htmlFor="finish-next-body">Finish box description</Label>
                                    <Textarea
                                        id="finish-next-body"
                                        className="resize-none"
                                        value={finishNextBody}
                                        onChange={(e) => setFinishNextBody(e.target.value)}
                                        placeholder={DEFAULT_FINISH_NEXT_BODY}
                                    />
                                </div>
                                <div className="grid gap-3">
                                    <Label htmlFor="finish-next-link">Finish box link URL</Label>
                                    <Input
                                        id="finish-next-link"
                                        value={finishNextLink}
                                        onChange={(e) => setFinishNextLink(e.target.value)}
                                        placeholder={DEFAULT_FINISH_NEXT_LINK}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                </div>
            </div>

            <div className="border-t border-gray-200 bg-gray-50 p-4">
                <div className="mx-auto">
                    <div className="relative flex items-center w-full">
                    <div className="absolute left-1/2 -translate-x-1/2">
                        <StatusIndicator message={err_message} isGood={startable} />
                    </div>

                    <div className="ml-auto">
                        <Button
                        variant="default"
                        className="h-12 w-72 bg-blue-600 hover:bg-blue-700"
                        disabled={!startable || isCreatingProject || (apiConfigAdvanced && !!sc.openaiAPIKey?.trim() && !keyTestResult)}
                        onClick={() => createProject()}
                        >
                        {isCreatingProject ? (
                            <LoaderCircle className="animate-spin" />
                        ) : (
                            <>
                            <ChevronRightIcon className="mr-2 h-4 w-4" />
                            Generate Project Link
                            </>
                        )}
                        </Button>
                    </div>
                    </div>
                </div>
            </div>

            </div>


    </RequireAuthLevel>


    )
}