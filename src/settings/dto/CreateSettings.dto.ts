import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateSettingsDto {
  @ApiPropertyOptional({
    description: 'Chat background image',
    type: String,
  })
  @IsOptional()
  @IsString()
  backgroundImage?: string;

  @ApiPropertyOptional({
    description: 'Chat glow color',
    type: String,
  })
  @IsOptional()
  @IsString()
  glowColor?: string;

  @ApiPropertyOptional({
    description: 'Chat tint color',
    type: String,
  })
  @IsOptional()
  @IsString()
  tintColor?: string;

  @ApiPropertyOptional({
    description: 'The choice to receive notifications.',
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  receiveNotifications?: boolean;
}
