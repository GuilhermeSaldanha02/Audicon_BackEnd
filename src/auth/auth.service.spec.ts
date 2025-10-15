import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
jest.mock('bcrypt', () => ({
  __esModule: true,
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { findOneByEmail: jest.Mock };
  let jwtService: { sign: jest.Mock };

  beforeEach(async () => {
    usersService = {
      findOneByEmail: jest.fn(),
    } as any;
    jwtService = {
      sign: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('deve retornar null quando usuário não encontrado', async () => {
      usersService.findOneByEmail.mockResolvedValue(null);

      const result = await service.validateUser('missing@example.com', 'senha');
      expect(result).toBeNull();
      expect(usersService.findOneByEmail).toHaveBeenCalledWith(
        'missing@example.com',
      );
    });

    it('deve retornar null quando a senha estiver incorreta', async () => {
      const user: any = { id: 1, email: 'john@example.com', senha: 'hashed' };
      usersService.findOneByEmail.mockResolvedValue(user);
      (bcrypt.compare as unknown as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('john@example.com', 'wrong');
      expect(result).toBeNull();
      expect(bcrypt.compare).toHaveBeenCalledWith('wrong', user.senha);
    });

    it('deve retornar o usuário sem campo senha quando a validação for bem-sucedida', async () => {
      const user: any = {
        id: 1,
        email: 'john@example.com',
        senha: 'hashed',
        nome: 'John',
      };
      usersService.findOneByEmail.mockResolvedValue(user);
      (bcrypt.compare as unknown as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('john@example.com', 'correct');
      expect(result).toEqual({
        id: 1,
        email: 'john@example.com',
        nome: 'John',
      });
      expect((result as any).senha).toBeUndefined();
      expect(bcrypt.compare).toHaveBeenCalledWith('correct', user.senha);
    });
  });

  describe('login', () => {
    it('deve retornar access_token e chamar sign com payload correto', async () => {
      const user = { id: 42, email: 'john@example.com' } as any;
      jwtService.sign.mockReturnValue('jwt-token');

      const result = await service.login(user);
      expect(result).toEqual({ access_token: 'jwt-token' });
      expect(jwtService.sign).toHaveBeenCalledWith({
        email: 'john@example.com',
        sub: 42,
      });
    });
  });
});
