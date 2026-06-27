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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { RegistrationsService } from './registrations.service';
import {
  CreateRegistrationDto,
  BulkRegistrationDto,
  ApproveRegistrationDto,
  RejectRegistrationDto,
  RegistrationQueryDto,
} from './dto/registration.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, RegistrationStatus } from '@prisma/client';

@ApiTags('Registrations')
@Controller('registrations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@ApiHeader({ name: 'Authorization', description: 'Bearer JWT token', required: true })
export class RegistrationsController {
  constructor(private registrationsService: RegistrationsService) {}

  // ============== STUDENT ==============

  @Post()
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Register for a thesis topic' })
  async create(
    @Body() createDto: CreateRegistrationDto,
    @CurrentUser() user: any,
  ) {
    return this.registrationsService.create(createDto, user.id);
  }

  @Post('bulk')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Register for multiple topics (order choices)' })
  async bulkCreate(
    @Body() bulkDto: BulkRegistrationDto,
    @CurrentUser() user: any,
  ) {
    return this.registrationsService.bulkCreate(bulkDto, user.id);
  }

  @Get('my-registrations')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get my registrations' })
  async getMyRegistrations(@CurrentUser() user: any) {
    return this.registrationsService.findByStudent(user.id);
  }

  @Put(':id/cancel')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Cancel my registration' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.registrationsService.cancel(id, user.id);
  }

  // ============== TEACHER ==============

  @Get('topic-registrations/:topicId')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Get registrations for a topic' })
  async getTopicRegistrations(
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Query('status') status?: RegistrationStatus,
  ) {
    return this.registrationsService.findByTopic(topicId, { status });
  }

  @Put(':id/approve')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Approve a registration' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() approveDto: ApproveRegistrationDto,
    @CurrentUser() user: any,
  ) {
    return this.registrationsService.approve(id, user.id);
  }

  @Put(':id/reject')
  @Roles(Role.TEACHER, Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Reject a registration' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() rejectDto: RejectRegistrationDto,
    @CurrentUser() user: any,
  ) {
    return this.registrationsService.reject(id, user.id, rejectDto.reason);
  }

  // ============== ADMIN/SECRETARY ==============

  @Get()
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Get all registrations with filters' })
  async findAll(@Query() query: RegistrationQueryDto) {
    return this.registrationsService.findAll(query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SECRETARY, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'Get registration by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.registrationsService.findOne(id);
  }

  @Get('stats/overview')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Get registration statistics' })
  async getStats() {
    return this.registrationsService.getRegistrationStats();
  }

  @Put(':id/secretary-override')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Secretary override for registration' })
  async secretaryOverride(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { action: 'approve' | 'reject'; reason?: string },
    @CurrentUser() user: any,
  ) {
    return this.registrationsService.secretaryOverride(id, user.id, body.action, body.reason);
  }
}
