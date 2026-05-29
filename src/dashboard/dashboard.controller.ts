import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @ApiOperation({
    summary:
      'Métricas gerais (master vê tudo; não-master filtrado por empresa)',
  })
  @ApiResponse({ status: 200, description: 'Métricas do dashboard' })
  @Get()
  getMetrics(@Request() req: any) {
    return this.dashboardService.getMetrics(req.user);
  }
}
