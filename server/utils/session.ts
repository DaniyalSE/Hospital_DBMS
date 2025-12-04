import type { Request } from "express";
import crypto from "node:crypto";

const SESSION_HEADER = "x-session-id";
const SESSION_PROP = Symbol("sessionId");

type SessionAwareRequest = Request & { [SESSION_PROP]?: string };

export function getSessionId(req: Request): string {
  const headerValue = req.header(SESSION_HEADER);
  if (headerValue) {
    return headerValue;
  }

  const sessionAware = req as SessionAwareRequest;
  if (!sessionAware[SESSION_PROP]) {
    sessionAware[SESSION_PROP] = crypto.randomUUID();
  }
  return sessionAware[SESSION_PROP];
}
