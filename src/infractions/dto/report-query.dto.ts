import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class ReportQueryDto {
  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Data inicial (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Data final (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
