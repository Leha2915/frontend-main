export interface OnboardingChatAnswer {
  message: string
}

export async function onboardingChat({
  message,
  finish,
  path,
  template,
}: {
  message: string
  finish: boolean
  path: string
  template: string
}): Promise<OnboardingChatAnswer> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  const project_slug = localStorage.getItem("project") ?? ""
  const session_id = localStorage.getItem(`interview_session_${project_slug}`) ?? ""
  const payload = { project_slug, session_id, message, path, finish, template }

  const ac = new AbortController()
  const timeoutId = setTimeout(() => ac.abort(), 20000)

  try {
    const res = await fetch(`${apiUrl}/onboarding-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
      body: JSON.stringify(payload),
      signal: ac.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`Request failed ${res.status} ${res.statusText} ${text ? `- ${text}` : ""}`)
    }

    const data = (await res.json()) as OnboardingChatAnswer
    return data
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error("timeout")
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}
