import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodValidationException } from "nestjs-zod";

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  path: string;
  timestamp: string;
}

/**
 * Global exception filter. Normalizes the response body to a single shape:
 *
 *   { error: { code, message, details? }, path, timestamp }
 *
 * Goals:
 *   • Consistent shape — clients/UI can render errors uniformly.
 *   • No user enumeration — auth failures from the AuthService throw
 *     `UnauthorizedException("Invalid credentials")`, which this filter
 *     emits with code "INVALID_CREDENTIALS" regardless of root cause.
 *   • Zod validation errors surface their issues under `details`.
 *   • Internal errors are logged with stack but the client only sees a
 *     generic message — never leak DB errors / stack traces / Prisma error
 *     codes that could be probed for tenant existence.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<FastifyRequest>();
    const reply = ctx.getResponse<FastifyReply>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_ERROR";
    let message = "An unexpected error occurred";
    let details: unknown;

    if (exception instanceof ZodValidationException) {
      status = HttpStatus.BAD_REQUEST;
      code = "VALIDATION_ERROR";
      message = "Request validation failed";
      details = exception.getZodError().issues;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      // Normalize: Nest's HttpException can hand us a string or an object.
      if (typeof response === "string") {
        message = response;
      } else if (typeof response === "object" && response !== null) {
        const r = response as Record<string, unknown>;
        // Step 5+: tenant guards throw payloads shaped { code, message }
        // (e.g. { code: "TENANT_SUSPENDED", message: "…" }). When present,
        // the explicit code wins over the status-based mapping.
        if (typeof r.code === "string") code = r.code;
        if (typeof r.message === "string") message = r.message;
        else if (Array.isArray(r.message)) message = r.message.join("; ");
        if (code === "INTERNAL_ERROR" && typeof r.error === "string") {
          code = httpErrorCodeFor(status, r.error);
        }
      }
      if (code === "INTERNAL_ERROR") code = httpErrorCodeFor(status);
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
    } else {
      this.logger.error("Unhandled non-Error exception", String(exception));
    }

    const body: ErrorBody = {
      error: { code, message, ...(details !== undefined ? { details } : {}) },
      path: req.url,
      timestamp: new Date().toISOString(),
    };
    void reply.status(status).send(body);
  }
}

function httpErrorCodeFor(status: number, hint?: string): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return "BAD_REQUEST";
    case HttpStatus.UNAUTHORIZED:
      return "UNAUTHORIZED";
    case HttpStatus.FORBIDDEN:
      return "FORBIDDEN";
    case HttpStatus.NOT_FOUND:
      return "NOT_FOUND";
    case HttpStatus.CONFLICT:
      return "CONFLICT";
    case HttpStatus.TOO_MANY_REQUESTS:
      return "RATE_LIMITED";
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return "UNPROCESSABLE";
    default:
      return hint ? hint.toUpperCase().replace(/\s+/g, "_") : "INTERNAL_ERROR";
  }
}
