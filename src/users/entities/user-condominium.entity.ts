import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from './user.entity';
import { Condominium } from '../../condominiums/entities/condominium.entity';

@Entity('user_condominium')
@Unique(['userId', 'condominiumId'])
export class UserCondominium {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  condominiumId: number;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @ManyToOne(() => User, (user) => user.memberships, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Condominium, (condo) => condo.memberships, { onDelete: 'CASCADE' })
  condominium: Condominium;
}
