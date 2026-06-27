import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      const expectedResult = [
        { id: '1', email: 'test@example.com', name: 'Test', role: 'USER' },
      ];
      mockPrismaService.user.findMany.mockResolvedValue(expectedResult);

      const result = await service.findAll();

      expect(result).toEqual(expectedResult);
      expect(prisma.user.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a user if found', async () => {
      const userId = '1';
      const expectedResult = {
        id: userId,
        email: 'test@example.com',
        name: 'Test',
        role: 'USER',
      };
      mockPrismaService.user.findUnique.mockResolvedValue(expectedResult);

      const result = await service.findOne(userId);

      expect(result).toEqual(expectedResult);
    });

    it('should throw NotFoundException if user not found', async () => {
      const userId = 'nonexistent';
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne(userId)).rejects.toThrow(NotFoundException);
    });
  });
});
