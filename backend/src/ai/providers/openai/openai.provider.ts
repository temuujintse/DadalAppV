import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  BadRequestError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
} from 'openai';
import type { Env } from '../../../config/env';
import { AIProvider, AIProviderError, AIRequest, AIResult } from '../../ai-provider.interface';

/**
 * OpenAI Responses API with Structured Outputs (strict JSON Schema).
 * The official SDK retries 429 / 5xx / timeouts with exponential backoff (maxRetries).
 */
@Injectable()
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  readonly model: string;
  readonly configured: boolean;
  private readonly client: OpenAI | null;

  constructor(config: ConfigService<Env, true>) {
    const apiKey = config.get('OPENAI_API_KEY', { infer: true });
    this.model = config.get('OPENAI_MODEL', { infer: true });
    this.configured = Boolean(apiKey);
    this.client = apiKey
      ? new OpenAI({
          apiKey,
          timeout: config.get('OPENAI_TIMEOUT_MS', { infer: true }),
          maxRetries: 2,
        })
      : null;
  }

  async generate(request: AIRequest): Promise<AIResult> {
    if (!this.client) throw new AIProviderError('AUTH', 'OPENAI_API_KEY is not configured');
    let response: OpenAI.Responses.Response;
    let requestId: string | undefined;
    try {
      const { data, request_id } = await this.client.responses
        .create({
          model: this.model,
          instructions: request.instructions,
          input: request.input.map((m) => ({ role: m.role, content: m.content })),
          max_output_tokens: request.maxOutputTokens,
          store: false,
          text: {
            format: {
              type: 'json_schema',
              name: request.schemaName,
              schema: request.schema,
              strict: true,
            },
          },
        })
        .withResponse();
      response = data;
      requestId = request_id ?? undefined;
    } catch (err) {
      throw mapError(err);
    }

    for (const item of response.output) {
      if (item.type !== 'message') continue;
      for (const part of item.content) {
        if (part.type === 'refusal') {
          throw new AIProviderError('REFUSAL', part.refusal, requestId);
        }
      }
    }
    if (response.status === 'incomplete') {
      throw new AIProviderError(
        'INVALID_OUTPUT',
        `Incomplete response: ${response.incomplete_details?.reason ?? 'unknown'}`,
        requestId,
      );
    }
    const text = response.output_text?.trim();
    if (!text) throw new AIProviderError('EMPTY', 'Empty response', requestId);

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new AIProviderError('INVALID_OUTPUT', 'Response is not valid JSON', requestId);
    }
    return {
      data,
      model: response.model,
      requestId,
      usage: {
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
    };
  }
}

function mapError(err: unknown): AIProviderError {
  const requestId = err instanceof APIError ? (err.requestID ?? undefined) : undefined;
  if (err instanceof APIConnectionTimeoutError)
    return new AIProviderError('TIMEOUT', 'Timed out', requestId);
  if (err instanceof APIConnectionError)
    return new AIProviderError('NETWORK', 'Network error', requestId);
  if (err instanceof RateLimitError)
    return new AIProviderError('RATE_LIMITED', 'Rate limited', requestId);
  if (err instanceof AuthenticationError || err instanceof PermissionDeniedError) {
    return new AIProviderError('AUTH', 'Authentication failed', requestId);
  }
  if (err instanceof NotFoundError)
    return new AIProviderError('BAD_MODEL', 'Unknown model', requestId);
  if (err instanceof BadRequestError) {
    return new AIProviderError('INVALID_OUTPUT', `Bad request: ${err.message}`, requestId);
  }
  if (err instanceof APIError)
    return new AIProviderError('UNAVAILABLE', `HTTP ${err.status}`, requestId);
  return new AIProviderError('UNAVAILABLE', String(err), requestId);
}
