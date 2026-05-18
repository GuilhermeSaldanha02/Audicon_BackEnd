import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class MasterGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || !user.isMaster) {
      throw new ForbiddenException(
        'Esta operação requer privilégio de usuário master.',
      );
    }
    return true;
  }
}
