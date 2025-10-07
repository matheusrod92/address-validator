import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
	NODE_ENV: z.enum(["development", "production", "test"]).default("production"),

	HOST: z.string().min(1).default("localhost"),

	PORT: z.coerce.number().int().positive().default(8080),

	CORS_ORIGIN: z.string().url().default("http://localhost:8080"),

	COMMON_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(1000),

	COMMON_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(1000),

	GOOGLE_API_KEY: z
		.string()
		.min(1)
		.default("test-google-key")
		.refine(
			(val) => process.env.NODE_ENV === "test" || !val.startsWith("test-"),
			"GOOGLE_API_KEY: Real API key required in production (test key detected)",
		),

	SMARTY_AUTH_ID: z
		.string()
		.min(1)
		.default("test-smarty-id")
		.refine(
			(val) => process.env.NODE_ENV === "test" || !val.startsWith("test-"),
			"SMARTY_AUTH_ID: Real auth ID required in production (test value detected)",
		),

	SMARTY_AUTH_TOKEN: z
		.string()
		.min(1)
		.default("test-smarty-token")
		.refine(
			(val) => process.env.NODE_ENV === "test" || !val.startsWith("test-"),
			"SMARTY_AUTH_TOKEN: Real auth token required in production (test value detected)",
		),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
	console.error("❌ Invalid environment variables:", parsedEnv.error.format());
	throw new Error("Invalid environment variables");
}

export const env = {
	...parsedEnv.data,
	isDevelopment: parsedEnv.data.NODE_ENV === "development",
	isProduction: parsedEnv.data.NODE_ENV === "production",
	isTest: parsedEnv.data.NODE_ENV === "test",
};
