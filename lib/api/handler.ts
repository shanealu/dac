import { ZodError } from "zod";
import { DomainError } from "../errors";

type Json = Record<string, unknown> | unknown[];

export const ok = <T>(data: T, init?: ResponseInit) =>
  Response.json({ data }, { status: init?.status ?? 200, ...init });

export const created = <T>(data: T) => ok(data, { status: 201 });

/** Wrap a route handler to translate thrown errors into structured responses. */
export function withErrorHandling<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown): Response {
  if (err instanceof DomainError) {
    return Response.json(
      { error: { code: err.code, message: err.message, details: err.details ?? null } },
      { status: err.httpStatus },
    );
  }
  if (err instanceof ZodError) {
    return Response.json(
      { error: { code: "VALIDATION", message: "Invalid input", issues: err.flatten() } },
      { status: 422 },
    );
  }
  if (err instanceof SyntaxError && /JSON/.test(err.message)) {
    return Response.json(
      { error: { code: "BAD_REQUEST", message: "Malformed JSON body" } },
      { status: 400 },
    );
  }
  console.error("[api] unexpected error:", err);
  return Response.json(
    { error: { code: "INTERNAL", message: "An unexpected error occurred." } },
    { status: 500 },
  );
}

export async function readJson<T extends Json>(req: Request): Promise<T> {
  const text = await req.text();
  if (!text) throw new SyntaxError("Empty JSON body");
  return JSON.parse(text) as T;
}
