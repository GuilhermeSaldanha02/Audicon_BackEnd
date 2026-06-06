import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * R-16: edição de funcionário pelo GERENTE/MASTER — APENAS nome e e-mail.
 *
 * `role` é deliberadamente ausente: editá-lo seria escalonamento de papel (o
 * Gerente promoveria um Funcionário a Gerente). O ValidationPipe global
 * (`forbidNonWhitelisted: true`) rejeita `role` ou qualquer campo extra no body
 * com 400 — mesma defesa do R-15.
 */
export class UpdateEmployeeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;
}
