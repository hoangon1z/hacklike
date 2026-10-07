import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService, private readonly config: ConfigService) {}
  private publicUser(user: { id:string; email:string; displayName:string; role:string; status:string; passwordChangeRequired?:boolean; wallet?:{balance:unknown;reserved:unknown}|null }) {
    return {
      id:user.id,
      email:user.email,
      displayName:user.displayName,
      role:user.role,
      status:user.status,
      passwordChangeRequired:user.passwordChangeRequired??false,
      ...(user.wallet ? { wallet:user.wallet } : {}),
    };
  }
  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new UnauthorizedException('Account unavailable');
    const user = await this.prisma.user.create({ data: { email, displayName: dto.displayName.trim(), passwordHash: await hash(dto.password, 12), wallet: { create: {} } } });
    return this.publicUser(user);
  }
  async login(dto: LoginDto, meta: { userAgent?: string; ipAddress?: string }) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() }, include:{wallet:true} });
    if (!user || user.status !== 'ACTIVE' || !await compare(dto.password, user.passwordHash)) throw new UnauthorizedException();
    const payload = { sub: user.id, email: user.email, role: user.role, v: user.tokenVersion };
    const accessToken = await this.jwt.signAsync(payload, { secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), expiresIn: '15m' });
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshSession.create({ data: { userId: user.id, tokenHash: createHash('sha256').update(refreshToken).digest('hex'), userAgent: meta.userAgent, ipAddress: meta.ipAddress, expiresAt: new Date(Date.now() + 30*24*60*60*1000) } });
    return { user: this.publicUser(user), accessToken, refreshToken };
  }
  async refresh(token?: string) {
    if (!token) throw new UnauthorizedException();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const session = await this.prisma.refreshSession.findUnique({ where: { tokenHash }, include: { user:{include:{wallet:true}} } });
    if (!session || session.revokedAt || session.expiresAt < new Date() || session.user.status !== 'ACTIVE') throw new UnauthorizedException();
    const accessToken = await this.jwt.signAsync({ sub: session.user.id, email: session.user.email, role: session.user.role, v: session.user.tokenVersion }, { secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), expiresIn: '15m' });
    const refreshToken=randomBytes(48).toString('base64url');
    const rotated=await this.prisma.refreshSession.updateMany({where:{id:session.id,tokenHash,revokedAt:null},data:{tokenHash:createHash('sha256').update(refreshToken).digest('hex')}});
    if(rotated.count!==1)throw new UnauthorizedException();
    return { user: this.publicUser(session.user), accessToken,refreshToken };
  }
  async logout(refreshToken?: string) {
    if (refreshToken) await this.prisma.refreshSession.updateMany({ where: { tokenHash: createHash('sha256').update(refreshToken).digest('hex'), revokedAt: null }, data: { revokedAt: new Date() } });
  }
  me(userId: string) { return this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id:true,email:true,displayName:true,role:true,status:true,passwordChangeRequired:true,wallet:{select:{balance:true,reserved:true}} } }); }
}
