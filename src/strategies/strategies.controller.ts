import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
  Res,
  Request
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiBearerAuth, 
  ApiOperation, 
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiQuery,
  ApiParam
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { StrategiesService } from './strategies.service';
import { CreateStrategyDto } from './dto/create-strategy.dto';
import { UpdateStrategyDto } from './dto/update-strategy.dto';
import { StrategyResponseDto } from './dto/strategy-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role, StrategyStatus } from '@prisma/client';
import * as fs from 'fs';

@ApiTags('strategies')
@ApiBearerAuth('JWT-auth')
@Controller('strategies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StrategiesController {
  constructor(private readonly strategiesService: StrategiesService) {}

  @Post()
  @ApiOperation({ summary: 'Upload a new strategy' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        symbols: { 
          type: 'array',
          items: { type: 'string' }
        },
        parameters: { type: 'object' },
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Body() createStrategyDto: CreateStrategyDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user,
  ) {
    return this.strategiesService.create(createStrategyDto, user.id, file);
  }

  @Get()
  @ApiOperation({ summary: 'Get all strategies' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: StrategyStatus })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(
    @CurrentUser() user,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: StrategyStatus,
    @Query('search') search?: string,
  ) {
    return this.strategiesService.findAll(user, page, limit, status, search);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get strategy statistics' })
  async getStats(@CurrentUser() user) {
    return this.strategiesService.getStrategyStats(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get strategy by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiQuery({ name: 'includeStats', required: false, type: Boolean })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user,
    @Query('includeStats') includeStats?: boolean,
  ) {
    return this.strategiesService.findOne(id, user, includeStats === true);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download strategy file' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async downloadFile(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user,
    @Res() res: Response,
  ) {
    const file = await this.strategiesService.getStrategyFile(id, user);
    
    const fileStream = fs.createReadStream(file.path);
    res.setHeader('Content-Type', 'text/x-python');
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    fileStream.pipe(res);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update strategy' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStrategyDto: UpdateStrategyDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user,
  ) {
    return this.strategiesService.update(id, updateStrategyDto, user, file);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete strategy' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user,
  ) {
    await this.strategiesService.remove(id, user);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate strategy' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user,
    @Body('name') newName?: string,
  ) {
    return this.strategiesService.duplicate(id, user, newName);
  }

  @Post(':id/backtest')
  @ApiOperation({ summary: 'Run backtest for strategy' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async runBacktest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user,
  ) {
    return this.strategiesService.runBacktest(id, user);
  }

  @Get(':id/backtest-results')
  @ApiOperation({ summary: 'Get all backtest results' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getBacktestResults(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.strategiesService.getBacktestResults(id, user, page, limit);
  }

  @Get(':id/latest-backtest')
  @ApiOperation({ summary: 'Get latest backtest result' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async getLatestBacktestResult(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user,
  ) {
    return this.strategiesService.getLatestBacktestResult(id, user);
  }
}