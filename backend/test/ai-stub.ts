import type { AIProvider, AIRequest, AIResult } from '../src/ai/ai-provider.interface';

/** Programmable stand-in for OpenAI: no network, records every request. */
export class StubProvider implements AIProvider {
  readonly name = 'stub';
  readonly model = 'stub-1';
  configured = true;
  calls: AIRequest[] = [];
  next: (req: AIRequest) => unknown = () => ({ recommendations: [] });

  // Synchronous on purpose (the interface returns a Promise); errors thrown by `next`
  // surface as rejections, like a real provider call.
  generate(req: AIRequest): Promise<AIResult> {
    this.calls.push(req);
    return new Promise((resolve) => {
      resolve({
        data: this.next(req),
        model: this.model,
        requestId: `req_${this.calls.length}`,
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      });
    });
  }
}
