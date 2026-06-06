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

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'R-16: data de desativação (soft-delete). NULL = ativo. Só aparece ' +
      'preenchido quando a listagem é chamada com ?includeInactive=true.',
  })
  deletedAt: Date | null;
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
