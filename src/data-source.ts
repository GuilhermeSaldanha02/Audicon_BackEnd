import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Condominium } from './condominiums/entities/condominium.entity';
import { Unit } from './units/entities/unit.entity';
import { Infraction } from './infractions/entities/infraction.entity';
import { User } from './users/entities/user.entity';

const appDataSourceOptions = {
  type: 'postgres' as const,
  host: process.env.DB_HOST || 'localhost',
  port: +(process.env.DB_PORT || 5432),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'audicon',
  entities: [Condominium, Unit, Infraction, User],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: false,
};

export const AppDataSource = new DataSource(appDataSourceOptions);

export default AppDataSource;