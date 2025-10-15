import { Test, TestingModule } from '@nestjs/testing';
import { CondominiumsService } from './condominiums.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Condominium } from './entities/condominium.entity';
import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

describe('CondominiumsService', () => {
  let service: CondominiumsService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOneBy: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CondominiumsService,
        {
          provide: getRepositoryToken(Condominium),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<CondominiumsService>(CondominiumsService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('deve criar com sucesso (happy path)', async () => {
      const dto: any = { name: 'Condo A', cnpj: '00.000.000/0000-00' };
      const created = { id: 1, ...dto };
      const saved = { id: 1, ...dto };
      repository.create.mockReturnValue(created);
      repository.save.mockResolvedValue(saved);

      const result = await service.create(dto);
      expect(result).toEqual(saved);
      expect(repository.create).toHaveBeenCalledWith(dto);
      expect(repository.save).toHaveBeenCalledWith(created);
    });

    it('deve lançar ConflictException quando código 23505 (duplicado)', async () => {
      const dto: any = { name: 'Condo A', cnpj: '00.000.000/0000-00' };
      const created = { id: 1, ...dto };
      repository.create.mockReturnValue(created);
      const driverError = Object.assign(new Error('duplicate key'), {
        code: '23505',
      });
      const queryError = new QueryFailedError('INSERT', [], driverError);
      repository.save.mockRejectedValue(queryError);

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repository.create).toHaveBeenCalledWith(dto);
      expect(repository.save).toHaveBeenCalledWith(created);
    });

    it('deve lançar InternalServerErrorException para erros genéricos', async () => {
      const dto: any = { name: 'Condo B', cnpj: '11.111.111/1111-11' };
      const created = { id: 2, ...dto };
      repository.create.mockReturnValue(created);
      repository.save.mockRejectedValue(new Error('unexpected'));

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('findAll', () => {
    it('deve retornar uma lista de condomínios (happy path)', async () => {
      const list = [{ id: 1 }, { id: 2 }];
      repository.find.mockResolvedValue(list);

      const result = await service.findAll();
      expect(result).toEqual(list);
      expect(repository.find).toHaveBeenCalledTimes(1);
    });

    it('deve retornar lista vazia quando não há registros', async () => {
      repository.find.mockResolvedValue([]);

      const result = await service.findAll();
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('deve retornar um condomínio quando existir', async () => {
      const entity = { id: 1 };
      repository.findOneBy.mockResolvedValue(entity);

      const result = await service.findOne(1);
      expect(result).toEqual(entity);
      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 1 });
    });

    it('deve lançar NotFoundException quando não existir', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('deve atualizar e retornar o condomínio atualizado; chama findOne duas vezes', async () => {
      const id = 1;
      const dto: any = { name: 'Atualizado' };
      const existing = { id, name: 'Antigo' };
      const updated = { id, name: 'Atualizado' };
      // findOne é chamado duas vezes: antes e depois do update
      repository.findOneBy
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);
      repository.update.mockResolvedValue(undefined);

      const result = await service.update(id, dto);
      expect(result).toEqual(updated);
      expect(repository.update).toHaveBeenCalledWith(id, dto);
      expect(repository.findOneBy).toHaveBeenCalledTimes(2);
    });

    it('deve lançar NotFoundException quando o condomínio não existir', async () => {
      const id = 999;
      repository.findOneBy.mockResolvedValue(null);

      await expect(
        service.update(id, { name: 'X' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deve remover com sucesso (retorna undefined)', async () => {
      const id = 1;
      repository.findOneBy.mockResolvedValue({ id });
      repository.delete.mockResolvedValue(undefined);

      await expect(service.remove(id)).resolves.toBeUndefined();
      expect(repository.findOneBy).toHaveBeenCalledWith({ id });
      expect(repository.delete).toHaveBeenCalledWith(id);
    });

    it('deve lançar NotFoundException quando o condomínio não existir', async () => {
      const id = 999;
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.remove(id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });
});
