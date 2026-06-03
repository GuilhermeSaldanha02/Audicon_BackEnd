import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsInt, IsEnum } from 'class-validator';
import { InfractionSeverity } from '../enums/infraction-severity.enum';

export class CreateInfractionDto {
  @ApiProperty({ example: 'Morador toca som alto após 22h.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    enum: InfractionSeverity,
    example: InfractionSeverity.MEDIA,
    description: 'Gravidade classificada pelo operador (obrigatória).',
  })
  @IsEnum(InfractionSeverity)
  @IsNotEmpty()
  severity: InfractionSeverity;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsNotEmpty()
  unitId: number;
}
