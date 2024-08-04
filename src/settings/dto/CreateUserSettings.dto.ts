import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateUserSettingsDto {
  @ApiPropertyOptional({
    description: 'Chat background image',
    type: String,
  })
  @IsOptional()
  @IsString()
  backgroundImage?: string;

  @ApiPropertyOptional({
    description: 'The choice to receive notifications.',
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  receiveNotifications?: boolean;
}
