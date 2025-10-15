import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    findOneBy: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('deve criar e salvar o usuário com sucesso', async () => {
      const dto: any = {
        nome: 'John',
        email: 'john@example.com',
        senha: '123456',
      };
      const created = { id: 1, ...dto } as any;
      const saved = { id: 1, ...dto } as any;
      repository.create.mockReturnValue(created);
      repository.save.mockResolvedValue(saved);

      const result = await service.create(dto);
      expect(result).toEqual(saved);
      expect(repository.create).toHaveBeenCalledWith(dto);
      expect(repository.save).toHaveBeenCalledWith(created);
    });
  });

  describe('findOneByEmail', () => {
    it('deve retornar usuário quando encontrado', async () => {
      const user = { id: 1, email: 'john@example.com' } as any;
      repository.findOne.mockResolvedValue(user);

      const result = await service.findOneByEmail('john@example.com');
      expect(result).toEqual(user);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { email: 'john@example.com' },
      });
    });

    it('deve retornar null quando não encontrado', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findOneByEmail('missing@example.com');
      expect(result).toBeNull();
    });
  });

  describe('findOneById', () => {
    it('deve retornar usuário quando encontrado', async () => {
      const user = { id: 1 } as any;
      repository.findOneBy.mockResolvedValue(user);

      const result = await service.findOneById(1);
      expect(result).toEqual(user);
      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 1 });
    });

    it('deve retornar undefined quando não encontrado', async () => {
      repository.findOneBy.mockResolvedValue(undefined);

      const result = await service.findOneById(999);
      expect(result).toBeUndefined();
    });
  });
});
