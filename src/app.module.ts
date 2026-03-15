import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users/users.module';

import { StrategiesModule } from './strategies/strategies.module';

import { RolesGuard } from './common/guards/roles.guard';


@Module({
  imports: [
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    StrategiesModule,
    UsersModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}