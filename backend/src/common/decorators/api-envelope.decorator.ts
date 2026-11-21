import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';

interface EnvelopeOptions {
  status?: number;
  isArray?: boolean;
  description?: string;
}

/** Documents `{ success: true, data: <model> }` responses in Swagger. */
export function ApiEnvelopeResponse(model: Type<unknown> | null, options: EnvelopeOptions = {}) {
  const data =
    model === null
      ? { type: 'object', nullable: true, example: null }
      : options.isArray
        ? { type: 'array', items: { $ref: getSchemaPath(model) } }
        : { $ref: getSchemaPath(model) };

  const decorators = [
    ApiResponse({
      status: options.status ?? 200,
      description: options.description ?? 'Success',
      schema: {
        type: 'object',
        required: ['success', 'data'],
        properties: { success: { type: 'boolean', example: true }, data },
      },
    }),
  ];
  return applyDecorators(...(model ? [ApiExtraModels(model)] : []), ...decorators);
}

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: 'Validation error (code VALIDATION_ERROR) or bad request',
  401: 'Missing/invalid access token',
  403: 'Insufficient family role',
  404: 'Resource not found (or not visible to this user)',
  409: 'Conflict with current state',
  410: 'Expired or used-up resource',
  429: 'Rate limited',
};

/** Documents the standard error envelope for the given HTTP statuses. */
export function ApiErrorResponses(...statuses: number[]) {
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: ERROR_DESCRIPTIONS[status] ?? 'Error',
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Оруулсан мэдээлэл буруу байна.' },
                details: { type: 'array', items: { type: 'object' }, nullable: true },
                requestId: { type: 'string' },
              },
            },
          },
        },
      }),
    ),
  );
}
