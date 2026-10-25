export class AppError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
export function databaseError(error: unknown): never {
  const e = error as { code?: string; message?: string };
  if (
    ["PGRST202", "PGRST205", "42P01", "42703", "42883"].includes(e?.code || "")
  )
    throw new AppError(
      "DATABASE_NOT_READY",
      503,
      "Conversation storage has not been initialized.",
    );
  if (e?.code === "42501")
    throw new AppError(
      "DATABASE_PERMISSION_DENIED",
      503,
      "Conversation storage access is not configured.",
    );
  if (/monthly limit/i.test(e?.message || ""))
    throw new AppError(
      "QUOTA_EXCEEDED",
      429,
      "Your monthly allowance has been reached.",
    );
  if (/rate limit/i.test(e?.message || ""))
    throw new AppError(
      "RATE_LIMITED",
      429,
      "Please wait a moment before asking again.",
    );
  throw new AppError(
    "DATABASE_UNAVAILABLE",
    503,
    "Conversation storage is temporarily unavailable.",
  );
}
export function checkDatabase(error: unknown) {
  if (error) databaseError(error);
}
export function publicError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const e = error as {
    code?: string;
    status?: number;
    name?: string;
    message?: string;
  };
  if (e?.code === "invalid_api_key" || e?.code === "invalid_api_key_error")
    return new AppError(
      "AI_AUTH_FAILED",
      503,
      "The AI service is not available. Its credential needs attention.",
    );
  if (e?.code === "insufficient_quota")
    return new AppError(
      "AI_CREDITS_REQUIRED",
      503,
      "The AI provider has no available credits.",
    );
  if (e?.status === 429)
    return new AppError(
      "AI_BUSY",
      429,
      "The AI service is busy. Please retry shortly.",
    );
  if (e?.name === "APIConnectionTimeoutError" || e?.name === "TimeoutError")
    return new AppError(
      "AI_TIMEOUT",
      504,
      "The AI service took too long to respond.",
    );
  if (e?.name === "ZodError")
    return new AppError(
      "INVALID_REQUEST",
      400,
      "Please check your message or recording.",
    );
  if (e?.message === "Unauthorized")
    return new AppError("UNAUTHORIZED", 401, "Please sign in again.");
  if (e?.message === "Forbidden")
    return new AppError("FORBIDDEN", 403, "This session is not available.");
  if (/Monthly or request rate limit/.test(e?.message || ""))
    return new AppError(
      "RATE_LIMITED",
      429,
      "Please wait before trying again.",
    );
  if (e?.message?.startsWith("Configure"))
    return new AppError(
      "SERVICE_NOT_CONFIGURED",
      503,
      "This service needs to be configured.",
    );
  return new AppError(
    "REQUEST_FAILED",
    e?.status && e.status >= 500 ? 502 : 400,
    "We could not complete this request. Please retry.",
  );
}
export function errorMessage(
  code: string | undefined,
  fallback: string,
  locale: string,
) {
  const pt: Record<string, string> = {
    DATABASE_NOT_READY:
      "O armazenamento de conversas ainda não foi ativado. Conclua a configuração inicial para usar o mentor e guardar o histórico.",
    DATABASE_PERMISSION_DENIED:
      "O armazenamento não tem as permissões necessárias. Peça ao administrador para concluir a configuração.",
    DATABASE_UNAVAILABLE:
      "Não foi possível acessar seu histórico. Tente novamente em instantes.",
    AI_AUTH_FAILED:
      "O serviço de IA recusou a credencial configurada. O administrador precisa revisá-la.",
    AI_CREDITS_REQUIRED:
      "A conta do provedor de IA está sem créditos. Adicione saldo para conversar com o mentor.",
    AI_BUSY: "O serviço de IA está ocupado. Tente novamente em instantes.",
    AI_TIMEOUT:
      "A IA demorou para responder. Sua pergunta continua no histórico; tente novamente.",
    QUOTA_EXCEEDED: "Você atingiu a franquia mensal do seu plano.",
    RATE_LIMITED: "Aguarde alguns instantes antes da próxima pergunta.",
    UNAUTHORIZED: "Entre novamente na sua conta.",
    SESSION_EXPIRED:
      "Esta sessão chegou ao tempo máximo. Inicie outra conversa.",
    INVALID_REQUEST: "Verifique sua mensagem ou gravação.",
    SERVICE_NOT_CONFIGURED: "O serviço ainda precisa ser configurado.",
    FORBIDDEN: "Esta sessão não está disponível.",
    TRANSCRIPTION_EMPTY:
      "Não consegui ouvir uma pergunta. Tente falar mais perto do microfone.",
  };
  return locale.startsWith("pt") && code && pt[code] ? pt[code] : fallback;
}
