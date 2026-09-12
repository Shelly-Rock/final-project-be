import {
  BadRequestException,
  Body,
  Controller,
  Header,
  Post,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '@core/auth/decorators/currentUser.decorator';
import type { JwtUser } from '@core/auth/interfaces/currentUser.interface';
import { ChatRequestDto } from './chat.dto';
import { ChatService, MISSING_KEY_ERROR } from './chat.service';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @Header('Content-Type', 'application/x-ndjson; charset=utf-8')
  @Header('Cache-Control', 'no-cache, no-transform')
  @ApiOperation({ summary: 'Trợ lý đồ án — stream NDJSON (đọc-only)' })
  async chat(
    @CurrentUser() user: JwtUser,
    @Body() dto: ChatRequestDto,
    @Res() res: Response,
  ) {
    const last = dto.messages[dto.messages.length - 1];
    if (!last || last.role !== 'user' || !last.content.trim()) {
      throw new BadRequestException('Tin nhắn cuối phải là câu hỏi của người dùng');
    }

    if (!this.chatService.getApiKey()) {
      res.status(503).json({
        statusCode: 503,
        message: MISSING_KEY_ERROR,
      });
      return;
    }

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.status(200);

    await this.chatService.streamTo(user, dto.messages, res);
  }
}
