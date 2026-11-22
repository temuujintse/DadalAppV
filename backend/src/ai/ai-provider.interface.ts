/**
 * Provider abstraction: business code (coach, planner, …) never talks to an SDK directly.
 * A provider turns instructions + input into JSON that matches a JSON Schema; the orchestrator
 * then validates it again at runtime.
 */
export const AI_PROVIDER = Symbol('AI_PROVIDER');

export interface AIRequest {
  /** System-level instructions (trusted, written by us). */
  instructions: string;
  /** Conversation / data turns. User text is untrusted and always delimited. */
  input: { role: 'user' | 'assistant'; content: string }[];
  /** Name + strict JSON Schema of the expected output. */
  schemaName: string;
  schema: Record<string, unknown>;
  maxOutputTokens: number;
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AIResult {
  /** Parsed JSON (not yet validated against business rules). */
  data: unknown;
  usage: AIUsage;
  model: string;
  requestId?: string;
}

export type AIErrorKind =
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'AUTH'
  | 'BAD_MODEL'
  | 'INVALID_OUTPUT'
  | 'REFUSAL'
  | 'EMPTY'
  | 'NETWORK';

export class AIProviderError extends Error {
  constructor(
    readonly kind: AIErrorKind,
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  /** False when the provider cannot be used (e.g. no API key). */
  readonly configured: boolean;
  generate(request: AIRequest): Promise<AIResult>;
}
