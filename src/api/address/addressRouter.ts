import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";
import { StatusCodes } from "http-status-codes";

import { addressController } from "@/api/address/addressController";
import {
	AddressValidationResponseSchema,
	ErrorResponseSchema,
	ValidateAddressRequestSchema,
} from "@/api/address/addressModel";
import { createDirectApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { validateRequest } from "@/common/utils/httpHandlers";

export const addressRegistry = new OpenAPIRegistry();
export const addressRouter: Router = express.Router();

addressRegistry.register("AddressValidationResponse", AddressValidationResponseSchema);
addressRegistry.register("ErrorResponse", ErrorResponseSchema);

addressRegistry.registerPath({
	method: "post",
	path: "/validate-address",
	tags: ["Address"],
	request: {
		body: {
			content: {
				"application/json": {
					schema: ValidateAddressRequestSchema.shape.body,
				},
			},
		},
	},
	responses: {
		...createDirectApiResponse(AddressValidationResponseSchema, "Address validated successfully", StatusCodes.OK),
		...createDirectApiResponse(ErrorResponseSchema, "Validation error", StatusCodes.BAD_REQUEST),
		...createDirectApiResponse(ErrorResponseSchema, "Server error", StatusCodes.INTERNAL_SERVER_ERROR),
		...createDirectApiResponse(ErrorResponseSchema, "Service unavailable", StatusCodes.SERVICE_UNAVAILABLE),
	},
});

addressRouter.post("/", validateRequest(ValidateAddressRequestSchema), addressController.validateAddress);
