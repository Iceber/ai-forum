import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { RejectBarDto } from './dto/reject-bar.dto';
import { SuspendBarDto } from './dto/suspend-bar.dto';
import { BanBarDto } from './dto/ban-bar.dto';
import { CloseBarDto } from './dto/close-bar.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('bars')
  async findAllBars(
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.adminService.findAllBars(status, cursor, parsedLimit);
  }

  @Post('bars/:id/approve')
  async approveBar(@Param('id') id: string, @CurrentUser() user: User) {
    return this.adminService.approveBar(id, user.id);
  }

  @Post('bars/:id/reject')
  async rejectBar(
    @Param('id') id: string,
    @Body() dto: RejectBarDto,
    @CurrentUser() user: User,
  ) {
    return this.adminService.rejectBar(id, user.id, dto.reason);
  }

  @Post('bars/:id/suspend')
  async suspendBar(
    @Param('id') id: string,
    @Body() dto: SuspendBarDto,
    @CurrentUser() user: User,
  ) {
    return this.adminService.suspendBar(id, user.id, dto.reason, dto.duration);
  }

  @Post('bars/:id/unsuspend')
  async unsuspendBar(@Param('id') id: string, @CurrentUser() user: User) {
    return this.adminService.unsuspendBar(id, user.id);
  }

  @Post('bars/:id/ban')
  async banBar(
    @Param('id') id: string,
    @Body() dto: BanBarDto,
    @CurrentUser() user: User,
  ) {
    return this.adminService.banBar(id, user.id, dto.reason);
  }

  @Post('bars/:id/close')
  async closeBar(
    @Param('id') id: string,
    @Body() dto: CloseBarDto,
    @CurrentUser() user: User,
  ) {
    return this.adminService.closeBar(id, user.id, dto.reason);
  }

  @Get('actions')
  async findAllActions(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.adminService.findAllActions(cursor, parsedLimit);
  }
}
