import { getMetadataArgsStorage } from 'typeorm';
import { User } from './user.entity';

/**
 * R-07 — Senha estrutural.
 *
 * Guarda a regressão que o R-07 existe para impedir: alguém remover o
 * `select: false` da coluna `senha` por engano, voltando a depender de
 * `delete result.senha` manuais espalhados. Não re-testa o engine do
 * TypeORM (garantia upstream) — apenas que NOSSA anotação permanece.
 */
describe('User entity — proteção estrutural da senha (R-07)', () => {
  it('declara a coluna senha com select: false', () => {
    const col = getMetadataArgsStorage().columns.find(
      (c) => c.target === User && c.propertyName === 'senha',
    );
    expect(col).toBeDefined();
    expect(col?.options.select).toBe(false);
  });
});
