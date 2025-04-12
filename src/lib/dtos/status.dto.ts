import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';

export class StatusDto {
  @ApiProperty({
    description: 'Current user status.',
    type: Boolean,
  })
  online: boolean;

  @ApiPropertyOptional({
    description: 'Status message.',
    type: String,
  })
  statusMessage?: string;

  @ApiProperty({
    description: 'Last time the user was seen.',
    type: String,
  })
  lastSeen: string;
}

export class StatusMessageDto extends PickType(StatusDto, [
  'statusMessage',
] as const) {}
