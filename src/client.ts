import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

const password = process.env['PASSWORD'];
const host = process.env['HOST'];
const port = process.env['PORT'] ? parseInt(process.env['PORT'], 10) :  14302

if (!password || !host) {
	throw new Error("PASSWORD and HOST are not found");
}

const client = createClient({
	username: "default",
	password: password,
	socket: {
		host: host,
		port: port,
	},
});



const subscriber = client.duplicate()

client.on("error", (error) => {
	console.log("normal client error", error);
});

subscriber.on("error", (error) => {
	console.log("subscriber client error", error);
})

const connectRedis = async () => {
    if(!client.isOpen) await client.connect();
    if(!subscriber.isOpen) await subscriber.connect();
}

export { client, subscriber, connectRedis};
