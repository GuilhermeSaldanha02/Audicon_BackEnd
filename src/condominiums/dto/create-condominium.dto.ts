import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateCondominiumDto {
  @ApiProperty({ example: 1, description: 'ID da empresa dona do condomínio' })
  @IsInt()
  companyId: number;

  @ApiProperty({ example: 'Condomínio Jardim das Flores' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '12345678000195' })
  @IsString()
  @IsNotEmpty()
  cnpj: string;

  @ApiProperty({ example: 'Rua das Acácias, 100 - São Paulo, SP' })
  @IsString()
  @IsNotEmpty()
  address: string;
}
