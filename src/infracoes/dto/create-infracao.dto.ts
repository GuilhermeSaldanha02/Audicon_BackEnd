import { IsNotEmpty, IsString } from 'class-validator';

export class CreateInfracaoDto {
  @IsString()
  @IsNotEmpty()
  descricao: string;
}