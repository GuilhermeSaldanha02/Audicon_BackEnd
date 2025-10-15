import { IsNotEmpty, IsString } from 'class-validator';

export class CreateUnitDto {
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsString()
  @IsNotEmpty()
  ownerName: string;
}
