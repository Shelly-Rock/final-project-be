import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { RoleService } from './role.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  RoleResponseDto,
  AssignUserRolesDto,
  UpdateRolePermissionsDto,
} from './dto';
import { JwtAuthGuard } from '@/core/auth/guards/jwtAuth.guard';
import { RolesGuard } from '@/core/auth/guards/roles.guard';
import { Roles } from '@/core/auth/decorators/roles.decorator';
import { CurrentUser } from '@/core/auth/decorators/currentUser.decorator';

@ApiTags('Roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo mới một role' })
  @ApiCreatedResponse({ type: RoleResponseDto, description: 'Role đã được tạo thành công' })
  async create(
    @Body() createRoleDto: CreateRoleDto,
    @CurrentUser('sub') actorUserId: number,
  ) {
    const role = await this.roleService.create(createRoleDto, actorUserId);
    return {
      success: true,
      message: 'Tạo role thành công',
      data: role,
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy danh sách tất cả roles' })
  @ApiOkResponse({ type: [RoleResponseDto], description: 'Danh sách roles' })
  async findAll() {
    const roles = await this.roleService.findAll();
    return {
      success: true,
      data: roles,
      total: roles.length,
    };
  }

  @Get('all-with-deleted')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy danh sách tất cả roles (bao gồm đã xóa)' })
  @ApiOkResponse({ type: [RoleResponseDto], description: 'Danh sách roles' })
  async findAllWithDeleted() {
    const roles = await this.roleService.findAll({ includeDeleted: true });
    return {
      success: true,
      data: roles,
      total: roles.length,
    };
  }

  @Get('users')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy danh sách user kèm roles (trang quản lý phân quyền)' })
  @ApiQuery({ name: 'page', required: false, description: 'Trang (mặc định 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Số phần tử/trang (mặc định 20, tối đa 100)' })
  @ApiQuery({ name: 'search', required: false, description: 'Tìm theo email hoặc username' })
  async listUsersWithRoles(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.roleService.listUsersWithRoles({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
    });
    return {
      success: true,
      ...result,
    };
  }

  @Get('users/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy danh sách roles của user' })
  @ApiParam({ name: 'userId', description: 'ID của user', type: Number })
  async getUserRoles(@Param('userId', ParseIntPipe) userId: number) {
    const roles = await this.roleService.getUserRoles(userId);
    return {
      success: true,
      data: roles,
      total: roles.length,
    };
  }

  @Put('users/:userId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gán nhiều roles cho user (thay thế toàn bộ)' })
  @ApiParam({ name: 'userId', description: 'ID của user', type: Number })
  async assignUserRoles(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: AssignUserRolesDto,
    @CurrentUser('sub') actorUserId: number,
  ) {
    const roles = await this.roleService.assignUserRoles(
      userId,
      dto.role_ids,
      actorUserId,
    );
    return {
      success: true,
      message: 'Gán roles cho user thành công',
      data: roles,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy chi tiết role theo ID' })
  @ApiParam({ name: 'id', description: 'ID của role', type: Number })
  @ApiOkResponse({ type: RoleResponseDto, description: 'Chi tiết role' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const role = await this.roleService.findOne(id);
    return {
      success: true,
      data: role,
    };
  }

  @Get('name/:name')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy chi tiết role theo tên' })
  @ApiParam({ name: 'name', description: 'Tên của role', type: String })
  @ApiOkResponse({ type: RoleResponseDto, description: 'Chi tiết role' })
  async findByName(@Param('name') name: string) {
    const role = await this.roleService.findByName(name);
    return {
      success: true,
      data: role,
    };
  }

  @Get(':id/permissions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy danh sách permissions của role' })
  @ApiParam({ name: 'id', description: 'ID của role', type: Number })
  async getPermissions(@Param('id', ParseIntPipe) id: number) {
    const permissions = await this.roleService.getPermissions(id);
    return {
      success: true,
      data: permissions,
      total: permissions.length,
    };
  }

  @Put(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cập nhật thông tin role' })
  @ApiParam({ name: 'id', description: 'ID của role', type: Number })
  @ApiOkResponse({ type: RoleResponseDto, description: 'Role đã được cập nhật' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRoleDto: UpdateRoleDto,
    @CurrentUser('sub') actorUserId: number,
  ) {
    const role = await this.roleService.update(id, updateRoleDto, actorUserId);
    return {
      success: true,
      message: 'Cập nhật role thành công',
      data: role,
    };
  }

  @Patch(':id/permissions')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gán permissions cho role' })
  @ApiParam({ name: 'id', description: 'ID của role', type: Number })
  @ApiOkResponse({ type: RoleResponseDto, description: 'Permissions đã được gán' })
  async assignPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser('sub') actorUserId: number,
  ) {
    const role = await this.roleService.assignPermissions(
      id,
      dto.permission_ids,
      actorUserId,
    );
    return {
      success: true,
      message: 'Gán permissions thành công',
      data: role,
    };
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa role (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID của role', type: Number })
  @ApiQuery({ name: 'hardDelete', required: false, description: 'Xóa vĩnh viễn' })
  @ApiOkResponse({ description: 'Role đã được xóa' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub') actorUserId: number,
    @Query('hardDelete') hardDelete?: string,
  ) {
    const isHardDelete = hardDelete === 'true' || hardDelete === '1';
    const result = await this.roleService.remove(id, actorUserId, isHardDelete);
    return {
      success: true,
      ...result,
    };
  }

  @Post(':id/restore')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Khôi phục role đã xóa' })
  @ApiParam({ name: 'id', description: 'ID của role', type: Number })
  @ApiOkResponse({ type: RoleResponseDto, description: 'Role đã được khôi phục' })
  async restore(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub') actorUserId: number,
  ) {
    const role = await this.roleService.restore(id, actorUserId);
    return {
      success: true,
      message: 'Khôi phục role thành công',
      data: role,
    };
  }
}
