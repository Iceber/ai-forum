import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bar } from '../bars/bar.entity';
import { AdminAction } from './admin-action.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { BarsModule } from '../bars/bars.module';

@Module({
  imports: [TypeOrmModule.forFeature([Bar, AdminAction]), BarsModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
