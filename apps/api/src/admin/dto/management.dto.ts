import {Type} from 'class-transformer';
import {IsEmail,IsEnum,IsISO8601,IsIn,IsInt,IsNumber,IsOptional,IsString,IsUUID,Max,MaxLength,Min,MinLength,NotEquals,Matches} from 'class-validator';
import {UserRole,UserStatus} from '@prisma/client';

export class PageQuery {
 @IsOptional() @Type(()=>Number) @IsInt() @Min(1) page:number=1;
 @IsOptional() @Type(()=>Number) @IsInt() @Min(10) @Max(100) pageSize:number=25;
 @IsOptional() @IsString() @MaxLength(120) search?:string;
 @IsOptional() @IsString() @MaxLength(50) status?:string;
 @IsOptional() @IsString() @MaxLength(50) method?:string;
 @IsOptional() @IsISO8601() from?:string;
 @IsOptional() @IsISO8601() to?:string;
}
export class ReasonDto {
 @IsString() @MinLength(3) @MaxLength(500) @Matches(/\S/) reason!:string;
}
export class CreateManagedUserDto extends ReasonDto {
 @IsEmail() @MaxLength(254) email!:string;
 @IsString() @MinLength(1) @MaxLength(80) @Matches(/\S/) displayName!:string;
 @IsString() @MinLength(12) @MaxLength(128) password!:string;
 @IsOptional() @IsEnum(UserRole) role:UserRole=UserRole.CUSTOMER;
 @IsOptional() @IsEnum(UserStatus) status:UserStatus=UserStatus.ACTIVE;
}
export class EditManagedUserDto extends ReasonDto {
 @IsOptional() @IsEmail() @MaxLength(254) email?:string;
 @IsOptional() @IsString() @MinLength(1) @MaxLength(80) @Matches(/\S/) displayName?:string;
 @IsOptional() @IsEnum(UserRole) role?:UserRole;
 @IsOptional() @IsEnum(UserStatus) status?:UserStatus;
}
export class ResetManagedPasswordDto extends ReasonDto {
 @IsString() @MinLength(12) @MaxLength(128) password!:string;
}
export class WalletAdjustmentDto extends ReasonDto {
 @IsNumber({maxDecimalPlaces:2}) @Min(-1000000000) @Max(1000000000) @NotEquals(0) amount!:number;
 @IsUUID() requestId!:string;
}
export class ManagedOrderActionDto extends ReasonDto {
 @IsIn(['RETRY','CANCEL_RELEASE','CONFIRM_SUBMITTED','SYNC_STATUS','RESCHEDULE','REFILL']) action!:string;
 @IsOptional() @IsString() @MaxLength(100) providerOrderId?:string;
 @IsOptional() @IsISO8601() scheduledAt?:string;
}
export class PaymentReconcileDto extends ReasonDto {
 @IsString() @MinLength(1) paymentTransactionId!:string;
 @IsNumber({maxDecimalPlaces:2}) @Min(0.01) @Max(1000000000) amountVnd!:number;
}
export class ManagedPaymentActionDto extends ReasonDto {
 @IsIn(['REVIEW','REJECT']) action!:string;
}
