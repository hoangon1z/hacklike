import { IsEmail, IsString, Length, MinLength } from 'class-validator';
export class RegisterDto {
  @IsEmail() email!: string;
  @IsString() @Length(2, 80) displayName!: string;
  @IsString() @MinLength(10) password!: string;
}
export class LoginDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
}
