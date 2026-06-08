import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { SystemRole } from '../../common/enums/system-role.enum';

/**
 * R-17: troca de papel de um usuário da empresa pelo MASTER.
 *
 * Aceita apenas GERENTE ou FUNCIONARIO — MASTER nunca atingível por esta rota.
 * O ValidationPipe global (forbidNonWhitelisted: true) rejeita qualquer campo
 * extra no body com 400.
 */
export class ChangeRoleDto {
  @ApiProperty({
    enum: [SystemRole.GERENTE, SystemRole.FUNCIONARIO],
    description: 'Novo papel do usuário. MASTER não é permitido.',
  })
  @IsEnum([SystemRole.GERENTE, SystemRole.FUNCIONARIO], {
    message: 'role deve ser GERENTE ou FUNCIONARIO',
  })
  role: SystemRole.GERENTE | SystemRole.FUNCIONARIO;
}
