import { PartialType } from '@nestjs/mapped-types';
import { CreateStrategyDto } from './create-strategy.dto';
import { IsEnum, IsOptional, IsBoolean, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { StrategyStatus } from '@prisma/client';

export class UpdateStrategyDto extends PartialType(CreateStrategyDto) {
  @ApiProperty({ enum: StrategyStatus, required: false })
  @IsEnum(StrategyStatus)
  @IsOptional()
  status?: StrategyStatus;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  // Add these fields to handle file updates
  @ApiProperty({ type: 'string', format: 'binary', required: false })
  file?: any;

  // Keep track of file path updates
  filePath?: string;
}