import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { BarsService } from './bars.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateBarDto } from './dto/create-bar.dto';
import { UpdateBarDto } from './dto/update-bar.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { TransferOwnerDto } from './dto/transfer-owner.dto';
import { User } from '../users/user.entity';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';

@Controller('bars')
export class BarsController {
  constructor(private readonly barsService: BarsService) {}

  @UseGuards(OptionalAuthGuard)
  @Get()
  async findAll(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Req() req?: any,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const userId = req?.user?.id ?? undefined;
    return this.barsService.findAll(cursor, parsedLimit, userId);
  }

  @UseGuards(OptionalAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req?: any) {
    const userId = req?.user?.id ?? undefined;
    return this.barsService.findOne(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreateBarDto, @CurrentUser() user: User) {
    return this.barsService.create(dto, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/join')
  async join(@Param('id') id: string, @CurrentUser() user: User) {
    return this.barsService.join(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/leave')
  async leave(@Param('id') id: string, @CurrentUser() user: User) {
    return this.barsService.leave(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBarDto,
    @CurrentUser() user: User,
  ) {
    return this.barsService.updateBar(id, dto, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/members')
  async getMembers(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.barsService.getMembers(id, user.id, cursor, parsedLimit, role);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/members/:userId/role')
  async changeRole(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Body() dto: ChangeRoleDto,
    @CurrentUser() user: User,
  ) {
    return this.barsService.changeRole(id, targetUserId, dto.role, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/transfer')
  async transfer(
    @Param('id') id: string,
    @Body() dto: TransferOwnerDto,
    @CurrentUser() user: User,
  ) {
    return this.barsService.transferOwnership(id, dto.targetUserId, user.id);
  }
}
