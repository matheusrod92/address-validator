import type { Request, RequestHandler, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { addressService } from "@/api/address/addressService";
import { logger } from "@/server";

class AddressController {
	public validateAddress: RequestHandler = async (req: Request, res: Response) => {
		const { address, provider } = req.body;

		try {
			const result = await addressService.validateAddress(address, provider);
			res.status(StatusCodes.OK).json(result);
		} catch (error) {
			const errorMessage = (error as Error).message;
			logger.error(`Address validation error: ${errorMessage}`);

			if (errorMessage.includes("not configured properly")) {
				res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
					error: "Service temporarily unavailable",
					details: [errorMessage],
				});
			} else if (errorMessage.includes("Both providers failed")) {
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
					error: "Unable to validate address",
					details: [errorMessage],
				});
			} else {
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
					error: "An error occurred while validating the address",
					details: [errorMessage],
				});
			}
		}
	};
}

export const addressController = new AddressController();
