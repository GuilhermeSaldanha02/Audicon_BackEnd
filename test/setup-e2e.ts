// Polyfill global crypto for Nest TypeORM utils during e2e tests
import * as crypto from 'crypto';
(globalThis as any).crypto = crypto as any;

// NestJS app init can be slow on Windows; 15 s covers all suites.
jest.setTimeout(15000);
