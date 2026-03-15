import { 
  Injectable, 
  NotFoundException, 
  ForbiddenException,
  BadRequestException,
  ConflictException
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStrategyDto } from './dto/create-strategy.dto';
import { UpdateStrategyDto } from './dto/update-strategy.dto';
import { StrategyResponseDto, StrategyWithStatsDto } from './dto/strategy-response.dto';
import { Role, StrategyStatus } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class StrategiesService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(
    createStrategyDto: CreateStrategyDto,
    userId: string,
    file: Express.Multer.File,
  ): Promise<StrategyResponseDto> {
    const { name, description } = createStrategyDto;

    // Validate Python file
    if (!file.originalname.endsWith('.py')) {
      throw new BadRequestException('Only Python (.py) files are allowed');
    }

    // Check for duplicate strategy name for this user
    const existingStrategy = await this.prisma.strategy.findFirst({
      where: {
        name,
        userId,
      },
    });

    if (existingStrategy) {
      throw new ConflictException('You already have a strategy with this name');
    }

    // Create strategy directory if not exists
    const userDir = path.join('uploads', 'strategies', userId);
    await fs.mkdir(userDir, { recursive: true });

    // Save file with unique name
    const fileName = `${uuidv4()}-${file.originalname}`;
    const filePath = path.join(userDir, fileName);
    await fs.writeFile(filePath, file.buffer);

    // Save relative path in database
    const relativePath = path.join('uploads', 'strategies', userId, fileName);

    // Create strategy in database
    const strategy = await this.prisma.strategy.create({
      data: {
        name,
        description,
        filePath: relativePath,
        userId,
        status: StrategyStatus.DRAFT,
        metadata: {
          symbols: createStrategyDto.symbols || [],
          parameters: createStrategyDto.parameters || {},
          originalName: file.originalname,
          fileSize: file.size,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    // Emit event for analytics
    this.eventEmitter.emit('strategy.created', {
      strategyId: strategy.id,
      userId,
    });

    return this.mapToResponseDto(strategy);
  }

  async findAll(
    user: any,
    page: number = 1,
    limit: number = 10,
    status?: StrategyStatus,
    search?: string,
  ): Promise<{ data: StrategyResponseDto[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause(user, status, search);

    const [strategies, total] = await Promise.all([
      this.prisma.strategy.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
          backtestResults: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      }),
      this.prisma.strategy.count({ where }),
    ]);

    const data = strategies.map(strategy => ({
      ...this.mapToResponseDto(strategy),
      backtestResults: strategy.backtestResults.slice(0, 1).map(r => ({
        id: r.id,
        sharpeRatio: r.sharpeRatio,
        maxDrawdown: r.maxDrawdown,
        totalReturn: r.totalReturn,
        createdAt: r.createdAt,
      })),
    }));

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, user: any, includeStats: boolean = false): Promise<StrategyResponseDto | StrategyWithStatsDto> {
    const strategy = await this.prisma.strategy.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            organization: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        backtestResults: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!strategy) {
      throw new NotFoundException('Strategy not found');
    }

    // Check permissions
    if (!this.canAccess(user, strategy)) {
      throw new ForbiddenException('You do not have permission to access this strategy');
    }

    if (includeStats) {
      return this.getStrategyWithStats(strategy);
    }

    return {
      ...this.mapToResponseDto(strategy),
      backtestResults: strategy.backtestResults.map(r => ({
        id: r.id,
        sharpeRatio: r.sharpeRatio,
        maxDrawdown: r.maxDrawdown,
        totalReturn: r.totalReturn,
        createdAt: r.createdAt,
      })),
    };
  }

  async update(
    id: string, 
    updateStrategyDto: UpdateStrategyDto, 
    user: any,
    file?: Express.Multer.File,
  ): Promise<StrategyResponseDto> {
    const strategy = await this.prisma.strategy.findUnique({
      where: { id },
    });

    if (!strategy) {
      throw new NotFoundException('Strategy not found');
    }

    // Check permissions
    if (!this.canAccess(user, strategy)) {
      throw new ForbiddenException('You do not have permission to update this strategy');
    }

    const updateData: any = { ...updateStrategyDto };

    if (file) {
      // Validate and save new file
      if (!file.originalname.endsWith('.py')) {
        throw new BadRequestException('Only Python (.py) files are allowed');
      }

      // Delete old file
      try {
        await fs.unlink(strategy.filePath);
      } catch (error) {
        console.error('Error deleting old file:', error);
      }

      // Save new file
      const userDir = path.join('uploads', 'strategies', user.id);
      await fs.mkdir(userDir, { recursive: true });
      const fileName = `${uuidv4()}-${file.originalname}`;
      const filePath = path.join(userDir, fileName);
      await fs.writeFile(filePath, file.buffer);
      
      updateData.filePath = path.join('uploads', 'strategies', user.id, fileName);
    }

    const updated = await this.prisma.strategy.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    return this.mapToResponseDto(updated);
  }

  async remove(id: string, user: any): Promise<void> {
    const strategy = await this.prisma.strategy.findUnique({
      where: { id },
    });

    if (!strategy) {
      throw new NotFoundException('Strategy not found');
    }

    // Check permissions
    if (!this.canAccess(user, strategy)) {
      throw new ForbiddenException('You do not have permission to delete this strategy');
    }

    // Delete file
    try {
      await fs.unlink(strategy.filePath);
    } catch (error) {
      console.error('Error deleting file:', error);
    }

    // Delete from database
    await this.prisma.strategy.delete({
      where: { id },
    });

    this.eventEmitter.emit('strategy.deleted', {
      strategyId: id,
      userId: user.id,
    });
  }

  async runBacktest(id: string, user: any): Promise<{ jobId: string; message: string }> {
    const strategy = await this.prisma.strategy.findUnique({
      where: { id },
    });

    if (!strategy) {
      throw new NotFoundException('Strategy not found');
    }

    // Check permissions
    if (!this.canAccess(user, strategy)) {
      throw new ForbiddenException('You do not have permission to run backtest on this strategy');
    }

    if (strategy.status === StrategyStatus.BACKTESTING) {
      throw new ConflictException('Strategy is already backtesting');
    }

    // Update status
    await this.prisma.strategy.update({
      where: { id },
      data: { status: StrategyStatus.BACKTESTING },
    });

    // Create backtest job
    const backtestJob = await this.prisma.backtestJob.create({
      data: {
        strategyId: id,
        status: 'PENDING',
      },
    });

    // Emit event to start backtest processing
    this.eventEmitter.emit('backtest.started', {
      jobId: backtestJob.id,
      strategyId: id,
      userId: user.id,
      filePath: strategy.filePath,
    });

    return {
      jobId: backtestJob.id,
      message: 'Backtest started successfully',
    };
  }

  async getBacktestResults(
    id: string, 
    user: any,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const strategy = await this.prisma.strategy.findUnique({
      where: { id },
    });

    if (!strategy) {
      throw new NotFoundException('Strategy not found');
    }

    // Check permissions
    if (!this.canAccess(user, strategy)) {
      throw new ForbiddenException('You do not have permission to view backtest results for this strategy');
    }

    const skip = (page - 1) * limit;

    const [results, total] = await Promise.all([
      this.prisma.backtestResult.findMany({
        where: { strategyId: id },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.backtestResult.count({ where: { strategyId: id } }),
    ]);

    return {
      data: results,
      total,
      page,
      limit,
    };
  }

  async getLatestBacktestResult(id: string, user: any) {
    const strategy = await this.prisma.strategy.findUnique({
      where: { id },
    });

    if (!strategy) {
      throw new NotFoundException('Strategy not found');
    }

    // Check permissions
    if (!this.canAccess(user, strategy)) {
      throw new ForbiddenException('You do not have permission to view backtest results for this strategy');
    }

    const result = await this.prisma.backtestResult.findFirst({
      where: { strategyId: id },
      orderBy: { createdAt: 'desc' },
    });

    if (!result) {
      throw new NotFoundException('No backtest results found for this strategy');
    }

    return result;
  }

  async duplicate(id: string, user: any, newName?: string): Promise<StrategyResponseDto> {
    const strategy = await this.prisma.strategy.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!strategy) {
      throw new NotFoundException('Strategy not found');
    }

    // Check permissions
    if (!this.canAccess(user, strategy)) {
      throw new ForbiddenException('You do not have permission to duplicate this strategy');
    }

    // Generate new name
    const duplicateName = newName || `${strategy.name} (Copy)`;

    // Check for duplicate name
    const existingStrategy = await this.prisma.strategy.findFirst({
      where: {
        name: duplicateName,
        userId: user.id,
      },
    });

    if (existingStrategy) {
      throw new ConflictException('You already have a strategy with this name');
    }

    // Copy file
    const originalPath = strategy.filePath;
    const ext = path.extname(originalPath);
    const newFileName = `${uuidv4()}${ext}`;
    const newFilePath = path.join('uploads', 'strategies', user.id, newFileName);

    try {
      await fs.copyFile(originalPath, newFilePath);
    } catch (error) {
      throw new BadRequestException('Failed to duplicate strategy file');
    }

    // Create new strategy
    const duplicated = await this.prisma.strategy.create({
      data: {
        name: duplicateName,
        description: strategy.description,
        filePath: newFilePath,
        userId: user.id,
        status: StrategyStatus.DRAFT,
        metadata: strategy.metadata as any,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    return this.mapToResponseDto(duplicated);
  }

  async getStrategyFile(id: string, user: any): Promise<{ path: string; name: string }> {
    const strategy = await this.prisma.strategy.findUnique({
      where: { id },
    });

    if (!strategy) {
      throw new NotFoundException('Strategy not found');
    }

    // Check permissions
    if (!this.canAccess(user, strategy)) {
      throw new ForbiddenException('You do not have permission to download this strategy');
    }
    
    return {
      path: strategy.filePath,
      name: path.basename(strategy.filePath),
    };
  }

  async getStrategyStats(user: any): Promise<any> {
    const where = this.buildWhereClause(user);

    const [
      totalStrategies,
      statusCounts,
      backtestStats,
    ] = await Promise.all([
      this.prisma.strategy.count({ where }),
      this.prisma.strategy.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      this.prisma.backtestResult.aggregate({
        where: { strategy: { userId: user.role === Role.ADMIN ? undefined : user.id } },
        _avg: {
          sharpeRatio: true,
          maxDrawdown: true,
          totalReturn: true,
        },
        _max: {
          sharpeRatio: true,
          totalReturn: true,
        },
        _min: {
          maxDrawdown: true,
        },
      }),
    ]);

    return {
      totalStrategies,
      byStatus: statusCounts.reduce((acc, curr) => {
        acc[curr.status] = curr._count;
        return acc;
      }, {} as Record<string, number>),
      performance: {
        averageSharpeRatio: backtestStats._avg.sharpeRatio || 0,
        averageMaxDrawdown: backtestStats._avg.maxDrawdown || 0,
        averageTotalReturn: backtestStats._avg.totalReturn || 0,
        bestSharpeRatio: backtestStats._max.sharpeRatio || 0,
        bestReturn: backtestStats._max.totalReturn || 0,
        worstDrawdown: backtestStats._min.maxDrawdown || 0,
      },
    };
  }

  private buildWhereClause(user: any, status?: StrategyStatus, search?: string) {
    const where: any = {};

    if (user.role !== Role.ADMIN) {
      where.userId = user.id;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ];
    }

    return where;
  }

  private canAccess(user: any, strategy: any): boolean {
    return user.role === Role.ADMIN || strategy.userId === user.id;
  }

  private async getStrategyWithStats(strategy: any): Promise<StrategyWithStatsDto> {
    const backtestResults = strategy.backtestResults || [];

    const stats = {
      totalBacktests: backtestResults.length,
      averageSharpeRatio: 0,
      averageMaxDrawdown: 0,
      averageTotalReturn: 0,
      bestSharpeRatio: 0,
      worstDrawdown: 0,
      bestReturn: 0,
    };

    if (backtestResults.length > 0) {
      stats.averageSharpeRatio = backtestResults.reduce((sum, r) => sum + r.sharpeRatio, 0) / backtestResults.length;
      stats.averageMaxDrawdown = backtestResults.reduce((sum, r) => sum + r.maxDrawdown, 0) / backtestResults.length;
      stats.averageTotalReturn = backtestResults.reduce((sum, r) => sum + r.totalReturn, 0) / backtestResults.length;
      stats.bestSharpeRatio = Math.max(...backtestResults.map(r => r.sharpeRatio));
      stats.worstDrawdown = Math.min(...backtestResults.map(r => r.maxDrawdown));
      stats.bestReturn = Math.max(...backtestResults.map(r => r.totalReturn));
    }

    return {
      ...this.mapToResponseDto(strategy),
      backtestResults: backtestResults.slice(0, 5).map(r => ({
        id: r.id,
        sharpeRatio: r.sharpeRatio,
        maxDrawdown: r.maxDrawdown,
        totalReturn: r.totalReturn,
        createdAt: r.createdAt,
      })),
      stats,
    };
  }

  private mapToResponseDto(strategy: any): StrategyResponseDto {
    return {
      id: strategy.id,
      name: strategy.name,
      description: strategy.description,
      filePath: strategy.filePath,
      status: strategy.status,
      userId: strategy.userId,
      createdAt: strategy.createdAt,
      updatedAt: strategy.updatedAt,
      user: strategy.user ? {
        id: strategy.user.id,
        email: strategy.user.email,
        fullName: strategy.user.fullName,
      } : undefined,
    };
  }
}