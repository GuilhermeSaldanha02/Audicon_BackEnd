import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

/** Relança `err` como ConflictException se for violação de unicidade (PG 23505). */
export function throwOnUniqueViolation(err: unknown, message: string): never {
  if (
    err instanceof QueryFailedError &&
    (err as any)?.driverError?.code === '23505'
  ) {
    throw new ConflictException(message);
  }
  throw err as Error;
}
