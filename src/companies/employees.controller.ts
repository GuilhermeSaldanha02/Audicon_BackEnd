import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyAdminGuard } from '../common/guards/company-admin.guard';
import { CompaniesService } from './companies.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';

@ApiTags('Company Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyAdminGuard)
@Controller('companies/me/users')
export class EmployeesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @ApiOperation({
    summary:
      'Criar funcionário da empresa do solicitante. Requer permissão ADMIN em pelo menos um condomínio. Retorna senha temporária.',
  })
  @ApiResponse({ status: 201, description: 'Funcionário criado' })
  @ApiResponse({
    status: 403,
    description: 'Solicitante não é ADMIN de nenhum condomínio',
  })
  @ApiResponse({ status: 409, description: 'E-mail já cadastrado' })
  @Post()
  create(@Request() req: any, @Body() dto: CreateEmployeeDto) {
    return this.companiesService.createEmployee(req.user.companyId, dto);
  }

  @ApiOperation({
    summary: 'Listar funcionários da empresa do solicitante.',
  })
  @ApiResponse({ status: 200, description: 'Lista de funcionários' })
  @Get()
  list(@Request() req: any) {
    return this.companiesService.listEmployees(req.user.companyId);
  }
}
