import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Actor } from '../../audit/audit.service';

export const CurrentActorDecorator = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Actor => {
    const req = ctx.switchToHttp().getRequest();
    return {
      userId: req.user.id,
      email: req.user.email,
      isMaster: !!req.user.isMaster,
      companyId: req.user.companyId ?? null,
    };
  },
);
