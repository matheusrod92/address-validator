import { StatusCodes } from "http-status-codes";

import type { AddressValidationResponse, Provider } from "@/api/address/addressModel";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { googleService } from "@/common/services/googleService";
import { smartyService } from "@/common/services/smartyService";
import { logger } from "@/server";

export class AddressService {
	/**
	 * Validates an address using the specified provider or automatic fallback
	 * @param address - The address string to validate
	 * @param provider - Optional provider preference ("google" | "smarty")
	 * @returns ServiceResponse with AddressValidationResponse
	 */
	async validateAddress(
		address: string,
		provider?: Provider,
	): Promise<ServiceResponse<AddressValidationResponse | null>> {
		try {
			if (provider === "google") {
				return await this.validateWithGoogle(address);
			}

			if (provider === "smarty") {
				return await this.validateWithSmarty(address);
			}

			return await this.validateWithFallback(address);
		} catch (ex) {
			const errorMessage = `Error validating address: ${(ex as Error).message}`;
			logger.error(errorMessage);
			return ServiceResponse.failure(
				"An error occurred while validating the address.",
				null,
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
		}
	}

	private async validateWithFallback(address: string): Promise<ServiceResponse<AddressValidationResponse | null>> {
		try {
			const googleResponse = await this.validateWithGoogle(address);

			if (googleResponse.success && googleResponse.responseObject?.status === "UNVERIFIABLE") {
				logger.info("Google returned UNVERIFIABLE, attempting Smarty fallback");
				try {
					return await this.validateWithSmarty(address);
				} catch (smartyError) {
					logger.warn(`Smarty fallback failed: ${(smartyError as Error).message}`);
					return googleResponse;
				}
			}

			return googleResponse;
		} catch (googleError) {
			logger.warn(`Google service failed, attempting Smarty fallback: ${(googleError as Error).message}`);
			try {
				return await this.validateWithSmarty(address);
			} catch (smartyError) {
				throw new Error(
					`Both providers failed - Google: ${(googleError as Error).message}, Smarty: ${(smartyError as Error).message}`,
				);
			}
		}
	}

	private async validateWithGoogle(address: string): Promise<ServiceResponse<AddressValidationResponse | null>> {
		try {
			const result = await googleService.validateAddress(address);

			const response: AddressValidationResponse = {
				input: address,
				standardized: result.standardized,
				status: result.status,
				corrections: result.corrections,
				provider: "google",
				warnings: result.warnings,
			};

			return ServiceResponse.success<AddressValidationResponse>("Address validated successfully", response);
		} catch (error) {
			logger.error(`Google validation error: ${(error as Error).message}`);
			throw error;
		}
	}

	private async validateWithSmarty(address: string): Promise<ServiceResponse<AddressValidationResponse | null>> {
		try {
			const result = await smartyService.validateAddress(address);

			const response: AddressValidationResponse = {
				input: address,
				standardized: result.standardized,
				status: result.status,
				corrections: result.corrections,
				provider: "smarty",
				warnings: result.warnings,
			};

			return ServiceResponse.success<AddressValidationResponse>("Address validated successfully", response);
		} catch (error) {
			logger.error(`Smarty validation error: ${(error as Error).message}`);
			throw error;
		}
	}
}

export const addressService = new AddressService();
