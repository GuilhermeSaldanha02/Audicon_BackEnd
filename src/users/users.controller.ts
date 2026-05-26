import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MasterGuard } from '../common/guards/master.guard';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Criar novo usuário (apenas master)' })
  @ApiResponse({
    status: 201,
    description: 'Usuário criado (senha omitida na resposta)',
  })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Requer usuário master' })
  @ApiResponse({ status: 409, description: 'E-mail já cadastrado' })
  @UseGuards(JwtAuthGuard, MasterGuard)
  @Post()
  async create(@Body() dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    const safeUser: any = { ...user };
    delete safeUser.senha;
    return safeUser;
  }
}
