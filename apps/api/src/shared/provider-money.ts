import { Prisma } from '@prisma/client';

export function providerBalanceVnd(balance:string,currency:string,multiplier:Prisma.Decimal.Value){
  const amount=new Prisma.Decimal(balance);
  if(!amount.isFinite()||amount.isNegative())throw new Error('INVALID_PROVIDER_BALANCE');
  if(currency.toUpperCase()==='VND')return amount;
  if(currency.toUpperCase()==='USD'){
    const rate=new Prisma.Decimal(multiplier);
    if(!rate.isFinite()||rate.lte(0))throw new Error('INVALID_PROVIDER_EXCHANGE_RATE');
    return amount.mul(rate);
  }
  throw new Error('UNSUPPORTED_PROVIDER_CURRENCY');
}
