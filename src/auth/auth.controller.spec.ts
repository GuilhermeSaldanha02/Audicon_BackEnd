import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
describe('AuthController', () => {
  let controller: AuthController;
  let authService: { login: jest.Mock };
  let usersService: { getProfile: jest.Mock; changePassword: jest.Mock };
  beforeEach(async () => {
    authService = { login: jest.fn() };
    usersService = { getProfile: jest.fn(), changePassword: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();
    controller = module.get<AuthController>(AuthController);
  });
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('login delega ao authService com o usuário do request', async () => {
    const req: any = { user: { id: 1, email: 'a@x.com' } };
    authService.login.mockResolvedValue({ access_token: 'tok' });
    const result = await controller.login(req);
    expect(authService.login).toHaveBeenCalledWith(req.user);
    expect(result).toEqual({ access_token: 'tok' });
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
