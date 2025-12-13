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
        res.status(429);
    } else {
        next();
    }
};

app.use(rateLimiter);

app.get("/products", async (req: Request, res: Response) => {
    res.json({ message: "Here is the product feed" });
});

app.listen(3000, () => {
    console.log(`server running on port: 3000`);
});
