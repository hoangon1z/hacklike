import { Controller, Get, Query } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { FinanceService } from './finance.service';

class FinanceQuery {
  @IsIn(['today','7d','30d','all']) period: string = '30d';
}
@Roles(UserRole.ADMIN,UserRole.SUPER_ADMIN)
@Controller('admin/finance')
export class FinanceController {
  constructor(private readonly finance:FinanceService){}
  @Get('overview') async overview(@Query() query:FinanceQuery){return {success:true,data:await this.finance.overview(query.period)};}
}
