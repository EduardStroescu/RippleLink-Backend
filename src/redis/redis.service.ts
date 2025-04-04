import { InjectRedis } from '@nestjs-modules/ioredis';
import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { Types } from 'mongoose';
import { ResetRedisCacheDto } from './dto/ResetRedisCache.dto';
import { ConfigService } from '@nestjs/config';
import { StatusService } from 'src/status/status.service';
import { CallDto } from 'src/lib/dtos/call.dto';

type QueryOperator = '$eq' | '$ne' | '$gt' | '$lt' | '$gte' | '$lte';
type QueryFilter<T> = Partial<Record<keyof T, { [op in QueryOperator]?: any }>>;

interface Identifiable {
  _id: Types.ObjectId;
}

@Injectable()
export class RedisService {
  EXPIRE_TIME_GENERAL_DATA = 3600; // 1 hour
  EXPIRE_TIME_ONLINE_USERS = 3600; // 1 hour

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
        this.EXPIRE_TIME_GENERAL_DATA,
        JSON.stringify(freshData),
      );

      return freshData;
    } catch (error) {
      if (error instanceof HttpException) throw error;
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
          this.EXPIRE_TIME_GENERAL_DATA,
          JSON.stringify(parsedData),
        );
      }

      // Return only the new data
      return newData;
    } catch (error) {
      if (error instanceof HttpException) throw error;
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
        if (!Array.isArray(parsedData)) {
          if (Array.isArray(parsedData?.[key.split('?')[0]])) {
            parsedData = parsedData[key.split('?')[0]];
          } else {
            parsedData = [];
          }
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

        if (!Array.isArray(JSON.parse(cacheData))) {
          parsedData = {
            ...JSON.parse(cacheData),
            [key.split('?')[0]]: parsedData,
          };
        }

        // Update the cache with the modified array
        await this.redis.setex(
          key,
          this.EXPIRE_TIME_GENERAL_DATA,
          JSON.stringify(parsedData),
        );
      }

      // Return only the updated data
      return updatedData;
    } catch (error) {
      if (error instanceof HttpException) throw error;
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
          if (Array.isArray(parsedData?.[key.split('?')[0]])) {
            parsedData = parsedData[key.split('?')[0]];
          } else {
            return;
          }
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

        if (!Array.isArray(JSON.parse(cacheData))) {
          parsedData = {
            ...JSON.parse(cacheData),
            [key.split('?')[0]]: parsedData,
          };
        }

        await this.redis.setex(
          key,
          this.EXPIRE_TIME_GENERAL_DATA,
          JSON.stringify(parsedData),
        );
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
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
            this.EXPIRE_TIME_GENERAL_DATA,
            JSON.stringify(parsedData),
          );
        }
      }

      // Return only the deleted data
      return deletedData;
    } catch (error) {
      if (error instanceof HttpException) throw error;
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
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        `An unexpected error occured. Please try again later!`,
      );
    }
  }

  // Add user to the online users redis set
  async connectUser(userId: string): Promise<void> {
    try {
      await this.redis.sadd(
        'onlineUsers',
        userId,
        this.EXPIRE_TIME_ONLINE_USERS,
      );
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
        'An unexpected error occured. Please try again later!',
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
        `User status not found. Please try again later!`,
      );
    }
  }

  /**
   * Populates the call object with the SDP and ICE candidates for each participant
   */
  async formatCallForUser(call: CallDto): Promise<CallDto> {
    const participants = await Promise.all(
      call.participants.map(async (participant) => {
        const offers = await Promise.all(
          participant.offers.map(async (offer) => {
            const [sdp, iceCandidates] = await Promise.all([
              this.getSDP(participant.userId._id.toString(), offer.to, 'offer'),
              this.getIce({
                from: participant.userId._id.toString(),
                to: offer.to,
                type: 'offer',
              }),
            ]);
            return { ...offer, sdp, iceCandidates };
          }),
        );

        const answers = await Promise.all(
          participant.answers.map(async (answer) => {
            const [sdp, iceCandidates] = await Promise.all([
              this.getSDP(
                participant.userId._id.toString(),
                answer.to,
                'answer',
              ),
              this.getIce({
                from: participant.userId._id.toString(),
                to: answer.to,
                type: 'answer',
              }),
            ]);
            return { ...answer, sdp, iceCandidates };
          }),
        );

        return {
          ...participant,
          offers,
          answers,
        };
      }),
    );

    return {
      ...call,
      participants,
    };
  }

  /**
   * Retrieves the call object from Redis and formats it for the user
   */
  async getFormattedCall(chatId: string) {
    try {
      const call = await this.redis.hgetall(`call:${chatId}`);
      if (Object.keys(call).length === 0) return null;
      call.chatId = JSON.parse(call.chatId);
      call.participants = JSON.parse(call.participants);

      return await this.formatCallForUser(call as unknown as CallDto);
    } catch (error) {
      throw new NotFoundException('Call not found.');
    }
  }

  /**
   * Retrieves the call object from Redis and returns it as is
   */
  async getUnformattedCall(chatId: string): Promise<CallDto> {
    try {
      const call = await this.redis.hgetall(`call:${chatId}`);
      if (Object.keys(call).length === 0) return null;
      call.chatId = JSON.parse(call.chatId);
      call.participants = JSON.parse(call.participants);

      return call as unknown as CallDto;
    } catch (error) {
      throw new NotFoundException('Call not found.');
    }
  }

  async setCall(chatId: string, call: CallDto) {
    try {
      const formattedCall = {
        ...call,
        participants: JSON.stringify(call.participants),
        chatId: JSON.stringify(call.chatId),
      };
      await this.redis.hset(`call:${chatId}`, formattedCall);
    } catch (error) {
      throw new InternalServerErrorException(
        `An unexpected error occured. Please try again later!`,
      );
    }
  }

  async deleteCall(chatId: string) {
    try {
      const call = await this.getUnformattedCall(chatId);
      await this.deleteAllIceAndSDPForCall(call.participants);

      await this.redis.del(`call:${chatId}`);
    } catch (error) {
      throw new InternalServerErrorException(
        `An unexpected error occured. Please try again later!`,
      );
    }
  }

  async addIce({
    from,
    to,
    type,
    iceCandidates,
  }: {
    from: string;
    to: string;
    type: string;
    iceCandidates: any;
  }) {
    try {
      await this.redis.rpush(`ice:${from}:${to}:${type}`, iceCandidates);
    } catch (error) {
      throw new InternalServerErrorException(
        `An unexpected error occured. Please try again later!`,
      );
    }
  }

  async getIce({ from, to, type }: { from: string; to: string; type: string }) {
    try {
      const ice = await this.redis.lrange(`ice:${from}:${to}:${type}`, 0, -1);
      return ice;
    } catch (error) {
      throw new InternalServerErrorException(
        `An unexpected error occured. Please try again later!`,
      );
    }
  }

  async addOrReplaceSDP(userId: string, to: string, sdp: string, type: string) {
    try {
      await this.redis.set(`sdp:${userId}:${to}:${type}`, sdp);
    } catch (error) {
      throw new InternalServerErrorException(
        `An unexpected error occured. Please try again later!`,
      );
    }
  }

  async getSDP(userId: string, to: string, type: string) {
    try {
      return await this.redis.get(`sdp:${userId}:${to}:${type}`);
    } catch (error) {
      throw new InternalServerErrorException(
        `An unexpected error occured. Please try again later!`,
      );
    }
  }

  async deleteOtherParticipantsIceAndSDPForParticipant(
    otherParticipants: CallDto['participants'],
    toUser: CallDto['participants'][number],
  ) {
    try {
      const delKeys: string[] = [];

      otherParticipants.forEach((participant) => {
        delKeys.push(
          `ice:${participant.userId._id}:${toUser.userId._id}:offer`,
        );
        delKeys.push(
          `sdp:${participant.userId._id}:${toUser.userId._id}:offer`,
        );
        delKeys.push(
          `ice:${participant.userId._id}:${toUser.userId._id}:answer`,
        );
        delKeys.push(
          `sdp:${participant.userId._id}:${toUser.userId._id}:answer`,
        );
      });

      if (delKeys.length > 0) {
        await this.redis.del(delKeys);
      }
    } catch (error) {
      throw new InternalServerErrorException(
        `An unexpected error occured. Please try again later!`,
      );
    }
  }

  async deleteIceAndSDPForParticipant(
    participant: CallDto['participants'][number],
  ) {
    try {
      const delKeys = await this.generateDeleteKeys([participant]);

      if (delKeys.length > 0) {
        await this.redis.del(delKeys);
      }
    } catch (error) {
      throw new InternalServerErrorException(
        `An unexpected error occurred. Please try again later!`,
      );
    }
  }

  async deleteAllIceAndSDPForCall(participants: CallDto['participants']) {
    try {
      const delKeys = await this.generateDeleteKeys(participants);

      if (delKeys.length > 0) {
        await this.redis.del(delKeys);
      }
    } catch (error) {
      throw new InternalServerErrorException(
        `An unexpected error occurred. Please try again later!`,
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
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        `An unexpected error occured. Please try again later!`,
      );
    }
  }

  /**
   * Helper function to generate an array of Redis keys to delete for a given participant.
   * Includes the ICE candidates and SDP for each offer and answer
   */
  private async generateDeleteKeys(participants: CallDto['participants']) {
    const delKeys: string[] = [];

    participants.forEach((participant) => {
      participant.offers.forEach((offer) => {
        delKeys.push(`ice:${participant.userId._id}:${offer.to}:offer`);
        delKeys.push(`sdp:${participant.userId._id}:${offer.to}:offer`);
      });
      participant.answers.forEach((answer) => {
        delKeys.push(`ice:${participant.userId._id}:${answer.to}:answer`);
        delKeys.push(`sdp:${participant.userId._id}:${answer.to}:answer`);
      });
    });
    return delKeys;
  }
}
