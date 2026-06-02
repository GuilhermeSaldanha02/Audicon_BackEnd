import { ApiProperty } from '@nestjs/swagger';

export enum InfractionStatusEnum {
  PENDING = 'pending',
  ANALYZED = 'analyzed',
  APPROVED = 'approved',
  SENT = 'sent',
}

export class InfractionResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  description: string;

  @ApiProperty({ nullable: true, type: String })
  formalDescription: string | null;

  @ApiProperty({ nullable: true, type: String })
  suggestedPenalty: string | null;

  @ApiProperty({ enum: InfractionStatusEnum })
  status: InfractionStatusEnum;

  @ApiProperty()
  occurrenceDate: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ nullable: true, type: Date })
  approvedAt: Date | null;

  @ApiProperty({ nullable: true, type: Date })
  sentAt: Date | null;

  @ApiProperty({ nullable: true, type: Date })
  whatsappSentAt: Date | null;

  @ApiProperty({ nullable: true, type: Date })
  deletedAt: Date | null;
}

export class PaginatedInfractionsDto {
  @ApiProperty({ type: [InfractionResponseDto] })
  data: InfractionResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
