import { IsNotEmpty, IsString } from 'class-validator';

export class CreateUnidadeDto {
  @IsString()
  @IsNotEmpty()
  identificador: string;

  @IsString()
  @IsNotEmpty()
  proprietario_nome: string;
}