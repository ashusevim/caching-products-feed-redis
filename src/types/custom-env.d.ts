import { NodeJS } from "@types/node";

interface ImportMetaEnv {
	PASSWORD: string;
	USERNAME: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

interface NodeJS {
	process: {
		env: {
			PASSWORD: string;
			HOST: string;
		};
	};
}
