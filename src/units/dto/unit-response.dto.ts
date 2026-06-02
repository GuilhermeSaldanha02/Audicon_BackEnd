import { ApiProperty } from '@nestjs/swagger';

export class UnitResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  identifier: string;

  @ApiProperty()
  ownerName: string;

  @ApiProperty({ nullable: true, type: String })
  residentEmail: string | null;

  @ApiProperty({ nullable: true, type: String })
  residentPhone: string | null;

  @ApiProperty({ nullable: true, type: Date })
  deletedAt: Date | null;
}

export class PaginatedUnitsDto {
  @ApiProperty({ type: [UnitResponseDto] })
  data: UnitResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
