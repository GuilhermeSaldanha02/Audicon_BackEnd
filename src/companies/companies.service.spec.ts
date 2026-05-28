import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { CompaniesService } from './companies.service';
import { Company } from './entities/company.entity';
import { User } from '../users/entities/user.entity';
import { Condominium } from '../condominiums/entities/condominium.entity';
import { AuditService } from '../audit/audit.service';
import { SystemRole } from '../common/enums/system-role.enum';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let companiesRepo: any;
  let usersRepo: any;
  let condosRepo: any;

  beforeEach(async () => {
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
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            create: jest.fn((dto) => dto),
            save: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Condominium),
          useValue: {
            count: jest.fn().mockResolvedValue(0),
            find: jest.fn(),
            manager: { query: jest.fn().mockResolvedValue([]) },
          },
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
    condosRepo = module.get(getRepositoryToken(Condominium));
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
          role: SystemRole.GERENTE,
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
          role: SystemRole.FUNCIONARIO,
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

  describe('listUsersOfCompany', () => {
    it('lista usuários após validar que empresa existe', async () => {
      companiesRepo.findOneBy = jest
        .fn()
        .mockResolvedValue({ id: 7, name: 'Empresa X' });
      usersRepo.find = jest
        .fn()
        .mockResolvedValue([{ id: 9, nome: 'Admin', email: 'a@x.com' }]);
      const result = await service.listUsersOfCompany(7);
      expect(companiesRepo.findOneBy).toHaveBeenCalledWith({ id: 7 });
      expect(result).toHaveLength(1);
      expect(usersRepo.find).toHaveBeenCalledWith({
        where: { companyId: 7, isMaster: false },
        select: ['id', 'nome', 'email'],
        order: { id: 'ASC' },
      });
    });

    it('lança 404 quando empresa não existe', async () => {
      companiesRepo.findOneBy = jest.fn().mockResolvedValue(null);
      await expect(service.listUsersOfCompany(999)).rejects.toThrow(
        /não encontrada/i,
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
    it('reseta senha de FUNCIONARIO (admin scope) e retorna nova temp', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 5,
        companyId: 1,
        isMaster: false,
        email: 'func@x.com',
        role: SystemRole.FUNCIONARIO,
      });
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

    it('rejeita admin tentando resetar um GERENTE (enforceNotAdmin=true)', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 7,
        companyId: 1,
        isMaster: false,
        email: 'gerente@x.com',
        role: SystemRole.GERENTE,
      });
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

  describe('update', () => {
    it('atualiza nome e cnpj e salva', async () => {
      companiesRepo.findOneBy.mockResolvedValue({
        id: 1,
        name: 'Antigo',
        cnpj: '00',
      });
      companiesRepo.save.mockImplementation((c: any) => Promise.resolve(c));
      const result = await service.update(1, {
        name: 'Novo',
        cnpj: '11',
      } as any);
      expect(result.name).toBe('Novo');
      expect(result.cnpj).toBe('11');
    });

    it('converte erro 23505 em ConflictException', async () => {
      companiesRepo.findOneBy.mockResolvedValue({
        id: 1,
        name: 'X',
        cnpj: '0',
      });
      const driverError = Object.assign(new Error('dup'), { code: '23505' });
      companiesRepo.save.mockRejectedValue(
        new QueryFailedError('UPDATE', [], driverError),
      );
      await expect(
        service.update(1, { cnpj: '11' } as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('remove', () => {
    const actor = {
      userId: 1,
      email: 'master@x.com',
      isMaster: true,
      companyId: null,
    };

    it('bloqueia exclusão quando há condomínios ativos', async () => {
      companiesRepo.findOneBy.mockResolvedValue({
        id: 1,
        name: 'X',
        cnpj: '0',
      });
      condosRepo.count.mockResolvedValue(2);
      await expect(service.remove(1, actor)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(companiesRepo.delete).not.toHaveBeenCalled();
    });

    it('remove em cascata e exclui a empresa quando não há condomínios ativos', async () => {
      companiesRepo.findOneBy.mockResolvedValue({
        id: 1,
        name: 'X',
        cnpj: '0',
      });
      condosRepo.count.mockResolvedValue(0);
      const result = await service.remove(1, actor);
      expect(condosRepo.manager.query).toHaveBeenCalled();
      expect(usersRepo.delete).toHaveBeenCalledWith({
        companyId: 1,
        isMaster: false,
      });
      expect(companiesRepo.delete).toHaveBeenCalledWith({ id: 1 });
      expect(result).toEqual({ id: 1 });
    });
  });
});
