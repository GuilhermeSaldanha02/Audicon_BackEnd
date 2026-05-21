import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { Actor } from '../audit/audit.service';

function masterActor(req: any): Actor {
  return {
    userId: req.user.id,
    email: req.user.email,
    isMaster: !!req.user.isMaster,
    companyId: req.user.companyId ?? null,
  };
}
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MasterGuard } from '../common/guards/master.guard';
import { CompaniesService } from './companies.service';
import { CondominiumsService } from '../condominiums/condominiums.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Patch } from '@nestjs/common';

@ApiTags('Companies (master only)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, MasterGuard)
@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly condominiumsService: CondominiumsService,
  ) {}

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

  @ApiOperation({
    summary:
      'Listar usuários (admins/funcionários) de uma empresa (apenas master)',
  })
  @ApiResponse({ status: 200, description: 'Lista de usuários da empresa' })
  @ApiResponse({ status: 404, description: 'Empresa não encontrada' })
  @Get(':companyId/users')
  listUsers(@Param('companyId', ParseIntPipe) companyId: number) {
    return this.companiesService.listUsersOfCompany(companyId);
  }

  @ApiOperation({
    summary: 'Listar condomínios de uma empresa (apenas master)',
  })
  @ApiResponse({ status: 200, description: 'Lista de condomínios da empresa' })
  @Get(':companyId/condominiums')
  listCondominiums(@Param('companyId', ParseIntPipe) companyId: number) {
    return this.condominiumsService.findByCompany(companyId);
  }

  @ApiOperation({ summary: 'Atualizar nome/CNPJ da empresa (apenas master)' })
  @ApiResponse({ status: 200, description: 'Empresa atualizada' })
  @ApiResponse({ status: 404, description: 'Empresa não encontrada' })
  @ApiResponse({ status: 409, description: 'CNPJ já cadastrado' })
  @Patch(':id')
  updateCompany(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companiesService.update(id, dto);
  }

  @ApiOperation({
    summary:
      'Excluir empresa (apenas master). Bloqueado se houver condomínios ativos.',
  })
  @ApiResponse({ status: 200, description: 'Empresa removida' })
  @ApiResponse({ status: 404, description: 'Empresa não encontrada' })
  @ApiResponse({
    status: 409,
    description: 'Empresa possui condomínios ativos',
  })
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.companiesService.remove(id, masterActor(req));
  }

  @ApiOperation({
    summary:
      'Criar usuário (funcionário/admin) para uma empresa (apenas master). Retorna senha temporária.',
  })
  @ApiResponse({ status: 201, description: 'Usuário criado' })
  @ApiResponse({ status: 404, description: 'Empresa não encontrada' })
  @ApiResponse({ status: 409, description: 'E-mail já cadastrado' })
  @Post(':companyId/users')
  createUser(
    @Request() req: any,
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.companiesService.createEmployee(
      companyId,
      dto,
      masterActor(req),
    );
  }

  @ApiOperation({
    summary:
      'Resetar senha de qualquer usuário da empresa (apenas master). Aceita admins e funcionários.',
  })
  @ApiResponse({
    status: 200,
    description: 'Senha resetada, retorna senha temporária',
  })
  @ApiResponse({ status: 403, description: 'Usuário não pertence à empresa' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  @Post(':companyId/users/:userId/reset-password')
  resetUserPassword(
    @Request() req: any,
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.companiesService.resetPassword({
      companyId,
      targetUserId: userId,
      requesterId: req.user.id,
      enforceNotAdmin: false,
      actor: masterActor(req),
    });
  }
}
