import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../user/decorators/current-user.decorator';
import { UserResponseDto } from '../../user/dtos/user-response.dto';
import { RegisterDeviceDto } from '../dtos/register-device.dto';
import { TestNotificationDto } from '../dtos/test-notification.dto';
import { DeviceService } from '../services/device.service';
import { FirebaseService } from '../services/firebase.service';

@ApiTags('Firebase')
@Controller('firebase')
export class FirebaseController {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly deviceService: DeviceService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('devices/register')
  @ApiOperation({
    summary: 'Register or update the current user device token',
  })
  async registerDevice(@CurrentUser() user: UserResponseDto, @Body() dto: RegisterDeviceDto) {
    const device = await this.deviceService.registerOrUpdate(user.id, dto);

    return {
      success: true,
      deviceId: device.id,
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('devices/unregister')
  @ApiOperation({
    summary: 'Deactivate a device token for the current user',
  })
  async unregisterDevice(@CurrentUser() user: UserResponseDto, @Body() dto: RegisterDeviceDto) {
    if (dto.installationId) {
      await this.deviceService.deactivateOwnDeviceByInstallationId(user.id, dto.installationId);
    }

    await this.deviceService.deactivateOwnDeviceByToken(user.id, dto.fcmToken);

    return {
      success: true,
      userId: user.id,
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('test-notification')
  @ApiOperation({
    summary: 'Send a test push notification',
    description: 'Development endpoint used to verify Firebase Cloud Messaging integration.',
  })
  @ApiResponse({
    status: 201,
    description: 'Notification successfully accepted by Firebase.',
  })
  async testNotification(@CurrentUser() user: UserResponseDto, @Body() dto: TestNotificationDto) {
    const messageId = await this.firebaseService.sendToToken(dto.token, dto.title, dto.message);

    return {
      success: true,
      messageId,
    };
  }
}
