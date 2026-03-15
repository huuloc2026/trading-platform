import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  UseGuards, 
  Request, 
  Delete,
  Patch,
  UseInterceptors,
  UploadedFile,
  HttpStatus,
  HttpCode
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../common/decorators/roles.decorator';

import { StrategiesService } from './strategies.service';
import { CreateStrategyDto } from './dto/create-strategy.dto';
import { UpdateStrategyDto } from './dto/update-strategy.dto';
import { 
  ApiTags, 
  ApiBearerAuth, 
  ApiConsumes, 
  ApiBody,
  ApiOperation,
  ApiResponse 
} from '@nestjs/swagger';

@ApiTags('strategies')
@ApiBearerAuth()
@Controller('strategies')
@UseGuards(AuthGuard('jwt'))
export class StrategiesController {
  constructor(private strategiesService: StrategiesService) {}

  @Post()
  @ApiOperation({ summary: 'Upload a new strategy' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
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
    @Request() req,
  ) {
    return this.strategiesService.create(createStrategyDto, req.user.id, file);
  }

  @Get()
  @ApiOperation({ summary: 'Get all strategies (filtered by role)' })
  async findAll(@Request() req) {
    return this.strategiesService.findAll(req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get strategy by ID' })
  async findOne(@Param('id') id: string, @Request() req) {
    return this.strategiesService.findOne(id, req.user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update strategy' })
  async update(
    @Param('id') id: string,
    @Body() updateStrategyDto: UpdateStrategyDto,
    @Request() req,
  ) {
    return this.strategiesService.update(id, updateStrategyDto, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete strategy' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @Request() req) {
    return this.strategiesService.remove(id, req.user);
  }

  @Post(':id/backtest')
  @ApiOperation({ summary: 'Run backtest for strategy' })
  async runBacktest(@Param('id') id: string, @Request() req) {
    return this.strategiesService.runBacktest(id, req.user);
  }

  @Get(':id/backtest-results')
  @ApiOperation({ summary: 'Get all backtest results for strategy' })
  async getBacktestResults(@Param('id') id: string, @Request() req) {
    return this.strategiesService.getBacktestResults(id, req.user);
  }

  @Get(':id/latest-backtest')
  @ApiOperation({ summary: 'Get latest backtest result for strategy' })
  async getLatestBacktestResult(@Param('id') id: string, @Request() req) {
    return this.strategiesService.getLatestBacktestResult(id, req.user);
  }
}