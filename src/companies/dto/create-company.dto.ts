import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCompanyAdminDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome: string;

  @ApiProperty()
  @IsEmail()
  email: string;
}

export class CreateCompanyDto {
  @ApiProperty({ example: 'Administradora Exemplo Ltda' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @ApiProperty({ example: '12.345.678/0001-90' })
  @IsString()
  @IsNotEmpty()
  @MinLength(14)
  @MaxLength(18)
  cnpj: string;

  @ApiProperty({ type: CreateCompanyAdminDto })
  @ValidateNested()
  @Type(() => CreateCompanyAdminDto)
  admin: CreateCompanyAdminDto;
}
