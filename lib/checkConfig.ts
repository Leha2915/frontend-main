"use client";
import { Settings } from "./types";

export function checkConfig(sc: Settings & { keyTestResult?: boolean, availableModels?: string[] }) {
  const missing: string[] = [];

  const hasKey = !!sc.openaiAPIKey?.trim();
  if (hasKey && !sc.keyTestResult) {
    missing.push("valid API key");
  }

  if (!sc.topic?.trim()) {
    missing.push("topic");
  }

  const hasStimulus =
    Array.isArray(sc.stimuli) && sc.stimuli.some(s => s?.trim());
  if (!hasStimulus) {
    missing.push("stimuli");
  }


  console.log(sc.model)

  const modelEmpty = !sc.model?.trim();
  const modelInvalid =
    !modelEmpty &&
    Array.isArray(sc.availableModels) &&
    sc.availableModels.length > 0 &&
    !sc.availableModels.includes(sc.model!);

  if (modelEmpty) {
    missing.push("model");
  } else if (modelInvalid) {
    missing.push("valid model");
  }
  

  if (missing.length > 0) {
    return { message: `Please provide: ${missing.join(", ")}`, startable: false };
  }

  return { message: "Configuration successful", startable: true };
}
