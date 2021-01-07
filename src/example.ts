import IoredisAux from "./main";

const ioredis = new IoredisAux({
    host: "127.0.0.1",
    port: 6379,
    keyPrefix: "EX_",
});

interface Entity {
    id: number;
    username: string;
}

const KEY = "EXAMPLE";

const objectExample: Entity = { id: 1, username: "Jeffyter" };

const createFn = id => () => {
    return { id: id, username: 'User ' + id }
}

(async () => {
    let i = 0

    const memoized = await ioredis.saveOrUpdate<Entity>(KEY, objectExample, {
        id: 1,
    });

    await ioredis.findOrCreate(KEY, { where: { id: 2 } }, createFn(2))

    if (memoized) {
        const search = await ioredis.findOne<Entity>(KEY, { where: { id: 1 } });

        // await ioredis.delete<Entity>(KEY, {
        //     where: {
        //         username: "Jeffyter",
        //     },
        // });

        // Will find the id 1
        const searchTwo = await ioredis.find<Entity>(KEY, {
            where: {
                id: 1,
                username: 'Jeffyter'
            },
            operator: 'NOT'
        });

        console.log(searchTwo);
    }
})();
