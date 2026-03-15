import { 
  Injectable, 
  NotFoundException, 
  ConflictException,
  ForbiddenException,
  BadRequestException 
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto, CreateOrganizationWithAdminDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationResponseDto, OrganizationWithStatsDto } from './dto/organization-response.dto';
import { Plan, Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async create(createOrganizationDto: CreateOrganizationDto): Promise<OrganizationResponseDto> {
    const { name, ...rest } = createOrganizationDto;

    // Check if organization with same name exists
    const existingOrg = await this.prisma.organization.findFirst({
      where: { name },
    });

    if (existingOrg) {
      throw new ConflictException('Organization with this name already exists');
    }

    const organization = await this.prisma.organization.create({
      data: {
        name,
        ...rest,
        plan: rest.plan || Plan.FREE,
      },
    });

    return this.mapToResponseDto(organization);
  }

  async createWithAdmin(createWithAdminDto: CreateOrganizationWithAdminDto): Promise<{ organization: OrganizationResponseDto; user: any }> {
    const { adminEmail, adminPassword, adminName, ...orgData } = createWithAdminDto;

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Create organization and admin in transaction
    const result = await this.prisma.$transaction(async (prisma) => {
      // Create organization
      const organization = await prisma.organization.create({
        data: {
          name: orgData.name,
          plan: orgData.plan || Plan.FREE,
          email: orgData.email,
          phone: orgData.phone,
          address: orgData.address,
          website: orgData.website,
          taxId: orgData.taxId,
        },
      });

      // Create admin user
      const admin = await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash: hashedPassword,
          role: Role.ADMIN,
          orgId: organization.id,
          fullName: adminName,
        },
      });

      return { organization, admin };
    });

    const { passwordHash, ...adminWithoutPassword } = result.admin;

    return {
      organization: this.mapToResponseDto(result.organization),
      user: adminWithoutPassword,
    };
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    plan?: Plan,
    search?: string,
  ): Promise<{ data: OrganizationResponseDto[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;

    // Build where clause properly
    const where: any = {};
    
    if (plan) {
      where.plan = plan;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ];
    }

    const [organizations, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              users: true,
            },
          },
        },
      }),
      this.prisma.organization.count({ where }),
    ]);

    const data = organizations.map(org => ({
      ...this.mapToResponseDto(org),
      userCount: org._count?.users || 0,
    }));

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, includeStats: boolean = false): Promise<OrganizationResponseDto | OrganizationWithStatsDto> {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        users: includeStats ? {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            strategies: includeStats ? {
              include: {
                backtestResults: {
                  take: 1,
                  orderBy: { createdAt: 'desc' },
                },
              },
            } : false,
          },
        } : false,
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (includeStats) {
      return this.getOrganizationWithStats(organization);
    }

    return {
      ...this.mapToResponseDto(organization),
      userCount: organization._count?.users || 0,
    };
  }

  async update(id: string, updateOrganizationDto: UpdateOrganizationDto): Promise<OrganizationResponseDto> {
    const organization = await this.findOne(id);

    // Check if name is being changed and if it's already taken
    if (updateOrganizationDto.name && updateOrganizationDto.name !== organization.name) {
      const existingOrg = await this.prisma.organization.findFirst({
        where: { 
          name: updateOrganizationDto.name,
          NOT: { id },
        },
      });

      if (existingOrg) {
        throw new ConflictException('Organization with this name already exists');
      }
    }

    const updated = await this.prisma.organization.update({
      where: { id },
      data: updateOrganizationDto,
    });

    return this.mapToResponseDto(updated);
  }

  async remove(id: string): Promise<void> {
    const organization = await this.findOne(id);

    // Check if organization has users
    const userCount = await this.prisma.user.count({
      where: { orgId: id },
    });

    if (userCount > 0) {
      throw new BadRequestException('Cannot delete organization with existing users. Deactivate it instead.');
    }

    await this.prisma.organization.delete({
      where: { id },
    });
  }

  async deactivate(id: string): Promise<OrganizationResponseDto> {
    const organization = await this.findOne(id);

    if (!organization.isActive) {
      throw new BadRequestException('Organization is already deactivated');
    }

    // Deactivate all users in the organization
    await this.prisma.$transaction([
      this.prisma.user.updateMany({
        where: { orgId: id },
        data: { isActive: false },
      }),
      this.prisma.organization.update({
        where: { id },
        data: { isActive: false },
      }),
    ]);

    return this.findOne(id) as Promise<OrganizationResponseDto>;
  }

  async activate(id: string): Promise<OrganizationResponseDto> {
    const organization = await this.findOne(id);

    if (organization.isActive) {
      throw new BadRequestException('Organization is already active');
    }

    const updated = await this.prisma.organization.update({
      where: { id },
      data: { isActive: true },
    });

    return this.mapToResponseDto(updated);
  }

  async upgradePlan(id: string, newPlan: Plan): Promise<OrganizationResponseDto> {
    const organization = await this.findOne(id);

    if (organization.plan === newPlan) {
      throw new BadRequestException(`Organization already on ${newPlan} plan`);
    }

    const updated = await this.prisma.organization.update({
      where: { id },
      data: { plan: newPlan },
    });

    // Log plan change - you need to create AuditLog model first
    // await this.prisma.auditLog.create({
    //   data: {
    //     organizationId: id,
    //     action: 'PLAN_CHANGED',
    //     details: { from: organization.plan, to: newPlan },
    //   },
    // });

    return this.mapToResponseDto(updated);
  }

  async getDashboardStats(id: string): Promise<any> {
    const organization = await this.findOne(id);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [
      totalUsers,
      activeUsers,
      totalStrategies,
      backtestStats,
      monthlyStats,
    ] = await Promise.all([
      this.prisma.user.count({ where: { orgId: id } }),
      this.prisma.user.count({ where: { orgId: id, isActive: true } }),
      this.prisma.strategy.count({ where: { user: { orgId: id } } }),
      this.prisma.backtestResult.aggregate({
        where: { strategy: { user: { orgId: id } } },
        _avg: {
          sharpeRatio: true,
          maxDrawdown: true,
          totalReturn: true,
        },
        _count: true,
      }),
      this.prisma.backtestResult.count({
        where: {
          strategy: { user: { orgId: id } },
          createdAt: { gte: startOfMonth },
        },
      }),
    ]);

    return {
      overview: {
        totalUsers,
        activeUsers,
        totalStrategies,
        totalBacktests: backtestStats._count,
        monthlyBacktests: monthlyStats,
      },
      performance: {
        averageSharpeRatio: backtestStats._avg.sharpeRatio || 0,
        averageMaxDrawdown: backtestStats._avg.maxDrawdown || 0,
        averageTotalReturn: backtestStats._avg.totalReturn || 0,
      },
    };
  }

  async getUsers(id: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { orgId: id },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              strategies: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where: { orgId: id } }),
    ]);

    return {
      data: users.map(({ passwordHash, ...user }) => ({
        ...user,
        strategyCount: user._count?.strategies || 0,
      })),
      total,
      page,
      limit,
    };
  }

  async getStrategies(id: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [strategies, total] = await Promise.all([
      this.prisma.strategy.findMany({
        where: { user: { orgId: id } },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              email: true,
              fullName: true,
            },
          },
          backtestResults: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.strategy.count({ where: { user: { orgId: id } } }),
    ]);

    return {
      data: strategies,
      total,
      page,
      limit,
    };
  }

  private async getOrganizationWithStats(organization: any): Promise<OrganizationWithStatsDto> {
    const users = organization.users || [];
    const activeUsers = users.filter(u => u.isActive).length;
    
    let totalStrategies = 0;
    let completedBacktests = 0;
    let totalSharpeRatio = 0;
    let totalReturn = 0;
    let backtestCount = 0;

    users.forEach(user => {
      if (user.strategies) {
        totalStrategies += user.strategies.length;
        user.strategies.forEach(strategy => {
          if (strategy.backtestResults?.length > 0) {
            completedBacktests++;
            const latest = strategy.backtestResults[0];
            totalSharpeRatio += latest.sharpeRatio || 0;
            totalReturn += latest.totalReturn || 0;
            backtestCount++;
          }
        });
      }
    });

    return {
      ...this.mapToResponseDto(organization),
      userCount: users.length,
      strategyCount: totalStrategies,
      backtestCount: completedBacktests,
      stats: {
        totalUsers: users.length,
        activeUsers,
        totalStrategies,
        completedBacktests,
        averageSharpeRatio: backtestCount > 0 ? totalSharpeRatio / backtestCount : 0,
        totalReturn: totalReturn,
      },
    };
  }

  private mapToResponseDto(organization: any): OrganizationResponseDto {
    return {
      id: organization.id,
      name: organization.name,
      plan: organization.plan,
      email: organization.email,
      phone: organization.phone,
      address: organization.address,
      website: organization.website,
      taxId: organization.taxId,
      isActive: organization.isActive ?? true,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
      userCount: 0, // Will be set separately
    };
  }
}