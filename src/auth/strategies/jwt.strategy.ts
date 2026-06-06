import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { UsersService } from 'src/users/users.service';
import { AUTH_COOKIE_NAME } from '../../common/config/auth-cookie';

/**
 * R-08: o JWT agora vem do cookie httpOnly `access_token` (não mais do header
 * Authorization: Bearer). Requer cookie-parser ativo (setupApp) para popular
 * req.cookies.
 */
function cookieExtractor(req: Request): string | null {
  const cookies = (req as Request & { cookies?: Record<string, string> })
    ?.cookies;
  return cookies?.[AUTH_COOKIE_NAME] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }
  async validate(payload: { sub: number; email: string }) {
    const user = await this.usersService.findOneById(payload.sub);
    // R-16: revogação real a cada request. `findOneById` (findOneBy) já auto-
    // filtra usuários soft-deleted (desativado → undefined → 401). O
    // `|| user.deletedAt` é defesa em profundidade gratuita, robusta a uma
    // eventual mudança do auto-filtro do TypeORM. Login tem a checagem
    // espelhada (auth.service.validateUser). Ver SDD §2.4.
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Token inválido.');
    }
    // findOneById não faz addSelect da senha (select:false na entity), então
    // req.user já vem sem o hash — sem necessidade de delete manual (R-07).
    return user;
  }
}
