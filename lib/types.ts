import { NodeOrigin, Position, XYPosition, Node } from "@xyflow/react";
import { Languages } from "next/dist/lib/metadata/types/alternative-urls-types";


// ──────────────────────────────────────────────────────────────────────────────
// BASIC MESSAGE TYPES
// ──────────────────────────────────────────────────────────────────────────────

export interface Message {
    id: string,
    text: string,
    isUserMessage: boolean,
    isSeparator?: boolean,
}


export interface StimuliPromptAnswer {
    stimuli: string[][],
}


// ──────────────────────────────────────────────────────────────────────────────
// INTERVIEW TREE STRUCTURE
// ──────────────────────────────────────────────────────────────────────────────

export interface TreeNode {
  id: number;
  label: string;
  conclusion: string;
  parents: number[];
  children: number[];
  trace: TraceElement[];
  is_value_path_completed: boolean;
}


export interface TreeStructure {
    nodes: TreeNode[];
    active_node_id: number | null;
    root_node_id: number | null;
}


export interface TraceElement {
  node_id: number;
  interaction_id: string | null;
}


// ──────────────────────────────────────────────────────────────────────────────
// CHAT & RESPONSE TYPES
// ──────────────────────────────────────────────────────────────────────────────

export interface ChatPromptAnswer {
    Next: {
    NextQuestion: string;
    AskingIntervieweeFor: string;
    ThoughtProcess: string;
    EndOfInterview: boolean;
    session_id?: string;  // (optional mit ?)

    ValuesReached?: boolean;  // Zeigt an, ob das Values-Limit erreicht wurde
    ValuesCount?: number;     // Aktuelle Anzahl der Values
    ValuesMax?: number;       // Maximum erlaubte Values
    CompletionReason?: "VALUES_LIMIT_REACHED" | "NORMAL_COMPLETION" | "FORCED_END";
    
  };
    Tree: TreeStructure;
}


export interface Chat {
    chatid: string,
    stimulus: string,
    messages: Message[],
    finished: boolean,
    rawMessages: (Message | ChatPromptAnswer)[],
    lastLLMTought: string,
    autoHelloSent: boolean
}



// ──────────────────────────────────────────────────────────────────────────────
// ANALYSIS & VISUALIZATION TYPES
// ──────────────────────────────────────────────────────────────────────────────

export interface MessageFromUserWithAnalysis {
    isUserMessage: true,
    text: string,
}


export interface MessageFromLLMWithAnalysis {
    isUserMessage: false,
    text: string,
    thought: string,
    tree: TreeStructure;
}


export interface TreeAnalysisData {
  chatid: string, 
  stimulus: string;
  treeData: TreeStructure;
}


export interface Edges {
    id: string,
    source: string,
    target: string,
    type?: string,
    label?: string,
}



// ──────────────────────────────────────────────────────────────────────────────
// SETTINGS & CONFIGURATION TYPES
// ──────────────────────────────────────────────────────────────────────────────

export interface SettingsFile {
    model: string,
    topic: string,
    n_stimuli: number,
    stimuli: string[],
}

export interface Settings {
    model: string,
    setModel: (model: string) => void,
    openaiAPIKey: string,
    setOpenaiAPIKey: (openaiAPIKey: string) => void,
    topic: string,
    setTopic: (topic: string) => void,
    description: string,
    setDescription: (description: string) => void,
    n_stimuli: number,
    setN_stimuli: (n_stimuli: number) => void,
    stimuli: string[],
    setStimuli: (stimuli: string[]) => void,
    projectSlug: string,
    setProjectSlug: (projectSlug: string) => void,
    baseURL: string,
    setBaseURL: (baseURL: string) => void,
    consentGiven: boolean,
    setConsentGiven: (consentGiven: boolean) => void,
    n_values_max: number,
    setN_values_max: (n_values_max: number) => void,
    voiceEnabled: boolean,
    setVoiceEnabled: (voiceEnabled: boolean) => void,
    interviewMode: number,
    setInterviewMode: (voiceEnabled: number) => void,
    treeEnabled: boolean,
    setTreeEnabled: (voiceEnabled: boolean) => void,
    dictationEnabled: boolean,
    setDictationEnabled: (dictationEnabled: boolean) => void,
    autoSendAvm: boolean,
    setAutoSendAvm: (autoSendAvm: boolean) => void,
    timeLimit: number,
    setTimeLimit: (timeLimit: number) => void,
    language: string,
    setLanguage: (language: string) => void,
}


// ──────────────────────────────────────────────────────────────────────────────
// TYPE GUARDS & UTILITY FUNCTIONS
// ──────────────────────────────────────────────────────────────────────────────

export const isChatPromptAnswer = (arg: any) => {
    return arg.Next !== undefined && arg.Tree !== undefined;
}


