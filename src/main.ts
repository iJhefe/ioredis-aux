import Ioredis from "./ioredis";
import { RedisOptions } from "ioredis";

export type Idable<T> = {
    [key in keyof T | "id"]?: any;
};

export type WhereOperator<T> = { [key in keyof T]?: number | string };

export type FindOperator = "AND" | "OR" | "NOT";

export interface DeleteOptions<T> {
    where: WhereOperator<T>;
}

export interface findOptions<T> {
    where: WhereOperator<T>;
    operator?: FindOperator;
}

export default class IoredisAux extends Ioredis {
    constructor(options: RedisOptions) {
        super(options);
    }

    public async find<T>(key: string, options: findOptions<T>): Promise<T[]> {
        try {
            const { where, operator } = options;

            const memoized = await this.getAll<T[]>(key);

            if (memoized) {
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
        options: findOptions<T>,
    ): Promise<T | false> {
        try {
            const { where, operator } = options;

            const memoized = await this.getAll<T[]>(key);

            if (memoized) {
                const findFn = this.findJoinFn<T>(where, operator);
                return memoized.find(findFn) || false;
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
            const exists = await this.findOne(key, {
                where: comparator,
                operator: "AND",
            });

            if (exists) {
                const withoutCurrent = await this.find<T>(key, {
                    where: comparator,
                    operator: "NOT",
                });

                return this.memoize<T>(key, [obj, ...withoutCurrent]);
            } else {
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
                const index = items.findIndex((i) => i.id === idOrOptions);

                // Item exist
                if (index >= 0) {
                    items.splice(index, 1);

                    await this.memoize(key, items);
                }

                return true;
            } else {
                const { where } = idOrOptions;

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

        switch (operator) {
            case "AND":
                return this._findOperatorAnd<T>(keys, where);
            case "OR":
                return this._findOperatorOr<T>(keys, where);
            case "NOT":
                return this._findOperatorNot<T>(keys, where);
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

    private _findOperatorNot<T>(
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

    public memoize<T>(key: string, obj: T[]) {
        if (!Array.isArray(obj)) {
            throw new Error("You should memoize just arrays");
        }

        return this.set(key, obj);
    }
}