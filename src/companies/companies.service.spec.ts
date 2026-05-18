import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { CompaniesService } from './companies.service';
import { Company } from './entities/company.entity';
import { User } from '../users/entities/user.entity';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let companiesRepo: any;
  let usersRepo: any;

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
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            create: jest.fn((dto) => dto),
            save: jest.fn(),
          },
        },
      ],
    }).compile();
    service = module.get(CompaniesService);
    companiesRepo = module.get(getRepositoryToken(Company));
    usersRepo = module.get(getRepositoryToken(User));
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
