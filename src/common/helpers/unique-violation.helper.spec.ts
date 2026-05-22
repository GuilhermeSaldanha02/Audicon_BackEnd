import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { throwOnUniqueViolation } from './unique-violation.helper';

function makeUniqueError(): QueryFailedError {
  const err = new QueryFailedError('INSERT', [], new Error('unique'));
  (err as any).driverError = { code: '23505' };
  return err;
}

describe('throwOnUniqueViolation', () => {
  it('lança ConflictException quando code === 23505', () => {
    const err = makeUniqueError();
    expect(() => throwOnUniqueViolation(err, 'Duplicado.')).toThrow(
      new ConflictException('Duplicado.'),
    );
  });

  it('re-lança o erro original quando não é 23505', () => {
    const err = new QueryFailedError('INSERT', [], new Error('outro'));
    (err as any).driverError = { code: '23000' };
    expect(() => throwOnUniqueViolation(err, 'Duplicado.')).toThrow(err);
  });

  it('re-lança erros que não são QueryFailedError', () => {
    const err = new Error('genérico');
    expect(() => throwOnUniqueViolation(err, 'Duplicado.')).toThrow(err);
  });
});
