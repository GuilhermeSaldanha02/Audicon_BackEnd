import {
  Controller,
  Post,
  UseGuards,
  Request,
  Res,
  Get,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiCookieAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  AUTH_COOKIE_NAME,
  buildAuthCookieOptions,
  buildAuthCookieClearOptions,
} from '../common/config/auth-cookie';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({ summary: 'Login com e-mail e senha' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'maria@email.com' },
        password: { type: 'string', example: 'S3nh@Segura' },
      },
      required: ['email', 'password'],
    },
  })
  @ApiResponse({
    status: 200,
    description:
      'Login bem-sucedido. Seta o cookie httpOnly access_token; corpo apenas { success: true }.',
  })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true }> {
    // R-08: o token vai no cookie httpOnly, não no corpo. O front hidrata os
    // claims sempre via GET /auth/profile (fonte única) — login e reload.
    const { access_token } = await this.authService.login(req.user);
    res.cookie(
      AUTH_COOKIE_NAME,
      access_token,
      buildAuthCookieOptions(this.configService),
    );
    return { success: true };
  }

  @ApiOperation({ summary: 'Logout — limpa o cookie de autenticação' })
  @ApiCookieAuth()
  @ApiResponse({ status: 200, description: 'Cookie de autenticação removido' })
  @ApiResponse({ status: 401, description: 'Token inválido ou ausente' })
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response): { success: true } {
    // Mesmas flags do set, sem maxAge — para o browser casar os atributos e
    // o clearCookie emitir um delete real (Expires no passado).
    res.clearCookie(
      AUTH_COOKIE_NAME,
      buildAuthCookieClearOptions(this.configService),
    );
    return { success: true };
  }

  @ApiOperation({ summary: 'Retorna os dados do usuário autenticado' })
  @ApiCookieAuth()
  @ApiResponse({ status: 200, description: 'Dados do usuário autenticado' })
  @ApiResponse({ status: 401, description: 'Token inválido ou ausente' })
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: any) {
    return this.usersService.getProfile(req.user.id);
  }

  @ApiOperation({
    summary: 'Trocar senha (obrigatório após primeiro login ou reset)',
  })
  @ApiCookieAuth()
  @ApiResponse({ status: 200, description: 'Senha alterada com sucesso' })
  @ApiResponse({ status: 400, description: 'Senha inválida' })
  @ApiResponse({ status: 401, description: 'Token inválido ou ausente' })
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    await this.usersService.changePassword(req.user.id, dto.newPassword);
    return { message: 'Senha alterada com sucesso.' };
  }
}
