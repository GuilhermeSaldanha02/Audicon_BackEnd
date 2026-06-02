import { ApiProperty } from '@nestjs/swagger';

/**
 * Contrato de resposta de GET /auth/profile.
 *
 * R-08: fonte única de claims do front (substitui a decodificação do JWT no
 * localStorage). Inclui companyId e mustChangePassword, exigidos pela guarda de
 * rota e pelo redirect pós-login do frontend.
 */
export class ProfileResponseDto {
  @ApiProperty()
  nome: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  isMaster: boolean;

  @ApiProperty({ nullable: true, type: Number })
  companyId: number | null;

  @ApiProperty()
  mustChangePassword: boolean;

  @ApiProperty({ nullable: true, type: String })
  companyName: string | null;
}
