// Tạo bảng ghi cho các thao của prisma xem dev đã làm gì

// // src/core/database/prisma/prisma-metrics.service.ts
// import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// import { Prisma } from '@prisma/client';
// import { PrismaService } from './prisma.service';

// export interface QueryMetrics {
//   query: string;
//   model: string;
//   operation: string;
//   duration: number;
//   timestamp: Date;
//   success: boolean;
//   error?: string;
//   params?: any;
// }

// export interface ConnectionMetrics {
//   activeConnections: number;
//   idleConnections: number;
//   totalConnections: number;
//   connectionPools: {
//     poolSize: number;
//     usedConnections: number;
//     availableConnections: number;
//   };
// }

// export interface SlowQueryAlert {
//   query: string;
//   model: string;
//   operation: string;
//   duration: number;
//   threshold: number;
//   timestamp: Date;
// }

// @Injectable()
// export class PrismaMetricsService implements OnModuleInit {
//   private readonly logger = new Logger(PrismaMetricsService.name);
//   private readonly slowQueryThreshold = parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '1000', 10);
//   private readonly metricsBuffer: QueryMetrics[] = [];
//   private readonly bufferSize = parseInt(process.env.DB_METRICS_BUFFER_SIZE || '100', 10);
//   private flushInterval: NodeJS.Timeout | null = null;

//   private queryCount = 0;
//   private errorCount = 0;
//   private totalQueryTime = 0;
//   private slowQueryCount = 0;
//   private readonly operationStats: Map<string, { count: number; totalTime: number; avgTime: number }> = new Map();

//   constructor(private readonly prisma: PrismaService) {}

//   async onModuleInit() {
//     await this.setupMetricsMiddleware();
//     this.flushInterval = setInterval(
//       () => this.flushMetrics(),
//       parseInt('60000', 10),
//     );
//     this.setupConnectionMonitoring();
//     this.logger.log('Prisma Metrics Service initialized');
//     this.logger.log(`Slow query threshold: ${this.slowQueryThreshold}ms`);
//   }

//   private async setupMetricsMiddleware() {
//     this.prisma.$use(async (params: any, next: any) => {
//       const startTime = Date.now();
//       let success = true;
//       let error: string | undefined;

//       try {
//         const result = await next(params);
//         return result;
//       } catch (err) {
//         success = false;
//         error = err.message || 'Unknown error';
//         throw err;
//       } finally {
//         const duration = Date.now() - startTime;
//         this.recordQueryMetrics(params, duration, success, error);
//       }
//     });
//   }

//   private setupConnectionMonitoring() {
//     setInterval(() => {
//       this.captureConnectionMetrics();
//     }, 10000);
//   }

//   private recordQueryMetrics(
//     params: Prisma.MiddlewareParams,
//     duration: number,
//     success: boolean,
//     error?: string,
//   ) {
//     const model = params.model || 'unknown';
//     const operation = params.action || 'unknown';
//     const query = this.formatQuery(params);

//     const metrics: QueryMetrics = {
//       query,
//       model,
//       operation,
//       duration,
//       timestamp: new Date(),
//       success,
//       error,
//       params: this.sanitizeParams(params.args),
//     };
//     this.queryCount++;
//     this.totalQueryTime += duration;

//     if (!success) {
//       this.errorCount++;
//     }
//     const key = `${model}.${operation}`;
//     const existing = this.operationStats.get(key) || { count: 0, totalTime: 0, avgTime: 0 };
//     existing.count++;
//     existing.totalTime += duration;
//     existing.avgTime = existing.totalTime / existing.count;
//     this.operationStats.set(key, existing);

//     // Check for slow queries
//     if (duration > this.slowQueryThreshold) {
//       this.slowQueryCount++;
//       const alert: SlowQueryAlert = {
//         query,
//         model,
//         operation,
//         duration,
//         threshold: this.slowQueryThreshold,
//         timestamp: new Date(),
//       };
//       this.handleSlowQuery(alert);
//     }
//     if (duration > this.slowQueryThreshold) {
//       this.logger.warn(
//         `Slow query detected: ${model}.${operation} took ${duration}ms`,
//         {
//           model,
//           operation,
//           duration,
//           threshold: this.slowQueryThreshold,
//           query,
//           params: this.sanitizeParams(params.args),
//         },
//       );
//     }
//     this.metricsBuffer.push(metrics);
//     if (this.metricsBuffer.length >= this.bufferSize) {
//       this.flushMetrics();
//     }
//   }

//   private async captureConnectionMetrics() {
//     try {
//       // @ts-ignore - Access internal Prisma connection pool
//       const pool = this.prisma._engine?.connectionPool;

//       let metrics: ConnectionMetrics = {
//         activeConnections: 0,
//         idleConnections: 0,
//         totalConnections: 0,
//         connectionPools: {
//           poolSize: 0,
//           usedConnections: 0,
//           availableConnections: 0,
//         },
//       };

//       if (pool) {
//         // Attempt to get pool metrics
//         const stats = pool.stats?.();
//         if (stats) {
//           metrics = {
//             activeConnections: stats.activeConnections || 0,
//             idleConnections: stats.idleConnections || 0,
//             totalConnections: stats.totalConnections || 0,
//             connectionPools: {
//               poolSize: stats.poolSize || 0,
//               usedConnections: stats.usedConnections || 0,
//               availableConnections: stats.availableConnections || 0,
//             },
//           };
//         }
//       }

