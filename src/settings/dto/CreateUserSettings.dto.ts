import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateUserSettingsDto {
  @IsOptional()
  @IsString()
  backgroundImage?: string;

  @IsOptional()
  @IsBoolean()
  receiveNotifications?: boolean;
}
