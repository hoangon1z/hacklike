import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  ValidateIf,
} from "class-validator";

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => value !== "")
  @IsUrl({ require_protocol: true })
  supportTelegram?: string;
  @IsOptional()
  @IsString()
  @ValidateIf((_, value) => value !== "")
  @IsUrl({ require_protocol: true })
  supportFanpage?: string;
  @IsOptional() @IsNumber() @Min(1) usdtRate?: number;
  @IsOptional() @IsNumber() @Min(1) providerRateMultiplier?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1000) defaultMarkupPercent?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) minimumSafeMarginPercent?: number;
  @IsOptional() @IsNumber() @Min(0) providerLowBalanceThreshold?: number;
  @IsOptional() @IsBoolean() bankingEnabled?: boolean;
  @IsOptional() @IsBoolean() usdtTrc20Enabled?: boolean;
  @IsOptional() @IsBoolean() usdtBep20Enabled?: boolean;
  @IsOptional() @IsBoolean() preventLossSales?: boolean;
}
