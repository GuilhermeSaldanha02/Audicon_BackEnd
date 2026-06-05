import { ApiProperty } from '@nestjs/swagger';
import { SystemRole } from '../../common/enums/system-role.enum';

/** Usuário (funcionário/admin) de uma empresa, na listagem GET /companies/:id/users. */
export class CompanyUserResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  nome: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: SystemRole })
  role: SystemRole;
}

/** Retorno de POST /companies/:id/users — inclui a senha temporária gerada. */
export class CreatedEmployeeResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  nome: string;

  @ApiProperty()
  email: string;

  @ApiProperty({
    description: 'Senha temporária gerada (mostrar uma única vez).',
  })
  tempPassword: string;
}
