import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dtos/login.dto';
import { FirebaseAuthGuard } from 'src/common/guards/firebase-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Post('login')
	async login(@Body() dto: LoginDto) {
		return this.authService.login(dto);
	}

	@UseGuards(FirebaseAuthGuard)
	@Get('me')
	async me(@CurrentUser() user: any) {
		
		return this.authService.getMe(user.email);
	}
}
