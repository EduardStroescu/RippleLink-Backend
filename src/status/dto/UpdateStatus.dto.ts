import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateStatusDto {
  @ApiProperty({
    description: 'The status message of the user',
    type: String,
  })
  @IsString()
  statusMessage: string;
}
