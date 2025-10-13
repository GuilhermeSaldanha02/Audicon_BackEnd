import { PartialType } from '@nestjs/mapped-types';
import { CreateInfracaoDto } from './create-infracao.dto';

export class UpdateInfracaoDto extends PartialType(CreateInfracaoDto) {}