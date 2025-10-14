import { IsNotEmpty, IsString } from 'class-validator';

export class CreateInfractionDto {
  @IsString()
  @IsNotEmpty()
  description: string;
}