import { InjectRedis } from '@nestjs-modules/ioredis';
import {
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { Types } from 'mongoose';
import { ResetRedisCacheDto } from './dto/ResetRedisCache.dto';
import { ConfigService } from '@nestjs/config';
import { StatusService } from 'src/status/status.service';

type QueryOperator = '$eq' | '$ne' | '$gt' | '$lt' | '$gte' | '$lte';
type QueryFilter<T> = Partial<Record<keyof T, { [op in QueryOperator]?: any }>>;

const EXPIRE_TIME_GENERAL_DATA = 3600;
const EXPIRE_TIME_ONLINE_USERS = 3600;

interface Identifiable {
  _id: Types.ObjectId;
}

@Injectable()
export class RedisService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly statusService: StatusService,
  ) {}

  getClient(): Redis {
    return this.redis;
  }

  async getOrSetCache<T>(key: string, cb: () => Promise<T>): Promise<T> {
    try {
      const data = await this.redis.get(key);
      if (data) {
        return JSON.parse(data);
      }
      const freshData = await cb();

      await this.redis.setex(
        key,
        EXPIRE_TIME_GENERAL_DATA,
        JSON.stringify(freshData),
      );

      return freshData;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `An unexpected error occured. Please try again later!`,
      );
    }
  }

  async addToCache<T>(key: string, cb: () => Promise<T>): Promise<T> {
    try {
      // Retrieve existing cache data
      const cacheData = await this.redis.get(key);
      const newData = await cb(); // Get new data to update cache

      if (cacheData) {
        let parsedData: T[] = JSON.parse(cacheData);

        // Ensure parsedData is an array
        if (!Array.isArray(parsedData)) {
          parsedData = [];
        }

        // Append the new data to the cache
        parsedData.push(newData);

        // Update the cache with the modified array
        await this.redis.setex(
          key,
          EXPIRE_TIME_GENERAL_DATA,
          JSON.stringify(parsedData),
        );
      }

      // Return only the new data
      return newData;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `An unexpected error occured. Please try again later!`,
      );
    }
  }

  async updateInCache<T extends Identifiable>(
    key: string,
    cb: () => Promise<T>,
    { addNew = true }: { addNew?: boolean } = {},
  ) {
    try {
      // Retrieve existing cache data
      const cacheData = await this.redis.get(key);
      const updatedData = await cb();

      if (cacheData) {
        let parsedData: T[] = JSON.parse(cacheData);

        // Ensure parsedData is an array
        if (!Array.isArray(parsedData)) {
          parsedData = [];
        }

        // Replace the updated data in the cache
        const index = parsedData.findIndex(
          (item: T) => item._id.toString() === updatedData._id.toString(),
        );
        if (index !== -1) {
          parsedData.splice(index, 1, updatedData);
        } else if (index === -1 && addNew) {
          parsedData.push(updatedData);
        }

        // Update the cache with the modified array
        await this.redis.setex(
          key,
          EXPIRE_TIME_GENERAL_DATA,
          JSON.stringify(parsedData),
        );
      }

      // Return only the updated data
      return updatedData;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `An unexpected error occured. Please try again later!`,
      );
    }
  }

  async updateInCacheByFilter<T extends Identifiable>(
    key: string,
    filter: QueryFilter<T>,
    target: keyof T,
    value: T[keyof T],
  ) {
    try {
      const cacheData = await this.redis.get(key);

      if (cacheData) {
        let parsedData: T[] = JSON.parse(cacheData);
        if (!Array.isArray(parsedData)) {
          return;
        }

        parsedData = parsedData.map((item) => {
          let shouldUpdate = true;

          for (const [key, conditions] of Object.entries(filter)) {
            const valueToCheck = item[key as keyof T];

            for (const [op, expectedValue] of Object.entries(conditions)) {
              switch (op) {
                case '$eq':
                  if (valueToCheck !== expectedValue) shouldUpdate = false;
                  break;
                case '$ne':
                  if (valueToCheck === expectedValue) shouldUpdate = false;
                  break;
                case '$gt':
                  if (valueToCheck <= expectedValue) shouldUpdate = false;
                  break;
                case '$lt':
                  if (valueToCheck >= expectedValue) shouldUpdate = false;
                  break;
                case '$gte':
                  if (valueToCheck < expectedValue) shouldUpdate = false;
                  break;
                case '$lte':
                  if (valueToCheck > expectedValue) shouldUpdate = false;
                  break;
                default:
                  throw new Error(`Unsupported operator ${op}`);
              }
            }
          }

          return shouldUpdate ? { ...item, [target]: value } : item;
        });

        await this.redis.setex(
          key,
          EXPIRE_TIME_GENERAL_DATA,
          JSON.stringify(parsedData),
        );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `An unexpected error occured. Please try again later!`,
      );
    }
  }

  async deleteFromCache<T extends Identifiable>(
    key: string,
    cb: () => Promise<T>,
  ) {
    try {
      // Retrieve existing cache data
      const cacheData = await this.redis.get(key);
      const deletedData = await cb();

      if (cacheData) {
        let parsedData: T[] = JSON.parse(cacheData);

        // Ensure parsedData is an array
        if (Array.isArray(parsedData)) {
          parsedData = parsedData.filter(
            (item: T) => item._id.toString() !== deletedData._id.toString(),
          );

          // Update the cache with the modified array
          await this.redis.setex(
            key,
            EXPIRE_TIME_GENERAL_DATA,
            JSON.stringify(parsedData),
          );
        }
      }

      // Return only the deleted data
      return deletedData;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `An unexpected error occured. Please try again later!`,
      );
    }
  }

  async invalidateCacheKey<T extends Identifiable>(
    key: string,
    cb: () => Promise<T>,
  ) {
    try {
      this.redis.del(key);
      return await cb();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `An unexpected error occured. Please try again later!`,
      );
    }
  }

  // Add user to the online users redis set
  async connectUser(userId: string): Promise<void> {
    try {
      await this.redis.sadd('onlineUsers', userId, EXPIRE_TIME_ONLINE_USERS);
    } catch (error) {
      throw new InternalServerErrorException(
        `An unexpected error occured. Please try again later!`,
      );
    }
  }

  // Remove user from the online users redis set
  async disconnectUser(userId: string): Promise<void> {
    try {
      await this.redis.srem('onlineUsers', userId);
      await this.statusService.disconnectUser(new Types.ObjectId(userId));
    } catch (error) {
      throw new InternalServerErrorException(
        'Error removing user from online set',
      );
    }
  }

  async getOnlineUsers(): Promise<string[]> {
    try {
      return await this.redis.smembers('onlineUsers');
    } catch (error) {
      throw new InternalServerErrorException(
        `An unexpected error occured. Please try again later!`,
      );
    }
  }

  async isUserOnline(userId: string): Promise<boolean> {
    try {
      return !!(await this.redis.sismember('onlineUsers', userId));
    } catch (error) {
      throw new InternalServerErrorException(
        `An unexpected error occured. Please try again later!`,
      );
    }
  }

  async checkConnection(): Promise<string> {
    try {
      const result = await this.redis.ping();
      return result;
    } catch (error) {
      throw new InternalServerErrorException(
        `Redis is not running. Please try again later!`,
      );
    }
  }

  async resetCache(resetRedisCacheDto: ResetRedisCacheDto): Promise<void> {
    try {
      const adminId = this.configService.get('ADMIN_ID');
      const adminPassword = this.configService.get('ADMIN_PASSWORD');

      if (
        adminId !== resetRedisCacheDto.adminId ||
        adminPassword !== resetRedisCacheDto.adminPassword
      ) {
        throw new InternalServerErrorException('Invalid admin credentials.');
      }

      await this.redis.flushall();
    } catch (error) {
      throw new InternalServerErrorException(
        `An unexpected error occured. Please try again later!`,
      );
    }
  }
}
