import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ApproveInfractionDto {
  @ApiPropertyOptional({
    description:
      'Optional override of the AI-generated formal description before approval.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  formalDescription?: string;

  @ApiPropertyOptional({
    description:
      'Optional override of the AI-suggested penalty before approval.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  suggestedPenalty?: string;
}
