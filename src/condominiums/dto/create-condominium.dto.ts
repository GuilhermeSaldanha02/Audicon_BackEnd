import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCondominiumDto {
  @ApiProperty({
    required: false,
    example: 1,
    description:
      'ID da empresa dona do condomínio. Obrigatório para master; ' +
      'ignorado para gerente (usa sempre a própria empresa, do token).',
  })
  @IsOptional()
  @IsInt()
  companyId?: number;

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
