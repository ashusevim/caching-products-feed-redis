import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

const password = process.env['PASSWORD'];
const host = process.env['HOST'];

if (!password || !host) {
	throw new Error("All fields are required!!");
}

const client = createClient({
	username: "default",
	password: password,
	socket: {
		host: host,
		port: 14032,
	},
});

client.on("error", (error) => {
	console.log("redis client error", error);
});

export default client;
