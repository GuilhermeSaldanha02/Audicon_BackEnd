import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MasterGuard } from '../common/guards/master.guard';
describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            create: jest.fn(),
          },
        },
      ],
    }).compile();
    controller = module.get<UsersController>(UsersController);
    service = module.get(UsersService) as jest.Mocked<UsersService>;
  });
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
  it('create deve remover o campo senha do retorno', async () => {
    const dto: any = {
      nome: 'John',
      email: 'john@example.com',
      senha: 'plaintext',
    };
    const created = {
      id: 1,
      nome: 'John',
      email: 'john@example.com',
      senha: 'hashed',
    } as any;
    service.create.mockResolvedValue(created);
    const result = await controller.create(dto);
    expect(result).toEqual({ id: 1, nome: 'John', email: 'john@example.com' });
    expect((result as any).senha).toBeUndefined();
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  // Complemento ao e2e (test/users.e2e-spec.ts): garante que os guards
  // estão DECLARADOS na rota. O e2e prova o bloqueio de comportamento;
  // este teste evita regressão de alguém remover o @UseGuards.
  it('POST /users declara JwtAuthGuard + MasterGuard', () => {
    const guards =
      Reflect.getMetadata('__guards__', UsersController.prototype.create) ?? [];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(MasterGuard);
  });
});
