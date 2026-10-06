import { UserRole, UserStatus } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, NotEquals } from 'class-validator';
export class UpdateUserDto{
 @IsOptional() @IsEnum(UserStatus) status?:UserStatus;
 @IsOptional() @IsEnum(UserRole) role?:UserRole;
}
export class AdjustWalletDto{
 @IsNumber() @Min(-1000000000) @Max(1000000000) @NotEquals(0) amount!:number;
 @IsString() @MinLength(3) @MaxLength(200) reason!:string;
}
