import {Body,Controller,Get,Param,Patch,Post,Query} from '@nestjs/common';
import {UserRole} from '@prisma/client';
import {Roles} from '../auth/roles.decorator';
import {CurrentUser} from '../auth/current-user.decorator';
import {AuthUser} from '../auth/auth.types';
import {ManagementService} from './management.service';
import {CreateManagedUserDto,EditManagedUserDto,ResetManagedPasswordDto,WalletAdjustmentDto,ManagedOrderActionDto,PaymentReconcileDto,PageQuery,ReasonDto,ManagedPaymentActionDto} from './dto/management.dto';

@Roles(UserRole.ADMIN,UserRole.SUPER_ADMIN)
@Controller('admin/management')
export class ManagementController {
 constructor(private readonly service:ManagementService){}
 @Get('users') async users(@Query() q:PageQuery){return {success:true,data:await this.service.users(q)};}
 @Post('users') async create(@Body() dto:CreateManagedUserDto,@CurrentUser() actor:AuthUser){return {success:true,data:await this.service.createUser(dto,actor)};}
 @Get('users/:id') async user(@Param('id') id:string){return {success:true,data:await this.service.userDetail(id)};}
 @Patch('users/:id') async edit(@Param('id') id:string,@Body() dto:EditManagedUserDto,@CurrentUser() actor:AuthUser){return {success:true,data:await this.service.editUser(id,dto,actor)};}
 @Post('users/:id/password') async reset(@Param('id') id:string,@Body() dto:ResetManagedPasswordDto,@CurrentUser() actor:AuthUser){return {success:true,data:await this.service.resetPassword(id,dto,actor)};}
 @Post('users/:id/wallet') async wallet(@Param('id') id:string,@Body() dto:WalletAdjustmentDto,@CurrentUser() actor:AuthUser){return {success:true,data:await this.service.adjustWallet(id,dto,actor)};}
 @Get('orders') async orders(@Query() q:PageQuery){return {success:true,data:await this.service.orders(q)};}
 @Get('orders/:id') async order(@Param('id') id:string){return {success:true,data:await this.service.orderDetail(id)};}
 @Post('orders/:id/action') async action(@Param('id') id:string,@Body() dto:ManagedOrderActionDto,@CurrentUser() actor:AuthUser){return {success:true,data:await this.service.orderAction(id,dto,actor)};}
 @Get('payments/stats') async stats(@Query() q:PageQuery){return {success:true,data:await this.service.paymentStats(q)};}
 @Get('payments/unmatched') async unmatched(@Query() q:PageQuery){return {success:true,data:await this.service.unmatched(q)};}
 @Get('payments') async payments(@Query() q:PageQuery){return {success:true,data:await this.service.payments(q)};}
 @Get('payments/:id') async payment(@Param('id') id:string){return {success:true,data:await this.service.paymentDetail(id)};}
 @Post('payments/import-sepay/:id') async importPayment(@Param('id') id:string,@Body() dto:ReasonDto,@CurrentUser() actor:AuthUser){return {success:true,data:await this.service.importSepay(id,dto.reason,actor)};}
 @Post('payments/:id/reconcile') async reconcile(@Param('id') id:string,@Body() dto:PaymentReconcileDto,@CurrentUser() actor:AuthUser){return {success:true,data:await this.service.reconcilePayment(id,dto,actor)};}
 @Post('payments/:id/action') async actionPayment(@Param('id') id:string,@Body() dto:ManagedPaymentActionDto,@CurrentUser() actor:AuthUser){return {success:true,data:await this.service.paymentAction(id,dto,actor)};}
 @Get('audits') async audits(@Query() q:PageQuery){return {success:true,data:await this.service.audits(q)};}
}
