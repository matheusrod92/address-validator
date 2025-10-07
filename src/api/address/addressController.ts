import type { Request, RequestHandler, Response } from "express";

import { addressService } from "@/api/address/addressService";

class AddressController {
	public validateAddress: RequestHandler = async (req: Request, res: Response) => {
		const { address, provider } = req.body;
		const serviceResponse = await addressService.validateAddress(address, provider);
		res.status(serviceResponse.statusCode).send(serviceResponse);
	};
}

export const addressController = new AddressController();
