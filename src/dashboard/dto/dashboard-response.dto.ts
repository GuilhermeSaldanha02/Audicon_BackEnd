import { ApiProperty } from '@nestjs/swagger';

export class ByMonthItemDto {
  @ApiProperty()
  month: string;

  @ApiProperty()
  count: number;
}

export class TopUnitItemDto {
  @ApiProperty()
  unitId: number;

  @ApiProperty()
  identifier: string;

  @ApiProperty()
  condominiumName: string;

  @ApiProperty()
  count: number;
}

export class DashboardResponseDto {
  @ApiProperty()
  totalInfractions: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    description: 'Contagem por status (pending, analyzed, approved, sent)',
  })
  byStatus: Record<string, number>;

  @ApiProperty({ type: [ByMonthItemDto] })
  byMonth: ByMonthItemDto[];

  @ApiProperty({ type: [TopUnitItemDto] })
  topUnits: TopUnitItemDto[];

  @ApiProperty()
  approvalRate: number;
}
