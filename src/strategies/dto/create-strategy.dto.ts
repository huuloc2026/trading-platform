import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateStrategyDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}