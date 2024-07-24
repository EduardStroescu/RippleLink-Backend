import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Patch,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import UpdateUserDto from './dto/UpdateUser.dto';
import { JwtGuard } from 'src/auth/guards';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @UseGuards(JwtGuard)
  @Get()
  async getUsers() {
    return await this.usersService.getAllUsers();
  }

  @UseGuards(JwtGuard)
  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    const deletedUser = await this.usersService.deleteUser(id);
    if (!deletedUser) throw new HttpException('User not found', 404);
    return deletedUser;
  }

  @UseGuards(JwtGuard)
  @Get('search/:displayName')
  async getUserByDisplayName(@Param('displayName') displayName: string) {
    console.log(displayName);
    const findUser = await this.usersService.getUserByDisplayName(displayName);
    if (!findUser) throw new HttpException('User not found', 404);
    return findUser;
  }

  @UseGuards(JwtGuard)
  @Patch(':id')
  @UsePipes(new ValidationPipe())
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const updatedUser = await this.usersService.updateUser(id, updateUserDto);
    if (!updatedUser) throw new HttpException('User not found', 404);
    return updatedUser;
  }
}
