import { PartialType } from '@nestjs/mapped-types';
import { CreateInfractionDto } from './create-infraction.dto';

export class UpdateInfractionDto extends PartialType(CreateInfractionDto) {}
