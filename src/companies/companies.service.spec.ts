import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { CompaniesService } from './companies.service';
import { Company } from './entities/company.entity';
import { User } from '../users/entities/user.entity';
import { UserCondominium } from '../users/entities/user-condominium.entity';
import { AuditService } from '../audit/audit.service';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let companiesRepo: any;
  let usersRepo: any;
  let ucRepo: any;
  let ucQb: any;

  beforeEach(async () => {
    ucQb = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        {
          provide: getRepositoryToken(Company),
          useValue: {
            create: jest.fn((dto) => dto),
            save: jest.fn(),
            find: jest.fn(),
            findOneBy: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            create: jest.fn((dto) => dto),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserCondominium),
          useValue: { createQueryBuilder: jest.fn(() => ucQb) },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
            logAsync: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();
    service = module.get(CompaniesService);
    companiesRepo = module.get(getRepositoryToken(Company));
    usersRepo = module.get(getRepositoryToken(User));
    ucRepo = module.get(getRepositoryToken(UserCondominium));
  });

  describe('create', () => {
    it('cria empresa + admin com senha temporária', async () => {
      companiesRepo.save.mockResolvedValue({
        id: 2,
        name: 'X',
        cnpj: '00.000.000/0001-99',
      });
      usersRepo.save.mockResolvedValue({
        id: 10,
        email: 'admin@x.com',
        nome: 'Admin X',
      });
      const result = await service.create({
        name: 'X',
        cnpj: '00.000.000/0001-99',
        admin: { nome: 'Admin X', email: 'admin@x.com' },
      });
      expect(result.company.id).toBe(2);
      expect(result.admin.email).toBe('admin@x.com');
      expect(result.admin.tempPassword).toMatch(/^[A-Za-z0-9]{12}$/);
      expect(usersRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 2,
          isMaster: false,
        }),
      );
    });

    it('lança ConflictException quando driverError 23505', async () => {
      const driverError = Object.assign(new Error('dup'), { code: '23505' });
      companiesRepo.save.mockRejectedValue(
        new QueryFailedError('INSERT', [], driverError),
      );
      await expect(
        service.create({
          name: 'X',
          cnpj: '00.000.000/0001-99',
          admin: { nome: 'A', email: 'a@x.com' },
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('retorna lista ordenada por createdAt DESC', async () => {
      companiesRepo.find.mockResolvedValue([{ id: 2 }, { id: 1 }]);
      const result = await service.findAll();
      expect(result).toHaveLength(2);
      expect(companiesRepo.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('createEmployee', () => {
    it('cria funcionário com senha temp e companyId do solicitante', async () => {
      usersRepo.findOne = jest.fn().mockResolvedValue(null);
      usersRepo.save.mockResolvedValue({
        id: 50,
        nome: 'Func A',
        email: 'a@empresa.com',
      });
      const result = await service.createEmployee(3, {
        nome: 'Func A',
        email: 'a@empresa.com',
      });
      expect(result.tempPassword).toMatch(/^[A-Za-z0-9]{12}$/);
      expect(usersRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 3,
          isMaster: false,
          nome: 'Func A',
          email: 'a@empresa.com',
        }),
      );
    });

    it('rejeita quando email já cadastrado', async () => {
      usersRepo.findOne = jest.fn().mockResolvedValue({ id: 1 });
      await expect(
        service.createEmployee(3, { nome: 'X', email: 'dup@empresa.com' }),
      ).rejects.toThrow(/já está em uso/);
    });

    it('rejeita quando companyId ausente (master)', async () => {
      await expect(
        service.createEmployee(undefined as any, {
          nome: 'X',
          email: 'x@x.com',
        }),
      ).rejects.toThrow(/vinculado/);
    });
  });

  describe('listEmployees', () => {
    it('lista funcionários da empresa (sem master, sem senha)', async () => {
      usersRepo.find = jest.fn().mockResolvedValue([
        { id: 5, nome: 'F1', email: 'f1@x.com' },
        { id: 6, nome: 'F2', email: 'f2@x.com' },
      ]);
      const result = await service.listEmployees(3);
      expect(result).toHaveLength(2);
      expect(usersRepo.find).toHaveBeenCalledWith({
        where: { companyId: 3, isMaster: false },
        select: ['id', 'nome', 'email'],
        order: { id: 'ASC' },
      });
    });

    it('rejeita quando companyId ausente', async () => {
      await expect(service.listEmployees(undefined as any)).rejects.toThrow(
        /vinculado/,
      );
    });
  });

  describe('resetPassword', () => {
    const actor = {
      userId: 99,
      email: 'admin@x.com',
      isMaster: false,
      companyId: 1,
    };
    it('reseta senha de funcionário não-admin (admin scope) e retorna nova temp', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 5,
        companyId: 1,
        isMaster: false,
        email: 'func@x.com',
      });
      ucQb.getCount.mockResolvedValue(0); // não é admin
      usersRepo.save.mockResolvedValue({});
      const result = await service.resetPassword({
        companyId: 1,
        targetUserId: 5,
        requesterId: 99,
        enforceNotAdmin: true,
        actor,
      });
      expect(result.tempPassword).toMatch(/^[A-Za-z0-9]{12}$/);
      expect(result.id).toBe(5);
      expect(usersRepo.save).toHaveBeenCalled();
    });

    it('rejeita admin tentando resetar a própria senha', async () => {
      await expect(
        service.resetPassword({
          companyId: 1,
          targetUserId: 99,
          requesterId: 99,
          enforceNotAdmin: true,
          actor,
        }),
      ).rejects.toThrow(/própria senha/);
    });

    it('rejeita admin resetando outro admin (enforceNotAdmin=true)', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 7,
        companyId: 1,
        isMaster: false,
        email: 'outroadmin@x.com',
      });
      ucQb.getCount.mockResolvedValue(1); // target é admin
      await expect(
        service.resetPassword({
          companyId: 1,
          targetUserId: 7,
          requesterId: 99,
          enforceNotAdmin: true,
          actor,
        }),
      ).rejects.toThrow(/master pode resetar/);
    });

    it('master reseta admin com enforceNotAdmin=false', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 7,
        companyId: 1,
        isMaster: false,
        email: 'admin@x.com',
      });
      usersRepo.save.mockResolvedValue({});
      const result = await service.resetPassword({
        companyId: 1,
        targetUserId: 7,
        requesterId: undefined,
        enforceNotAdmin: false,
        actor: { ...actor, isMaster: true, companyId: null },
      });
      expect(result.tempPassword).toMatch(/^[A-Za-z0-9]{12}$/);
    });

    it('rejeita quando target pertence a outra empresa', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 7,
        companyId: 2,
        isMaster: false,
        email: 'a@b.com',
      });
      await expect(
        service.resetPassword({
          companyId: 1,
          targetUserId: 7,
          requesterId: 99,
          enforceNotAdmin: true,
          actor,
        }),
      ).rejects.toThrow(/não pertence/);
    });

    it('rejeita reset de usuário master', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 1,
        companyId: 1,
        isMaster: true,
        email: 'master@x.com',
      });
      await expect(
        service.resetPassword({
          companyId: 1,
          targetUserId: 1,
          requesterId: 99,
          enforceNotAdmin: false,
          actor,
        }),
      ).rejects.toThrow(/master/);
    });

    it('lança NotFound quando user não existe', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(
        service.resetPassword({
          companyId: 1,
          targetUserId: 999,
          requesterId: 99,
          enforceNotAdmin: true,
          actor,
        }),
      ).rejects.toThrow(/não encontrado/);
    });
  });

  describe('findOne', () => {
    it('retorna empresa quando existe', async () => {
      companiesRepo.findOneBy.mockResolvedValue({ id: 5 });
      const result = await service.findOne(5);
      expect(result.id).toBe(5);
    });
    it('lança NotFound quando não existe', async () => {
      companiesRepo.findOneBy.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toThrow(/não encontrada/);
    });
  });
});
