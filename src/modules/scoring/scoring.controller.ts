import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ScoringService } from './scoring.service';
import {
  CreateIndependentScoreDto,
  UpdateScoreDto,
  SubmitScoreDto,
  QueryScoresDto,
  QueryMyScoresDto,
  QueryMeetingsDto,
  AdjustMeetingScoreDto,
  QueryTranscriptsDto,
  UpdateBonusScoreDto,
  QueryPostDefenseDto,
  SetRevisionWindowDto,
  SubmitRevisionDto,
  UpdateRankDto,
} from './scoring.dto';
import { JwtAuthGuard } from '@core/auth/guards/jwtAuth.guard';
import { RolesGuard } from '@core/auth/guards/roles.guard';
import { Roles } from '@core/auth/decorators/roles.decorator';
import { CurrentUser } from '@core/auth/decorators/currentUser.decorator';

@ApiTags('Scoring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('scores')
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  private userId(req: { user: { sub?: number; id?: number } }) {
    return Number(req.user.sub ?? req.user.id);
  }

  // ============ TEACHER SCORING ============

  @Get('my')
  @Roles('TEACHER', 'ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Get my assigned scores (for teachers)' })
  async getMyScores(@Request() req, @Query() query: QueryMyScoresDto) {
    return this.scoringService.getMyScores(this.userId(req), query);
  }

  @Get('my/stats')
  @Roles('TEACHER', 'ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Get my scoring statistics' })
  async getMyStats(@Request() req) {
    return this.scoringService.getMyStats(this.userId(req));
  }

  @Get('my/:id')
  @Roles('TEACHER', 'ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Get my score by ID' })
  async getMyScore(@Request() req, @Param('id') id: string) {
    return this.scoringService.getScoreById(parseInt(id));
  }

  @Put('my/:id')
  @Roles('TEACHER', 'ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Update my score (draft)' })
  async updateMyScore(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateScoreDto,
  ) {
    return this.scoringService.updateScore(parseInt(id), this.userId(req), dto);
  }

  @Post('my/:id/submit')
  @Roles('TEACHER', 'ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Submit my score' })
  async submitMyScore(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: SubmitScoreDto,
  ) {
    return this.scoringService.submitScore(parseInt(id), this.userId(req), dto);
  }

  @Get('my/:id/export/word')
  @Roles('TEACHER', 'ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Export my score sheet to Word' })
  async exportMyScoreWord(
    @Request() req,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.scoringService.exportScoreSheetWord(
      parseInt(id),
      this.userId(req),
    );
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="Phieu_Cham_Diem_${id}.docx"`,
    });
    res.send(buffer);
  }

  // ============ ADMIN SCORING MANAGEMENT ============

  @Get('meetings')
  @Roles('ADMIN', 'SECRETARY', 'TEACHER')
  @ApiOperation({ summary: 'Danh sách đề tài họp hội đồng (Giai đoạn 5)' })
  async getMeetings(@Request() req, @Query() query: QueryMeetingsDto) {
    return this.scoringService.getMeetings(
      this.userId(req),
      req.user.role,
      query,
    );
  }

  @Get('meetings/:projectId')
  @Roles('ADMIN', 'SECRETARY', 'TEACHER')
  @ApiOperation({ summary: 'Chi tiết họp hội đồng theo đề tài' })
  async getMeeting(@Request() req, @Param('projectId') projectId: string) {
    return this.scoringService.getMeeting(
      parseInt(projectId),
      this.userId(req),
      req.user.role,
    );
  }

  @Put('meetings/:scoreId')
  @Roles('ADMIN', 'SECRETARY', 'TEACHER')
  @ApiOperation({
    summary: 'Sửa điểm hội đồng sau khi thống nhất (trước khi chốt)',
  })
  async adjustMeetingScore(
    @Request() req,
    @Param('scoreId') scoreId: string,
    @Body() dto: AdjustMeetingScoreDto,
  ) {
    return this.scoringService.adjustMeetingScore(
      parseInt(scoreId),
      this.userId(req),
      req.user.role,
      dto,
    );
  }

  @Post('meetings/:projectId/finalize')
  @Roles('ADMIN', 'SECRETARY', 'TEACHER')
  @ApiOperation({ summary: 'Chốt điểm hội đồng (OK)' })
  async finalizeMeeting(@Request() req, @Param('projectId') projectId: string) {
    return this.scoringService.finalizeMeeting(
      parseInt(projectId),
      this.userId(req),
      req.user.role,
    );
  }

  @Get('transcripts/me')
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Sinh viên xem bảng điểm đã công bố' })
  async getMyTranscript(@Request() req) {
    return this.scoringService.getMyTranscript(this.userId(req));
  }

  @Get('transcripts')
  @Roles('ADMIN', 'SECRETARY', 'TEACHER')
  @ApiOperation({ summary: 'Danh sách bảng điểm tổng hợp (Giai đoạn 6)' })
  async getTranscripts(@Request() req, @Query() query: QueryTranscriptsDto) {
    return this.scoringService.getTranscripts(
      this.userId(req),
      req.user.role,
      query,
    );
  }

  @Get('transcripts/:projectId')
  @Roles('ADMIN', 'SECRETARY', 'TEACHER')
  @ApiOperation({ summary: 'Chi tiết bảng điểm tổng hợp' })
  async getTranscript(
    @Request() req,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.scoringService.getTranscript(
      projectId,
      this.userId(req),
      req.user.role,
    );
  }

  @Put('transcripts/:projectId/bonus')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Thư ký hội đồng cộng điểm thưởng (tối đa 3)' })
  async updateBonusScore(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateBonusScoreDto,
  ) {
    return this.scoringService.updateBonusScore(
      parseInt(projectId),
      this.userId(req),
      req.user.role,
      dto,
    );
  }

  @Post('transcripts/:projectId/publish')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Công bố bảng điểm cho sinh viên' })
  async publishTranscript(
    @Request() req,
    @Param('projectId') projectId: string,
  ) {
    return this.scoringService.publishTranscript(
      parseInt(projectId),
      this.userId(req),
      req.user.role,
    );
  }

  // ============ GIAI ĐOẠN 7: HẬU KIỂM VÀ XẾP HẠNG ============

  @Get('post-defense')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Danh sách xếp hạng sau bảo vệ (Giai đoạn 7)' })
  async getPostDefense(@Request() req, @Query() query: QueryPostDefenseDto) {
    return this.scoringService.getPostDefenseList(
      this.userId(req),
      req.user.role,
      query,
    );
  }

  @Post('post-defense/rank')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Thư ký hệ thống xếp hạng theo điểm tổng' })
  async computeRankings(@Request() req) {
    return this.scoringService.computeRankings(this.userId(req), req.user.role);
  }

  @Get('post-defense/print')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Bảng điểm lưu trữ học vụ (in biểu mẫu)' })
  async getPrintSheet(@Request() req) {
    return this.scoringService.getPrintSheet(this.userId(req), req.user.role);
  }

  @Put('post-defense/:projectId/revision-window')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Đặt hạn chỉnh sửa hồ sơ cho đề tài' })
  async setRevisionWindow(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() dto: SetRevisionWindowDto,
  ) {
    return this.scoringService.setRevisionWindow(
      parseInt(projectId),
      this.userId(req),
      req.user.role,
      dto,
    );
  }

  @Put('post-defense/:projectId/rank')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Xếp hạng thủ công khi đồng điểm' })
  async updateRank(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateRankDto,
  ) {
    return this.scoringService.updateRank(
      parseInt(projectId),
      this.userId(req),
      req.user.role,
      dto,
    );
  }

  @Get('revisions/me')
  @Roles('STUDENT')
  @ApiOperation({ summary: 'Sinh viên xem hạn và bản chỉnh sửa hồ sơ' })
  async getMyRevision(@Request() req) {
    return this.scoringService.getMyRevision(this.userId(req));
  }

  @Post('revisions/me')
  @Roles('STUDENT')
  @ApiOperation({
    summary: 'Sinh viên nộp hồ sơ chỉnh sửa theo nhận xét hội đồng',
  })
  async submitRevision(@Request() req, @Body() dto: SubmitRevisionDto) {
    return this.scoringService.submitRevision(this.userId(req), dto);
  }

  @Get()
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Get all scores (admin)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({
    name: 'scoringType',
    enum: ['GVHD', 'COMMITTEE'],
    required: false,
  })
  @ApiQuery({
    name: 'status',
    enum: ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'FAILED', 'PASSED'],
    required: false,
  })
  @ApiQuery({ name: 'teacherId', required: false })
  @ApiQuery({ name: 'projectId', required: false })
  async getAllScores(@Query() query: QueryScoresDto) {
    return this.scoringService.getScores(query);
  }

  @Get('results')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Get all scoring results (admin)' })
  async getAllResults(@Query() query: QueryScoresDto) {
    return this.scoringService.getAllScoringResults(query);
  }

  @Get('results/:projectId')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Get scoring result by project ID' })
  async getResultByProject(@Param('projectId') projectId: string) {
    return this.scoringService.getScoringResult(parseInt(projectId));
  }

  @Get('project/:projectId')
  @Roles('ADMIN', 'SECRETARY', 'TEACHER')
  @ApiOperation({ summary: 'Get all scores for a project' })
  async getScoresByProject(@Param('projectId') projectId: string) {
    return this.scoringService.getScoresByProject(parseInt(projectId));
  }

  @Get(':id')
  @Roles('ADMIN', 'SECRETARY', 'TEACHER')
  @ApiOperation({ summary: 'Get score by ID' })
  async getScore(@Param('id') id: string) {
    return this.scoringService.getScoreById(parseInt(id));
  }

  @Post()
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Create a new score assignment' })
  async createScore(@Body() dto: CreateIndependentScoreDto) {
    return this.scoringService.createScore(dto);
  }

  @Put(':id')
  @Roles('ADMIN', 'SECRETARY', 'TEACHER')
  @ApiOperation({ summary: 'Update a score' })
  async updateScore(@Param('id') id: string, @Body() dto: UpdateScoreDto) {
    return this.scoringService.updateScore(parseInt(id), 0, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({ summary: 'Delete a score' })
  async deleteScore(@Param('id') id: string) {
    return this.scoringService.deleteScore(parseInt(id));
  }

  // ============ COMMITTEE SCORE ASSIGNMENT ============

  @Post('assign/:sessionProjectId')
  @Roles('ADMIN', 'SECRETARY')
  @ApiOperation({
    summary: 'Assign scores to committee members for a defense session',
  })
  async assignScoresToCommittee(
    @Param('sessionProjectId') sessionProjectId: string,
    @Body('committeeId') committeeId: number,
  ) {
    return this.scoringService.assignScoresToCommittee(
      parseInt(sessionProjectId),
      committeeId,
    );
  }
}
