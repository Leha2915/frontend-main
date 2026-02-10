"use client";

import app_stimuli from "@/app/stimuli/lang.json";
import app_project_slug from "@/app/project/[slug]/lang.json";
import app_onboarding_tutorials from "@/app/onboarding/tutorials/lang.json"
import app_pause from "@/app/pause/lang.json"
import app_onboarding from "@/app/onboarding/lang.json"
import app_chat from "@/app/chat/lang.json"
import app_chat_id from "@/app/chat/[id]/lang.json"
import components_ui_avmOverlay from "@/components/ui/avmOverlay/lang.json"
import components_ui_onboardingPopup from "@/components/ui/onboardingPopup/lang.json"
import app_info from "@/app/project/[slug]/info/lang.json"

const translations: Record<string, any> = {
  app_stimuli,
  app_project_slug,
  app_onboarding,
  app_onboarding_tutorials,
  app_pause,
  app_chat,
  app_chat_id,
  components_ui_avmOverlay,
  components_ui_onboardingPopup,
  app_info
};

const DEFAULT_NS = Object.keys(translations)[0] ?? "default";

export default function getTranslation(loc: string, lang: string): string {
  const parts = loc.split(".");
  let ns: string;

  if (parts[0] in translations) {
    ns = parts.shift() as string;
  } else {
    ns = DEFAULT_NS;
  }

  const bundle = translations[ns];
  if (!bundle) return `Missing namespace: ${ns}`;

  const langData = bundle?.[lang];
  if (!langData) return `Missing language: ${lang} for namespace: ${ns}`;

  let value: any = langData;
  for (const key of parts) {
    if (value == null || typeof value !== "object" || !(key in value)) {
      return `Missing key: ${[ns, ...parts].join(".")}`;
    }
    value = value[key];
  }

  if (typeof value !== "string") {
    return `Invalid translation (expected string) at: ${[ns, ...parts].join(".")}`;
  }

  return value;
}
