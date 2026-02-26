import { Controller, Get, Param, Query } from '@nestjs/common';
import { BarsService } from './bars.service';

@Controller('bars')
export class BarsController {
  constructor(private readonly barsService: BarsService) {}

  @Get()
  async findAll(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.barsService.findAll(cursor, parsedLimit);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.barsService.findOne(id);
  }
}
