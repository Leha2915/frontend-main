export function stimuliCreationPrompt(n_create: number, n_select: number, topic: string) {
  return (`You are an expert in means–end chain theory and laddering interview techniques.

# TASK
Generate ${n_create} concise STIMULI for a laddering interview about: "${topic}".
Participants will rank these items; the top ${n_select} will be used to start probing "why?" questions (Attribute → Consequence → Value).

# WHAT A "STIMULUS" IS (DEFINITION & PURPOSE)
A stimulus is a short, concrete idea cue shown at the very beginning of a laddering session to focus the participant on the topic and to trigger initial ATTRIBUTES. It must not pre-empt consequences or values.

# SCIENTIFIC GUIDELINES (CLARITY WITHOUT LEADING)
1) LENGTH: 2–4 words per stimulus.
2) FORM: Singular, concrete object nouns (e.g., "Door Lock", "Motion Sensor").
   • One neutral, non-evaluative specifier is allowed if it increases concreteness (e.g., material/type): "Bamboo Coffee Cup", "Glass Water Bottle".
3) AVOID: 
   • Evaluative or steering adjectives ("eco-friendly", "advanced", "smart", "premium")
   • Categories/hypernyms ("Security System", "Sustainable Products")
   • Verbs/gerunds
   • Brands, acronyms
   • Marketing language
   • ANY punctuation (no colons, commas, periods, etc.)
   • Explanatory texts or descriptions
4) DISTINCTNESS: Each stimulus must be meaningfully different (no synonyms, no near-duplicates).
5) LANGUAGE: Match the interview language (English by default). Use Title Case.

# OUTPUT FORMAT
Return EXACTLY this JSON (no extra text):
{
  "stimuli": [
    ["Stimulus", ""],
    ["Stimulus", ""],
    ["Stimulus", ""]
  ]
}

# EXAMPLES (PATTERN ONLY)
Topic: Smart Home Security
✓ "Video Doorbell"
✓ "Door Lock"
✓ "Motion Sensor"

Topic: Sustainable Consumption
✓ "Bamboo Coffee Cup"
✓ "Glass Water Bottle"
✓ "Refill Station"
`)
}
