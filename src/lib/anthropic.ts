import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

export function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return client
}

export const PARSER_MODEL = 'claude-sonnet-4-6'
