import type { LoggerService } from '@nestjs/common';

const SILENCED_BOOTSTRAP_CONTEXTS = new Set<string>([
  'InstanceLoader',
  'RouterExplorer',
  'RoutesResolver',
]);

function getContext(optionalParams: unknown[]): string {
  const c = optionalParams[0];
  return typeof c === 'string' ? c : '';
}

function formatMessage(prefix: string, context: string, message: unknown): string {
  const ctx = context ? `[${context}] ` : '';
  const msg =
    typeof message === 'object' && message !== null && 'toString' in message
      ? (message as { toString(): string }).toString()
      : String(message);
  return `${prefix} ${ctx}${msg}`;
}

/**
 * NestJS logger that suppresses verbose bootstrap logs (InstanceLoader, RouterExplorer, RoutesResolver).
 * Use in NestFactory.create(AppModule, { logger: new FilteredBootstrapLogger() }).
 */
export class FilteredBootstrapLogger implements LoggerService {
  log(message: unknown, ...optionalParams: unknown[]): void {
    const context = getContext(optionalParams);
    if (SILENCED_BOOTSTRAP_CONTEXTS.has(context)) return;
    console.log(formatMessage('LOG', context, message));
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    console.error(formatMessage('ERROR', getContext(optionalParams), message));
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    console.warn(formatMessage('WARN', getContext(optionalParams), message));
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    console.debug(formatMessage('DEBUG', getContext(optionalParams), message));
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    console.info(formatMessage('VERBOSE', getContext(optionalParams), message));
  }
}
