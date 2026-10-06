import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
export enum AdminOrderAction { RETRY='RETRY',CANCEL_RELEASE='CANCEL_RELEASE',CONFIRM_SUBMITTED='CONFIRM_SUBMITTED' }
export class OrderActionDto{
 @IsEnum(AdminOrderAction) action!:AdminOrderAction;
 @IsOptional() @IsString() @MinLength(1) providerOrderId?:string;
}
