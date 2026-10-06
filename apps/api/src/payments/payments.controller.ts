import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { Public } from '../auth/public.decorator';
import { DomainError } from '../shared/domain-error';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController{
 constructor(private readonly payments:PaymentsService,private readonly config:ConfigService){}
 @Post('deposits') async create(@CurrentUser() user:AuthUser,@Body() dto:CreateDepositDto){return {success:true,data:await this.payments.create(user.sub,dto)}}
 @Get('deposits') async list(@CurrentUser() user:AuthUser){return {success:true,data:await this.payments.list(user.sub)}}
 @Public() @Post('sepay/webhook') async sepay(@Headers('authorization') authorization:string|undefined,@Headers('x-webhook-secret') secret:string|undefined,@Body() payload:Record<string,unknown>){
   const expected=this.config.get<string>('SEPAY_WEBHOOK_SECRET');const supplied=secret??authorization?.replace(/^Apikey\s+/i,'');
   if(!expected||supplied!==expected)throw new DomainError('UNAUTHORIZED_WEBHOOK','payment.unauthorized_webhook',401);
   await this.payments.processSepay(payload);return {success:true};
 }
}
