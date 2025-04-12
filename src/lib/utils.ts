import { User } from 'schemas/User.schema';
import { PrivateUserDto } from './dtos/user.dto';
import { StatusDto } from './dtos/status.dto';
import { SettingsDto } from './dtos/settings.dto';

export function stripUserOfSensitiveData(user: User): PrivateUserDto {
  return {
    _id: user._id.toString(),
    email: user.email,
    displayName: user.displayName,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    status: user.status as unknown as StatusDto,
    chats: user.chats as unknown as string[],
    settings: user.settings as unknown as SettingsDto,
  };
}

export function getCallDuration(startDate: string) {
  const start = new Date(startDate).getTime();
  const end = new Date().getTime();
  const durationMs = end - start;

  // Convert milliseconds to hours, minutes, and seconds
  const seconds = Math.floor((durationMs / 1000) % 60);
  const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
  const hours = Math.floor(durationMs / (1000 * 60 * 60));

  return `${hours ? hours + 'h ' : ''}${minutes ? minutes + 'm ' : ''}${seconds}s`;
}
