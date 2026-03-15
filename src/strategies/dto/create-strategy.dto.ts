import { 
  IsString, 
  IsOptional, 
  MinLength, 
  MaxLength, 
  IsEnum,
  IsArray,
  ValidateNested,
  IsObject
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { StrategyStatus } from '@prisma/client';

export class CreateStrategyDto {
  @ApiProperty({ example: 'Moving Average Crossover', description: 'Strategy name' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiProperty({ 
    example: 'Simple moving average crossover strategy using 50-day and 200-day MA',
    required: false 
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ 
    type: 'string', 
    format: 'binary',
    description: 'Python strategy file' 
  })
  file: any;

  @ApiProperty({ 
    example: ['AAPL', 'GOOGL'],
    required: false,
    description: 'List of symbols to trade'
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  symbols?: string[];

  @ApiProperty({ 
    example: { 'lookback': 50, 'threshold': 0.02 },
    required: false,
    description: 'Strategy parameters'
  })
  @IsObject()
  @IsOptional()
  parameters?: Record<string, any>;

  @ApiProperty({ 
    enum: StrategyStatus,
    default: StrategyStatus.DRAFT,
    required: false
  })
  @IsEnum(StrategyStatus)
  @IsOptional()
  status?: StrategyStatus;
}

export class UploadStrategyDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file: any;
}