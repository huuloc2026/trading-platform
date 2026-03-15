import { 
  Injectable, 
  NotFoundException, 
  ConflictException,
  ForbiddenException 
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const { email, password, organizationId, role, fullName } = createUserDto;

    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    // Check if organization exists
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: role || Role.RESEARCHER,
        orgId: organizationId,
        fullName,
        isActive: true,
      },
      include: {
        organization: true,
      },
    });

    const { passwordHash: _, ...result } = user;
    return result as UserResponseDto;
  }

  async findAll(orgId?: string, role?: Role): Promise<UserResponseDto[]> {
    const users = await this.prisma.user.findMany({
      where: {
        ...(orgId && { orgId }),
        ...(role && { role }),
      },
      include: {
        organization: true,
        _count: {
          select: {
            strategies: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users.map(({ passwordHash, ...user }) => user as UserResponseDto);
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        organization: true,
        strategies: {
          take: 5,
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { passwordHash, ...result } = user;
    return result as UserResponseDto;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto, currentUser: any): Promise<UserResponseDto> {
    const user = await this.findOne(id);

    // Check permissions
    if (currentUser.role !== Role.ADMIN && currentUser.id !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }

    // If updating password, hash it
    const data: any = { ...updateUserDto };
    if (updateUserDto.password) {
      data.passwordHash = await bcrypt.hash(updateUserDto.password, 10);
      delete data.password;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data,
      include: {
        organization: true,
      },
    });

    const { passwordHash, ...result } = updatedUser;
    return result as UserResponseDto;
  }

  async remove(id: string, currentUser: any): Promise<void> {
    const user = await this.findOne(id);

    // Only admin can delete users
    if (currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can delete users');
    }

    // Don't allow deleting yourself
    if (currentUser.id === id) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    await this.prisma.user.delete({
      where: { id },
    });
  }

  async deactivate(id: string, currentUser: any): Promise<UserResponseDto> {
    // Only admin can deactivate users
    if (currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can deactivate users');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      include: {
        organization: true,
      },
    });

    const { passwordHash, ...result } = user;
    return result as UserResponseDto;
  }

  async activate(id: string, currentUser: any): Promise<UserResponseDto> {
    // Only admin can activate users
    if (currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can activate users');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: true },
      include: {
        organization: true,
      },
    });

    const { passwordHash, ...result } = user;
    return result as UserResponseDto;
  }

  async getUsersByOrganization(orgId: string): Promise<UserResponseDto[]> {
    const users = await this.prisma.user.findMany({
      where: { orgId },
      include: {
        organization: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users.map(({ passwordHash, ...user }) => user as UserResponseDto);
  }
}