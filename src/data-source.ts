import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Condominium } from './condominiums/entities/condominium.entity';
import { Unit } from './units/entities/unit.entity';
import { Infraction } from './infractions/entities/infraction.entity';
import { InfractionImage } from './infractions/entities/infraction-image.entity';
import { User } from './users/entities/user.entity';
import { UserCondominium } from './users/entities/user-condominium.entity';
import { requireEnv, requireEnvInt } from './common/config/require-env';

const appDataSourceOptions = {
  type: 'postgres' as const,
  host: requireEnv('DB_HOST'),
  port: requireEnvInt('DB_PORT'),
  username: requireEnv('DB_USERNAME'),
  password: requireEnv('DB_PASSWORD'),
  database: requireEnv('DB_DATABASE'),
  entities: [
    Condominium,
    Unit,
    Infraction,
    InfractionImage,
    User,
    UserCondominium,
  ],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: false,
};

export const AppDataSource = new DataSource(appDataSourceOptions);
