import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, StrategyStatus } from '@prisma/client';
import { CreateStrategyDto } from './dto/create-strategy.dto';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StrategiesService {
  constructor(private prisma: PrismaService) {}

  async create(createStrategyDto: CreateStrategyDto, userId: string, file: Express.Multer.File) {
    const { name, description } = createStrategyDto;
    
    // Lưu file vào thư mục uploads
    const fileName = `${uuidv4()}${path.extname(file.originalname)}`;
    const filePath = path.join('uploads', fileName);
    
    // Tạo thư mục uploads nếu chưa tồn tại
    await fs.mkdir('uploads', { recursive: true });
    
    // Lưu file
    await fs.writeFile(filePath, file.buffer);

    // Tạo strategy trong database
    const strategy = await this.prisma.strategy.create({
      data: {
        name,
        description,
        filePath: filePath,
        userId: userId,
        status: StrategyStatus.DRAFT,
      },
      include: {
        user: {
          select: {
            email: true,
            role: true,
          },
        },
      },
    });

    return strategy;
  }

  async findAll(user: any) {
    if (user.role === Role.ADMIN) {
      // Admin thấy tất cả strategies
      return this.prisma.strategy.findMany({
        include: {
          user: {
            select: { email: true, role: true },
          },
          backtestResults: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1, // Chỉ lấy kết quả backtest gần nhất
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });
    } else {
      // Researcher chỉ thấy strategies của mình
      return this.prisma.strategy.findMany({
        where: { userId: user.id },
        include: {
          backtestResults: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });
    }
  }

  async findOne(id: string, user: any) {
    const strategy = await this.prisma.strategy.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
        backtestResults: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!strategy) {
      throw new NotFoundException('Strategy not found');
    }

    // Kiểm tra quyền truy cập
    if (user.role !== Role.ADMIN && strategy.userId !== user.id) {
      throw new ForbiddenException('You do not have permission to access this strategy');
    }

    return strategy;
  }

  async update(id: string, updateData: Partial<{ name: string; description: string; status: StrategyStatus }>, user: any) {
    // Kiểm tra strategy tồn tại và quyền truy cập
    const strategy = await this.findOne(id, user);

    // Chỉ cho phép cập nhật nếu là chủ sở hữu hoặc admin
    if (user.role !== Role.ADMIN && strategy.userId !== user.id) {
      throw new ForbiddenException('You do not have permission to update this strategy');
    }

    return this.prisma.strategy.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, user: any) {
    // Kiểm tra strategy tồn tại và quyền truy cập
    const strategy = await this.findOne(id, user);

    // Chỉ cho phép xóa nếu là chủ sở hữu hoặc admin
    if (user.role !== Role.ADMIN && strategy.userId !== user.id) {
      throw new ForbiddenException('You do not have permission to delete this strategy');
    }

    // Xóa file vật lý
    try {
      await fs.unlink(strategy.filePath);
    } catch (error) {
      console.error('Error deleting file:', error);
      // Không throw error vì vẫn muốn xóa record trong database
    }

    // Xóa strategy và các backtest results liên quan (cascade)
    return this.prisma.strategy.delete({
      where: { id },
    });
  }

  async runBacktest(id: string, user: any) {
    // Kiểm tra strategy tồn tại và quyền truy cập
    const strategy = await this.findOne(id, user);

    // Kiểm tra strategy đang ở trạng thái có thể chạy backtest
    if (strategy.status === StrategyStatus.BACKTESTING) {
      throw new ForbiddenException('Strategy is already backtesting');
    }

    // Cập nhật status thành BACKTESTING
    await this.prisma.strategy.update({
      where: { id },
      data: { status: StrategyStatus.BACKTESTING },
    });

    // Ở đây bạn sẽ gửi job vào queue hoặc socket để xử lý backtest
    // Trả về thông tin để frontend có thể subscribe vào socket
    return {
      message: 'Backtest started',
      strategyId: id,
      socketChannel: `backtest-${id}`,
    };
  }

  async getBacktestResults(id: string, user: any) {
    // Kiểm tra strategy tồn tại và quyền truy cập
    const strategy = await this.findOne(id, user);

    return this.prisma.backtestResult.findMany({
      where: { strategyId: id },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getLatestBacktestResult(id: string, user: any) {
    // Kiểm tra strategy tồn tại và quyền truy cập
    const strategy = await this.findOne(id, user);

    return this.prisma.backtestResult.findFirst({
      where: { strategyId: id },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}