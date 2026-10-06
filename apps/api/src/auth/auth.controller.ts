import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { Public } from './public.decorator';
import { AuthUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  private cookies(res: Response, access: string, refresh?: string) {
    const secure = process.env.NODE_ENV === 'production';
    res.cookie('svn_access', access, { httpOnly:true, secure, sameSite:'lax', maxAge:15*60*1000, path:'/' });
    if (refresh) res.cookie('svn_refresh', refresh, { httpOnly:true, secure, sameSite:'strict', maxAge:30*24*60*60*1000, path:'/api/auth' });
  }
  @Public() @Post('register') async register(@Body() dto:RegisterDto) { return { success:true,data:await this.auth.register(dto) }; }
  @Public() @Post('login') async login(@Body() dto:LoginDto,@Req() req:Request,@Res({passthrough:true}) res:Response) { const result=await this.auth.login(dto,{userAgent:req.get('user-agent'),ipAddress:req.ip});this.cookies(res,result.accessToken,result.refreshToken);return {success:true,data:{user:result.user}}; }
  @Public() @Post('refresh') async refresh(@Req() req:Request,@Res({passthrough:true}) res:Response) { const result=await this.auth.refresh(req.cookies?.svn_refresh);this.cookies(res,result.accessToken,result.refreshToken);return {success:true,data:{user:result.user}}; }
  @Post('logout') async logout(@Req() req:Request,@Res({passthrough:true}) res:Response) { await this.auth.logout(req.cookies?.svn_refresh);res.clearCookie('svn_access',{path:'/'});res.clearCookie('svn_refresh',{path:'/api/auth'});return {success:true,data:null}; }
  @Get('me') async me(@CurrentUser() user:AuthUser) { return {success:true,data:await this.auth.me(user.sub)}; }
}
