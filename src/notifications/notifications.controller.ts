import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { InfractionAccessGuard } from 'src/common/guards/infraction-access.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('infractions')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({ summary: 'Listar notificações enviadas para a infração' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Lista de notificações com status real',
  })
  @UseGuards(InfractionAccessGuard)
  @Get(':id/notifications')
  findByInfraction(@Param('id', ParseIntPipe) id: number) {
    return this.notificationsService.findByInfraction(id);
  }
}
