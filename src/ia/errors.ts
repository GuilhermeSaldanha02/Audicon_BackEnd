import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';

export function geminiUpstreamError(reason: string): BadGatewayException {
  return new BadGatewayException({
    message: 'AI provider (Gemini) failed to analyze the infraction.',
    reason,
  });
}

export function geminiTimeoutError(timeoutMs: number): BadGatewayException {
  return new BadGatewayException({
    message: 'AI provider (Gemini) timed out.',
    timeoutMs,
  });
}

export function geminiConfigError(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    message: 'AI provider (Gemini) is not configured.',
  });
}
