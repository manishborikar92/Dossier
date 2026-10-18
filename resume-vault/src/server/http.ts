import { ZodError } from 'zod';
import { issuesToFields } from '@/lib/schemas';
import { HttpError } from './errors';

export const json = (data: unknown, init?: number | ResponseInit): Response =>
  Response.json(data, typeof init === 'number' ? { status: init } : init);

type Handler<C> = (req: Request, ctx: C) => Promise<Response> | Response;

/** Wrap a route handler so errors become tidy JSON responses. */
export function handle<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (error) {
      if (error instanceof ZodError) {
        const fields = issuesToFields(error.issues);
        const first = Object.values(fields)[0] ?? 'Some fields are not valid.';
        return json({ error: first, fields }, 400);
      }
      if (error instanceof HttpError) {
        return json({ error: error.message, fields: error.fields }, error.status);
      }
      console.error(error);
      return json({ error: 'Something went wrong on the server. Check the terminal for details.' }, 500);
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'The request body is not valid JSON.');
  }
}

export function intParam(value: string, what = 'id'): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Invalid ${what}.`);
  return n;
}
