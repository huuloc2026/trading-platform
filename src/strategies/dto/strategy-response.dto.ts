import { ApiProperty } from '@nestjs/swagger';
import { StrategyStatus } from '@prisma/client';

export class BacktestResultSummary {
  @ApiProperty()
  id: string;

  @ApiProperty()
  sharpeRatio: number;

  @ApiProperty()
  maxDrawdown: number;

  @ApiProperty()
  totalReturn: number;

  @ApiProperty()
  createdAt: Date;
}

export class StrategyResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  filePath: string;

  @ApiProperty({ enum: StrategyStatus })
  status: StrategyStatus;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  user?: {
    id: string;
    email: string;
    fullName?: string;
  };

  @ApiProperty({ type: [BacktestResultSummary], required: false })
  backtestResults?: BacktestResultSummary[];

  @ApiProperty({ type: BacktestResultSummary, required: false })
  latestBacktest?: BacktestResultSummary;
}

export class StrategyWithStatsDto extends StrategyResponseDto {
  @ApiProperty()
  stats: {
    totalBacktests: number;
    averageSharpeRatio: number;
    averageMaxDrawdown: number;
    averageTotalReturn: number;
    bestSharpeRatio: number;
    worstDrawdown: number;
    bestReturn: number;
  };
}