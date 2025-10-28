import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
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
});
