import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SettingsDto {
  @ApiProperty({
    description: 'Settings ID',
    type: String,
  })
  _id: string;

  @ApiProperty({
    description: 'User ID',
    type: String,
  })
  userId: string;

  @ApiPropertyOptional({
    description: 'Chat background image url.',
    type: String,
  })
  backgroundImage?: string;

  @ApiPropertyOptional({
    description: 'Chat glow color in RGBA format.',
    type: String,
    example: 'rgba(0,255,227,1)',
  })
  glowColor?: string;

  @ApiPropertyOptional({
    description: 'Chat tint color in RGBA format.',
    type: String,
    example: 'rgba(0,255,227,1)',
  })
  tintColor?: string;
}
