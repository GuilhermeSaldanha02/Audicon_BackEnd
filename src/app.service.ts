import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  getStatus() {
    return {
      status: 'online',
      environment: this.configService.get('NODE_ENV') || 'development',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
