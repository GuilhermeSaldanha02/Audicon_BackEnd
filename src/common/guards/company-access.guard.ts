import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

/**
 * Guard de tenant para rotas que operam sobre uma empresa específica via
 * `:companyId` no path (padrão canônico §2.3, espelhando CondominiumAccessGuard).
 *
 * Como o `:companyId` do path JÁ é o id da empresa, não há lookup no banco:
 * compara `params.companyId` com `req.user.companyId`. Master bypassa.
 *
 * IMPORTANTE (defesa em profundidade): este guard NÃO barra um FUNCIONARIO que
 * chama a PRÓPRIA empresa (o companyId casa). Quem restringe o papel é o
 * RolesGuard — por isso ambos são aplicados juntos nas rotas abertas a GERENTE
 * (RolesGuard ANTES, na ordem do array @UseGuards). Ver comentário no
 * companies.controller.
 */
@Injectable()
export class CompanyAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Não autenticado.');
    }

    const raw = req.params?.companyId;
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      throw new NotFoundException(`Company with ID #${raw} not found.`);
    }

    if (user.isMaster) {
      return true;
    }

    if (id !== user.companyId) {
      throw new ForbiddenException('Esta empresa pertence a outro tenant.');
    }
    return true;
  }
}
