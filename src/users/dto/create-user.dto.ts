import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
import { SystemRole } from '../../common/enums/system-role.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'Maria Souza' })
  @IsString()
  @IsNotEmpty({ message: 'O nome não pode ser vazio' })
  nome: string;

  @ApiProperty({ example: 'maria@email.com' })
  @IsEmail({}, { message: 'Formato de e-mail inválido' })
  @IsNotEmpty({ message: 'O e-mail não pode ser vazio' })
  email: string;

  @ApiProperty({ example: 'S3nh@Segura', minLength: 6 })
  @IsString()
  @MinLength(6, { message: 'A senha deve ter no mínimo 6 caracteres' })
  @IsNotEmpty({ message: 'A senha não pode ser vazia' })
  senha: string;

  // R-02: papel é obrigatório e explícito (coluna NOT NULL sem default).
  // PENDÊNCIA (ver nota do PR): este endpoint não valida coerência
  // entre role e companyId — revisar junto da decisão de manter/remover.
  @ApiProperty({ enum: SystemRole, example: SystemRole.FUNCIONARIO })
  @IsEnum(SystemRole, { message: 'Papel inválido' })
  @IsNotEmpty({ message: 'O papel não pode ser vazio' })
  role: SystemRole;
}
