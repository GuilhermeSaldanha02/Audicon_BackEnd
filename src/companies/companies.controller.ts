import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Actor } from '../audit/audit.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MasterGuard } from '../common/guards/master.guard';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';

@ApiTags('Companies (master only)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, MasterGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @ApiOperation({
    summary:
      'Criar uma nova empresa + usuário admin inicial (apenas master). Retorna senha temporária.',
  })
  @ApiResponse({ status: 201, description: 'Empresa criada' })
  @ApiResponse({
    status: 403,
    description: 'Apenas master pode criar empresas',
  })
  @ApiResponse({ status: 409, description: 'CNPJ ou e-mail já cadastrados' })
  @Post()
  create(@Request() req: any, @Body() dto: CreateCompanyDto) {
    const actor: Actor = {
      userId: req.user.id,
      email: req.user.email,
      isMaster: !!req.user.isMaster,
      companyId: req.user.companyId ?? null,
    };
    return this.companiesService.create(dto, actor);
  }

  @ApiOperation({ summary: 'Listar todas as empresas (apenas master)' })
  @ApiResponse({ status: 200, description: 'Lista de empresas' })
  @Get()
  findAll() {
    return this.companiesService.findAll();
  }

  @ApiOperation({ summary: 'Buscar empresa por ID (apenas master)' })
  @ApiResponse({ status: 200, description: 'Empresa encontrada' })
  @ApiResponse({ status: 404, description: 'Empresa não encontrada' })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.companiesService.findOne(id);
  }
}
