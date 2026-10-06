import {CallHandler,ExecutionContext,Injectable,NestInterceptor} from '@nestjs/common';
import {defer,lastValueFrom} from 'rxjs';
import {PrismaService} from '../prisma/prisma.service';

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
 constructor(private readonly db:PrismaService){}
 intercept(context:ExecutionContext,next:CallHandler){
  const request=context.switchToHttp().getRequest();
  const path=String(request.path??'');
  if(!request.user||!['POST','PUT','PATCH','DELETE'].includes(request.method)||(!path.startsWith('/api/admin/')&&path!=='/api/services/sync'))return next.handle();
  return defer(async()=>{
   // Do not serialize bodies: passwords, API keys and secrets must never enter the audit trail.
   const record=await this.db.auditLog.create({data:{actorId:request.user.sub,action:'ADMIN_REQUEST',entityType:'ADMIN_OPERATION',entityId:request.params?.id,after:{method:request.method,path,outcome:'STARTED'}}});
   try{const result=await lastValueFrom(next.handle());await this.db.auditLog.update({where:{id:record.id},data:{after:{method:request.method,path,outcome:'SUCCEEDED'}}});return result;}
   catch(error){await this.db.auditLog.update({where:{id:record.id},data:{after:{method:request.method,path,outcome:'FAILED'}}});throw error;}
  });
 }
}
