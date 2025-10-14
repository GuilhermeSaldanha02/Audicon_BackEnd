import { PartialType } from '@nestjs/mapped-types';
import { CreateCondominiumDto } from './create-condominium.dto';

export class UpdateCondominiumDto extends PartialType(CreateCondominiumDto) {}
