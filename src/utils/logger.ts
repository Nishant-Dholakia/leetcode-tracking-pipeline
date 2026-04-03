type LogLevel = "INFO" | "WARN" | "ERROR";

export function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ? { context } : {})
  };

  const line = JSON.stringify(payload);
  if (level === "ERROR") {
    console.error(line);
    return;
  }

  console.log(line);
}
