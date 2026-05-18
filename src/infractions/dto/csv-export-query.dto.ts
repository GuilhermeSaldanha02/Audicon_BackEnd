import { IsEnum, IsInt, IsISO8601, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { InfractionStatus } from '../entities/infraction.entity';

export class CsvExportQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por unidade', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unitId?: number;

  @ApiPropertyOptional({ enum: InfractionStatus })
  @IsOptional()
  @IsEnum(InfractionStatus)
  status?: InfractionStatus;

  @ApiPropertyOptional({
    description: 'Data início (ISO 8601)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    description: 'Data fim (ISO 8601)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
