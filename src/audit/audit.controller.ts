import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuditService } from './audit.service';
import { PaginationDto } from '../common/dto/pagination.dto';
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
@ApiBearerAuth()
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
    const isMaster = !!req.user.isMaster;
    const userCompanyId = req.user.companyId ?? null;

    let scope: number | null;
    if (isMaster) {
      // Master pode filtrar por companyId opcionalmente; sem filtro vê todos
      scope = requestedCompanyId ?? null;
    } else {
      if (!userCompanyId) {
        throw new ForbiddenException(
          'Usuário sem empresa associada não pode acessar audit log.',
        );
      }
      // Non-master ignora requestedCompanyId — sempre da própria empresa
      scope = userCompanyId;
    }

    return this.auditService.list({ companyId: scope, page, limit });
  }
}
