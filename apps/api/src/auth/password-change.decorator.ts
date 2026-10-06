import { SetMetadata } from '@nestjs/common';
export const PASSWORD_CHANGE_ALLOWED = 'passwordChangeAllowed';
export const AllowPasswordChange = () => SetMetadata(PASSWORD_CHANGE_ALLOWED, true);
