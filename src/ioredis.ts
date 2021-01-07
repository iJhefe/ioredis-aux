import Redis from "ioredis";

export default class Ioredis {
    protected redis: Redis.Redis;

    constructor(options: Redis.RedisOptions) {
        this.start(options);
    }

    protected start(options: Redis.RedisOptions): Redis.Redis {
        return (this.redis = new Redis(options));
    }

    protected async set(
        key: string,
        value: unknown,
        expireMode?: "EX" | "PX",
        expiresIn?: number,
    ): Promise<boolean> {
        try {
            if (expireMode && expiresIn) {
                return !!(await this.redis.set(
                    key,
                    JSON.stringify(value),
                    expireMode,
                    expiresIn,
                ));
            }

            return !!(await this.redis.set(key, JSON.stringify(value)));
        } catch (e) {
            throw new Error(e);
        }
    }

    protected async getAll<T>(key: string): Promise<T> {
        try {
            const getted = await this.redis.get(key);
            return JSON.parse(getted) as T;
        } catch (e) {
            throw new Error(e);
        }
    }
}
