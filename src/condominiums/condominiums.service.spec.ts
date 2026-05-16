import { Test, TestingModule } from '@nestjs/testing';
import { CondominiumsService } from './condominiums.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Condominium } from './entities/condominium.entity';
import { UserCondominium } from '../users/entities/user-condominium.entity';
import { UsersService } from '../users/users.service';
import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { UserRole } from '../common/enums/user-role.enum';

const makeQb = (result: any) => ({
  innerJoin: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue(result),
});

describe('CondominiumsService', () => {
  let service: CondominiumsService;
  let condoRepo: {
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
    findOneBy: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let ucRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };
  let usersService: { findOneByEmail: jest.Mock };

  beforeEach(async () => {
    condoRepo = {
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
      findOneBy: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    ucRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };
    usersService = { findOneByEmail: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CondominiumsService,
        { provide: getRepositoryToken(Condominium), useValue: condoRepo },
        { provide: getRepositoryToken(UserCondominium), useValue: ucRepo },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get<CondominiumsService>(CondominiumsService);
  });

  beforeEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('deve criar condomínio e atribuir ADMIN ao criador', async () => {
      const dto: any = { name: 'Condo A', cnpj: '00.000.000/0000-00' };
      const saved = { id: 1, ...dto };
      condoRepo.create.mockReturnValue(dto);
      condoRepo.save.mockResolvedValue(saved);
      ucRepo.create.mockReturnValue({
        userId: 7,
        condominiumId: 1,
        role: UserRole.ADMIN,
      });
      ucRepo.save.mockResolvedValue({});

      const result = await service.create(dto, 7);
      expect(result).toEqual(saved);
      expect(ucRepo.create).toHaveBeenCalledWith({
        userId: 7,
        condominiumId: 1,
        role: UserRole.ADMIN,
      });
      expect(ucRepo.save).toHaveBeenCalledTimes(1);
    });

    it('deve lançar ConflictException quando código 23505 (duplicado)', async () => {
      const dto: any = { name: 'Condo A', cnpj: '00.000.000/0000-00' };
      condoRepo.create.mockReturnValue(dto);
      const driverError = Object.assign(new Error('duplicate key'), {
        code: '23505',
      });
      condoRepo.save.mockRejectedValue(
        new QueryFailedError('INSERT', [], driverError),
      );
      await expect(service.create(dto, 1)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('deve lançar InternalServerErrorException para erros genéricos', async () => {
      const dto: any = { name: 'Condo B', cnpj: '11.111.111/1111-11' };
      condoRepo.create.mockReturnValue(dto);
      condoRepo.save.mockRejectedValue(new Error('unexpected'));
      await expect(service.create(dto, 1)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('findAll', () => {
    it('deve retornar lista de condomínios do usuário (happy path)', async () => {
      const list = [{ id: 1 }, { id: 2 }];
      condoRepo.createQueryBuilder.mockReturnValue(makeQb(list));
      const result = await service.findAll(42);
      expect(result).toEqual(list);
    });

    it('deve retornar lista vazia quando usuário não é membro de nenhum', async () => {
      condoRepo.createQueryBuilder.mockReturnValue(makeQb([]));
      const result = await service.findAll(42);
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('deve retornar um condomínio quando existir', async () => {
      const entity = { id: 1 };
      condoRepo.findOneBy.mockResolvedValue(entity);
      const result = await service.findOne(1);
      expect(result).toEqual(entity);
    });

    it('deve lançar NotFoundException quando não existir', async () => {
      condoRepo.findOneBy.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('deve atualizar e retornar o condomínio atualizado', async () => {
      const id = 1;
      const dto: any = { name: 'Atualizado' };
      const existing = { id, name: 'Antigo' };
      const updated = { id, name: 'Atualizado' };
      condoRepo.findOneBy
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);
      condoRepo.update.mockResolvedValue(undefined);
      const result = await service.update(id, dto);
      expect(result).toEqual(updated);
      expect(condoRepo.update).toHaveBeenCalledWith(id, dto);
    });

    it('deve lançar NotFoundException quando não existir', async () => {
      condoRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.update(999, { name: 'X' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(condoRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deve remover com sucesso', async () => {
      condoRepo.findOneBy.mockResolvedValue({ id: 1 });
      condoRepo.delete.mockResolvedValue(undefined);
      await expect(service.remove(1)).resolves.toBeUndefined();
      expect(condoRepo.delete).toHaveBeenCalledWith(1);
    });

    it('deve lançar NotFoundException quando não existir', async () => {
      condoRepo.findOneBy.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(condoRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('addMember', () => {
    it('deve criar membership quando não existe', async () => {
      condoRepo.findOneBy.mockResolvedValue({ id: 3 });
      usersService.findOneByEmail.mockResolvedValue({
        id: 5,
        email: 'novo@condo.com',
      });
      ucRepo.findOne.mockResolvedValue(null);
      const membership = {
        id: 1,
        userId: 5,
        condominiumId: 3,
        role: UserRole.MANAGER,
      };
      ucRepo.create.mockReturnValue(membership);
      ucRepo.save.mockResolvedValue(membership);

      const result = await service.addMember(3, {
        email: 'novo@condo.com',
        role: UserRole.MANAGER,
      });
      expect(result).toEqual(membership);
      expect(ucRepo.create).toHaveBeenCalledWith({
        userId: 5,
        condominiumId: 3,
        role: UserRole.MANAGER,
      });
    });

    it('deve atualizar role quando membership já existe', async () => {
      condoRepo.findOneBy.mockResolvedValue({ id: 3 });
      usersService.findOneByEmail.mockResolvedValue({
        id: 5,
        email: 'user@condo.com',
      });
      const existing = {
        id: 1,
        userId: 5,
        condominiumId: 3,
        role: UserRole.RESIDENT,
      };
      ucRepo.findOne.mockResolvedValue(existing);
      ucRepo.save.mockResolvedValue({ ...existing, role: UserRole.ADMIN });

      const result = await service.addMember(3, {
        email: 'user@condo.com',
        role: UserRole.ADMIN,
      });
      expect(result.role).toBe(UserRole.ADMIN);
    });

    it('deve lançar NotFoundException quando usuário não existe', async () => {
      condoRepo.findOneBy.mockResolvedValue({ id: 3 });
      usersService.findOneByEmail.mockResolvedValue(null);
      await expect(
        service.addMember(3, {
          email: 'nao@existe.com',
          role: UserRole.RESIDENT,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deve lançar NotFoundException quando condomínio não existe', async () => {
      condoRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.addMember(999, {
          email: 'user@condo.com',
          role: UserRole.RESIDENT,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