//       // Log connection pool status if issues
//       if (metrics.connectionPools.usedConnections > metrics.connectionPools.poolSize * 0.8) {
//         this.logger.warn(
//           `Connection pool nearing limit: ${metrics.connectionPools.usedConnections}/${metrics.connectionPools.poolSize}`,
//         );
//       }

//       // Store metrics (you can send to monitoring system)
//       this.logger.debug('Connection pool metrics', metrics);
//     } catch (error) {
//       this.logger.error('Failed to capture connection metrics', error);
//     }
//   }

//   private handleSlowQuery(alert: SlowQueryAlert) {
//     this.logger.warn(
//       ` SLOW QUERY ALERT: ${alert.model}.${alert.operation} - ${alert.duration}ms (threshold: ${alert.threshold}ms)`,
//       {
//         query: alert.query,
//         duration: alert.duration,
//         threshold: alert.threshold,
//         timestamp: alert.timestamp,
//       },
//     );
//   }

//   private async flushMetrics() {
//     if (this.metricsBuffer.length === 0) return;

//     const metrics = [...this.metricsBuffer];
//     this.metricsBuffer.length = 0;

//     try {
//       const aggregated = this.aggregateMetrics(metrics);
//       this.logger.debug('Aggregated query metrics', {
//         totalQueries: metrics.length,
//         avgDuration: aggregated.avgDuration,
//         errorRate: aggregated.errorRate,
//         slowQueries: aggregated.slowQueries,
//         byOperation: aggregated.byOperation,
//       });
//       await this.storeMetrics(metrics);
//     } catch (error) {
//       this.logger.error('Failed to flush metrics', error);
//     }
//   }

//   private aggregateMetrics(metrics: QueryMetrics[]) {
//     const total = metrics.length;
//     const errors = metrics.filter(m => !m.success).length;
//     const slowQueries = metrics.filter(m => m.duration > this.slowQueryThreshold).length;
//     const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);

//     const byOperation: Record<string, { count: number; avgDuration: number; errorCount: number }> = {};
//     metrics.forEach(m => {
//       const key = `${m.model}.${m.operation}`;
//       if (!byOperation[key]) {
//         byOperation[key] = { count: 0, avgDuration: 0, errorCount: 0 };
//       }
//       byOperation[key].count++;
//       byOperation[key].avgDuration = (byOperation[key].avgDuration * (byOperation[key].count - 1) + m.duration) / byOperation[key].count;
//       if (!m.success) byOperation[key].errorCount++;
//     });

//     return {
//       total,
//       errors,
//       avgDuration: totalDuration / total,
//       errorRate: (errors / total) * 100,
//       slowQueries,
//       byOperation,
//     };
//   }

//   private async storeMetrics(metrics: QueryMetrics[]) {
//     try {
//       this.logger.verbose(`Metrics stored: ${metrics.length} records`);
//     } catch (error) {
//       this.logger.error('Failed to store metrics', error);
//     }
//   }

//   getMetricsStats() {
//     return {
//       totalQueries: this.queryCount,
//       totalErrors: this.errorCount,
//       totalQueryTime: this.totalQueryTime,
//       averageQueryTime: this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0,
//       slowQueryCount: this.slowQueryCount,
//       bufferSize: this.metricsBuffer.length,
//       operationStats: Object.fromEntries(this.operationStats),
//       timestamp: new Date(),
//     };
//   }

//   getSlowQueries(limit: number = 10): SlowQueryAlert[] {
//     const slowQueries = this.metricsBuffer
//       .filter(m => m.duration > this.slowQueryThreshold)
//       .map(m => ({
//         query: m.query,
//         model: m.model,
//         operation: m.operation,
//         duration: m.duration,
//         threshold: this.slowQueryThreshold,
//         timestamp: m.timestamp,
//       }))
//       .sort((a, b) => b.duration - a.duration)
//       .slice(0, limit);

//     return slowQueries;
//   }

//   resetMetrics() {
//     this.queryCount = 0;
//     this.errorCount = 0;
//     this.totalQueryTime = 0;
//     this.slowQueryCount = 0;
//     this.operationStats.clear();
//     this.metricsBuffer.length = 0;
//     this.logger.log('Metrics reset');
//   }

//   private formatQuery(params: Prisma.MiddlewareParams): string {
//     try {
//       const model = params.model || 'unknown';
//       const action = params.action || 'unknown';
//       return `${action} on ${model}`;
//     } catch (error) {
//       return 'unknown query';
//     }
//   }

//   private sanitizeParams(params: any): any {
//     if (!params) return params;
//     const sanitized = JSON.parse(JSON.stringify(params));
//     if (sanitized.data) {
//       if (sanitized.data.password) {
//         sanitized.data.password = '***REDACTED***';
//       }
//       if (sanitized.data.refreshToken) {
//         sanitized.data.refreshToken = '***REDACTED***';
//       }
//     }
//     if (sanitized.where?.password) {
//       sanitized.where.password = '***REDACTED***';
//     }

//     return sanitized;
//   }
//   async onModuleDestroy() {
//     if (this.flushInterval) {
//       clearInterval(this.flushInterval);
//       this.flushInterval = null;
//     }
//     await this.flushMetrics();
//     this.logger.log('Prisma Metrics Service destroyed');
//   }
// }
