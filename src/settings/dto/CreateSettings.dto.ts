import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateSettingsDto {
  @ApiPropertyOptional({
    description: 'Chat background image as a base64 encoded string.',
    type: String,
  })
  @IsOptional()
  @IsString()
  backgroundImage?: string;

  @ApiPropertyOptional({
    description: 'Chat glow color in RGBA format.',
    type: String,
    example: 'rgba(0,255,227,1)',
  })
  @IsOptional()
  @IsString()
  glowColor?: string;

  @ApiPropertyOptional({
    description: 'Chat tint color in RGBA format.',
    type: String,
    example: 'rgba(0,255,227,1)',
  })
  @IsOptional()
  @IsString()
  tintColor?: string;
}
