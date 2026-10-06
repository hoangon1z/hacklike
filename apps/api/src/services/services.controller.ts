import { Controller, Get, Post } from '@nestjs/common';
import { ServicesService } from './services.service';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}
  @Public() @Get() async list() { return { success: true, data: await this.services.publicList() }; }
  @Roles(UserRole.ADMIN,UserRole.SUPER_ADMIN) @Post('sync') async sync() { return { success: true, data: await this.services.syncFromProvider() }; }
}
