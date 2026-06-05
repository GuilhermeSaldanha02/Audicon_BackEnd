import 'reflect-metadata';
import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { AuditLog } from './audit/entities/audit-log.entity';
import { Company } from './companies/entities/company.entity';
import { Condominium } from './condominiums/entities/condominium.entity';
import { Unit } from './units/entities/unit.entity';
import { Infraction } from './infractions/entities/infraction.entity';
import { InfractionImage } from './infractions/entities/infraction-image.entity';
import { User } from './users/entities/user.entity';
import { requireEnv, requireEnvInt } from './common/config/require-env';

const appDataSourceOptions = {
  type: 'postgres' as const,
  host: requireEnv('DB_HOST'),
  port: requireEnvInt('DB_PORT'),
  username: requireEnv('DB_USERNAME'),
  password: requireEnv('DB_PASSWORD'),
  database: requireEnv('DB_DATABASE'),
  entities: [
    AuditLog,
    Company,
    Condominium,
    Unit,
    Infraction,
    InfractionImage,
    User,
  ],
  // Resolvido via __dirname para funcionar nos dois mundos (caminho A do R-14):
  // dev/ts-node → __dirname=src → casa *.ts; prod/compilado → __dirname=dist →
  // casa *.js. Sem isso, rodar do dist/data-source.js tenta require um .ts (falha
  // sem ts-node) ou, no runner sem src/, casa zero migrations (no-op silencioso).
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: false,
};

export const AppDataSource = new DataSource(appDataSourceOptions);
