import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { SystemRole } from '../common/enums/system-role.enum';
describe('UsersService', () => {
  let service: UsersService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    findOneBy: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      createQueryBuilder: jest.fn(),
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
    it('seleciona a senha via addSelect e retorna o usuário', async () => {
      const user = { id: 1, email: 'john@example.com', senha: 'hash' } as any;
      const qb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(user),
      };
      repository.createQueryBuilder.mockReturnValue(qb);
      const result = await service.findOneByEmail('john@example.com');
      expect(result).toEqual(user);
      expect(repository.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(qb.addSelect).toHaveBeenCalledWith('user.senha');
      expect(qb.where).toHaveBeenCalledWith('user.email = :email', {
        email: 'john@example.com',
      });
    });
    it('deve retornar null quando não encontrado', async () => {
      const qb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      repository.createQueryBuilder.mockReturnValue(qb);
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

  describe('changePassword', () => {
    it('deve trocar a senha e limpar mustChangePassword', async () => {
      const user: any = { id: 1, senha: 'old', mustChangePassword: true };
      repository.findOneBy.mockResolvedValue(user);
      repository.save.mockResolvedValue(user);
      await service.changePassword(1, 'NovaSenha@2026');
      expect(user.mustChangePassword).toBe(false);
      expect(user.senha).not.toBe('old');
      expect(repository.save).toHaveBeenCalledWith(user);
    });

    it('deve lançar NotFound quando usuário não existe', async () => {
      repository.findOneBy.mockResolvedValue(null);
      await expect(
        service.changePassword(99, 'NovaSenha@2026'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deve lançar BadRequest quando a senha tem menos de 8 caracteres', async () => {
      repository.findOneBy.mockResolvedValue({ id: 1 });
      await expect(service.changePassword(1, 'curta')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('deve retornar dados do perfil com companyId, mustChangePassword e nome da empresa', async () => {
      repository.findOne.mockResolvedValue({
        nome: 'Admin',
        email: 'admin@x.com',
        isMaster: false,
        companyId: 7,
        mustChangePassword: true,
        company: { name: 'Empresa X' },
        role: SystemRole.GERENTE,
      });
      const result = await service.getProfile(1);
      expect(result).toEqual({
        nome: 'Admin',
        email: 'admin@x.com',
        isMaster: false,
        companyId: 7,
        mustChangePassword: true,
        companyName: 'Empresa X',
        role: SystemRole.GERENTE,
      });
    });

    it('deve retornar perfil vazio quando usuário não existe', async () => {
      repository.findOne.mockResolvedValue(null);
      const result = await service.getProfile(99);
      expect(result).toEqual({
        nome: '',
        email: '',
        isMaster: false,
        companyId: null,
        mustChangePassword: false,
        companyName: null,
        role: SystemRole.FUNCIONARIO,
      });
    });
  });
});
