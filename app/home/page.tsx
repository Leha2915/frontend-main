"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import StatusIndicator from "@/components/ui/StatusIndicator";
import { ProgressContext } from "@/context/progress";
import { SettingsContext } from "@/context/settings";
import { checkConfig } from "@/lib/checkConfig";
import { SettingsFile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { DivideCircleIcon, EyeIcon, EyeOffIcon, LoaderCircle, LockIcon, Settings2Icon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import OpenAI from "openai";
import { ChatCompletion } from "openai/resources";
import { ChangeEvent, useContext, useState } from "react";
import RequireAuthLevel from "@/components/RequireAuthLevel";

export default function Home() {

    const sc = useContext(SettingsContext)
    const pc = useContext(ProgressContext)
    const router = useRouter()

    const [startable, setStartable] = useState(checkConfig(sc).startable)
    const [err_message, setErr_message] = useState(checkConfig(sc).message)

    const [keyVisible, setKeyVisible] = useState(false)
    const [KeyTestMessage, setKeyTestMessage] = useState("Please test your key")
    const [keyTestResult, setKeyTestResult] = useState(false)

    const importsettings = (e: ChangeEvent<HTMLInputElement>) => {

        if (e.target.files.length === 0) {
            setStartable(false)
            setErr_message("No file selected")
            return
        }

        setStartable(false)
        const file1 = e.target.files[0]


        file1.text().then(
            (value) => {
                const importdata = value

                try {

                    try {
                        const importSettings = JSON.parse(importdata) as SettingsFile
                        const { model, topic, n_stimuli, stimuli } = importSettings


                        if ((topic === "") && (stimuli.every((s) => s === ""))) {
                            setStartable(false)
                            setErr_message("Configuartion has no topic and no stimuli")
                            return

                        } else if (topic === "") {
                            setStartable(false)
                            setErr_message("Configuartion has no topic")
                            return

                        } else if (stimuli.every((s) => s === "")) {

                            setStartable(false)
                            setErr_message("Configuartion has no stimuli")
                            return

                        }


                        sc.setModel(model)
                        sc.setTopic(topic)
                        sc.setN_stimuli(n_stimuli)
                        sc.setStimuli(stimuli)

                        console.log(sc)

                        setStartable(checkConfig(sc).startable)
                        setErr_message(checkConfig(sc).message)

                    }

                    catch (error) {
                        setStartable(false)
                        setErr_message("No LadderChat Configuartion file")
                    }

                } catch (error) {
                    setStartable(false)
                    setErr_message("No valid JSON")
                }
            }
        )

    }


    const { mutate: testAPIKey, isPending } = useMutation({
        // Key zur Identifizierung von Mutation
        mutationKey: ['testAPIKey'],
        // include message to later use it in onMutate
        mutationFn: async () => {
            const response = await fetch('/api/testOpenaiAPIKey', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },

                body: JSON.stringify({
                    OPENAI_API_KEY: sc.openaiAPIKey
                }),
            })
            return response
        },

        onSuccess: (data) => {
            if (data.status === 200) {
                data.json().then((response) => {

                    try {
                        if (response.choices[0].text !== "") {
                            setKeyTestMessage("API key is valid")
                            setKeyTestResult(true)
                        }
                    } catch (error) {
                        setKeyTestMessage("API key is not valid")
                        setKeyTestResult(false)
                    }

                })
            }
        }
    })








    return (

        <RequireAuthLevel>

            
            <div className="w-[50%] ml-auto mr-auto mt-8">

                <p>Disclaimer: <br />
                    As LadderChat is still in developemt it is not yet perfect. <br />
                    We want to make you aware of the following conditions: <br />
                    1) If you refresh the window via F5 or the browser refresh button, LadderChat will reset itself and the data will be gone. <br />
                    So please do not refresh during the session. <br />
                    2) The bot is not adjusted for smaller screens such as smartphones. <br />
                    3) No data is collected during the process. However, if you want to help me improve the bot you have the option to give some feedback and upload the chat logs at the end of the interview. <br />
                    4) If you want to checkout the Configuration page click Setup yourslef below. <br />
                    You can always come back here via the logo in the top left corner <br />

                    <br /><br /><br />
                </p>


                <div id="wrapper" className="w-full relative">

                    <div className={cn("flex absolute w-[calc(100%+2rem)] h-[calc(100%+2rem)] -left-4 -top-4 bg-[rgba(160,160,160,0.8)] rounded", {
                        'hidden': !pc.submittedRanking
                    })}>
                        <LockIcon size="30%" className="mx-auto place-self-center"></LockIcon>
                    </div>


                    <Card className="mb-4">
                        <CardHeader>
                            <CardTitle className="mb-4">Set OpenAI API Key</CardTitle>
                            <CardDescription className="pb-3">Please enter your OpenAI API Key. If no key is set LadderChat will not answer.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-4 items-center">
                                <Input
                                    defaultValue={sc.openaiAPIKey}
                                    type={keyVisible ? "text" : "password"}
                                    id="api-key"
                                    className=""
                                    onChange={(event) => {
                                        sc.setOpenaiAPIKey(event.target.value)
                                        setKeyTestMessage("Please test your key")
                                        setKeyTestResult(false)
                                    }}
                                />

                                {keyVisible ? <EyeOffIcon onClick={() => setKeyVisible(false)} /> : <EyeIcon onClick={() => setKeyVisible(true)} />}
                            </div>
                        </CardContent>
                        <CardFooter className="grid grid-rows-2 justify-items-center gap-4">
                            <StatusIndicator className="" message={KeyTestMessage} isGood={keyTestResult} />
                            <Button className="w-full" variant="outline" onClick={() => testAPIKey()}>
                                {isPending
                                    ? <LoaderCircle className="animate-spin" />
                                    : <p>Test your API Key</p>
                                }
                            </Button>
                        </CardFooter>

                    </Card>


                    <Card>
                        <CardHeader>
                            <CardTitle className="mb-4">Configuration Setup</CardTitle>
                            <CardDescription className="pb-3">Choose how you want to set up LadderChat</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between space-x-4">
                                <div className="flex-1">
                                    <Input
                                        type="file"
                                        id="config-file"
                                        className="sr-only"
                                        accept=".json,.yml,.yaml"
                                        onChange={(event) => importsettings(event)}
                                    />
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => document.getElementById('config-file').click()}
                                    >
                                        <UploadIcon className="mr-2 h-4 w-4" />
                                        Import Settings
                                    </Button>
                                </div>
                                <span className="text-sm font-medium text-muted-foreground">OR</span>
                                <div className="flex-1">
                                    <Button variant="outline" className="w-full" onClick={() => router.push('/setup')}>
                                        <Settings2Icon className="mr-2 h-4 w-4" />
                                        Manual Setup
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="grid grid-rows-2 justify-items-center gap-4">
                            <StatusIndicator className="" message={err_message} isGood={startable} />
                            <Button className="w-full" variant="outline" disabled={!startable} onClick={() => router.push('/stimuli')}>Start</Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>

        </RequireAuthLevel>
    )
}

