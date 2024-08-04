import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    type: String,
    description: 'Refresh token issued by the server (required)',
  })
  @IsJWT()
  @IsNotEmpty()
  refresh_token: string;
}
