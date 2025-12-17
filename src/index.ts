import express, {
    type Request,
    type Response,
    type NextFunction,
} from "express";
import { client, subscriber, connectRedis } from "./client.ts";

const app = express();
app.use(express.json());

await connectRedis();

// to check if the line reaches here
console.log("Subscribing to product_updates...");

await subscriber.subscribe("product_updates", async (message) => {
    console.log(`Update Received: ${message}`);
    // delete the old data immediately
    await client.del("products_feed");

    console.log("Cache cleared!. ");
});

const processOrders = async () => {
    const workerClient = client.duplicate();
    await workerClient.connect();

    const key = "order_stream";
    const group = "our_app_group";
    const consumerName = `worker_${Math.random().toString(36).substring(7)}`; // UUID or pod name in production

    console.log(`Group worker starting as: ${consumerName}`);

    try {
        await workerClient.xGroupCreate(key, group, "$", { MKSTREAM: true });
        console.log("created consumer group!");
    } catch (error) {}

    while (true) {
        try {
            const response = (await workerClient.xReadGroup(
                group,
                consumerName,
                [
                    {
                        key: key,
                        id: ">", // > meaning giving new undelivered messages
                    },
                ],
                {
                    BLOCK: 0, // wait forever
                    COUNT: 1,
                },
            )) as any;

            if (response) {
                const myStream = response[0];

                for (const msg of myStream.messages) {
                    console.log(`Processing order: ${msg.id}`);
                    console.log(`Product: ${msg.message.productId}`);

                    // simulating DB processing time for tasks like Save to DB, email user
                    await new Promise((r) => setTimeout(r, 1000));

                    await workerClient.xAck(key, group, msg.id);
                    console.log(`Acknowledged: ${msg.id}`);
                }
            }
        } catch (error) {
            console.log("Worker error: ", error);
        }
    }
};

const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
    // we would be using user ip address as the unique identifier
    const userIP = req.ip;
    const key = `rate_limit:${userIP || "127.0.0.1"}`;

    // 1. Increment the key (INCR)
    // 2. If it's the first request, set the expiry to 60s (EXPIRE)
    // 3. If the count > 10, return a 429 error
    // 4. Otherwise, allow the request (next())

    try {
        const requestCount = await client.incr(key);

        if (requestCount == 1) {
            await client.expire(key, 60);
            next();
        } else if (requestCount > 10) {
            res.status(429).json({
                message: "too many requests",
            });
        } else {
            next();
        }
    } catch (error) {
        next(error);
    }
};

app.use(rateLimiter);

// DB simulation (I don't wanted to set the database and all just to learn REDIS)
const getProductFeedFromDB = async () => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve([
                { id: 1, name: "iPhone 15", price: 899 },
                { id: 2, name: "MacBook Pro", price: 1999 },
            ]);
        }, 2000);
    });
};

/*  ask the Redis for the data
    if HIT -> return it immediately
    if MISS -> fetch the data from the DB, store in cache and then return it
*/
app.get("/products", async (_req: Request, res: Response) => {
    const key = "products_feed";

    try {
        const cachedData = await client.get(key);

        if (cachedData) {
            console.log("Cache HIT");
            res.status(200).json(JSON.parse(cachedData));
            // stop the execution as we got the data from the cache
            return;
        }

        console.log("Cache MISS");
        const db_data = await getProductFeedFromDB();

        await client.setEx(key, 60, JSON.stringify(db_data));

        res.status(200).json(db_data);
    } catch (error) {
        console.log("Server error");
        res.status(500).json({
            message: "Internal server error",
        });
    }
});

app.post("/orders", async (req: Request, res: Response) => {
    const { productId, quantity } = req.body;

    if (!productId || !quantity) {
        console.log("ProductId or quantity are missing!");
        res.status(400).json({
            message: "productid or quantity are missing!",
        });
    }

    try {
        const orderDetails = await client.xAdd("order_stream", "*", {
            productId: String(productId),
            quantity: String(quantity),
        });

        res.status(201).json({
            message: "Order Received Successfully",
            orderId: orderDetails,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "could not process order",
        });
    }
});

app.listen(3000, () => {
    console.log(`server running on port: 3000`);
});

processOrders();
