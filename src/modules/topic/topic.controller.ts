import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put, Delete,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '@core/auth/guards/jwtAuth.guard';
import { RolesGuard } from '@core/auth/guards/roles.guard';
import { Roles } from '@core/auth/decorators/roles.decorator';
import { Public } from '@core/auth/decorators/public.decorator';
import { CurrentUser } from '@core/auth/decorators/currentUser.decorator';
import { TopicService } from './topic.service';
import {
  BulkModerationDto,
  CreateSupplementalTopicDto,
  CreateTopicDto,
  ForceUpdateTopicDto,
  GenerateTopicCodesDto,
  ManualAssignDto,
  RegistrationDecisionDto,
  SearchPeriodEntityQueryDto,
  TopicAvailableQueryDto,
  TopicManageQueryDto,
  UpdateTopicDto,
} from './dto';

@ApiTags('Topics â€” Governance')
@Controller('topics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TopicController {
  constructor(private readonly topicService: TopicService) {}

  // ── Governance state: mọi role đã đăng nhập ──────────────────

  @Get('governance-state')
  @Public()
  @ApiOperation({ summary: 'Trạng thái governance của đợt (deadline, quota, trạng thái stage)' })
  getGovernanceState(@Query('periodId') periodId?: string) {
    const parsed = periodId ? Number(periodId) : undefined;
    return this.topicService.getGovernanceState(
      Number.isFinite(parsed as number) ? (parsed as number) : undefined,
    );
  }

  // ── Quản trị: danh sách hợp nhất ─────────────────────────────

  @Get('manage')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Danh sách đề tài hợp nhất (lọc, tìm kiếm, phân trang server)' })
  listManaged(@Query() query: TopicManageQueryDto) {
    return this.topicService.listManaged(query);
  }

  @Get('manage/export')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Xuất Excel danh sách đề tài theo bộ lọc hiện tại' })
  async exportManaged(
    @Query() query: TopicManageQueryDto,
    @Res() res: Response,
  ) {
    const file = await this.topicService.exportManaged(query);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${file.fileName}"`,
      'Content-Length': String(file.buffer.length),
    });
    res.send(file.buffer);
  }

  @Get('manage/students-without-topic')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Sinh viên chưa có đề tài (phục vụ gán trực tiếp)' })
  listStudentsWithoutTopic(@Query() query: SearchPeriodEntityQueryDto) {
    return this.topicService.listStudentsWithoutTopic(query);
  }

  @Get('manage/teachers-with-quota')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Giảng viên còn chỉ tiêu (phục vụ tạo đề tài bổ sung)' })
  listTeachersWithQuota(@Query() query: SearchPeriodEntityQueryDto) {
    return this.topicService.listTeachersWithQuota(query);
  }

  // ── Quản trị: can thiệp có audit ─────────────────────────────

  @Post('manual-assign')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Gán trực tiếp sinh viên vào đề tài (bắt buộc lý do)' })
  manualAssign(
    @Body() dto: ManualAssignDto,
    @CurrentUser('sub') actorUserId: number,
  ) {
    return this.topicService.manualAssign(dto, actorUserId);
  }

  @Put(':id/force-update')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Chỉnh sửa cưỡng bức đề tài sau deadline (bắt buộc lý do, ghi audit)' })
  forceUpdate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ForceUpdateTopicDto,
    @CurrentUser('sub') actorUserId: number,
  ) {
    return this.topicService.forceUpdate(id, dto, actorUserId);
  }

  @Post('bulk-moderation')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Duyệt / từ chối hàng loạt đề tài' })
  bulkModeration(
    @Body() dto: BulkModerationDto,
    @CurrentUser('sub') actorUserId: number,
  ) {
    return this.topicService.bulkModeration(dto, actorUserId);
  }

  @Post('supplemental')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Tạo đề tài bổ sung (quá deadline vẫn cho phép, kiểm tra quota)' })
  createSupplemental(
    @Body() dto: CreateSupplementalTopicDto,
    @CurrentUser('sub') actorUserId: number,
  ) {
    return this.topicService.createSupplemental(dto, actorUserId);
  }

  @Post('generate-codes')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Sinh mã đề tài DT{year}_{DEPT}_{seq} hàng loạt' })
  generateCodes(
    @Body() dto: GenerateTopicCodesDto,
    @CurrentUser('sub') actorUserId: number,
  ) {
    return this.topicService.generateCodes(dto, actorUserId);
  }

  @Get(':id/audits')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Lịch sử can thiệp (force-update, bulk, gán, sinh mã)' })
  listAudits(@Param('id', ParseIntPipe) id: number) {
    return this.topicService.listAudits(id);
  }

  // ── Sinh viên (đặt trước :id để không nuốt 'available') ─────

  @Get('available')
  @Public()
  @ApiOperation({ summary: 'Đề tài còn chỗ cho sinh viên đăng ký' })
  listAvailable(
    @Query() query: TopicAvailableQueryDto,
    @CurrentUser('sub') actorUserId?: number,
  ) {
    return this.topicService.listAvailableTopics(query, actorUserId);
  }

  @Get('my-registration')
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Đăng ký hiện tại của sinh viên' })
  getMyRegistration(@CurrentUser('sub') actorUserId: number) {
    return this.topicService.getMyRegistration(actorUserId);
  }

  @Post(':id/registrations')
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Sinh viên đăng ký đề tài' })
  registerTopic(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub') actorUserId: number,
  ) {
    return this.topicService.registerTopic(id, actorUserId);
  }

  @Delete(':id/registrations')
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Sinh viên hủy đăng ký đề tài' })
  cancelRegistration(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub') actorUserId: number,
  ) {
    return this.topicService.cancelRegistration(id, actorUserId);
  }

  @Post(':id/lock-with-assignments')
  @Roles('TEACHER', 'ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Khóa đề tài và chốt danh sách' })
  lockWithAssignments(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub') actorUserId: number,
    @Body('assignments') assignments: { projectId: number; assignedTask: string; isLeader: boolean }[],
  ) {
    return this.topicService.lockWithAssignments(id, actorUserId, assignments);
  }

  @Put(':id/change-leader')
  @Roles('TEACHER', 'ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Đổi trưởng nhóm' })
  changeLeader(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub') actorUserId: number,
    @Body('projectId') projectId: number,
  ) {
    return this.topicService.changeLeader(id, actorUserId, projectId);
  }


  @Get('mine')
  @Roles('TEACHER', 'ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Đề tài của giảng viên hiện tại' })
  listMine(
    @CurrentUser('sub') actorUserId: number,
    @Query('periodId') periodId?: string,
  ) {
    const parsed = periodId ? Number(periodId) : undefined;
    return this.topicService.listMyTopics(
      actorUserId,
      Number.isFinite(parsed as number) ? (parsed as number) : undefined,
    );
  }

  @Post(':id/approvals/:projectId')
  @Roles('TEACHER', 'ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Giảng viên duyệt / từ chối đăng ký' })
  decideRegistration(
    @Param('id', ParseIntPipe) topicId: number,
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: RegistrationDecisionDto,
    @CurrentUser('sub') actorUserId: number,
  ) {
    return this.topicService.decideRegistration(
      topicId,
      projectId,
      dto,
      actorUserId,
    );
  }

  @Post()
  @Roles('TEACHER', 'ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Giảng viên tạo đề tài (kiểm tra quota + deadline + số lượng)' })
  createTopic(
    @Body() dto: CreateTopicDto,
    @CurrentUser('sub') actorUserId: number,
  ) {
    return this.topicService.createTopic(dto, actorUserId);
  }

  @Put(':id')
  @Roles('TEACHER', 'ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Giảng viên cập nhật đề tài của mình' })
  updateTopic(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTopicDto,
    @CurrentUser('sub') actorUserId: number,
  ) {
    return this.topicService.updateTopic(id, dto, actorUserId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết đề tài' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.topicService.findOne(id);
  }
}

