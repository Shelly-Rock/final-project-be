import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@core/auth/guards/jwtAuth.guard';
import { RolesGuard } from '@core/auth/guards/roles.guard';
import { Roles } from '@core/auth/decorators/roles.decorator';
import { CurrentUser } from '@core/auth/decorators/currentUser.decorator';
import { AdminConfigService } from './admin-config.service';
import { AlertDispatchService } from './alert-dispatch.service';
import {
  AlertLogsQueryDto,
  DeleteTeacherOverrideQueryDto,
  ListTeacherOverridesQueryDto,
  SendDeadlineAlertsDto,
  UpdateGovernanceConfigDto,
  UpsertTeacherOverridesDto,
} from './dto';

@ApiTags('Project Governance Config')
@Controller('admin/configs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SECRETARY')
export class AdminConfigController {
  constructor(
    private readonly adminConfigService: AdminConfigService,
    private readonly alertDispatchService: AlertDispatchService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy cấu hình quản trị theo đợt đồ án' })
  getConfig(@Query('periodId', ParseIntPipe) periodId: number) {
    return this.adminConfigService.getConfig(periodId);
  }

  @Put()
  @ApiOperation({ summary: 'Cập nhật cấu hình và các deadline của đợt' })
  updateConfig(
    @Body() dto: UpdateGovernanceConfigDto,
    @CurrentUser('sub') actorUserId: number,
  ) {
    return this.adminConfigService.updateConfig(dto, actorUserId);
  }

  @Get('teacher-overrides')
  @ApiOperation({ summary: 'Danh sách chỉ tiêu hiệu lực và ghi đè theo GV' })
  listTeacherOverrides(@Query() query: ListTeacherOverridesQueryDto) {
    return this.adminConfigService.listTeacherOverrides(query);
  }

  @Put('teacher-overrides')
  @ApiOperation({ summary: 'Ghi đè chỉ tiêu cho một hoặc nhiều GV' })
  upsertTeacherOverrides(
    @Body() dto: UpsertTeacherOverridesDto,
    @CurrentUser('sub') actorUserId: number,
  ) {
    return this.adminConfigService.upsertTeacherOverrides(dto, actorUserId);
  }

  @Delete('teacher-overrides/:teacherId')
  @ApiOperation({ summary: 'Đưa chỉ tiêu GV về cấu hình mặc định của đợt' })
  deleteTeacherOverride(
    @Param('teacherId', ParseIntPipe) teacherId: number,
    @Query() query: DeleteTeacherOverrideQueryDto,
  ) {
    return this.adminConfigService.deleteTeacherOverride(teacherId, query);
  }

  @Post('send-alerts')
  @ApiOperation({ summary: 'Gửi deadline alert thủ công, có chống trùng' })
  sendAlerts(@Body() dto: SendDeadlineAlertsDto) {
    return this.alertDispatchService.sendManual(dto);
  }

  @Get('alert-logs')
  @ApiOperation({ summary: 'Lịch sử và trạng thái gửi deadline alert' })
  listAlertLogs(@Query() query: AlertLogsQueryDto) {
    return this.adminConfigService.listAlertLogs(query);
  }
}
