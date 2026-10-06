import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';
import { AuthUser } from './auth.types';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService,private readonly config:ConfigService,private readonly prisma:PrismaService) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = request.cookies?.svn_access as string | undefined;
    if (!token) throw new UnauthorizedException();
    try {
      const payload=await this.jwt.verifyAsync<AuthUser>(token,{secret:this.config.getOrThrow('JWT_ACCESS_SECRET')});
      const current=await this.prisma.user.findUnique({where:{id:payload.sub},select:{email:true,role:true,status:true,tokenVersion:true}});
      if(!current||current.status!=='ACTIVE'||(payload.v??0)!==current.tokenVersion)throw new UnauthorizedException();
      request.user={...payload,email:current.email,role:current.role};
      return true;
    }
    catch { throw new UnauthorizedException(); }
  }
}
