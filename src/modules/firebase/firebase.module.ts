import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserDevice } from './entities/device.entity';
import { FirebaseService } from './services/firebase.service';
import { FirebaseController } from './controllers/firebase.controller';
import { DeviceService } from './services/device.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserDevice])],
  controllers: [FirebaseController],
  providers: [FirebaseService, DeviceService],
  exports: [FirebaseService, DeviceService],
})
export class FirebaseModule {}
