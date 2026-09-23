import type { Request } from 'express';
import type { ZodType } from 'zod';

export function parseRequestBody<T>(request: Request, schema: ZodType<T>): T {
  return schema.parse(request.body);
}
