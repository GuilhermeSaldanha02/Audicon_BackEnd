import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateUnitDto {
  @ApiProperty({ example: 'A-101' })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({ example: 'João da Silva' })
  @IsString()
  @IsNotEmpty()
  ownerName: string;
}
