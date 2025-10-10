// Polyfill global crypto for Nest TypeORM utils during e2e tests
import * as crypto from 'crypto';
(globalThis as any).crypto = crypto as any;
