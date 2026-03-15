import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiBearerAuth, 
  ApiOperation, 
  ApiResponse,
  ApiQuery,
  ApiParam
} from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto, CreateOrganizationWithAdminDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationResponseDto, OrganizationWithStatsDto } from './dto/organization-response.dto';

import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

import { Public } from '../common/decorators/public.decorator';
import { Role, Plan } from '@prisma/client';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@ApiTags('organizations')
@ApiBearerAuth('JWT-auth')
@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create new organization (Admin only)' })
  @ApiResponse({ status: 201, type: OrganizationResponseDto })
  async create(@Body() createOrganizationDto: CreateOrganizationDto) {
    return this.organizationsService.create(createOrganizationDto);
  }

  @Public()
  @Post('with-admin')
  @ApiOperation({ summary: 'Create organization with admin user (Public)' })
  @ApiResponse({ status: 201, description: 'Organization and admin created successfully' })
  async createWithAdmin(@Body() createWithAdminDto: CreateOrganizationWithAdminDto) {
    return this.organizationsService.createWithAdmin(createWithAdminDto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all organizations (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'plan', required: false, enum: Plan })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('plan') plan?: Plan,
    @Query('search') search?: string,
  ) {
    return this.organizationsService.findAll(page, limit, plan, search);
  }

  @Get('my-organization')
  @ApiOperation({ summary: 'Get current user organization' })
  async getMyOrganization(@CurrentUser() user) {
    return this.organizationsService.findOne(user.orgId);
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get organization by ID (Admin only)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiQuery({ name: 'includeStats', required: false, type: Boolean })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('includeStats') includeStats?: boolean,
  ) {
    return this.organizationsService.findOne(id, includeStats === true);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update organization (Admin only)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(id, updateOrganizationDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete organization (Admin only)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.organizationsService.remove(id);
  }

  @Patch(':id/deactivate')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Deactivate organization (Admin only)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationsService.deactivate(id);
  }

  @Patch(':id/activate')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Activate organization (Admin only)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationsService.activate(id);
  }

  @Patch(':id/upgrade-plan')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Upgrade organization plan (Admin only)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async upgradePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('plan') plan: Plan,
  ) {
    return this.organizationsService.upgradePlan(id, plan);
  }

  @Get(':id/dashboard-stats')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get organization dashboard statistics (Admin only)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  async getDashboardStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationsService.getDashboardStats(id);
  }

  @Get(':id/users')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get organization users (Admin only)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getUsers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.organizationsService.getUsers(id, page, limit);
  }

  @Get(':id/strategies')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get organization strategies (Admin only)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getStrategies(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.organizationsService.getStrategies(id, page, limit);
  }
}