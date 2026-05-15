import { IsEmail, IsEnum } from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';

export class AddMemberDto {
  @IsEmail()
  email: string;

  @IsEnum(UserRole)
  role: UserRole;
}
