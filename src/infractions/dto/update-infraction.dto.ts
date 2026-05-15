import { PartialType } from '@nestjs/swagger';
import { CreateInfractionDto } from './create-infraction.dto';

export class UpdateInfractionDto extends PartialType(CreateInfractionDto) {}
