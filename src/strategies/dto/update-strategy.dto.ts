import { PartialType } from '@nestjs/mapped-types';
import { CreateStrategyDto } from './create-strategy.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { StrategyStatus } from '@prisma/client';

export class UpdateStrategyDto extends PartialType(CreateStrategyDto) {
  @IsEnum(StrategyStatus)
  @IsOptional()
  status?: StrategyStatus;
}