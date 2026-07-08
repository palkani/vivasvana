import { NextResponse } from 'next/server';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { Prisma } from '@vivasvana/db';

/**
 * Serverless HTTP helpers — the Next.js equivalent of what the Fastify
 * `error-handler` plugin + `@fastify/sensible` gave the old API service.
 *
 * A route handler throws a typed `HttpError` (or a ZodError from schema
 * parsing, or a Prisma error) and `route()` maps it to the right JSON
 * response. This keeps every handler a thin "parse → authorize → call
 * service → return json" function with no try/catch boilerplate.
 */

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly errorCode: string,
    message: string,
    public readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = errorCode;
  }
}

export const badRequest = (message: string, extra?: Record<string, unknown>) =>
  new HttpError(400, 'BadRequest', message, extra);
export const unauthorized = (message = 'unauthorized') =>
  new HttpError(401, 'Unauthorized', message);
export const forbidden = (message = 'forbidden') => new HttpError(403, 'Forbidden', message);
export const notFound = (message = 'not found') => new HttpError(404, 'NotFound', message);
export const conflict = (message = 'conflict') => new HttpError(409, 'Conflict', message);
export const tooManyRequests = (message = 'too many requests') =>
  new HttpError(429, 'TooManyRequests', message);

/** Convenience JSON responder so handlers don't import NextResponse directly. */
export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

/**
 * Secure default: in PRODUCTION we never leak internal error details
 * (Prisma messages, connection strings, driver internals) to the client —
 * they only ever go to the server logs. Outside production the detail is
 * included to keep local/preview debugging fast. To temporarily diagnose a
 * live prod issue, set EXPOSE_ERROR_DETAILS=true on the deployment.
 */
function detailsIfExposed(err: unknown): Record<string, unknown> {
  const expose =
    process.env.EXPOSE_ERROR_DETAILS === 'true' || process.env.NODE_ENV !== 'production';
  if (!expose) return {};
  if (!(err instanceof Error)) return { detail: { type: typeof err } };
  const detail: Record<string, unknown> = { name: err.name, message: err.message };
  if ('code' in err && typeof err.code === 'string') detail.code = err.code;
  return { detail };
}

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json(
      { error: err.errorCode, message: err.message, ...(err.extra ?? {}) },
      { status: err.status },
    );
  }

  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'ValidationError',
        message: 'Invalid request payload',
        issues: err.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return NextResponse.json(
        { error: 'Conflict', message: 'Resource already exists', meta: err.meta },
        { status: 409 },
      );
    }
    if (err.code === 'P2025') {
      return NextResponse.json(
        { error: 'NotFound', message: 'Resource not found' },
        { status: 404 },
      );
    }
    console.error('[api] prisma known request error', err);
    return NextResponse.json(
      { error: 'DatabaseError', message: 'Database error', ...detailsIfExposed(err) },
      { status: 500 },
    );
  }

  console.error('[api] unhandled route error', err);
  return NextResponse.json(
    { error: 'InternalServerError', message: 'Something went wrong', ...detailsIfExposed(err) },
    { status: 500 },
  );
}

type RouteCtx = { params?: Promise<Record<string, string>> };
// Allow plain Response too, so handlers can `return new Response(null, {status:204})`.
type Handler = (req: Request, ctx: RouteCtx) => Promise<Response> | Response;

/**
 * Wrap a route handler so any thrown HttpError/ZodError/Prisma error becomes
 * the appropriate JSON response. Every exported GET/POST/… should be wrapped.
 */
export function route(handler: Handler) {
  return async (req: Request, ctx: RouteCtx): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

/** Parse + validate a JSON body. Throws badRequest on malformed JSON, ZodError on shape. */
export async function parseBody<S extends ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw badRequest('Invalid or missing JSON body');
  }
  return schema.parse(raw);
}

/** Parse + validate the URL querystring as a flat object. */
export function parseQuery<S extends ZodTypeAny>(req: Request, schema: S): z.infer<S> {
  const url = new URL(req.url);
  return schema.parse(Object.fromEntries(url.searchParams.entries()));
}

/** Parse + validate Next.js dynamic route params (awaited from ctx.params). */
export async function parseParams<S extends ZodTypeAny>(
  ctx: RouteCtx,
  schema: S,
): Promise<z.infer<S>> {
  const params = (await ctx.params) ?? {};
  return schema.parse(params);
}
