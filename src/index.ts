import express, {
    type Request,
    type Response,
    type NextFunction,
} from "express";
import { createClient } from "redis";

const app = express();
const client = createClient();

await client.connect();

const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
    // we would be using user ip address as the unique identifier
    const userIP = req.ip;
    const key = `rate_limit:${userIP}`;

    // 1. Increment the key (INCR)
    // 2. If it's the first request, set the expiry to 60s (EXPIRE)
    // 3. If the count > 10, return a 429 error
    // 4. Otherwise, allow the request (next())
    const requestCount = await client.incr(key);

    if (requestCount == 1) {
        await client.expire(key, 60);
    } else if (requestCount > 10) {
        res.status(429).json({
            message: "too many requests",
        });
    } else {
        next();
    }
};

const getProductFeedFromDB = async () => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve([
                { id: 1, name: "iPhone 15", price: 999 },
                { id: 2, name: "MacBook Pro", price: 1999 },
            ]);
        }, 2000);
    });
};

app.use(rateLimiter);

app.get("/products", async (req: Request, res: Response) => {
    const key = "products_feed";

    // ask the Redis for the data
    // if HIT -> return it immediately
    // if MISS -> fetch the data from the DB, store in cache and then return it
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
        await client.setEx(key, 30, JSON.stringify(db_data));
        res.status(200).json(db_data);
    } catch (error) {
        console.log("Server error");
        res.status(500).json({
            message: "Internal server error",
        });
    }
});

app.listen(3000, () => {
    console.log(`server running on port: 3000`);
});
