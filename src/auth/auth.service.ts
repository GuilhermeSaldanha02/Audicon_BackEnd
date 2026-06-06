import { Injectable } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}
  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      return null;
    }
    // R-16: revogação explícita de acesso de usuário desativado (soft-delete).
    // Não dependemos só do auto-filtro de soft-delete do QueryBuilder (que é
    // versão-dependente): mesmo que um upgrade do TypeORM passe a retornar a
    // linha desativada, o login continua negado aqui. Ver jwt.strategy (leg do
    // request autenticado) e SDD §2.4.
    if (user.deletedAt) {
      return null;
    }
    if (await bcrypt.compare(pass, user.senha)) {
      const result: any = { ...(user as any) };
      delete result.senha;
      return result;
    }
    return null;
  }
  async login(user: any) {
    const payload = {
      email: user.email,
      sub: user.id,
      companyId: user.companyId ?? null,
      isMaster: !!user.isMaster,
      mustChangePassword: !!user.mustChangePassword,
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
