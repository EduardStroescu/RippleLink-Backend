import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateChatDto {
  @ApiPropertyOptional({
    description: 'New Chat Name',
    type: String,
  })
  @IsOptional()
  @IsString()
  name?: string;
}
