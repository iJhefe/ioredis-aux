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

(async () => {
    const objetoExemplo: Entity = { id: 1, username: "Jeffyter" };

    const memoized = await ioredis.saveOrUpdate<Entity>(KEY, objetoExemplo, {
        id: 1,
    });

    if (memoized) {
        const search = await ioredis.findOne<Entity>(KEY, 1);

        console.log(search);


        // await ioredis.delete<Entity>(KEY, {
        //     where: {
        //         username: "Jeffyter",
        //         id: 2,
        //     },
        // });

        // Will find the id 1
        const searchTwo = await ioredis.find<Entity>(KEY, {
            where: {
                id: 1,
                username: 'Jeffyter'
            },
            operator: 'NOT_OR'
        });

        console.log(searchTwo);
    }
})();
