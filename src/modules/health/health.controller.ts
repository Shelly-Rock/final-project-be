import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Root Health Check',
    description: 'Basic health check endpoint at the root path',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is running',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number', description: 'Server uptime in seconds' },
      },
    },
  })
  async check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };
  }

  @Get('health')
  @Public()
  @ApiOperation({
    summary: 'Detailed Health Check',
    description: `
      Comprehensive health check that verifies database connectivity.
      
      **Checks performed:**
      - Server status
      - Database connectivity (PostgreSQL)
      
      **Use Cases:**
      - Kubernetes liveness/readiness probes
      - Load balancer health checks
      - Monitoring systems
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy - All checks passed',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'healthy' },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number', example: 3600, description: 'Uptime in seconds' },
        database: { type: 'string', example: 'connected' },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Service is unhealthy - Database connection failed',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'unhealthy' },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number', example: 3600 },
        database: { type: 'string', example: 'disconnected' },
      },
    },
  })
  async healthCheck() {
    const uptime = Math.floor(process.uptime());
    const timestamp = new Date().toISOString();

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'healthy',
        timestamp,
        uptime,
        database: 'connected',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp,
        uptime,
        database: 'disconnected',
      };
    }
  }
}
