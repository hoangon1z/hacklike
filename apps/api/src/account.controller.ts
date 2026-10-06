import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { compare, hash } from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { PrismaService } from './prisma/prisma.service';
import { CurrentUser } from './auth/current-user.decorator';
import { AuthUser } from './auth/auth.types';
import { Roles } from './auth/roles.decorator';
import { DomainError } from './shared/domain-error';

class ProfileDto {
  @IsString() @MinLength(1) @MaxLength(80) displayName!: string;
}
class PasswordDto {
  @IsString() @MaxLength(128) currentPassword!: string;
  @IsString() @MinLength(12) @MaxLength(128) newPassword!: string;
}
class AnnouncementDto {
  @IsString() @MinLength(1) @MaxLength(160) title!: string;
  @IsString() @MinLength(1) @MaxLength(20000) content!: string;
  @IsIn(['NEWS', 'PROMOTION', 'NOTICE']) kind!: string;
  @IsBoolean() published!: boolean;
}

@Controller('account')
export class AccountController {
  constructor(private readonly db: PrismaService) {}
  @Get('dashboard') async dashboard(@CurrentUser() user: AuthUser) {
    const offset = 7 * 3600000;
    const localDay = new Date(Date.now() + offset); localDay.setUTCHours(0,0,0,0); localDay.setUTCDate(localDay.getUTCDate()-29);
    const from = new Date(localDay.getTime() - offset);
    const walletWhere = { wallet: { userId: user.sub } };
    const [deposits, captures, refunds, count, recent, chartRows, posts] = await Promise.all([
      this.db.walletTransaction.aggregate({where:{...walletWhere,type:'DEPOSIT'},_sum:{amount:true}}),
      this.db.walletTransaction.aggregate({where:{...walletWhere,type:'ORDER_CAPTURE'},_sum:{amount:true},_count:true}),
      this.db.walletTransaction.aggregate({where:{...walletWhere,type:'REFUND'},_sum:{amount:true}}),
      this.db.order.count({where:{userId:user.sub}}),
      this.db.order.count({where:{userId:user.sub,createdAt:{gte:from}}}),
      this.db.walletTransaction.findMany({where:{...walletWhere,type:{in:['ORDER_CAPTURE','REFUND']},createdAt:{gte:from}},select:{amount:true,createdAt:true}}),
      this.db.announcement.findMany({where:{published:true},orderBy:{createdAt:'desc'},take:30}),
    ]);
    const spending = Math.max(0,-Number(captures._sum.amount??0)-Number(refunds._sum.amount??0));
    const daily = Array.from({length:30},(_,i)=>({date:new Date(localDay.getTime()+i*86400000).toISOString().slice(0,10),amount:0}));
    for(const row of chartRows){const bucket=daily.find(x=>x.date===new Date(row.createdAt.getTime()+offset).toISOString().slice(0,10));if(bucket)bucket.amount-=Number(row.amount);}
    return {success:true,data:{totalDeposited:Number(deposits._sum.amount??0),totalSpent:spending,orderCount:count,newOrders:recent,averageOrder:captures._count?spending/captures._count:0,daily,posts}};
  }
  @Patch('profile') async profile(@CurrentUser() user: AuthUser,@Body() dto: ProfileDto) {
    if(!dto.displayName.trim())throw new DomainError('INVALID_PROFILE','profile.invalid',422);
    return {success:true,data:await this.db.user.update({where:{id:user.sub},data:{displayName:dto.displayName.trim()},select:{id:true,email:true,displayName:true}})};
  }
  @Patch('password') async password(@CurrentUser() user: AuthUser,@Body() dto: PasswordDto) {
    const account=await this.db.user.findUniqueOrThrow({where:{id:user.sub}});
    if(!await compare(dto.currentPassword,account.passwordHash))throw new DomainError('WRONG_PASSWORD','profile.wrong_password',422);
    const passwordHash=await hash(dto.newPassword,12);
    await this.db.$transaction([this.db.user.update({where:{id:user.sub},data:{passwordHash,tokenVersion:{increment:1}}}),this.db.refreshSession.updateMany({where:{userId:user.sub,revokedAt:null},data:{revokedAt:new Date()}})]);
    return {success:true,data:{updated:true}};
  }
  @Get('notifications') async notifications(@CurrentUser() user: AuthUser) {
    const [history, payments, posts] = await Promise.all([
      this.db.orderStatusHistory.findMany({where:{order:{userId:user.sub}},include:{order:{select:{publicId:true,publicMessage:true,service:{select:{category:{select:{name:true}}}}}}},orderBy:{createdAt:'desc'},take:50}),
      this.db.walletTransaction.findMany({where:{wallet:{userId:user.sub},type:{in:['DEPOSIT','REFUND']}},orderBy:{createdAt:'desc'},take:30}),
      this.db.announcement.findMany({where:{published:true},orderBy:{createdAt:'desc'},take:30}),
    ]);
    const events=[...history.map(x=>({id:`order:${x.id}`,title:`Đơn ${x.order.publicId}`,status:x.toStatus,content:'Trạng thái đơn hàng đã được cập nhật.',createdAt:x.createdAt,href:`/orders?group=${encodeURIComponent(x.order.service.category.name)}`})),...payments.map(x=>({id:`wallet:${x.id}`,title:x.type==='DEPOSIT'?'Nạp tiền thành công':'Hoàn tiền đơn hàng',content:`${Number(x.amount).toLocaleString('vi-VN')} VND đã được cộng vào tài khoản.`,createdAt:x.createdAt,href:'/deposit'})),...posts.map(x=>({id:`post:${x.id}:${x.updatedAt.getTime()}`,title:x.title,content:x.content,createdAt:x.updatedAt,href:'/dashboard'}))].sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime()).slice(0,60);
    const reads=await this.db.notificationRead.findMany({where:{userId:user.sub,eventId:{in:events.map(x=>x.id)}}});
    return {success:true,data:events.map(x=>({...x,read:reads.some(r=>r.eventId===x.id)}))};
  }
  @Post('notifications/read') async read(@CurrentUser() user: AuthUser) {
    const {data}=await this.notifications(user);
    await this.db.notificationRead.createMany({data:data.map(x=>({userId:user.sub,eventId:x.id})),skipDuplicates:true});
    return {success:true,data:{updated:true}};
  }
}

@Roles(UserRole.ADMIN,UserRole.SUPER_ADMIN)
@Controller('admin/announcements')
export class AnnouncementsController {
  constructor(private readonly db: PrismaService) {}
  @Get() async list(){return {success:true,data:await this.db.announcement.findMany({orderBy:{createdAt:'desc'},take:100})};}
  @Post() async create(@CurrentUser() user:AuthUser,@Body() dto:AnnouncementDto){return {success:true,data:await this.db.announcement.create({data:{...dto,authorId:user.sub}})};}
  @Patch(':id') async update(@Param('id') id:string,@Body() dto:AnnouncementDto){return {success:true,data:await this.db.announcement.update({where:{id},data:dto})};}
}
