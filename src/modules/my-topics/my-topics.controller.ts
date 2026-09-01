import { Controller, Get, Post, Patch, Body, Param, ParseIntPipe, UseGuards, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MyTopicsService } from './my-topics.service';
import { CreateTopicDto, UpdateTopicDto, ApproveRegistrationDto, RejectRegistrationDto, LockTopicDto, UpdateAssignmentsDto } from './dto';
import { CurrentUser } from "../../core/auth/decorators/currentUser.decorator";

import { JwtAuthGuard } from "../../core/auth/guards/jwtAuth.guard"; 

@ApiTags('MyTopics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('topics')
export class MyTopicsController {
  constructor(private readonly myTopicsService: MyTopicsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách đề tài của tôi' })
  async getMyTopics(@CurrentUser('sub') userId: number) {
    return this.myTopicsService.getMyTopics(userId);
  }

  @Get('pending-requests')
  @ApiOperation({ summary: 'Lấy danh sách yêu cầu đăng ký đang chờ duyệt' })
  async getPendingRequests(@CurrentUser('sub') userId: number) {
    return this.myTopicsService.getPendingRequests(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo đề tài mới' })
  async createTopic(@CurrentUser('sub') userId: number, @Body() dto: CreateTopicDto) {
    return this.myTopicsService.createTopic(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một đề tài' })
  async getTopicDetail(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) topicId: number,
  ) {
    return this.myTopicsService.getTopicDetail(userId, topicId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin đề tài' })
  async updateTopic(
    @CurrentUser('sub') userId: number, 
    @Param('id', ParseIntPipe) topicId: number, 
    @Body() dto: UpdateTopicDto
  ) {
    return this.myTopicsService.updateTopic(topicId, userId, dto);
  }

  @Get(':topicId/students')
  @ApiOperation({ summary: 'Lấy danh sách sinh viên đăng ký vào đề tài' })
  async getRegisteredStudents(
    @CurrentUser('sub') userId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
  ) {
    return this.myTopicsService.getRegisteredStudents(userId, topicId);
  }
  
  @Post(':id/approve')
  @ApiOperation({ summary: 'Duyệt sinh viên đăng ký đề tài' })
  async approveRegistration(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) topicId: number,
    @Body() dto: ApproveRegistrationDto
  ) {
    return this.myTopicsService.approveRegistration(topicId, userId, dto);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Từ chối sinh viên đăng ký đề tài' })
  async rejectRegistration(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) topicId: number,
    @Body() dto: RejectRegistrationDto
  ) {
    return this.myTopicsService.rejectRegistration(topicId, userId, dto);
  }

  @Patch(':id/lock')
  @ApiOperation({ summary: 'Khóa đề tài và phân công nhiệm vụ' })
  async lockTopic(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) topicId: number,
    @Body() dto: LockTopicDto
  ) {
    return this.myTopicsService.lockTopic(topicId, userId, dto);
  }

  @Patch(':id/assignments')
  @ApiOperation({ summary: 'Cập nhật phân công nhiệm vụ khi đề tài đang khóa' })
  async updateAssignments(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) topicId: number,
    @Body() dto: UpdateAssignmentsDto,
  ) {
    return this.myTopicsService.updateAssignments(userId, topicId, dto);
  }

  @Patch(':id/unlock')
  @ApiOperation({ summary: 'Mở khóa đề tài' })
  async unlockTopic(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) topicId: number
  ) {
    return this.myTopicsService.unlockTopic(topicId, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa đề tài' })
  async deleteTopic(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) topicId: number,
  ) {
    return this.myTopicsService.deleteTopic(userId, topicId);
  }
  
}