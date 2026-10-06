import { Injectable } from '@nestjs/common';
import { Prisma, WalletTransactionType } from '@prisma/client';
import { DomainError } from '../shared/domain-error';

@Injectable()
export class WalletsService {
  async reserve(tx: Prisma.TransactionClient, userId: string, amount: Prisma.Decimal, referenceId: string, idempotencyKey: string) {
    await tx.$queryRaw`SELECT id FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
    const available = wallet.balance.sub(wallet.reserved);
    if (available.lt(amount)) throw new DomainError('INSUFFICIENT_BALANCE', 'wallet.insufficient_balance', 409);
    const updated = await tx.wallet.update({ where: { id: wallet.id }, data: { reserved: { increment: amount }, version: { increment: 1 } } });
    await tx.walletTransaction.create({ data: { walletId: wallet.id, type: WalletTransactionType.ORDER_RESERVE, amount: amount.negated(), balanceAfter: updated.balance, referenceType: 'ORDER', referenceId, description: 'Giữ tiền đặt đơn', idempotencyKey } });
  }
  async capture(tx: Prisma.TransactionClient, userId: string, amount: Prisma.Decimal, referenceId: string) {
    await tx.$queryRaw`SELECT id FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
    const existing = await tx.walletTransaction.findUnique({ where: { idempotencyKey: `capture:${referenceId}` } });
    if (existing) return;
    if (wallet.reserved.lt(amount) || wallet.balance.lt(amount)) throw new DomainError('INSUFFICIENT_BALANCE', 'wallet.reservation_invalid', 409);
    const updated = await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { decrement: amount }, reserved: { decrement: amount }, version: { increment: 1 } } });
    await tx.walletTransaction.create({ data: { walletId: wallet.id, type: WalletTransactionType.ORDER_CAPTURE, amount: amount.negated(), balanceAfter: updated.balance, referenceType: 'ORDER', referenceId, description: 'Thanh toán đơn hàng', idempotencyKey: `capture:${referenceId}` } });
  }
  async release(tx: Prisma.TransactionClient, userId: string, amount: Prisma.Decimal, referenceId: string, reason = 'Hoàn tiền đơn hàng') {
    await tx.$queryRaw`SELECT id FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
    const existing = await tx.walletTransaction.findUnique({ where: { idempotencyKey: `release:${referenceId}` } });
    if (existing) return;
    const releaseAmount = Prisma.Decimal.min(wallet.reserved, amount);
    await tx.wallet.update({ where: { id: wallet.id }, data: { reserved: { decrement: releaseAmount }, version: { increment: 1 } } });
    await tx.walletTransaction.create({ data: { walletId: wallet.id, type: WalletTransactionType.ORDER_RELEASE, amount: releaseAmount, balanceAfter: wallet.balance, referenceType: 'ORDER', referenceId, description: reason, idempotencyKey: `release:${referenceId}` } });
  }
  async refund(tx: Prisma.TransactionClient, userId: string, amount: Prisma.Decimal, referenceId: string, reason = 'Hoàn tiền đơn hàng') {
    if(amount.lte(0)) return;
    await tx.$queryRaw`SELECT id FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;
    const wallet=await tx.wallet.findUniqueOrThrow({where:{userId}});
    const existing=await tx.walletTransaction.findUnique({where:{idempotencyKey:`refund:${referenceId}`}});
    if(existing) return;
    const updated=await tx.wallet.update({where:{id:wallet.id},data:{balance:{increment:amount},version:{increment:1}}});
    await tx.walletTransaction.create({data:{walletId:wallet.id,type:WalletTransactionType.REFUND,amount,balanceAfter:updated.balance,referenceType:'ORDER',referenceId,description:reason,idempotencyKey:`refund:${referenceId}`}});
  }
  async deposit(tx: Prisma.TransactionClient,userId:string,amount:Prisma.Decimal,referenceId:string,idempotencyKey:string,description='Nạp tiền tự động'){
    if(amount.lte(0)) throw new DomainError('INVALID_PAYMENT_AMOUNT','payment.invalid_amount',422);
    await tx.$queryRaw`SELECT id FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;
    const wallet=await tx.wallet.findUniqueOrThrow({where:{userId}});
    const existing=await tx.walletTransaction.findUnique({where:{idempotencyKey}});
    if(existing)return;
    const updated=await tx.wallet.update({where:{id:wallet.id},data:{balance:{increment:amount},version:{increment:1}}});
    await tx.walletTransaction.create({data:{walletId:wallet.id,type:WalletTransactionType.DEPOSIT,amount,balanceAfter:updated.balance,referenceType:'DEPOSIT',referenceId,description,idempotencyKey}});
  }
}
