import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import type { Content, FunctionCall, Part } from '@google/genai';
import type { Response } from 'express';
import type { JwtUser } from '@core/auth/interfaces/currentUser.interface';
import type { ChatMessageDto } from './chat.dto';
import { ChatToolsService } from './chat.tools';
import {
  STABLE_SYSTEM_PROMPT,
  buildRoleSystemBlock,
} from './knowledge/system-prompt';
import type { ChatRole } from './knowledge/deep-links';

const MAX_HISTORY = 20;
const MAX_CONTENT = 4000;
const MAX_ITERATIONS = 8;
const MODELS = [
  'gemini-2.0-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.0-flash-001',
];

export const GENERIC_ERROR = 'Không thể trả lời lúc này. Vui lòng thử lại.';
export const MISSING_KEY_ERROR =
  'Chatbot chưa được cấu hình. Dán GEMINI_API_KEY (Google AI Studio, key AIza…) vào .env của backend rồi restart Nest.';

function stripQuotes(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function isUsableApiKey(value: string | undefined): boolean {
  const key = value?.trim() ?? '';
  if (key.length < 20) return false;
  if (key.includes('...') || /your_|changeme|placeholder/i.test(key))
    return false;
  return key.startsWith('AIza') || key.startsWith('AQ.');
}

function keyFromDotEnv(): string {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return '';
  const text = readFileSync(envPath, 'utf8');
  for (const name of ['GEMINI_API_KEY', 'GOOGLE_API_KEY']) {
    const match = text.match(new RegExp(`^${name}\\s*=\\s*(.*)$`, 'm'));
    if (!match) continue;
    const value = stripQuotes(match[1] ?? '');
    if (value) return value;
  }
  return '';
}

function extractErrorText(error: unknown): string {
  if (error instanceof Error && error.message) {
    const raw = error.message.trim();
    try {
      const parsed = JSON.parse(raw) as {
        error?: { message?: unknown };
        message?: unknown;
      };
      if (typeof parsed.error?.message === 'string')
        return parsed.error.message;
      if (typeof parsed.message === 'string') return parsed.message;
    } catch {
      // plain text
    }
    return raw;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}

function publicErrorMessage(error: unknown): string {
  const status =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : undefined;
  const message = extractErrorText(error);
  const blob = `${status ?? ''} ${message}`;
  if (
    status === 401 ||
    status === 403 ||
    /api[- ]?key|invalid.*key|permission denied|unauthenticated|unauthorized/i.test(
      blob,
    )
  ) {
    return 'API key Gemini không hợp lệ hoặc bị từ chối. Lấy key AIza… tại aistudio.google.com/apikey, dán GEMINI_API_KEY, restart Nest.';
  }
  if (
    status === 404 ||
    /NOT_FOUND|is not found|not (found|available|supported)/i.test(message)
  ) {
    return 'Model Gemini không khả dụng với key này.';
  }
  if (status === 429 || /quota|rate/i.test(message)) {
    return 'Hết hạn mức API tạm thời. Thử lại sau.';
  }
  if (isHighDemand(error)) {
    return 'Gemini đang quá tải. Đợi khoảng 20–30 giây rồi hỏi lại.';
  }
  const hint = message.replace(/\s+/g, ' ').slice(0, 180);
  return hint ? `${GENERIC_ERROR} (${hint})` : GENERIC_ERROR;
}

function isHighDemand(error: unknown): boolean {
  const status =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : undefined;
  const message = extractErrorText(error);
  return (
    status === 503 ||
    /high demand|overloaded|unavailable|try again later|UNAVAILABLE/i.test(
      message,
    )
  );
}

function isRetryableModelError(error: unknown): boolean {
  return isModelUnavailable(error) || isHighDemand(error);
}

function isModelUnavailable(error: unknown): boolean {
  const status =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : undefined;
  const message = extractErrorText(error);
  return (
    status === 404 ||
    /NOT_FOUND|is not found|not (found|available|supported)/i.test(message)
  );
}

function parseToolOutput(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { output: parsed };
  } catch {
    return { output: raw };
  }
}

type StreamEvent =
  | { type: 'status'; status: 'looking_up' | 'responding' }
  | { type: 'text'; delta: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private resolvedModel: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly chatTools: ChatToolsService,
  ) {}

  getApiKey(): string | null {
    const fromConfig =
      this.config.get<string>('GEMINI_API_KEY') ||
      this.config.get<string>('GOOGLE_API_KEY') ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      keyFromDotEnv();
    const trimmed = stripQuotes(fromConfig ?? '');
    return isUsableApiKey(trimmed) ? trimmed : null;
  }

  async streamTo(user: JwtUser, messages: ChatMessageDto[], res: Response) {
    const write = (event: StreamEvent) => {
      if (res.writableEnded) return;
      res.write(`${JSON.stringify(event)}\n`);
      const flushable = res as Response & { flush?: () => void };
      flushable.flush?.();
    };

    const apiKey = this.getApiKey();
    if (!apiKey) {
      write({ type: 'error', message: MISSING_KEY_ERROR });
      if (!res.writableEnded) res.end();
      return;
    }

    const role =
      ((user.role || 'STUDENT').toUpperCase() as ChatRole) || 'STUDENT';
    const contents: Content[] = messages.slice(-MAX_HISTORY).map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content.slice(0, MAX_CONTENT) }],
    }));
    const systemInstruction = `${STABLE_SYSTEM_PROMPT}\n\n${buildRoleSystemBlock(role, user.email ?? '')}`;

    try {
      const tools = this.chatTools.createTools(user);
      const byName = new Map(tools.map((tool) => [tool.name, tool]));
      const client = new GoogleGenAI({ apiKey });
      const functionDeclarations = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parametersJsonSchema: tool.parametersJsonSchema,
      }));
      const generateConfig = {
        systemInstruction,
        temperature: 0.3,
        tools: [{ functionDeclarations }],
      };

      for (let i = 0; i < MAX_ITERATIONS; i += 1) {
        let started = false;
        const response = await this.generateStream(
          client,
          contents,
          generateConfig,
          (chunk) => {
            if (!chunk.text) return;
            if (!started) {
              started = true;
              write({ type: 'status', status: 'responding' });
            }
            write({ type: 'text', delta: chunk.text });
          },
        );

        const functionCalls = response.functionCalls ?? [];

        if (functionCalls.length > 0) {
          write({ type: 'status', status: 'looking_up' });
          const modelContent = response.content;
          if (modelContent) {
            contents.push(modelContent);
          } else {
            contents.push({
              role: 'model',
              parts: functionCalls.map((call) => ({ functionCall: call })),
            });
          }

          const responseParts: Part[] = [];
          for (const call of functionCalls) {
            const name = call.name ?? '';
            const tool = byName.get(name);
            const raw = tool
              ? await tool.run(call.args ?? {})
              : JSON.stringify({ ok: false, reason: 'không có dữ liệu' });
            responseParts.push({
              functionResponse: {
                id: call.id,
                name,
                response: parseToolOutput(raw),
              },
            });
          }
          contents.push({ role: 'user', parts: responseParts });
          continue;
        }

        if (!started && response.text) {
          write({ type: 'status', status: 'responding' });
          write({ type: 'text', delta: response.text });
        }
        write({ type: 'done' });
        return;
      }

      write({ type: 'done' });
    } catch (error) {
      const detail = extractErrorText(error) || 'Chat request failed';
      this.logger.error(detail);
      write({ type: 'error', message: publicErrorMessage(error) });
    } finally {
      if (!res.writableEnded) res.end();
    }
  }

  private async generateStream(
    client: GoogleGenAI,
    contents: Content[],
    config: {
      systemInstruction: string;
      temperature: number;
      tools: Array<{ functionDeclarations: unknown[] }>;
    },
    onChunk: (chunk: { text?: string }) => void,
  ): Promise<{
    functionCalls: FunctionCall[];
    content?: Content;
    text: string;
  }> {
    const models = this.resolvedModel
      ? [
          this.resolvedModel,
          ...MODELS.filter((name) => name !== this.resolvedModel),
        ]
      : MODELS;

    let lastError: unknown;
    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        let emitted = false;
        try {
          const streamConfig = model.includes('2.5')
            ? { ...config, thinkingConfig: { thinkingBudget: 0 } }
            : config;
          const stream = await client.models.generateContentStream({
            model,
            contents,
            config: streamConfig,
          });

          const functionCalls: FunctionCall[] = [];
          const parts: Part[] = [];
          let text = '';
          for await (const chunk of stream) {
            emitted = true;
            if (chunk.functionCalls?.length) {
              functionCalls.push(...chunk.functionCalls);
            }
            const chunkParts = chunk.candidates?.[0]?.content?.parts;
            if (chunkParts?.length) parts.push(...chunkParts);
            if (chunk.text) {
              text += chunk.text;
              if (functionCalls.length === 0) onChunk({ text: chunk.text });
            }
          }
          this.resolvedModel = model;
          return {
            functionCalls,
            content: parts.length ? { role: 'model', parts } : undefined,
            text,
          };
        } catch (error) {
          lastError = error;
          if (emitted) throw error;
          if (isModelUnavailable(error)) break;
          if (isHighDemand(error) && attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            continue;
          }
          if (!isRetryableModelError(error)) throw error;
          break;
        }
      }
      this.resolvedModel = null;
      this.logger.warn(`Gemini model ${model} failed, trying next`);
    }
    throw lastError;
  }
}
