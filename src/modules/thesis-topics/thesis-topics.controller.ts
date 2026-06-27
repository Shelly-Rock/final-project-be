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
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { ThesisTopicsService } from './thesis-topics.service';
import {
  CreateThesisTopicDto,
  UpdateThesisTopicDto,
  ThesisTopicQueryDto,
  ApproveTopicDto,
  RejectTopicDto,
  SetDeadlineDto,
  BulkAssignTopicsDto,
} from './dto/thesis-topic.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, TopicStatus } from '@prisma/client';
import { ExcelService } from '../excel/excel.service';

@ApiTags('Thesis Topics')
@Controller('thesis-topics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@ApiHeader({ name: 'Authorization', description: 'Bearer JWT token', required: true })
export class ThesisTopicsController {
  constructor(
    private thesisTopicsService: ThesisTopicsService,
    private excelService: ExcelService,
  ) {}

  // ============== CRUD ==============

  @Post()
  @Roles(Role.ADMIN, Role.SECRETARY, Role.TEACHER)
  @ApiOperation({ summary: 'Create a new thesis topic' })
  async create(
    @Body() createDto: CreateThesisTopicDto,
    @CurrentUser() user: any,
  ) {
    return this.thesisTopicsService.create(createDto, user.id);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SECRETARY, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'Get all thesis topics with filters' })
  async findAll(@Query() query: ThesisTopicQueryDto) {
    return this.thesisTopicsService.findAll(query);
  }

  @Get('my-topics')
  @Roles(Role.TEACHER)
  @ApiOperation({ summary: 'Get topics supervised by current teacher' })
  async getMyTopics(@CurrentUser() user: any, @Query('status') status?: TopicStatus) {
    return this.thesisTopicsService.findBySupervisor(user.id, { status });
  }

  @Get('pending-approval')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Get topics pending approval' })
  async getPendingApproval() {
    return this.thesisTopicsService.getPendingApproval();
  }

  @Get('available')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Get available topics for student registration' })
  async getAvailableTopics(@Query() query: ThesisTopicQueryDto) {
    return this.thesisTopicsService.findAll({
      ...query,
      status: TopicStatus.APPROVED,
    });
  }

  @Get('upcoming-deadlines')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Get topics with upcoming deadlines' })
  async getUpcomingDeadlines(@Query('warningDays') warningDays?: number) {
    return this.thesisTopicsService.getUpcomingDeadlines(warningDays || 3);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SECRETARY, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'Get thesis topic by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.thesisTopicsService.findOne(id);
  }

  @Get('code/:code')
  @Roles(Role.ADMIN, Role.SECRETARY, Role.TEACHER)
  @ApiOperation({ summary: 'Get thesis topic by code' })
  async findByCode(@Param('code') code: string) {
    return this.thesisTopicsService.findByCode(code);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.SECRETARY, Role.TEACHER)
  @ApiOperation({ summary: 'Update thesis topic' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateThesisTopicDto,
    @CurrentUser() user: any,
  ) {
    return this.thesisTopicsService.update(id, updateDto, user.id, user.role);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Delete thesis topic' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.thesisTopicsService.delete(id);
  }

  // ============== APPROVAL FLOW ==============

  @Put(':id/approve')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Approve thesis topic' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() approveDto: ApproveTopicDto,
    @CurrentUser() user: any,
  ) {
    return this.thesisTopicsService.approve(id, user.id);
  }

  @Put(':id/reject')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Reject thesis topic' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() rejectDto: RejectTopicDto,
  ) {
    return this.thesisTopicsService.reject(id, rejectDto.reason, rejectDto.reason);
  }

  @Put(':id/close')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Close thesis topic' })
  async close(@Param('id', ParseUUIDPipe) id: string) {
    return this.thesisTopicsService.close(id);
  }

  // ============== BULK OPERATIONS ==============

  @Put('bulk-assign')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Bulk assign supervisors to topics' })
  async bulkAssign(@Body() bulkDto: BulkAssignTopicsDto) {
    return this.thesisTopicsService.bulkAssignSupervisors(bulkDto.assignments);
  }

  @Post('close-expired')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Close all expired topics' })
  async closeExpired() {
    return this.thesisTopicsService.closeExpiredTopics();
  }

  // ============== EXPORT ==============

  @Get('export/excel')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Export topics to Excel' })
  async exportToExcel(@Query() query: ThesisTopicQueryDto) {
    const { data } = await this.thesisTopicsService.findAll({ ...query, take: 1000 });
    const topics = data.map((topic) => ({
      code: topic.code,
      title: topic.title,
      supervisor: topic.supervisor.name || topic.supervisor.email,
      status: topic.status,
      maxStudents: topic.maxStudents,
      registeredCount: (topic as any).registeredCount || 0,
      deadline: topic.deadline,
    }));
    return this.excelService.exportTopicsToExcel(topics);
  }
}
