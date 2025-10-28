import { IsNotEmpty, IsString } from 'class-validator';
export class CreateCondominiumDto {
    @IsString()
    @IsNotEmpty()
    name: string;
    @IsString()
    @IsNotEmpty()
    cnpj: string;
    @IsString()
    @IsNotEmpty()
    address: string;
}
