import { fail } from "@openmonetis/shared/api";
import type { ErrorHandler, NotFoundHandler } from "hono";
import { ApiError } from "../utils/errors";

export const errorHandler: ErrorHandler = (error, context) => {
  const companionCompatibility = isCompanionCompatibilityPath(context.req.path);

  if (error instanceof ApiError) {
    if (companionCompatibility) {
      return context.json({ error: getCompanionErrorMessage(error.code) }, error.status);
    }
    return context.json(fail(error.message, error.code), error.status);
  }

  console.error(error);

  if (companionCompatibility) {
    return context.json({ error: "Erro interno" }, 500);
  }
  return context.json(fail("Internal server error", "internal_server_error"), 500);
};

export const notFoundHandler: NotFoundHandler = (context) => {
  if (isCompanionCompatibilityPath(context.req.path)) {
    return context.json({ error: "Rota não encontrada" }, 404);
  }
  return context.json(fail("Route not found", "not_found"), 404);
};

function isCompanionCompatibilityPath(path: string) {
  return path === "/api/auth/device/verify" || path === "/api/inbox" || path === "/api/inbox/batch";
}

function getCompanionErrorMessage(code: string) {
  switch (code) {
    case "inbox_idempotency_conflict":
      return "Identificador já utilizado com outro conteúdo";
    case "inbox_notification_timestamp_invalid":
      return "Data da notificação inválida";
    default:
      return "Não foi possível receber a notificação";
  }
}
