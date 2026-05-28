import { Test, TestingModule } from '@nestjs/testing';
import { CondominiumsService } from './condominiums.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Condominium } from './entities/condominium.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { AuditService } from '../audit/audit.service';

const makeQb = (data: any[], total = data.length) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([data, total]),
});

describe('CondominiumsService', () => {
  let service: CondominiumsService;
  let condoRepo: {
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
    findOneBy: jest.Mock;
    find: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    softDelete: jest.Mock;
  };

  beforeEach(async () => {
    condoRepo = {
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
      findOneBy: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CondominiumsService,
        { provide: getRepositoryToken(Condominium), useValue: condoRepo },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
            logAsync: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    service = module.get<CondominiumsService>(CondominiumsService);
  });

  beforeEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('cria condomínio vinculado à empresa', async () => {
      const dto: any = {
        name: 'Condo A',
        cnpj: '00.000.000/0000-00',
        companyId: 1,
      };
      const saved = { id: 1, ...dto };
      condoRepo.create.mockReturnValue(dto);
      condoRepo.save.mockResolvedValue(saved);

      const result = await service.create(dto);
      expect(result).toEqual(saved);
      expect(condoRepo.create).toHaveBeenCalledWith(dto);
    });

    it('traduz 23505 em ConflictException', async () => {
      const dto: any = {
        name: 'Condo A',
        cnpj: '00.000.000/0000-00',
        companyId: 1,
      };
      condoRepo.create.mockReturnValue(dto);
      const driverError = Object.assign(new Error('duplicate key'), {
        code: '23505',
      });
      condoRepo.save.mockRejectedValue(
        new QueryFailedError('INSERT', [], driverError),
      );
      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('relança erros genéricos sem transformação', async () => {
      const dto: any = {
        name: 'Condo B',
        cnpj: '11.111.111/1111-11',
        companyId: 1,
      };
      condoRepo.create.mockReturnValue(dto);
      const genericError = new Error('unexpected');
      condoRepo.save.mockRejectedValue(genericError);
      await expect(service.create(dto)).rejects.toThrow(genericError);
    });
  });

  describe('findAll', () => {
    const pagination = { page: 1, limit: 20 };

    it('lista todos os condomínios da empresa do ator', async () => {
      const list = [{ id: 1 }, { id: 2 }];
      const qb = makeQb(list);
      condoRepo.createQueryBuilder.mockReturnValue(qb);
      const result = await service.findAll(pagination, 7);
      expect(result).toEqual({ data: list, total: 2, page: 1, limit: 20 });
      expect(qb.where).toHaveBeenCalledWith('c.companyId = :companyId', {
        companyId: 7,
      });
    });

    it('sem companyId (master) não aplica filtro de empresa', async () => {
      const list = [{ id: 1 }];
      const qb = makeQb(list, 1);
      condoRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll(pagination, null);
      expect(qb.where).not.toHaveBeenCalled();
    });

    it('aplica skip e take corretos para page 3', async () => {
      const qb = makeQb([]);
      condoRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll({ page: 3, limit: 10 }, 1);
      expect(qb.skip).toHaveBeenCalledWith(20);
      expect(qb.take).toHaveBeenCalledWith(10);
    });
  });

  describe('findByCompany', () => {
    it('lista condomínios da empresa ordenados por nome', async () => {
      const list = [{ id: 1 }, { id: 2 }];
      condoRepo.find.mockResolvedValue(list);
      const result = await service.findByCompany(7);
      expect(result).toEqual(list);
      expect(condoRepo.find).toHaveBeenCalledWith({
        where: { companyId: 7 },
        order: { name: 'ASC' },
      });
    });
  });

  describe('findOne', () => {
    it('retorna um condomínio quando existir', async () => {
      const entity = { id: 1 };
      condoRepo.findOneBy.mockResolvedValue(entity);
      const result = await service.findOne(1);
      expect(result).toEqual(entity);
    });

    it('lança NotFoundException quando não existir', async () => {
      condoRepo.findOneBy.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('atualiza e retorna o condomínio atualizado', async () => {
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

    it('lança NotFoundException quando não existir', async () => {
      condoRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.update(999, { name: 'X' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(condoRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('soft-deleta com sucesso', async () => {
      condoRepo.findOneBy.mockResolvedValue({ id: 1 });
      condoRepo.softDelete.mockResolvedValue(undefined);
      await expect(service.remove(1)).resolves.toBeUndefined();
      expect(condoRepo.softDelete).toHaveBeenCalledWith(1);
    });

    it('lança NotFoundException quando não existir', async () => {
      condoRepo.findOneBy.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(condoRepo.softDelete).not.toHaveBeenCalled();
    });
  });
});
