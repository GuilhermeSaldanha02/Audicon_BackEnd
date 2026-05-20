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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompaniesService } from './companies.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';

@ApiTags('Company Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
    return this.companiesService.createEmployee(req.user.companyId, dto, {
      userId: req.user.id,
      email: req.user.email,
      isMaster: !!req.user.isMaster,
      companyId: req.user.companyId,
    });
  }

  @ApiOperation({
    summary: 'Listar funcionários da empresa do solicitante.',
  })
  @ApiResponse({ status: 200, description: 'Lista de funcionários' })
  @Get()
  list(@Request() req: any) {
    return this.companiesService.listEmployees(req.user.companyId);
  }

  @ApiOperation({
    summary:
      'Resetar senha de funcionário (admin não pode resetar outro admin — só master). Retorna nova senha temporária.',
  })
  @ApiResponse({ status: 200, description: 'Senha resetada' })
  @ApiResponse({
    status: 403,
    description: 'Target é ADMIN ou pertence a outra empresa',
  })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado' })
  @Post(':id/reset-password')
  resetEmployeePassword(
    @Request() req: any,
    @Param('id', ParseIntPipe) targetId: number,
  ) {
    return this.companiesService.resetPassword({
      companyId: req.user.companyId,
      targetUserId: targetId,
      requesterId: req.user.id,
      enforceNotAdmin: true,
      actor: {
        userId: req.user.id,
        email: req.user.email,
        isMaster: !!req.user.isMaster,
        companyId: req.user.companyId,
      },
    });
  }
}
