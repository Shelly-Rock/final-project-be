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
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Courses')
@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoursesController {
  constructor(private coursesService: CoursesService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Create a new course' })
  async create(@Body() createDto: CreateCourseDto) {
    return this.coursesService.create(createDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SECRETARY, Role.TEACHER)
  @ApiOperation({ summary: 'Get all courses' })
  async findAll(
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('take', new DefaultValuePipe(100), ParseIntPipe) take: number,
    @Query('search') search?: string,
  ) {
    return this.coursesService.findAll({ skip, take, search });
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Get course by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.coursesService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.SECRETARY)
  @ApiOperation({ summary: 'Update course' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() updateDto: UpdateCourseDto) {
    return this.coursesService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete course' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.coursesService.delete(id);
  }
}
