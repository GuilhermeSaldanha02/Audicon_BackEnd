import { Controller, Post, UseGuards, Request, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }
    @UseGuards(LocalAuthGuard)
    @Post('login')
    async login(
    @Request()
    req: any) {
        return this.authService.login(req.user);
    }
    @UseGuards(JwtAuthGuard)
    @Get('profile')
    getProfile(
    @Request()
    req: any) {
        return req.user;
    }
}
