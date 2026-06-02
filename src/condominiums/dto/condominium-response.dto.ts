import { ApiProperty } from '@nestjs/swagger';

export class CondominiumResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  cnpj: string;

  @ApiProperty()
  address: string;

  @ApiProperty({ type: Number })
  companyId: number;

  @ApiProperty({ nullable: true, type: String })
  regimentoFilename: string | null;

  @ApiProperty({ nullable: true, type: Date })
  regimentoUploadedAt: Date | null;

  @ApiProperty({ nullable: true, type: Date })
  deletedAt: Date | null;
}

export class PaginatedCondominiumsDto {
  @ApiProperty({ type: [CondominiumResponseDto] })
  data: CondominiumResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
