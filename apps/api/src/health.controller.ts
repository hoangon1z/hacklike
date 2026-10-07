import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { Public } from './auth/public.decorator';
import { sepayDepositAccounts, sepayConfigured } from './payments/sepay-config';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService,private readonly config:ConfigService) {}
  @Public()
  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { success: true, data: { status: 'ok', timestamp: new Date().toISOString() } };
  }
  @Public()
  @Get('capabilities')
  async capabilities(){
    const settings=await this.prisma.systemSetting.findMany({where:{key:{in:['USDT_RATE','SUPPORT_TELEGRAM','SUPPORT_FANPAGE','BANKING_ENABLED','USDT_TRC20_ENABLED','USDT_BEP20_ENABLED']}}});
    const values=Object.fromEntries(settings.map(x=>[x.key,x.value]));
    const bankingCredentials=sepayConfigured(this.config);
    const usdtCredentials=Boolean(this.config.get('BINANCE_API_KEY')&&this.config.get('BINANCE_API_SECRET'));
    const hasUsdtRate=Number(values.USDT_RATE??0)>0;const trc20Ready=usdtCredentials&&hasUsdtRate&&Boolean(this.config.get('BINANCE_TRC20_ADDRESS'))&&values.USDT_TRC20_ENABLED===true;const bep20Ready=usdtCredentials&&hasUsdtRate&&Boolean(this.config.get('BINANCE_BEP20_ADDRESS'))&&values.USDT_BEP20_ENABLED===true;
    return {success:true,data:{banking:bankingCredentials&&values.BANKING_ENABLED===true,bankAccounts:bankingCredentials?sepayDepositAccounts(this.config).map(({id,bankName,accountNumber})=>({id,bankName,last4:accountNumber.slice(-4)})):[],usdt:trc20Ready||bep20Ready,usdtTrc20:trc20Ready,usdtBep20:bep20Ready,usdtRate:values.USDT_RATE??null,telegram:values.SUPPORT_TELEGRAM??null,fanpage:values.SUPPORT_FANPAGE??null}};
  }
}
