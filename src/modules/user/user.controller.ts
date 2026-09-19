import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserReqDTO } from './dto/request/createUserREQ.dto';
import { UpdateUserReqDTO } from './dto/request/updateUserREQ.dto';
import { UserRespDTO } from './dto/response/userRESP.dto';
import { JwtAuthGuard } from '@/core/auth/guards/jwtAuth.guard';
import { Permissions } from '@/core/auth/decorators/permissions.decorator';
import { CurrentUser } from '@/core/auth/decorators/currentUser.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('user:create')
  @ApiOperation({ summary: 'Tạo user mới' })
  @ApiCreatedResponse({ type: UserRespDTO })
  async create(
    @Body() dto: CreateUserReqDTO,
    @CurrentUser('sub') actorUserId: number,
  ): Promise<UserRespDTO> {
    return this.userService.create(dto, actorUserId);
  }

  @Get()
  @Permissions('user:read')
  @ApiOperation({ summary: 'Lấy danh sách users (phân trang)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'includeDeleted', required: false, example: false })
  @ApiOkResponse({ description: 'Danh sách users' })
  async findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    const includeDeletedBool = includeDeleted === 'true';
    return this.userService.findAll(page, limit, includeDeletedBool);
  }

  @Get(':id')
  @Permissions('user:read')
  @ApiOperation({ summary: 'Lấy thông tin user theo ID' })
  @ApiOkResponse({ type: UserRespDTO })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<UserRespDTO> {
    return this.userService.findOne(id);
  }

  @Put(':id')
  @Permissions('user:update')
  @ApiOperation({ summary: 'Cập nhật user' })
  @ApiOkResponse({ type: UserRespDTO })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserReqDTO,
    @CurrentUser('sub') actorUserId: number,
  ): Promise<UserRespDTO> {
    return this.userService.update(id, dto, actorUserId);
  }

  @Delete(':id')
  @Permissions('user:delete')
  @ApiOperation({ summary: 'Xóa user (soft delete)' })
  @ApiOkResponse({ description: 'Xóa thành công' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub') actorUserId: number,
  ) {
    return this.userService.remove(id, actorUserId);
  }

  @Post(':id/restore')
  @Permissions('user:update')
  @ApiOperation({ summary: 'Khôi phục user đã xóa' })
  @ApiOkResponse({ type: UserRespDTO })
  async restore(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub') actorUserId: number,
  ): Promise<UserRespDTO> {
    return this.userService.restore(id, actorUserId);
  }
}
