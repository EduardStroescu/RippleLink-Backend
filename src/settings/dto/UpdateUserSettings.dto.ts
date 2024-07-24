import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateUserSettingsDto {
  @IsOptional()
  @IsString()
  backgroundImage?: string;

  @IsOptional()
  @IsBoolean()
  receiveNotifications?: boolean;
}
