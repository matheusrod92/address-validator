import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const ProviderEnum = z.enum(["google", "smarty"]);
export type Provider = z.infer<typeof ProviderEnum>;

export const ValidationStatusEnum = z.enum(["VALID", "CORRECTED", "UNVERIFIABLE"]);
export type ValidationStatus = z.infer<typeof ValidationStatusEnum>;

export const StandardizedAddressSchema = z.object({
	number: z.string().optional(),
	street: z.string().optional(),
	city: z.string().optional(),
	state: z.string().optional(),
	zip: z.string().optional(),
});
export type StandardizedAddress = z.infer<typeof StandardizedAddressSchema>;

export const AddressValidationResponseSchema = z.object({
	input: z.string(),
	standardized: StandardizedAddressSchema,
	status: ValidationStatusEnum,
	corrections: z.array(z.string()),
	provider: ProviderEnum,
	warnings: z.array(z.string()),
});
export type AddressValidationResponse = z.infer<typeof AddressValidationResponseSchema>;

export const ValidateAddressRequestSchema = z.object({
	body: z.object({
		address: z.string().min(1, "Address is required"),
		provider: ProviderEnum.optional(),
	}),
});
export type ValidateAddressRequest = z.infer<typeof ValidateAddressRequestSchema>;

export const ErrorResponseSchema = z.object({
	error: z.string(),
	details: z.array(z.string()).optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
