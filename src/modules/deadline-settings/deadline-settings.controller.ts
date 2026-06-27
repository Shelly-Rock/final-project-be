import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DeadlineSettingsService } from './deadline-settings.service';
import { CreateDeadlineDto, UpdateDeadlineDto } from './deadline-settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Deadline Settings')
@Controller('deadline-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeadlineSettingsController {
  constructor(private deadlineService: DeadlineSettingsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Create a new deadline setting' })
  async create(@Body() createDto: CreateDeadlineDto) {
    return this.deadlineService.create(createDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Get all deadline settings' })
  async findAll(@Query('isActive') isActive?: string) {
    return this.deadlineService.findAll({
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get('active')
  @Roles(Role.ADMIN, Role.SECRETARY, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'Get active deadlines' })
  async findActive() {
    return this.deadlineService.findActive();
  }

  @Get('upcoming')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Get upcoming deadline warnings' })
  async checkUpcoming() {
    return this.deadlineService.checkUpcomingDeadlines();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Get deadline by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.deadlineService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Update deadline setting' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateDeadlineDto,
  ) {
    return this.deadlineService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete deadline setting' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.deadlineService.delete(id);
  }
}
