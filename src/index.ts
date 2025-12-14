import express, { Request, Response, NextFunction } from "express";
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

    const cachedData = await client.get(key);

    if (cachedData) {
        const data = JSON.parse(cachedData);
        return res.status(200).json(data);
    } else {
        try {
            const db_data = await getProductFeedFromDB();
            await client.set(key, String(db_data));
            await client.expire(key, 30);
            return res.status(300).json(db_data);
        } catch (error) {
            console.log("Error fetching data from the DB", error);
        }
    }
});

app.listen(3000, () => {
    console.log(`server running on port: 3000`);
});
