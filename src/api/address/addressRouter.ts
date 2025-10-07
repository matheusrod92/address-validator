import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";

import { addressController } from "@/api/address/addressController";
import {
	AddressValidationResponseSchema,
	ValidateAddressRequestSchema,
} from "@/api/address/addressModel";
import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { validateRequest } from "@/common/utils/httpHandlers";

export const addressRegistry = new OpenAPIRegistry();
export const addressRouter: Router = express.Router();

addressRegistry.register("AddressValidationResponse", AddressValidationResponseSchema);

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
	responses: createApiResponse(AddressValidationResponseSchema, "Success"),
});

addressRouter.post("/", validateRequest(ValidateAddressRequestSchema), addressController.validateAddress);
