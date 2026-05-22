import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentActor } from './current-actor.decorator';
import { Actor } from '../../audit/audit.service';

function getParamDecoratorFactory(
  decorator: (...args: unknown[]) => ParameterDecorator,
) {
  class TestController {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    handler(@decorator() _actor: Actor) {}
  }
  const args = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    TestController,
    'handler',
  );
  return args[Object.keys(args)[0]].factory;
}

describe('CurrentActor decorator', () => {
  const factory = getParamDecoratorFactory(CurrentActor);
  const user = { id: 7, email: 'a@b.com', companyId: 3, isMaster: false };
  const mockContext = {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;

  it('retorna Actor com os campos corretos', () => {
    const actor: Actor = factory(null, mockContext);
    expect(actor).toEqual({
      userId: 7,
      email: 'a@b.com',
      isMaster: false,
      companyId: 3,
    });
  });

  it('trata isMaster ausente como false', () => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 1, email: 'x@y.com', companyId: null },
        }),
      }),
    } as unknown as ExecutionContext;
    const actor: Actor = factory(null, ctx);
    expect(actor.isMaster).toBe(false);
    expect(actor.companyId).toBeNull();
  });

  it('trata companyId undefined como null', () => {
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 2, email: 'z@z.com', isMaster: true },
        }),
      }),
    } as unknown as ExecutionContext;
    const actor: Actor = factory(null, ctx);
    expect(actor.companyId).toBeNull();
  });
});
