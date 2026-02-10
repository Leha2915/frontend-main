import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { ChatCompletionMessageParam } from 'openai/resources'

//TODO: ins backend!

export async function POST(request: NextRequest) {
  const { role_prompt, model, OPENAI_API_KEY, base_url } = await request.json()

  // OpenAI-Client mit dynamischer baseURL initialisieren
  const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
    baseURL: base_url || 'https://api.openai.com/v1', // Fallback auf Standard-URL
  })

  const outboundMessages: ChatCompletionMessageParam[] = [
    {
      role: 'user',
      content: role_prompt,
    },
  ]

  try {
    const completion = await openai.chat.completions.create({
      messages: outboundMessages,
      model,
      presence_penalty: 0,
      temperature: 1,
      response_format: {
        type: 'json_object',
      },
    })

    return NextResponse.json(completion)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error }, { status: 500 })
  }
}
