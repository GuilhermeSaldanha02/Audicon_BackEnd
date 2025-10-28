import { Test, TestingModule } from '@nestjs/testing';
import { UnitsService } from './units.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Unit } from './entities/unit.entity';
import { CondominiumsService } from '../condominiums/condominiums.service';
import { ConflictException, InternalServerErrorException, NotFoundException, } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
describe('UnitsService', () => {
    let service: UnitsService;
    let repository: {
        create: jest.Mock;
        save: jest.Mock;
        find: jest.Mock;
        findOneBy: jest.Mock;
        update: jest.Mock;
        delete: jest.Mock;
    };
    let condominiumsService: {
        findOne: jest.Mock;
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
        condominiumsService = {
            findOne: jest.fn(),
        };
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UnitsService,
                {
                    provide: getRepositoryToken(Unit),
                    useValue: repository,
                },
                {
                    provide: CondominiumsService,
                    useValue: condominiumsService,
                },
            ],
        }).compile();
        service = module.get<UnitsService>(UnitsService);
    });
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('create', () => {
        it('deve criar a unidade com sucesso (happy path)', async () => {
            const condoId = 10;
            const condo = { id: condoId } as any;
            const dto: any = { identifier: 'A-101', residentName: 'John' };
            const created = { id: 1, ...dto, condominium: condo };
            const saved = { id: 1, ...dto, condominium: condo };
            condominiumsService.findOne.mockResolvedValue(condo);
            repository.create.mockReturnValue(created);
            repository.save.mockResolvedValue(saved);
            const result = await service.create(condoId, dto);
            expect(result).toEqual(saved);
            expect(condominiumsService.findOne).toHaveBeenCalledWith(condoId);
            expect(repository.create).toHaveBeenCalledWith({
                ...dto,
                condominium: condo,
            });
            expect(repository.save).toHaveBeenCalledWith(created);
        });
        it('deve lançar ConflictException quando código 23505 (duplicado)', async () => {
            const condoId = 10;
            const condo = { id: condoId } as any;
            const dto: any = { identifier: 'A-101', residentName: 'John' };
            condominiumsService.findOne.mockResolvedValue(condo);
            repository.create.mockReturnValue({ ...dto, condominium: condo });
            const driverError = Object.assign(new Error('duplicate key'), {
                code: '23505',
            });
            const queryError = new QueryFailedError('INSERT', [], driverError);
            repository.save.mockRejectedValue(queryError);
            await expect(service.create(condoId, dto)).rejects.toBeInstanceOf(ConflictException);
            expect(condominiumsService.findOne).toHaveBeenCalledWith(condoId);
        });
        it('deve propagar NotFoundException quando condomínio não existir', async () => {
            const condoId = 999;
            const dto: any = { identifier: 'A-101' };
            condominiumsService.findOne.mockRejectedValue(new NotFoundException('Condo not found'));
            await expect(service.create(condoId, dto)).rejects.toBeInstanceOf(NotFoundException);
            expect(repository.save).not.toHaveBeenCalled();
        });
        it('deve lançar InternalServerErrorException para erros genéricos do save', async () => {
            const condoId = 10;
            const condo = { id: condoId } as any;
            const dto: any = { identifier: 'A-101' };
            condominiumsService.findOne.mockResolvedValue(condo);
            repository.create.mockReturnValue({ ...dto, condominium: condo });
            repository.save.mockRejectedValue(new Error('unexpected'));
            await expect(service.create(condoId, dto)).rejects.toBeInstanceOf(InternalServerErrorException);
        });
    });
    describe('findAll', () => {
        it('deve listar unidades do condomínio (happy path)', async () => {
            const condoId = 10;
            const list = [{ id: 1 }, { id: 2 }];
            condominiumsService.findOne.mockResolvedValue({ id: condoId });
            repository.find.mockResolvedValue(list);
            const result = await service.findAll(condoId);
            expect(result).toEqual(list);
            expect(condominiumsService.findOne).toHaveBeenCalledWith(condoId);
            expect(repository.find).toHaveBeenCalledWith({
                where: { condominium: { id: condoId } },
            });
        });
        it('deve retornar lista vazia quando não houver unidades', async () => {
            const condoId = 10;
            condominiumsService.findOne.mockResolvedValue({ id: condoId });
            repository.find.mockResolvedValue([]);
            const result = await service.findAll(condoId);
            expect(result).toEqual([]);
            expect(result).toHaveLength(0);
        });
        it('deve lançar NotFoundException quando condomínio não existir', async () => {
            const condoId = 999;
            condominiumsService.findOne.mockRejectedValue(new NotFoundException());
            await expect(service.findAll(condoId)).rejects.toBeInstanceOf(NotFoundException);
            expect(repository.find).not.toHaveBeenCalled();
        });
    });
    describe('findOne', () => {
        it('deve retornar a unidade quando existir', async () => {
            const entity = { id: 1 };
            repository.findOneBy.mockResolvedValue(entity);
            const result = await service.findOne(1);
            expect(result).toEqual(entity);
            expect(repository.findOneBy).toHaveBeenCalledWith({ id: 1 });
        });
        it('deve lançar NotFoundException quando unidade não existir', async () => {
            repository.findOneBy.mockResolvedValue(null);
            await expect(service.findOne(999)).rejects.toBeInstanceOf(NotFoundException);
        });
    });
    describe('update', () => {
        it('deve atualizar e retornar a unidade; chama findOne duas vezes', async () => {
            const id = 1;
            const dto: any = { residentName: 'Jane' };
            const existing = { id, residentName: 'John' };
            const updated = { id, residentName: 'Jane' };
            repository.findOneBy
                .mockResolvedValueOnce(existing)
                .mockResolvedValueOnce(updated);
            repository.update.mockResolvedValue(undefined);
            const result = await service.update(id, dto);
            expect(result).toEqual(updated);
            expect(repository.update).toHaveBeenCalledWith(id, dto);
            expect(repository.findOneBy).toHaveBeenCalledTimes(2);
        });
        it('deve lançar NotFoundException quando unidade não existir', async () => {
            repository.findOneBy.mockResolvedValue(null);
            await expect(service.update(999, { residentName: 'X' } as any)).rejects.toBeInstanceOf(NotFoundException);
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
        it('deve lançar NotFoundException quando unidade não existir', async () => {
            repository.findOneBy.mockResolvedValue(null);
            await expect(service.remove(999)).rejects.toBeInstanceOf(NotFoundException);
            expect(repository.delete).not.toHaveBeenCalled();
        });
    });
});
