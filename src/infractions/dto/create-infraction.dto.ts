import { IsNotEmpty, IsString, IsInt } from 'class-validator';
export class CreateInfractionDto {
    @IsString()
    @IsNotEmpty()
    description: string;
    @IsInt()
    @IsNotEmpty()
    unitId: number;
}
