import IoredisClient, { RedisOptions, RedisClient } from "./ioredisClient";
import debug from 'debug'

const log = debug('IoredisAux')

type Idable<T> = {
    [key in keyof T | "id"]?: any;
};

type WhereOperator<T> = { [key in keyof T | 'id']?: number | string };

type FindOperator = "AND" | "OR" | "NOT" | "NOT_AND" | "NOT_OR";

interface DeleteOptions<T> {
    where: WhereOperator<T>;
}

interface FindOptions<T> {
    where: WhereOperator<T>;
    operator?: FindOperator;
}

export default class IoredisAux extends IoredisClient {
    constructor(options: RedisOptions) {
        super(options);
    }

    public memoize<T>(key: string, obj: T[]) {
        if (!Array.isArray(obj)) {
            throw new Error("You should memoize just arrays");
        }

        log('saving', key, obj)

        return this.set(key, obj);
    }

    public async findOrCreate<T>(key: string, options: FindOptions<T>, createFn: () => T[] | T, comparator: WhereOperator<T> = { id: options.where?.id}): Promise<T[] | T> {
        try {
            log('finding', key, options)
            const finded = await this.find<T>(key, options);

            if (finded.length === 0) {
                log('not found, creating new...')
                const created = createFn();

                log('created', created)

                if (Array.isArray(created)) {
                    for (const item of created) {
                        await this.saveOrUpdate(key, item, comparator);
                    }
                } else {
                    await this.saveOrUpdate<T>(key, created, comparator);
                }

                return created;
            }

            log('finded', finded)
            return finded;
        } catch (e) {
            throw new Error(e)
        }
    }

    public async find<T>(key: string, options: FindOptions<T>): Promise<T[]> {
        try {
            const { where, operator } = options;

            const memoized = await this.getAll<T[]>(key);

            if (memoized && !(memoized instanceof IoredisClient)) {
                const filterFn = this.findJoinFn<T>(where, operator);
                return memoized.filter(filterFn);
            }

            return [];
        } catch (e) {
            throw new Error(e);
        }
    }

    public async findOne<T>(
        key: string,
        idOrOptions: number | FindOptions<T>,
    ): Promise<T | false> {
        try {
            const memoized = await this.getAll<T[]>(key);

            if (memoized) {
                if (typeof idOrOptions === 'number') {
                    const findFn = this.findJoinFn<T>({ id: idOrOptions });
                    return memoized.find(findFn) || false;
                } else {
                    const { where, operator } = idOrOptions;
                    const findFn = this.findJoinFn<T>(where, operator);
                    return memoized.find(findFn) || false;
                }
            }

            return false;
        } catch (e) {
            throw new Error(e);
        }
    }

    public async saveOrUpdate<T>(
        key: string,
        obj: T,
        comparator: WhereOperator<T>,
    ) {
        try {
            log('saving', key, obj, comparator)

            const exists = await this.findOne(key, {
                where: comparator,
                operator: "AND",
            });

            if (exists) {
                log('exists, replacing...')

                const withoutCurrent = await this.find<T>(key, {
                    where: comparator,
                    operator: "NOT",
                });

                return this.memoize<T>(key, [obj, ...withoutCurrent]);
            } else {
                log('dont exists, saving new...')

                const items = (await this.getAll<T[]>(key)) || [];

                return this.memoize<T>(key, [obj, ...items]);
            }
        } catch (e) {
            throw new Error(e);
        }
    }

    public async delete<T>(
        key: string,
        idOrOptions: number | DeleteOptions<T>,
    ) {
        try {
            const items = await this.getAll<Array<Idable<T>>>(key);

            if (typeof idOrOptions === "number") {
                log('deleting as id...');
                const index = items.findIndex((i) => i.id === idOrOptions);

                // Item exist
                if (index >= 0) {
                    items.splice(index, 1);

                    log('found and deleted')

                    await this.memoize(key, items);
                }

                log('an item with key', key, 'and id', idOrOptions, 'not found, returning true')
                return true;
            } else {
                const { where } = idOrOptions;

                log('deleting where', where)

                const filterFn = this.findJoinFn(where, "NOT");

                const filtred = items.filter(filterFn);

                return this.memoize(key, filtred);
            }
        } catch (e) {
            throw new Error(e);
        }
    }

    private findJoinFn<T>(
        where: unknown,
        operator?: FindOperator,
    ): (item: T) => boolean {
        const keys = Object.keys(where) as Array<keyof typeof where>;

        if (!operator) {
            operator = "AND";
        }

        switch (operator.toUpperCase()) {
            case "AND":
                return this._findOperatorAnd<T>(keys, where);
            case "OR":
                return this._findOperatorOr<T>(keys, where);
            case "NOT":
            case "NOT_AND":
                return this._findOperatorNotAnd<T>(keys, where);
            case "NOT_OR":
                return this._findOperatorNotOr<T>(keys, where);
            default:
                return this._findOperatorAnd<T>(keys, where);
        }
    }

    private _findOperatorAnd<T>(
        keys: string[] | number[],
        where: unknown,
    ): (item: T) => boolean {
        return (item: T) => {
            let is = true;

            keys.forEach((key) => {
                const value = where[key];

                is &&= item[key] === value;
            });

            return is;
        };
    }

    private _findOperatorNotAnd<T>(
        keys: string[] | number[],
        where: unknown,
    ): (item: T) => boolean {
        return (item: T) => {
            let is = true;

            keys.forEach((key) => {
                const value = where[key];

                is &&= item[key] !== value;
            });

            return is;
        };
    }

    private _findOperatorNotOr<T>(
        keys: string[] | number[],
        where: unknown,
    ): (item: T) => boolean {
        return (item: T) => {
            let is = true;

            keys.forEach((key) => {
                const value = where[key];

                is ||= item[key] !== value;
            });

            return is;
        };
    }

    private _findOperatorOr<T>(
        keys: string[] | number[],
        where: unknown,
    ): (item: T) => boolean {
        return (item: T) => {
            let is = true;

            keys.forEach((key) => {
                const value = where[key];

                is ||= item[key] === value;
            });

            return is;
        };
    }
}

export {
    Idable,
    WhereOperator,
    FindOperator,
    FindOptions,
    RedisClient,
    RedisOptions,
    DeleteOptions,
}
