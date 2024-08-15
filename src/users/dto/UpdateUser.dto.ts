import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export default class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'User email',
    type: String,
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({
    description: 'User First Name.',
    type: String,
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({
    description: 'User Last Name..',
    type: String,
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({
    description: 'User Display Name will be shown to other users.',
    type: String,
  })
  @IsOptional()
  @IsString()
  displayName?: string;
}
