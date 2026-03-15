import { IsString, IsEnum, IsOptional, IsArray, ValidateNested, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Plan } from '@prisma/client';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Trading Fund Inc.', description: 'Organization name' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: Plan, example: Plan.FREE, default: Plan.FREE })
  @IsEnum(Plan)
  @IsOptional()
  plan?: Plan;

  @ApiProperty({ example: 'contact@tradingfund.com', required: false })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '+1-555-123-4567', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: '123 Trading Street, New York, NY 10001', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ example: 'https://tradingfund.com', required: false })
  @IsString()
  @IsOptional()
  website?: string;

  @ApiProperty({ example: '123456789', required: false })
  @IsString()
  @IsOptional()
  taxId?: string;
}

export class CreateOrganizationWithAdminDto extends CreateOrganizationDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsString()
  adminEmail: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  adminPassword: string;

  @ApiProperty({ example: 'John Doe', required: false })
  @IsString()
  @IsOptional()
  adminName?: string;
}