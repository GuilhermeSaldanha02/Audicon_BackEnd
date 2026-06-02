import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { AUTH_COOKIE_NAME } from '../common/config/auth-cookie';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { login: jest.Mock };
  let usersService: { getProfile: jest.Mock; changePassword: jest.Mock };
  const configValues: Record<string, unknown> = {
    COOKIE_SAMESITE: 'lax',
    COOKIE_SECURE: 'false',
    JWT_EXPIRATION: '1h',
  };
  beforeEach(async () => {
    authService = { login: jest.fn() };
    usersService = { getProfile: jest.fn(), changePassword: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: usersService },
        {
          provide: ConfigService,
          useValue: { get: (k: string) => configValues[k] },
        },
      ],
    }).compile();
    controller = module.get<AuthController>(AuthController);
  });
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('login seta o cookie httpOnly e retorna apenas { success: true } (sem token no corpo)', async () => {
    const req: any = { user: { id: 1, email: 'a@x.com' } };
    authService.login.mockResolvedValue({ access_token: 'tok' });
    const res: any = { cookie: jest.fn() };
    const result = await controller.login(req, res);
    expect(authService.login).toHaveBeenCalledWith(req.user);
    expect(res.cookie).toHaveBeenCalledWith(
      AUTH_COOKIE_NAME,
      'tok',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
    expect(result).toEqual({ success: true });
    expect(result).not.toHaveProperty('access_token');
  });

  it('logout limpa o cookie e retorna { success: true }', () => {
    const res: any = { clearCookie: jest.fn() };
    const result = controller.logout(res);
    expect(res.clearCookie).toHaveBeenCalledWith(
      AUTH_COOKIE_NAME,
      expect.objectContaining({ httpOnly: true }),
    );
    expect(result).toEqual({ success: true });
  });

  it('getProfile delega ao usersService com o id do usuário', () => {
    const req: any = { user: { id: 9 } };
    usersService.getProfile.mockReturnValue({ id: 9 });
    const result = controller.getProfile(req);
    expect(usersService.getProfile).toHaveBeenCalledWith(9);
    expect(result).toEqual({ id: 9 });
  });

  it('changePassword delega ao usersService e retorna mensagem', async () => {
    const req: any = { user: { id: 5 } };
    usersService.changePassword.mockResolvedValue(undefined);
    const result = await controller.changePassword(req, {
      newPassword: 'NovaSenha@2026',
    });
    expect(usersService.changePassword).toHaveBeenCalledWith(
      5,
      'NovaSenha@2026',
    );
    expect(result).toEqual({ message: 'Senha alterada com sucesso.' });
  });
});
