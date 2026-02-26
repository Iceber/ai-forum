import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bar } from './bar.entity';
import { BarMember } from './bar-member.entity';
import { BarsService } from './bars.service';
import { BarsController } from './bars.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Bar, BarMember])],
  providers: [BarsService],
  controllers: [BarsController],
  exports: [BarsService],
})
export class BarsModule {}
