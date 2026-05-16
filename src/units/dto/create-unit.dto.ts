import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateUnitDto {
  @ApiProperty({ example: 'A-101' })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({ example: 'João da Silva' })
  @IsString()
  @IsNotEmpty()
  ownerName: string;

  @ApiPropertyOptional({ example: 'morador@exemplo.com' })
  @IsOptional()
  @IsEmail({}, { message: 'residentEmail deve ser um e-mail válido' })
  residentEmail?: string;

  @ApiPropertyOptional({ example: '+5511999998888' })
  @IsOptional()
  @IsString()
  residentPhone?: string;
}
