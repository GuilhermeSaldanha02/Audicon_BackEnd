import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuditService } from './audit.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { assertTenantScope } from '../common/helpers/assert-tenant-scope';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

class AuditQueryDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId?: number;
}

@ApiTags('Audit Log')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit-log')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @ApiOperation({
    summary:
      'Listar audit log. Master vê tudo (pode filtrar por companyId). Demais usuários veem apenas da própria empresa.',
  })
  @ApiQuery({
    name: 'companyId',
    required: false,
    type: Number,
    description: 'Filtro de empresa (apenas master)',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada de logs' })
  @Get()
  async list(@Request() req: any, @Query() query: AuditQueryDto) {
    const { page, limit, companyId: requestedCompanyId } = query;
    const scope = assertTenantScope(req.user, {
      masterOverrideCompanyId: requestedCompanyId ?? null,
    });
    return this.auditService.list({ companyId: scope.companyId, page, limit });
  }
}
