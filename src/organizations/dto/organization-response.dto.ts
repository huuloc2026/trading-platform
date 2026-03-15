import { ApiProperty } from '@nestjs/swagger';
import { Plan } from '@prisma/client';

export class OrganizationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: Plan })
  plan: Plan;

  @ApiProperty()
  email?: string;

  @ApiProperty()
  phone?: string;

  @ApiProperty()
  address?: string;

  @ApiProperty()
  website?: string;

  @ApiProperty()
  taxId?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  userCount?: number;

  @ApiProperty()
  strategyCount?: number;

  @ApiProperty()
  backtestCount?: number;
}

export class OrganizationWithStatsDto extends OrganizationResponseDto {
  @ApiProperty()
  stats: {
    totalUsers: number;
    activeUsers: number;
    totalStrategies: number;
    completedBacktests: number;
    averageSharpeRatio?: number;
    totalReturn?: number;
  };
}