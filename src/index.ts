import express, {
    type Request,
    type Response,
    type NextFunction,
} from "express";
import { client, subscriber, connectRedis, pool } from "./client.ts";

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
    // "$" means "only new messages from now on"
    let lastId = "$";

    console.log("Worker is listening to new orders");

    while (true) {
        try {
            await pool.ping();
            const response = (await workerClient.xRead(
                [
                    {
                        key: key,
                        id: lastId,
                    },
                ],
                {
                    BLOCK: 0, // 0 = Wait forever until a message arrives
                    COUNT: 1, // Process 1 message at a time
                },
            )) as any;

            if (response) {
                const streamData = response[0];
                const messages = streamData.messages;

                for (const msg of messages) {
                    console.log(`Processing order: ${msg.id}`);
                    console.log(
                        `Product: ${msg.message.productId}, Qty: ${msg.message.quantity}`,
                    );

                    // move the cursor so we don't read the same data again
                    lastId = msg.id;
                }
            }
        } catch (error) {
            console.log("Stream error: ", error);
            return new Promise((resolve) => setTimeout(resolve, 1000));
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
