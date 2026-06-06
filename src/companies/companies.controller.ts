import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { CurrentActor } from '../common/decorators/current-actor.decorator';
import { Actor } from '../audit/audit.service';
import { CompanyResponseDto } from './dto/company-response.dto';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MasterGuard } from '../common/guards/master.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CompanyAccessGuard } from '../common/guards/company-access.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole } from '../common/enums/system-role.enum';
import { CompaniesService } from './companies.service';
import { CondominiumsService } from '../condominiums/condominiums.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import {
  CompanyUserResponseDto,
  CreatedEmployeeResponseDto,
} from './dto/company-user-response.dto';
import { Patch } from '@nestjs/common';

// Autenticação para todas as rotas (JwtAuthGuard na classe). A AUTORIZAÇÃO é por
// rota: a maioria é master-only (MasterGuard); as duas rotas de funcionários da
// empresa (POST/GET :companyId/users) são abertas a MASTER e GERENTE — ver §2.3.
@ApiTags('Companies')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
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
  @ApiResponse({
    status: 201,
    description: 'Empresa criada',
    type: CompanyResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Apenas master pode criar empresas',
  })
  @ApiResponse({ status: 409, description: 'CNPJ ou e-mail já cadastrados' })
  @UseGuards(MasterGuard)
  @Post()
  create(@CurrentActor() actor: Actor, @Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto, actor);
  }

  @ApiOperation({ summary: 'Listar todas as empresas (apenas master)' })
  @ApiResponse({
    status: 200,
    description: 'Lista de empresas',
    type: [CompanyResponseDto],
  })
  @UseGuards(MasterGuard)
  @Get()
  findAll() {
    return this.companiesService.findAll();
  }

  @ApiOperation({ summary: 'Buscar empresa por ID (apenas master)' })
  @ApiResponse({
    status: 200,
    description: 'Empresa encontrada',
    type: CompanyResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Empresa não encontrada' })
  @UseGuards(MasterGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.companiesService.findOne(id);
  }

  @ApiOperation({
    summary: 'Listar usuários de uma empresa (master ou gerente da empresa)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuários da empresa (inclui role)',
    type: [CompanyUserResponseDto],
  })
  @ApiResponse({ status: 403, description: 'Papel ou empresa sem permissão' })
  @ApiResponse({ status: 404, description: 'Empresa não encontrada' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'R-16: inclui funcionários desativados (soft-deleted).',
  })
  // Ordem dos guards é garantida pelo NestJS (array @UseGuards, da esquerda p/
  // direita): RolesGuard roda ANTES do CompanyAccessGuard. RolesGuard barra o
  // FUNCIONARIO (defesa em profundidade) — o CompanyAccessGuard sozinho NÃO o
  // barraria na própria empresa, pois o companyId casa. Ver company-access.guard.
  @UseGuards(RolesGuard, CompanyAccessGuard)
  @Roles(SystemRole.MASTER, SystemRole.GERENTE)
  @Get(':companyId/users')
  listUsers(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe)
    includeInactive: boolean,
  ) {
    return this.companiesService.listUsersOfCompany(companyId, includeInactive);
  }

  @ApiOperation({
    summary: 'Listar condomínios de uma empresa (apenas master)',
  })
  @ApiResponse({ status: 200, description: 'Lista de condomínios da empresa' })
  @UseGuards(MasterGuard)
  @Get(':companyId/condominiums')
  listCondominiums(@Param('companyId', ParseIntPipe) companyId: number) {
    return this.condominiumsService.findByCompany(companyId);
  }

  @ApiOperation({ summary: 'Atualizar nome/CNPJ da empresa (apenas master)' })
  @ApiResponse({
    status: 200,
    description: 'Empresa atualizada',
    type: CompanyResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Empresa não encontrada' })
  @ApiResponse({ status: 409, description: 'CNPJ já cadastrado' })
  @UseGuards(MasterGuard)
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
  @UseGuards(MasterGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentActor() actor: Actor, @Param('id', ParseIntPipe) id: number) {
    return this.companiesService.remove(id, actor);
  }

  @ApiOperation({
    summary:
      'Criar funcionário de uma empresa (master ou gerente da empresa). ' +
      'Sempre cria com role FUNCIONARIO. Retorna senha temporária.',
  })
  @ApiResponse({
    status: 201,
    description: 'Funcionário criado (role FUNCIONARIO)',
    type: CreatedEmployeeResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Papel ou empresa sem permissão' })
  @ApiResponse({ status: 404, description: 'Empresa não encontrada' })
  @ApiResponse({ status: 409, description: 'E-mail já cadastrado' })
  // Mesma blindagem da listagem: RolesGuard (antes) barra FUNCIONARIO;
  // CompanyAccessGuard escopa o GERENTE à própria empresa. O role criado é
  // sempre FUNCIONARIO (forçado no service; CreateEmployeeDto não tem `role` e
  // o ValidationPipe rejeita campos não-whitelisted) — gerente não escala papel.
  @UseGuards(RolesGuard, CompanyAccessGuard)
  @Roles(SystemRole.MASTER, SystemRole.GERENTE)
  @Post(':companyId/users')
  createUser(
    @CurrentActor() actor: Actor,
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.companiesService.createEmployee(companyId, dto, actor);
  }

  @ApiOperation({
    summary:
      'Editar nome/e-mail de um funcionário da empresa (master ou gerente da ' +
      'empresa). `role` NÃO é editável (anti-escalonamento). Alvo só FUNCIONARIO.',
  })
  @ApiResponse({
    status: 200,
    description: 'Funcionário atualizado',
    type: CompanyUserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Body inválido (ex.: campo `role`)',
  })
  @ApiResponse({
    status: 403,
    description: 'Papel/empresa sem permissão, ou alvo não é FUNCIONARIO',
  })
  @ApiResponse({ status: 404, description: 'Funcionário não encontrado' })
  @ApiResponse({ status: 409, description: 'E-mail já em uso' })
  // Mesma blindagem do R-15: RolesGuard (antes) barra FUNCIONARIO;
  // CompanyAccessGuard escopa o GERENTE à própria empresa. O escopo do ALVO
  // (só FUNCIONARIO da empresa, nunca master/gerente) é aplicado no service.
  @UseGuards(RolesGuard, CompanyAccessGuard)
  @Roles(SystemRole.MASTER, SystemRole.GERENTE)
  @Patch(':companyId/users/:userId')
  updateUser(
    @CurrentActor() actor: Actor,
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.companiesService.updateEmployee(companyId, userId, dto, actor);
  }

  @ApiOperation({
    summary:
      'Desativar (soft-delete) um funcionário da empresa (master ou gerente ' +
      'da empresa). O registro permanece; o acesso é revogado. Alvo só FUNCIONARIO.',
  })
  @ApiResponse({ status: 200, description: 'Funcionário desativado' })
  @ApiResponse({
    status: 403,
    description: 'Papel/empresa sem permissão, ou alvo não é FUNCIONARIO',
  })
  @ApiResponse({ status: 404, description: 'Funcionário não encontrado' })
  @UseGuards(RolesGuard, CompanyAccessGuard)
  @Roles(SystemRole.MASTER, SystemRole.GERENTE)
  @Delete(':companyId/users/:userId')
  @HttpCode(HttpStatus.OK)
  deactivateUser(
    @CurrentActor() actor: Actor,
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.companiesService.deactivateEmployee(companyId, userId, actor);
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
  @UseGuards(MasterGuard)
  @Post(':companyId/users/:userId/reset-password')
  resetUserPassword(
    @CurrentActor() actor: Actor,
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.companiesService.resetPassword({
      companyId,
      targetUserId: userId,
      requesterId: actor.userId,
      enforceNotAdmin: false,
      actor,
    });
  }
}
